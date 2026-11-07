# Analyse approfondie du système de plugins Vibe

> Rapport généré le 2026-10-29 après exploration complète du code source.

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture en couches](#2-architecture-en-couches)
3. [Cycle de vie complet d'un plugin](#3-cycle-de-vie-complet-dun-plugin)
4. [Le répertoire `vibe/plugins/` (data)](#4-le-répertoire-vibeplugins-data)
5. [Le moteur `vibe/core/plugins/` (code)](#5-le-moteur-vibecoreplugins-code)
6. [Côté Host : `vibe/app_server/_plugins.py`](#6-côté-host-vibeapp_server_pluginspy)
7. [Côté Session Runtime : harness plugins](#7-côté-session-runtime-harness-plugins)
8. [Côté Rust : harness/core](#8-côté-rust-harnesscore)
9. [Sécurité et validation](#9-sécurité-et-validation)
10. [Détection de drift et réconciliation](#10-détection-de-drift-et-réconciliation)
11. [Adapters foreign (Claude/Codex/Kimi/OpenCode)](#11-adapters-foreign-claudecodexkimiopencode)
12. [Interface utilisateur](#12-interface-utilisateur)
13. [Tests et qualité](#13-tests-et-qualité)
14. [Documentation et cohérence](#14-documentation-et-cohérence)
15. [Zones d'ombre et observations](#15-zones-dombre-et-observations)
16. [Glossaire](#16-glossaire)

---

## 1. Vue d'ensemble

Le système de plugins de Vibe est un mécanisme d'extension **package-based** suivant le standard **Agent Plugins 1.0** (`https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`). Il permet de distribuer des bundles comprenant :

- **Skills** (instructions spécialisées)
- **MCP servers** (outils via Model Context Protocol)
- **Hooks** (commandes shell sur événements de cycle de vie)
- **Knowledge** (dossiers de connaissances)
- **Agents** (sous-agents déclaratifs)
- **Libraries** (dépendances Node.js/Python)
- **Connectors** (outils de connecteurs managés)

### Principes directeurs (ADR 0007)

> *« Filesystem plugin packages are an optional backend capability rather than a required Vibe extension mechanism. »*

Les plugins sont une **capacité optionnelle du backend** — pas un mécanisme d'extension core. Seul le backend Unified Harness les supporte ; le legacy backend ne les traduit pas.

### Chiffres clés

| Métrique | Valeur |
|---|---|
| Fichiers Python dans `vibe/core/plugins/` | 22 |
| Lignes de code (plugins core) | ~9 100 |
| Fichiers dans `vibe/plugins/` (data) | 7 (2 `__init__.py` + 1 `plugin.json` + 4 `SKILL.md`) |
| Fichiers harness Python (plugins) | 3 |
| Formats supportés | 5 (natif + 4 foreign) |
| Namespaces réservés | 6 (`file_system`, `self`, `process`, `skill`, `subagent`, `vibe`) |
| Codes de diagnostic | 30 |
| Codes fatals | 11 |

---

## 2. Architecture en couches

```
┌─────────────────────────────────────────────────────────────────┐
│                    COUCHE UTILISATEUR                            │
│  /plugins  /reload-plugins  (slash commands, Unified Harness)    │
│  PluginsApp (Textual widget — liste, filtre, détail)            │
├─────────────────────────────────────────────────────────────────┤
│                    COUCHE HOST (Python)                          │
│  vibe/app_server/_plugins.py                                    │
│  ├── packaged_builtin_plugin_roots() → vibe/plugins/builtins/   │
│  ├── resolve_session_plugins() → resolve + materialize + snapshot│
│  ├── UnifiedPluginProvider (implémente le port Session Runtime) │
│  └── requested_plugin_definitions() → AgentConfig.plugins       │
├─────────────────────────────────────────────────────────────────┤
│                    COUCHE RÉSOLUTION (Core)                      │
│  vibe/core/plugins/                                             │
│  ├── _native.py       — PluginResolver (résolution native)       │
│  ├── _compatibility.py — détection format + adapters             │
│  ├── _claude.py       — ClaudePluginAdapter (834 lignes)        │
│  ├── _codex.py        — CodexPluginAdapter (746 lignes)         │
│  ├── _kimi.py         — KimiPluginAdapter (556 lignes)          │
│  ├── _foreign.py      — OpenCodePluginAdapter (1347 lignes)     │
│  ├── _materialize.py   — PluginMaterializer (connecte MCP/conn)  │
│  ├── _catalog.py       — build_tool_catalog (MCP → tools)       │
│  ├── _snapshot.py      — ResolvedPluginSnapshot (portable)      │
│  ├── _adapter.py       — build_snapshot (projection)             │
│  ├── _drift.py         — reconcile_plugin_routes (drift detect) │
│  ├── _naming.py        — tool group naming (déterministe)        │
│  ├── _paths.py         — PluginPathRef (portable paths)         │
│  ├── _canonical.py     — canonical JSON (RFC 8785)               │
│  ├── _content.py       — digest_plugin_tree (tree hashing)       │
│  ├── _redaction.py     — redaction secrets/URLs                  │
│  ├── _diagnostics.py    — PluginDiagnostic (30 codes)            │
│  ├── _snapshot.py      — snapshot models (frozen Pydantic)       │
│  ├── inspection.py      — inspect_plugin (CLI offline)           │
│  └── upstream_fixtures.py — conformance fixtures                 │
├─────────────────────────────────────────────────────────────────┤
│              COUCHE SESSION RUNTIME (Harness Python)             │
│  harness/.../vibe/plugins/                                      │
│  ├── _store.py    — PluginPackageStore (content-addressed)      │
│  └── _session.py  — SessionPluginBinder (create/restore/bind)   │
├─────────────────────────────────────────────────────────────────┤
│              COUCHE SESSION RUNTIME (Rust)                       │
│  harness/core/src/core/                                         │
│  ├── config.rs           — AgentConfig.plugins: Vec<PluginContext>│
│  ├── tools/resolved/assembly.rs — hook_tool_catalog (root+plugin)│
│  ├── prompt/context_snapshot.rs — plugin paths in system prompt  │
│  └── capabilities.rs     — RustHarnessCapabilitySet              │
└─────────────────────────────────────────────────────────────────┘
```

### Flux de données

```
Filesystem                    Mémoire                          Wire/Disk
──────────                    ───────                          ─────────
.vibe/plugins/    ──resolve──→ ResolvedPluginSet ──materialize→ MaterializedPluginSet
~/.vibe/plugins/              (Pydantic models)                  │
vibe/plugins/builtins/                                       build_snapshot
                                                             ▼
                                                    ResolvedPluginSnapshot
                                                    (portable, no paths,
                                                     no secrets, frozen)
                                                             │
                              ┌──────────────────────────────┤
                              ▼                              ▼
                    SessionPluginBinder.create        snapshot_bytes()
                    (pin → ingest → checkout → bind)   → sha256 digest
                              │                              │
                              ▼                              ▼
                    PluginLockV1                   stored as blob
                    (name + content_digest           in PluginPackageStore
                     per plugin + snapshot_digest)
                              │
                              ▼
                    SessionPluginBinder.restore
                    (checkout from digest → replay snapshot into bind)
                              │
                              ▼
                    RustPluginContextDefinition[]
                    → AgentConfig.plugins
                    → Rust Session Runtime
```

---

## 3. Cycle de vie complet d'un plugin

### Phase 1 : Découverte (`PluginResolver._builtin_plugin_dirs` / `_child_dirs`)

```
Sources (par ordre de précédence) :
  1. PROJECT  ← .vibe/plugins/  (dans chaque project root, trusted folder)
  2. GLOBAL   ← ~/.vibe/plugins/
  3. BUILTIN  ← vibe/plugins/builtins/  (embarqué dans le package)
```

Chaque sous-répertoire contenant un `plugin.json` est un candidat.

### Phase 2 : Résolution (`PluginResolver.resolve()`)

```
1. _load_scope(project_roots, PROJECT)   → liste de _PluginCandidate
2. _load_scope(user_roots, GLOBAL)       → liste de _PluginCandidate
3. _load_scope(builtin_dirs, BUILTIN)    → liste de _PluginCandidate
4. _select_by_precedence(project, user, builtin)
   → pour chaque nom : project > user > builtin
5. _remove_namespace_collisions()
   → deux plugins avec le même namespace = erreur (tous dropés)
6. _remove_same_scope_duplicates()
   → deux plugins avec le même nom au même scope = erreur
7. _remove_library_collisions()
   → alias de library identique entre plugins = les deux dropés
8. _remove_config_shadowed_mcp_servers()
   → un serveur MCP plugin qui partage un nom avec un serveur configuré
     est dropé (protection contre le vol de credentials)
```

Pour chaque candidat survivant, `_load_plugin()` :
- Détecte le format (`detect_plugin_source_format`)
- Si natif (Agent Plugins 1.0) → `_load_native_plugin()`
- Si foreign → adapter correspondant (`_claude.py`, `_codex.py`, etc.)
- Si builtin + foreign → rejeté (`_reject_builtin_foreign_format`)

### Phase 3 : Chargement des composants (`_load_native_plugin`)

```
plugin.json ──→ _PluginManifest (Pydantic, extra="forbid", strict=True)
                  ├── name: ^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$, 1-64 chars, no "--"/".."
                  ├── version, description, author, homepage, repository, license, keywords
                  └── extensions["ai.mistral.vibe"] → _VibePluginExtension
                        ├── schemaVersion: 1 (Literal)
                        ├── toolNamespace: TypeScript identifier
                        └── toolOverrides: {toolName: {name, exposure}}

skills/ ──────→ _load_skills_from_roots()
                  └── pour chaque skills/<name>/SKILL.md:
                        ├── parse frontmatter YAML → SkillMetadata
                        ├── nom doit matcher le nom du répertoire
                        ├── alias = "<namespace>:<name>"
                        └── SkillSource.PLUGIN

mcp.json ─────→ _load_mcp_servers()
                  └── _MCPConfiguration (stdio | streamable-http | sse)
                        ├── stdio: command (bare ou ./relatif), args, env, cwd
                        │         env: PLUGIN_ROOT/PLUGIN_DATA injectés auto
                        │         variables ${PLUGIN_ROOT}/${PLUGIN_DATA} expansées
                        ├── streamable-http: url + headers (static auth only)
                        └── sse: détecté mais non supporté (retourne None)
                        └── private_alias = "plugin_<blake2s(name\0source_id)[:8]>_<source_id>"

ai.mistral.vibe/hooks.toml ──→ _load_runtime_hooks()
                  └── max 128 hooks, max 64 Ko, noms uniques
                        ├── nom runtime = "<plugin>:<hook-name>"
                        ├── cwd = plugin.root
                        ├── env = {PLUGIN_ROOT, PLUGIN_DATA}
                        └── HookVisibility.PRIVATE

ai.mistral.vibe/knowledge/ ──→ _load_knowledge()
                  └── max 100 dossiers, KNOWLEDGE.md max 256 Ko
                        ├── nom frontmatter doit matcher nom du dossier
                        └── pas de symlinks, tout contenu dans plugin root

ai.mistral.vibe/agents/ ────→ _load_agents()
                  └── max 128 agents, fichier .toml max 64 Ko
                        ├── nom fichier: kebab-case
                        ├── safety: safe|neutral|destructive|yolo
                        ├── agentType: "subagent" (seul supporté)
                        └── nom runtime = "<namespace>:<stem>"

libraries.json ────────────→ _load_libraries()
                  └── {schemaVersion: 1, node: {alias: path}, python: {alias: path}}
                        ├── aliases Node: ^(?:@[a-z0-9].../)?[a-z0-9]...$ (max 214)
                        ├── aliases Python: ^[A-Za-z_][A-Za-z0-9_]*$ (max 128)
                        ├── chemins relatifs, ./ prefix, pas de .. ou symlinks
                        └── runtime_path = data_root/libraries/<digest>/<lang>/<alias>

connectors.json ───────────→ _load_connectors()
                  └── {schemaVersion: 1, connectors: [{id, tools[]}]}
                        └── max 128, ids uniques, tool names 1-256 chars
```

### Phase 4 : Matérialisation (`PluginMaterializer.materialize()`)

Exécuté en parallèle (asyncio.TaskGroup) :

```
┌─────────────────┐  ┌──────────────────┐  ┌────────────────────────┐
│  _materialize_  │  │  _materialize_   │  │  _materialize_tools()  │
│  knowledge()    │  │  libraries()     │  │  (MCP + connectors)    │
│  (thread)       │  │  (thread)        │  │  (async)               │
└────────┬────────┘  └────────┬─────────┘  └───────────┬────────────┘
         │                      │                        │
         ▼                      ▼                        ▼
   copie source_root    copie vers data_root      build_tool_catalog()
   → data_root/         (Node: node_modules/,     connecte MCP servers,
   knowledge/<name>/     Python: fichiers)         résout connectors,
                                                   produit tool_groups +
                                                   tool_routes
```

### Phase 5 : Snapshot (`build_snapshot()`)

Projection de `MaterializedPluginSet` → `ResolvedPluginSnapshot` :

```
Ce qui est conservé :              Ce qui est exclu :
────────────────────              ─────────────────
- PluginSnapshotEntry             - Chemins absolus (remplacés par PluginPathRef)
  (name, namespace, version,       - Définitions MCP (seul le catalogue d'outils
   source_format, manifest_digest)   en résultant est conservé)
- PluginSkillSnapshot             - Secrets (env values, headers, URL query)
  (name, description, path ref)    - Hook environment (sauf noms, pas valeurs)
- PluginKnowledgeSnapshot         - Configurations de serveurs MCP
- PluginAgentSnapshot             - Chemins de staging runtime
- PluginHookSnapshot
  (declared_name, source, protocol,
   visibility, order, config JSON)
- PluginLibrarySnapshot
- PluginConnectorSnapshot
- PluginToolGroupSnapshot
- PluginToolRouteSnapshot
  (avec schema_fingerprint)
```

Le snapshot est :
- **Frozen** (Pydantic `frozen=True`)
- **Portable** (pas de chemins absolus, POSIX relatif uniquement)
- **Sans secrets** (redaction appliquée)
- **Versionné** (`version: Literal[1]`)
- **Sérialisable** en canonical JSON (RFC 8785) → `snapshot_bytes()` → sha256

### Phase 6 : Pinning (`SessionPluginBinder.create()`)

```
1. Provider.pin(requested) → PinnedPlugins (name → root path)
2. Pour chaque plugin:
   store.ingest(root, expected=content_digest)
   → scanne l'arbre, écrit les blobs, écrit le manifest
   → vérifie que le digest correspond à celui déclaré
3. store.checkout(content_digest) → rebuild read-only tree
   → hard-links depuis les blobs, vérifie le digest
4. provider.bind(RestoredPlugins(checkouts)) → (snapshot_bytes, projection)
5. store.put_blob(snapshot_bytes) → snapshot_digest
6. Retourne SessionPluginBinding(lock=PluginLockV1(...), projection)
```

### Phase 7 : Restauration (`SessionPluginBinder.restore()`)

```
1. Pour chaque entrée dans lock.plugins:
   store.checkout(content_digest) → rebuild read-only tree
   (ne re-résout PAS depuis le disque, ne compare PAS avec le mounted actuel)
2. Lit le snapshot blob (snapshot_digest)
3. provider.bind(RestoredPlugins(snapshot=bytes, checkouts))
   → rejoue les bytes épinglés, ne re-digest pas
4. Retourne SessionPluginBinding
```

**Garantie clé** : *« Nothing here re-resolves an installed root, compares against what is mounted now, or digests what bind derives, so a resolver change can never fail a restore. »*

### Phase 8 : Exécution (Rust Session Runtime)

Le Rust runtime reçoit `AgentConfig.plugins: Vec<PluginContextDefinition>` :

```rust
pub struct PluginContextDefinition {
    pub name: String,
    pub description: String,
    pub path: String,           // chemin vers le checkout read-only
    pub capabilities: RustHarnessCapabilitySet,
}
```

Le runtime Rust :
- Lit les skills depuis `path/skills/<name>/SKILL.md`
- Lit les knowledge depuis `path/knowledge/<name>/KNOWLEDGE.md`
- Lit les agents depuis `path/agents/<name>.toml`
- Monte les tool groups MCP/connector déclarés dans le snapshot
- Injecte les chemins dans le system prompt (`context_snapshot.rs`)

---

## 4. Le répertoire `vibe/plugins/` (data)

### Structure

```
vibe/plugins/
├── __init__.py                  # Vide — package marker Python
└── builtins/
    ├── __init__.py              # Vide — package marker Python
    └── vibe/                    # Plugin "vibe" v1.0.0
        ├── plugin.json          # Manifeste Agent Plugins 1.0
        └── skills/              # 4 skills
            ├── vibe/SKILL.md
            ├── worktree/SKILL.md
            ├── skill-creator/SKILL.md
            └── create-plugin/SKILL.md
```

### `plugin.json`

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "vibe",
  "version": "1.0.0",
  "description": "Skills and components shipped with the Vibe CLI.",
  "author": { "name": "Mistral AI" },
  "extensions": {
    "ai.mistral.vibe": {
      "schemaVersion": 1,
      "toolNamespace": "vibe"
    }
  }
}
```

Particularités :
- **Namespace `vibe` réservé** — seul le scope BUILTIN peut l'utiliser (`_RESERVED_NAMESPACES - {"vibe"}` pour builtin)
- **Pas de `toolOverrides`** — aucun renommage d'outils
- **Pas de MCP, hooks, knowledge, agents, libraries, connectors** — uniquement des skills

### Les 4 skills embarquées

| Skill | `user-invocable` | Taille | Rôle |
|---|---|---|---|
| `vibe` | `false` | ~53 Ko | Référence auto-descriptive complète de Vibe |
| `worktree` | `true` | ~4,7 Ko | Gestion git worktrees sous `$VIBE_HOME/worktrees` |
| `skill-creator` | `true` | ~4,8 Ko | Guide création/modification/suppression de skills |
| `create-plugin` | `true` | ~12 Ko | Guide création de plugins Agent Plugins 1.0 |

### Dual-source : Python legacy vs Plugin

```
┌─────────────────────────────────┐    ┌──────────────────────────────────┐
│  vibe/core/skills/builtins/     │    │  vibe/plugins/builtins/vibe/     │
│  (Legacy Host — Python)         │    │  (Unified Harness — par défaut)  │
├─────────────────────────────────┤    ├──────────────────────────────────┤
│  vibe.py (69 Ko, inline)        │    │  skills/vibe/SKILL.md (~53 Ko)   │
│  skill_creator.py (5,3 Ko)      │    │  skills/skill-creator/SKILL.md   │
│                                 │    │  skills/worktree/SKILL.md        │
│                                 │    │  skills/create-plugin/SKILL.md   │
└─────────────────────────────────┘    └──────────────────────────────────┘
         │                                        │
         └──────► BUILTIN_SKILLS dict ◄───────────┘
              (tests/skills/test_builtin_sync.py)
```

**Différences clés** :
- `vibe.py` interpole `__version__` → URL README versionnée ; la copie plugin pointe vers `main`
- `worktree` et `create-plugin` existent **uniquement** dans le plugin (pas dans `vibe/core/skills/builtins/`)
- Le test `test_builtin_sync.py` vérifie : même nom, même description, même `user-invocable`

### Comment le plugin built-in est découvert

```python
# vibe/app_server/_plugins.py:101-108
def packaged_builtin_plugin_roots() -> list[Path]:
    """Discover built-in plugin directories shipped inside the package."""
    try:
        import vibe.plugins.builtins as _pkg
    except ImportError:
        return []
    return [Path(_pkg.__file__).parent]  # → vibe/plugins/builtins/
```

Puis dans `_native.py:506-530` :
```python
@property
def _builtin_plugin_dirs(self) -> list[Path]:
    dirs: list[Path] = []
    for root in self._builtin_roots:
        dirs.extend(sorted(
            (path for path in root.iterdir()
             if path.is_dir()
             and not path.name.startswith("__")
             and (path / "plugin.json").is_file()),
            key=lambda path: path.name,
        ))
    return dirs  # → [vibe/plugins/builtins/vibe]
```

---

## 5. Le moteur `vibe/core/plugins/` (code)

### Tableau des modules

| Module | Lignes | Rôle |
|---|---|---|
| `_native.py` | 2 127 | **Cœur** — PluginResolver, chargement natif, validation Pydantic |
| `_foreign.py` | 1 347 | OpenCodePluginAdapter (skills uniquement) |
| `_claude.py` | 834 | ClaudePluginAdapter (skills + MCP + hooks) |
| `_codex.py` | 746 | CodexPluginAdapter (skills + MCP) |
| `_catalog.py` | 557 | Connexion MCP/connecteurs → tool catalog |
| `_kimi.py` | 556 | KimiPluginAdapter (skills + MCP + hooks) |
| `inspection.py` | 522 | `inspect_plugin()` — inspection offline d'un plugin |
| `_materialize.py` | 385 | PluginMaterializer — copie knowledge/libraries, connecte tools |
| `_compatibility.py` | 319 | Détection format, types partagés, adapters protocol |
| `_adapter.py` | 285 | `build_snapshot()` — projection MaterializedPluginSet → snapshot |
| `_snapshot.py` | 270 | Modèles snapshot (frozen Pydantic), sérialisation |
| `upstream_fixtures.py` | 309 | Catalogue de fixtures upstream pour conformance |
| `_drift.py` | 149 | `reconcile_plugin_routes()`, `retain_pinned_tools()` |
| `_diagnostics.py` | 135 | `PluginDiagnostic`, 30 codes, tri, fatal/non-fatal |
| `_redaction.py` | 102 | Redaction secrets, URLs, argv, messages |
| `_naming.py` | 97 | Nommage déterministe des tool groups |
| `_content.py` | 70 | `digest_plugin_tree()` — hashing d'arbre |
| `_canonical.py` | 49 | Canonical JSON (RFC 8785), NFC normalization |
| `_paths.py` | 56 | `PluginPathRef`, `PluginPathOutsideRootError` |
| `__init__.py` | 232 | API publique (`__all__` explicite, lazy loading pour `_catalog`) |

### Modèles Pydantic clés (`_native.py`)

Tous les modèles de validation utilisent `ConfigDict(extra="forbid", strict=True)` :

```python
# Manifest (plugin.json)
class _PluginManifest(BaseModel):
    schema_id: Literal["https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"]
    name: str  # ^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$, 1-64, no "--"/".."
    version: str | None
    description: str | None
    author: _ManifestAuthor | None  # {name, email, url}
    # ...
    extensions: dict[str, object] | None

# Extension Vibe
class _VibePluginExtension(BaseModel):
    schema_version: Literal[1]  # alias: schemaVersion
    tool_namespace: str | None  # TypeScript identifier
    tool_overrides: dict[str, _ToolOverride]  # alias: toolOverrides

# MCP servers (mcp.json)
class _MCPStdioServer(BaseModel):
    type: Literal["stdio"]
    command: str  # bare executable ou ./relatif
    args: list[str]
    env: dict[str, str]  # PLUGIN_ROOT/PLUGIN_DATA réservés
    cwd: str | None  # ./relatif, ${PLUGIN_ROOT}, ${PLUGIN_DATA}

# Agents (ai.mistral.vibe/agents/*.toml)
class _PluginAgentDocument(BaseModel):
    schema_version: Literal[1]
    agent_type: Literal["subagent"]
    safety: Literal["safe", "neutral", "destructive", "yolo"] = "neutral"
    # ...
```

### Dataclasses de résultat

```python
@dataclass(frozen=True, slots=True)
class PluginDescriptor:
    name: str
    version: str | None
    description: str
    root: Path
    manifest_path: Path
    data_root: Path
    namespace: str
    scope: SkillScope  # PROJECT | GLOBAL | BUILTIN
    source_format: DetectedPluginFormat
    tool_overrides: Mapping[str, PluginToolOverride]
    manifest_digest: str
    content_digest: str
    author: str | None

@dataclass(frozen=True, slots=True)
class ResolvedPluginSet:
    plugins: tuple[PluginDescriptor, ...]
    skills: Mapping[str, SkillInfo]
    mcp_servers: tuple[PluginMCPServerDefinition, ...]
    runtime_hooks: tuple[RuntimeHookDefinition, ...]
    knowledge: tuple[PluginKnowledgeDefinition, ...]
    agents: tuple[PluginAgentDefinition, ...]
    libraries: tuple[PluginLibraryDefinition, ...]
    connectors: tuple[PluginConnectorDefinition, ...]
    issues: tuple[PluginConfigIssue, ...]
    unsupported_components: tuple[PluginUnsupportedComponent, ...]
```

### Algorithme de nommage des tool groups (`_naming.py`)

```python
def resolve_tool_group_names(identities, *, claimed):
    """
    Nommage déterministe : assigné depuis l'ensemble complet des identités,
    ordonné par clé brute (plugin_name\0source_id), pas par ordre de découverte.
    """
    # Si un seul contendant pour un base_name et non réclamé → base_name
    # Sinon → base_name + "_" + sha256(identity)[:8] (ou plus si collision)
```

Exemple : deux plugins déclarent tous deux un serveur MCP `figma` →
- `figma_a6729baf` et `figma_47646b90` (suffix = 8 premiers hex du sha256)

### Digest d'arbre (`_content.py` + harness `_store.py`)

Deux implémentations **identiques** (Host et Runtime doivent produire le même digest) :

```
Pour chaque entrée (triée par path POSIX NFC-normalisé) :
  file:    b"f" NUL <path> NUL <sha256(content)> NUL
  symlink: b"l" NUL <path> NUL <sha256(target)> NUL
  other:   b"o" NUL <path> NUL
```

- Mode bits exclus (Windows n'a pas de POSIX mode)
- Paths NFC-normalisés (macOS vs Linux identiques)
- Framing injectif (pas de collision file/symlink/path)

---

## 6. Côté Host : `vibe/app_server/_plugins.py`

### Fonctions principales

```python
def packaged_builtin_plugin_roots() -> list[Path]:
    """Retourne [vibe/plugins/builtins/] via import vibe.plugins.builtins"""

async def resolve_session_plugins(
    harness_files, *,
    config_orchestrator=None,
    plugin_mcp=None,
    connector_registry=None,
    builtin_plugin_roots=None,  # None → packaged_builtin_plugin_roots()
) -> SessionPlugins:
    """
    1. _resolve_installed() → PluginResolver.resolve() (dans un thread)
    2. _materialize() → PluginMaterializer.materialize()
    3. build_snapshot(materialized) → ResolvedPluginSnapshot
    """

def requested_plugin_definitions(plugins: SessionPlugins) -> list[ResolvedPluginDefinition]:
    """Projette vers AgentConfig.plugins (name, namespace, version, digests)"""
```

### `UnifiedPluginProvider` (implémente `SessionPluginProvider`)

```python
class UnifiedPluginProvider:
    """
    Quatre méthodes, une seule lit un répertoire installé (pin).
    Le reste travaille sur les checkouts read-only reconstruits par le Runtime.
    """

    async def pin(requested, *, session_id) -> PinnedPlugins:
        """Create only. Retourne name → installed root."""

    async def bind(plugins: RestoredPlugins, *, session_id) -> tuple[bytes, SessionPluginProjection]:
        """Résout, matérialise, snapshot, projette. All-or-nothing."""

    async def info(*, session_id) -> PluginInfo:
        """Projette pour plugin/info. Read-only."""

    async def release(*, session_id) -> None:
        """Ferme les clients MCP, drop les fichiers runtime. Idempotent."""
```

### Données par session

```
storage_root/plugins/
├── blobs/<ab>/<sha256>           # Contenus de fichiers (read-only, 0o400)
├── blobs/<ab>/<sha256>.x         # Twins exécutables (0o500)
├── manifests/<ab>/<digest>       # Manifests de packages (JSON)
├── packages/<ab>/<digest>/       # Checkouts read-only (hard-links, 0o500 dirs)
└── tmp/                          # Staging (swept après 24h)

storage_root/plugins/data/<session_id>/
└── knowledge/<name>/             # Connaissances copiées (PLUGIN_DATA)
    libraries/<digest>/<lang>/    # Libraries copiées
```

---

## 7. Côté Session Runtime : harness plugins

### `PluginPackageStore` (`_store.py`)

**Content-addressed storage** pour les arbres de plugins :

```
┌──────────────────────────────────────────────────────────┐
│  ingest(root, expected=digest, ignored_names)            │
│  ├── _scan_tree() → liste de _ScannedEntry               │
│  ├── _digest_entries() → sha256                          │
│  ├── vérifie expected == digest (PluginPackageMismatch)  │
│  ├── écrit les blobs manquants (idempotent)              │
│  └── écrit le manifest (PackageManifestV1)               │
├──────────────────────────────────────────────────────────┤
│  checkout(content_digest) → Path                         │
│  ├── lit le manifest                                     │
│  ├── rebuild dans staging (hard-links depuis blobs)      │
│  ├── vérifie que le rebuild re-digeste à la clé          │
│  ├── os.rename(staging, final) — atomique                │
│  └── harden_directories (read-only, deepest first)       │
├──────────────────────────────────────────────────────────┤
│  put_blob(payload) → sha256                              │
│  read_blob(digest) → bytes (vérifié)                     │
│  has(digest) → bool                                      │
└──────────────────────────────────────────────────────────┘
```

**Limites** :
- `MAX_PACKAGE_ENTRIES = 10_000`
- `MAX_PACKAGE_BYTES = 256 MiB`
- `TEMPORARY_TTL_SECONDS = 24h` (sweep des tmp abandonnés)

**Sécurité** :
- `_validate_entry_path()` : rejette `..`, chemins absolus, backslashes
- `_reject_normalization_collisions()` : deux entrées NFC-identiques = erreur
- `_launched_executables()` : détecte les fichiers lancés via `./` dans mcp.json pour leur donner le bit exécutable
- Vérification post-rebuild : le arbre reconstruit doit re-digester à sa clé

### `SessionPluginBinder` (`_session.py`)

```python
class SessionPluginBinder:
    async def create(requested, *, session_id) -> SessionPluginBinding:
        """
        1. provider.pin(requested) → vérifie que les noms correspondent
        2. store.ingest(root, expected=digest) pour chaque plugin
        3. store.checkout(digest) pour chaque plugin
        4. provider.bind(RestoredPlugins(snapshot=None, checkouts))
        5. store.put_blob(snapshot_bytes) → snapshot_digest
        6. Retourne SessionPluginBinding(lock, projection)
        """

    async def restore(lock, *, session_id) -> SessionPluginBinding:
        """
        1. store.checkout(entry.content_digest) pour chaque entrée
        2. store.read_blob(lock.snapshot_digest) → bytes
        3. provider.bind(RestoredPlugins(snapshot=bytes, checkouts))
        4. Retourne SessionPluginBinding
        """
```

**Codes d'erreur de restauration** :
| Code | Signification |
|---|---|
| `plugin_lock_invalid` | Lock malformé |
| `plugin_package_unavailable` | Manifest ou blob manquant |
| `plugin_package_corrupt` | Les bytes stockés ne re-digestent pas à leur clé |
| `plugin_snapshot_unavailable` | Blob snapshot manquant |
| `plugin_pin_mismatch` | Le provider n'a pas remis ce qui était demandé |

---

## 8. Côté Rust : harness/core

### Définitions de protocole

```rust
// harness/core/src/core/config.rs:144
pub struct AgentConfig {
    // ...
    pub plugins: Vec<PluginContextDefinition>,
}

pub struct PluginContextDefinition {
    pub name: String,
    pub description: String,
    pub path: String,  // chemin vers le checkout read-only
    pub capabilities: RustHarnessCapabilitySet,
}
```

### Intégration dans le moteur Rust

| Fichier | Usage |
|---|---|
| `core/tools/resolved/assembly.rs` | `hook_tool_catalog_includes_root_and_plugin_provided_tools` — test d'assembly |
| `core/prompt/context_snapshot.rs` | Injecte les chemins de skills/knowledge/agents dans le system prompt |
| `core/capabilities.rs` | `RustHarnessCapabilitySet` — capacités déclarées par le plugin |
| `core/step_protocol/mod.rs` | Sérialisation des définitions dans le protocole step |

### Côté Python du harness (pont)

```python
# harness/runtimes/python/.../protocol.py:184
class RustPluginContextDefinition(RustProtocolModel):
    name: str
    description: str
    path: str
    capabilities: RustHarnessCapabilitySet = Field(default_factory=RustHarnessCapabilitySet)
```

---

## 9. Sécurité et validation

### 9.1 Containment des chemins

```python
# _paths.py — PluginPathRef
# Tout chemin dans le snapshot est relatif POSIX, normalisé NFC, sans . ni ..
# La résolution se fait contre le checkout du plugin nommé

def plugin_path_ref(plugin: str, root: Path, target: Path) -> PluginPathRef:
    resolved_root = root.resolve()
    resolved_target = target.resolve()
    if not resolved_target.is_relative_to(resolved_root):
        raise PluginPathOutsideRootError(plugin, target)
    # ...

# _native.py — validation des composants
_contained_component_file(plugin_root, path)    # doit résoudre dans plugin_root
_contained_component_directory(plugin_root, path) # idem, et doit être un dir
_validate_contained_library_tree()               # pas de symlinks, tout dans root
_validate_contained_knowledge_tree()             # pas de symlinks, tout dans root
```

### 9.2 Redaction des secrets (`_redaction.py`)

```python
REDACTED = "<redacted>"
PLUGIN_PLACEHOLDER = "<plugin>"

# Ce qui est redacted dans les projections publiques :
- env values (MCP stdio)        → {name: "<redacted>"}
- argv values (MCP stdio)       → [exe, "--opt=<redacted>", "<redacted>"]
- HTTP header values            → {name: "<redacted>"}
- URL query strings             → query params redacted
- URLs dans les messages        → display_url_or_raw (userinfo/query dropés)
- input_value= dans les messages → "input_value=<redacted>"
- Chemins absolus               → "<plugin>"
```

### 9.3 Protection contre le shadowing MCP

```python
# _native.py — _remove_config_shadowed_mcp_servers()
# Si un plugin déclare un serveur MCP avec le même source_id qu'un serveur
# configuré dans config.toml, le serveur plugin est DROPÉ :
# "a plugin sharing one with a configured server would be handed the tokens
#  the user granted that server and send them to the url the plugin declared"
```

### 9.4 Namespaces réservés

```python
_RESERVED_NAMESPACES = {"file_system", "self", "process", "skill", "subagent", "vibe"}

# Pour les plugins builtin, "vibe" est autorisé :
_builtin_reserved = _RESERVED_NAMESPACES - {"vibe"}  # si scope == BUILTIN
```

### 9.5 Validation des entrées utilisateur

| Élément | Validation |
|---|---|
| Nom plugin | `^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$`, 1-64, no `--`/`..` |
| Namespace | TypeScript identifier `^[A-Za-z_$][A-Za-z0-9_$]*$` |
| Skill name | `^[a-z0-9]+(-[a-z0-9]+)*$`, 1-64 |
| Knowledge name | `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$` |
| Agent filename | `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$` (kebab-case) |
| Node alias | `^(?:@[a-z0-9][a-z0-9._-]*/)?[a-z0-9][a-z0-9._-]*$`, max 214 |
| Python alias | `^[A-Za-z_][A-Za-z0-9_]*$`, max 128 |
| HTTP header name | RFC 7230 token |
| HTTP header value | printable ASCII + tab, no DEL, max 0xFF |
| MCP stdio command | bare executable ou `./relatif` (résolu dans plugin root) |
| MCP stdio cwd | `./`, `${PLUGIN_ROOT}`, ou `${PLUGIN_DATA}` uniquement |
| env (MCP) | `PLUGIN_ROOT`/`PLUGIN_DATA` réservés (rejetés si définis) |

### 9.6 Limites de taille

| Ressource | Limite |
|---|---|
| Hooks par plugin | 128 |
| Taille hooks.toml | 64 Ko |
| Knowledge folders | 100 |
| Taille KNOWLEDGE.md | 256 Ko |
| Agents par plugin | 128 |
| Taille agent TOML | 64 Ko |
| Libraries par langage | 128 |
| Longueur path composant | 1 024 |
| Package entries (store) | 10 000 |
| Package bytes (store) | 256 MiB |
| Instructions agent | 65 536 chars |

---

## 10. Détection de drift et réconciliation

### `reconcile_plugin_routes()` (`_drift.py`)

Compare les routes épinglées (pinned) avec les sources qui viennent de répondre :

| Status | Condition |
|---|---|
| `live` | La source a répondu, le schema_fingerprint est identique |
| `stale` | La source a répondu, mais avec un fingerprint différent ou sans l'outil |
| `unavailable` | La source n'a pas répondu du tout |

### `retain_pinned_tools()` (`_drift.py`)

Lors d'un re-pin (`/reload-plugins`), les outils qui existaient dans le snapshot précédent mais plus dans le nouveau sont **retenus** dans le catalogue avec le status `unavailable` :

> *« Dropping one would make a tool the conversation has already called read as never having existed. »*

Seuls les **tools** sont retenus — pas les skills, knowledge, etc. (car seuls les tools ont un status sur le wire).

---

## 11. Adapters foreign

### Tableau comparatif

| Format | Marqueur | Skills | MCP | Hooks | Knowledge | Agents | Libraries | Connectors | Exécutables |
|---|---|---|---|---|---|---|---|---|---|
| **Agent Plugins 1.0** | `plugin.json` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (stdio ./) |
| **Claude Code** | `.claude-plugin/plugin.json` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ (.js/.ts refusés) |
| **Codex** | `.codex-plugin/plugin.json` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Kimi Code** | `.kimi.plugin.json` ou `.kimi-plugin/plugin.json` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **OpenCode** | `.opencode/` | ✅ | ✅ (déclaratif) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ (modules exécutables refusés) |

### Particularités par adapter

**Claude Code** (`_claude.py`, 834 lignes) :
- Supporte `skills/`, `mcp.json` (ou `.mcp.json`), hooks dans `.claude-plugin/hooks.json`
- Variables d'environnement spécifiques : `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`
- `cwd = None` pour les hooks (comportement Claude)
- Skills peuvent avoir des traductions (`synthetic_skill`)

**Codex** (`_codex.py`, 746 lignes) :
- Supporte `skills/`, MCP via `.codex-plugin/plugin.json`
- Pas de hooks

**Kimi Code** (`_kimi.py`, 556 lignes) :
- Deux marqueurs possibles : `kimi.plugin.json` (racine) ou `.kimi-plugin/plugin.json`
- `kimi.plugin.json` prend précédence si les deux existent (erreur `format_ambiguous` sinon)
- Variables spécifiques : `KIMI_PLUGIN_ROOT`, `KIMI_CODE_HOME`
- Supporte hooks

**OpenCode** (`_foreign.py`, 1347 lignes — le plus gros adapter) :
- Détection via `.opencode/plugins/`, `.opencode/skills/*/SKILL.md`, ou `opencode.json`
- **Refuse les modules exécutables** (.js, .ts, .cjs, .mjs, etc.) — diagnostic `executable_format_unsupported`
- Supporte uniquement skills + MCP déclaratifs

### Détection de format (`_compatibility.py`)

```python
def detect_plugin_source_format(root: Path) -> PluginFormatDetection:
    # Ordre de détection (premier match gagne) :
    # 1. plugin.json avec $schema agent-plugins.org → AGENT_PLUGINS_1_0
    # 2. plugin.json avec $schema non supporté → unsupported_schema
    # 3. .claude-plugin/plugin.json → CLAUDE_CODE
    # 4. .codex-plugin/plugin.json → CODEX
    # 5. kimi.plugin.json ou .kimi-plugin/plugin.json → KIMI_CODE
    # 6. .opencode/ → OPENCODE
    # 7. Plusieurs marqueurs → AMBIGUOUS (fatal)
    # 8. Aucun → UNKNOWN (fatal)
```

---

## 12. Interface utilisateur

### Slash commands (Unified Harness uniquement)

| Commande | Handler | Description |
|---|---|---|
| `/plugins` | `_show_plugins` | Ouvre `PluginsApp` — catalogue des plugins de la session |
| `/reload-plugins` | `_reload_plugins` | Re-découvre, re-pin, affiche le diff (`+`/`-`/`~`) |

Disponibilité : `is_available=lambda ctx: ctx.experimental_harness`

### `PluginsApp` (Textual widget)

```
┌─────────────────────────────────────┐
│  Plugins                            │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ plugin:vibe (builtin)       │    │
│  │   Skills (4)                │    │
│  │ plugin:my-plugin (project)  │    │
│  │   Skills (2), MCP (1)       │    │
│  └─────────────────────────────┘    │
│                                     │
│  [Filter plugins          ]         │
│                                     │
│  ↑↓/jk Navigate  Enter View         │
│  / Search  r Reload  Esc Close      │
└─────────────────────────────────────┘
```

Bindings : `Esc` (close), `Backspace` (back), `/` (filter), `r` (reload)

### Modèles de données UI (`vibe/app_server/models.py`)

```python
type PluginComponentKind = Literal[
    "skill", "knowledge", "library", "mcp_server",
    "connector", "hook", "agent", "subagent", "tool", "unknown"
]

class PluginCatalogEntry(ProtocolModel):
    name: str
    version: str | None
    source_format: PluginSourceFormat
    manifest_digest: str
    description: str
    author: str | None
    scope: PluginScope  # "builtin" | "global" | "project"
    content_sha256: str | None
    components: list[PluginCatalogComponent]
    drifted: int  # nombre de routes en drift
```

### `inspect_plugin()` — inspection offline

```python
# vibe/core/plugins/inspection.py
def inspect_plugin(path: Path) -> PluginInspection:
    """
    Inspecte un plugin sans le charger dans une session.
    Stage le plugin dans un répertoire temporaire isolé,
    le résout avec PluginResolver, retourne un PluginInspection (JSON).
    """
```

**Note** : `inspect_plugin` existe dans le code mais ne semble **pas encore câblé** à une commande CLI `vibe plugins inspect`. C'est référencé dans un commentaire de `_catalog.py` comme *« the offline paths — `plugins inspect` above all »* — probablement un feature en préparation.

---

## 13. Tests et qualité

### Fichiers de test

| Fichier | Cible | Description |
|---|---|---|
| `tests/skills/test_builtin_sync.py` | Dual-source skills | Vérifie que les copies plugin matchent les originales Python |
| `tests/app_server/test_plugin_mcp.py` | Plugin MCP | Nommage, login, /mcp, shadowing, auth (23,7 Ko) |
| `tests/cli/test_plugins_app.py` | UI PluginsApp | Widget Textual |
| `tests/cli/test_plugins_command.py` | Commandes /plugins | Slash commands |
| `tests/stubs/fake_plugin_ports.py` | Ports offline | `FakeMCPDiscovery`, `FakeConnectorCatalog`, `fixture_mcp_tool` |

### Test de synchronisation builtin (`test_builtin_sync.py`)

```python
class TestBuiltinSkillsShippedAsPluginSkills:
    """Vérifie que chaque skill Python builtin a une copie plugin identique."""

    @pytest.mark.parametrize("name", sorted(BUILTIN_SKILLS))
    def test_every_builtin_has_a_plugin_copy(self, name): ...

    @pytest.mark.parametrize("name", sorted(BUILTIN_SKILLS))
    def test_the_copy_routes_on_the_same_description(self, name): ...

    @pytest.mark.parametrize("name", sorted(BUILTIN_SKILLS))
    def test_the_copy_keeps_the_invocability_of_the_original(self, name): ...

    def test_the_vibe_copy_does_not_pin_a_version_it_cannot_know(self): ...
```

### Tests skippés (feature withheld)

```python
# tests/skills/test_builtin_sync.py:40-50
@pytest.mark.skip(reason="Plugins are withheld from the vibe skill")
def test_vibe_skill_documents_plugin_install_directories(self): ...

@pytest.mark.skip(reason="Plugins are withheld from the vibe skill")
def test_vibe_skill_description_covers_plugin_requests(self): ...
```

**Observation** : La section Plugins du skill `vibe` est **cachée** de cette release. Les tests sont skippés avec la note *« Unskip with the Plugins section: it is withheld from this release »*.

### Conformance suite

Mentionnée dans `_catalog.py` :
> *« Candidate building mirrors the TypeScript runtime's `plugins/materializer.ts` step for step, because the two runtimes share fixtures and a divergence here is a divergence in checked-in expected output. »*

Et dans `tests/stubs/fake_plugin_ports.py` :
> *« The conformance suite has to produce byte-identical snapshots with no network, so it drives materialization through doubles. »*

`upstream_fixtures.py` fournit le catalogue de fixtures pour cette suite.

### Qualité du code

- **Aucun TODO/FIXME/XXX/HACK** dans `vibe/core/plugins/`
- Tous les modèles Pydantic utilisent `extra="forbid", strict=True`
- Frozen dataclasses avec `slots=True` partout
- Type hints complets, `from __future__ import annotations`
- Logging via `logging.getLogger(__name__)`

---

## 14. Documentation et cohérence

### ADR 0007 — Extension Mechanisms

Points clés :
- Plugins = capacité backend optionnelle, pas mécanisme core
- Le app server expose les Host APIs (install, mounts, diagnostics, reload)
- La découverte, résolution, exécution, restauration appartiennent au backend
- *« Reject plugin Host operations when the active backend does not support them »*

### Skill `vibe` — section Plugins

La section `## Plugins` dans `vibe/core/skills/builtins/vibe.py` (lignes 1114-1230) documente :
- Les deux emplacements de découverte (`~/.vibe/plugins/`, `.vibe/plugins/`)
- Le manifest `plugin.json` (Agent Plugins 1.0)
- Les composants (skills, MCP, hooks, knowledge, agents, libraries, connectors)
- Les formats foreign (Claude, Codex, Kimi, OpenCode)
- Le pinning et le reload

**État** : Cette section existe dans le code mais est **withheld** (tests skippés). La copie plugin `skills/vibe/SKILL.md` la contient également.

### Cohérence vérifiée

| Aspect | Cohérent ? | Notes |
|---|---|---|
| ADR 0007 ↔ code | ✅ | Le code respecte la séparation backend optionnel |
| Skill vibe ↔ code | ✅ | Documentation à jour (mais withheld) |
| `vibe/plugins/` ↔ `vibe/core/plugins/` | ✅ | Data/engine bien séparés |
| Python ↔ Rust protocol | ✅ | `RustPluginContextDefinition` miroire `PluginContextDefinition` |
| Host digest ↔ Runtime digest | ✅ | Même implémentation `_digest_entries` |
| Tests ↔ code | ✅ | `test_builtin_sync.py` couvre la dual-source |

---

## 15. Zones d'ombre et observations

### 15.1 Feature withheld

La section Plugins du skill `vibe` est **cachée** de cette release. Deux tests sont skippés avec `reason="Plugins are withheld from the vibe skill"`. Cela suggère que le système de plugins est fonctionnel mais pas encore annoncé publiquement.

### 15.2 `inspect_plugin` non câblé

La fonction `inspect_plugin(path)` existe dans `inspection.py` (522 lignes) mais n'est appelée par aucune commande CLI. Le commentaire dans `_catalog.py` mentionne *« `plugins inspect` above all »* comme un chemin offline prévu. C'est probablement un travail en cours.

### 15.3 Pas de tests core dédiés

Il n'y a pas de répertoire `tests/core/plugins/`. Les tests sont dispersés :
- `tests/skills/test_builtin_sync.py` (sync builtin)
- `tests/app_server/test_plugin_mcp.py` (intégration MCP)
- `tests/cli/test_plugins_app.py` (UI)
- `tests/cli/test_plugins_command.py` (commandes)
- `tests/stubs/fake_plugin_ports.py` (test doubles)

Il manque des tests unitaires pour `_native.py`, `_snapshot.py`, `_drift.py`, `_naming.py`, `_redaction.py`, `_paths.py`, `_canonical.py`, `_content.py`.

### 15.4 Conformance suite externe

La « conformance suite » mentionnée dans les commentaires semble être externe (partagée avec le runtime TypeScript). Les fixtures checked-in devraient être dans un répertoire dédié mais seul `upstream_fixtures.py` (le loader) est présent — pas le catalogue JSON ni les fixtures eux-mêmes dans ce repo.

### 15.5 `vibe/plugins/` est du data pur

Les deux `__init__.py` sont vides. Le répertoire n'est qu'un conteneur de données embarquées. Toute la logique est dans `vibe/core/plugins/`.

### 15.6 Dual-source maintenance

Le maintien de deux copies des skills builtin (Python inline + plugin SKILL.md) est un risque de drift. Le test `test_builtin_sync.py` couvre les champs critiques (name, description, user-invocable) mais pas le contenu du body (sauf pour la version du README).

### 15.7 SSE transport détecté mais non supporté

Dans `_native.py`, `_MCPSSEServer` est défini comme modèle Pydantic mais `_to_vibe_mcp_server()` retourne `None` pour SSE, produisant un diagnostic *« uses unsupported transport 'sse' »*.

### 15.8 `data_root_base` requis pour builtin

```python
# _native.py — _scope_data_root()
if scope is SkillScope.BUILTIN:
    if self._data_root_base is None:
        self._issues.append(PluginConfigIssue(
            file=root,
            message="data_root_base is required for built-in plugins",
        ))
        return root.parent.parent / "plugin-data"  # fallback
```

En pratique, `resolve_session_plugins` passe `data_root_base=VIBE_HOME.path / "plugin-data"`.

---

## 16. Glossaire

| Terme | Définition |
|---|---|
| **Agent Plugins 1.0** | Standard de packaging d'extensions agent (schema JSON officiel) |
| **Plugin** | Répertoire contenant `plugin.json` + composants optionnels |
| **Builtin plugin** | Plugin embarqué dans le package Python (`vibe/plugins/builtins/`) |
| **Namespace** | Préfixe TypeScript-identifier pour les composants d'un plugin (ex: `vibe:my-skill`) |
| **Scope** | Niveau de précédence : `PROJECT` > `GLOBAL` > `BUILTIN` |
| **ResolvedPluginSet** | Résultat de la résolution : descripteurs + composants chargés |
| **MaterializedPluginSet** | ResolvedPluginSet + tool catalog (MCP/connecteurs connectés) |
| **ResolvedPluginSnapshot** | Projection portable, sans chemins absolus ni secrets |
| **Pinning** | Processus d'enregistrement content-addressed d'un plugin pour une session |
| **Checkout** | Reconstruction read-only d'un arbre de plugin depuis le store |
| **Drift** | Divergence entre le schema d'un outil épinglé et sa source live |
| **Tool group** | Groupe d'outils provenant d'une source MCP/connector d'un plugin |
| **Tool route** | Mapping (group, function) → source (MCP/connector) + fingerprint |
| **Foreign format** | Format de plugin non-natif (Claude, Codex, Kimi, OpenCode) |
| **Adapter** | Traducteur d'un format foreign vers le modèle interne Vibe |
| **PLUGIN_ROOT** | Variable d'environnement injectée = racine du plugin |
| **PLUGIN_DATA** | Variable d'environnement injectée = répertoire de données du plugin |
| **Unified Harness** | Backend par défaut (remplace le legacy Python harness) |
| **Session Runtime** | Sous-système qui exécute la boucle agent (Rust + Python SDK) |
| **Host** | Côté app-server Python qui résout et projette les plugins |
| **Canonical JSON** | Sérialisation JSON déterministe (RFC 8785) pour le hashing |
| **NFC** | Normalisation Unicode (Form C) — assure l'égalité cross-platform |

---

## Sources

Tous les chemins sont relatifs à `/home/dilos/A3/agentic/mistral-vibe/` :

### Data
- `vibe/plugins/__init__.py`
- `vibe/plugins/builtins/__init__.py`
- `vibe/plugins/builtins/vibe/plugin.json`
- `vibe/plugins/builtins/vibe/skills/{vibe,worktree,skill-creator,create-plugin}/SKILL.md`

### Core engine
- `vibe/core/plugins/__init__.py` (232 lignes)
- `vibe/core/plugins/_native.py` (2 127 lignes)
- `vibe/core/plugins/_foreign.py` (1 347 lignes)
- `vibe/core/plugins/_claude.py` (834 lignes)
- `vibe/core/plugins/_codex.py` (746 lignes)
- `vibe/core/plugins/_catalog.py` (557 lignes)
- `vibe/core/plugins/_kimi.py` (556 lignes)
- `vibe/core/plugins/inspection.py` (522 lignes)
- `vibe/core/plugins/upstream_fixtures.py` (309 lignes)
- `vibe/core/plugins/_compatibility.py` (319 lignes)
- `vibe/core/plugins/_materialize.py` (385 lignes)
- `vibe/core/plugins/_adapter.py` (285 lignes)
- `vibe/core/plugins/_snapshot.py` (270 lignes)
- `vibe/core/plugins/_drift.py` (149 lignes)
- `vibe/core/plugins/_diagnostics.py` (135 lignes)
- `vibe/core/plugins/_redaction.py` (102 lignes)
- `vibe/core/plugins/_naming.py` (97 lignes)
- `vibe/core/plugins/_content.py` (70 lignes)
- `vibe/core/plugins/_paths.py` (56 lignes)
- `vibe/core/plugins/_canonical.py` (49 lignes)

### Host integration
- `vibe/app_server/_plugins.py` (43 223 octets)
- `vibe/app_server/models.py` (PluginCatalogEntry, PluginComponent, etc.)

### Session Runtime (Python)
- `harness/runtimes/python/python/mistralai_vibe_local_harness/vibe/plugins/__init__.py`
- `harness/runtimes/python/python/mistralai_vibe_local_harness/vibe/plugins/_store.py` (658 lignes)
- `harness/runtimes/python/python/mistralai_vibe_local_harness/vibe/plugins/_session.py`
- `harness/runtimes/python/python/mistralai_vibe_local_harness/protocol.py` (RustPluginContextDefinition)

### Session Runtime (Rust)
- `harness/core/src/core/config.rs` (AgentConfig.plugins)
- `harness/core/src/core/tools/resolved/assembly.rs` (tool catalog assembly)
- `harness/core/src/core/prompt/context_snapshot.rs` (plugin paths in prompt)
- `harness/core/src/core/capabilities.rs` (RustHarnessCapabilitySet)

### UI
- `vibe/cli/commands.py` (/plugins, /reload-plugins)
- `vibe/cli/textual_ui/app.py` (_show_plugins, _reload_plugins)
- `vibe/cli/textual_ui/widgets/plugins_app.py` (PluginsApp widget)

### Config & paths
- `vibe/core/config/harness_files/_harness_manager.py` (user_plugins_dirs, project_plugins_dirs)
- `vibe/core/config/harness_files/_paths.py` (GLOBAL_PLUGINS_DIR)
- `vibe/core/paths/_local_config_files.py` (find_local_config_dirs, .vibe/plugins/)

### Skills builtin
- `vibe/core/skills/builtins/__init__.py` (BUILTIN_SKILLS)
- `vibe/core/skills/builtins/vibe.py` (69 Ko, section Plugins lignes 1114-1230)
- `vibe/core/skills/builtins/skill_creator.py`

### Tests
- `tests/skills/test_builtin_sync.py` (dual-source sync)
- `tests/app_server/test_plugin_mcp.py` (plugin MCP integration)
- `tests/cli/test_plugins_app.py` (UI)
- `tests/cli/test_plugins_command.py` (commands)
- `tests/stubs/fake_plugin_ports.py` (FakeMCPDiscovery, FakeConnectorCatalog)

### Docs
- `docs/adr/0007-extension-mechanisms.md` (architecture decision)
