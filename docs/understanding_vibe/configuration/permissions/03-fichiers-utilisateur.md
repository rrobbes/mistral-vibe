# Fichiers utilisateur

---

## Fichiers de configuration des permissions

### 1. config.toml (Configuration principale)

**Chemins possibles :**
- `~/.vibe/config.toml` (configuration globale utilisateur)
- `.vibe/config.toml` (configuration locale au projet)

**Format :** TOML

**Priorité :** 
1. CLI args
2. Variables d'environnement
3. Fichiers projet (`.vibe/config.toml`)
4. Configuration utilisateur (`~/.vibe/config.toml`)
5. Valeurs par défaut

**Source :** `vibe/core/config/vibe_schema.py:L100-150` (système de layers de configuration)

---

#### Structure pour les permissions

```toml
# Configuration globale
[core]
bypass_tool_permissions = false  # Si true, contourne TOUTES les vérifications de permission

# Configuration par outil
[tools.bash]
permission = "ask"               # Niveau global : ALWAYS, NEVER, ASK
allowlist = [
    "cd",
    "echo", 
    "git diff",
    "git log",
    "git status",
    "ls",
    "tree",
    "whoami"
]
denylist = [
    "gdb",
    "pdb", 
    "passwd",
    "rm -rf",
    "sudo",
    "bash -i",
    "nano",
    "vim"
]
sensitive_patterns = ["sudo"]

[tools.write_file]
permission = "ask"
allowlist = []
denylist = ["**/.env", "**/.env.*"]

[tools.read_file]
permission = "always"
sensitive_patterns = ["**/.env", "**/.env.*", "**/.ssh/*"]
```

**Ordre de priorité pour les outils :**
1. `tools.{nom_outil}.permission` (niveau global pour l'outil)
2. Règles session dans `PermissionStore` (si `PermissionStore.covers()` retourne True)
3. `bypass_tool_permissions: true` (contourne tout)
4. `Tool.resolve_permission()` (analyse spécifique de l'outil)
5. Valeur par défaut : `ToolPermission.ASK` (dans `BaseToolConfig`)

**Source :** `vibe/core/config/vibe_schema.py:L414-420`, `vibe/core/tools/base.py:L114-120`

---

### 2. trusted_folders.toml (Confiance workspace)

**Chemin :** `~/.vibe/trusted_folders.toml`

**Format :** TOML

**Rôle :** Gère la **confiance des dossiers workspace**, **indépendamment des permissions des outils**. Un dossier de confiance permet à l'agent d'accéder aux fichiers de configuration Vibe (AGENTS.md, .vibe/) dans ce dossier.

**Exemple :**
```toml
[trusted]
paths = [
    "/home/user/projets/mon-projet",
    "/home/user/projets/autre-projet"
]

[untrusted]
paths = [
    "/home/user/projets/secret",
    "/etc"
]
```

**Comportement :**
- Si un dossier est dans `trusted` → Vibe peut y lire les fichiers de configuration (AGENTS.md, .vibe/)
- Si un dossier est dans `untrusted` → Vibe **ne lit pas** les fichiers de configuration dans ce dossier
- Si un dossier n'est dans aucune liste → **non fiable par défaut**

**Source :** `vibe/core/trusted_folders.py:L198-345`

---

## Comment le code lit les fichiers de configuration

### Configuration principale (config.toml)

**Mécanisme :**
1. Au démarrage, `ConfigOrchestrator` charge les fichiers de configuration selon l'ordre de priorité
2. La section `[tools]` est validée via `BaseToolConfig` (dans `vibe/core/tools/models.py:L114-120`)
3. `ToolManager` utilise `config_getter()` pour accéder à la config actuelle
4. `ToolManager.get_tool_config()` (L750-775) merge :
   - Config par défaut de l'outil
   - Overrides utilisateur depuis `self._config.tools.get(tool_name)`
   - Override de permission depuis `PermissionStore` si `permission_getter` est défini

**Source :** `vibe/core/tools/manager.py:L750-775`

---

### Trusted Folders

**Mécanisme :**
1. `TrustedFoldersManager` est un singleton initialisé dans `vibe/core/trusted_folders.py:L288`
2. Au premier accès, `_load()` (L230-245) charge `~/.vibe/trusted_folders.toml`
3. Si le fichier est invalide ou absent → crée un fichier vide avec mode `0o600` (owner-only)
4. `for_session()` (L216-220) crée une copie sans les permissions session

**Méthodes clés :**
- `is_trusted(path: Path) -> bool | None` : Tri-state (True/False/None) pour la confiance
- `trust_status(path: Path) -> WorkspaceTrustStatus` : RETURN Trusted/Session/Untrusted
- `add_trusted(path: Path)` : Ajoute un chemin à la liste trusted (persistent)
- `add_untrusted(path: Path)` : Ajoute un chemin à la liste untrusted (persistent)
- `trust_for_session(path: Path)` : Ajoute un chemin trusted pour la session uniquement

**Source :** `vibe/core/trusted_folders.py:L216-345`

---

## "Always allow" : comment ça marche ?

### Dans l'interface utilisateur

Quand l'utilisateur voit une demande de permission, il a **4 options** (défini dans `vibe/cli/textual_ui/widgets/approval_app.py`) :

1. **Allow once** (1 ou y) → Approuve pour **cet appel uniquement**
2. **Allow for remainder of this session** (2) → Approuve pour **toute la session**
3. **Always allow** (3) → Approuve **définivement** (persistent)
4. **Deny** (4 ou n ou Esc) → **Refuse**

**Source :** `vibe/cli/textual_ui/widgets/approval_app.py:L42-47` (bindings), `L259-270` (options)

---

### Où la règle est écrite

#### Option 1 : Allow once
- **Ne crée aucune règle**
- L'outil est exécuté **une seule fois**
- **Source :** `approval_app.py:L292-297` → `ApprovalGranted` → `_respond_to_approval(ApprovalDecisionType.APPROVE)`

#### Option 2 : Allow for remainder of this session
- **Ajoute une règle dans `PermissionStore._rules`** (session-scoped)
- La règle est de type `ApprovedRule(tool_name, scope, session_pattern)`
- **Source :**
  - `approval_app.py:L298-306` → `ApprovalGrantedAlwaysTool`
  - `app.py:L2131-2133` → `_respond_to_approval(ApprovalDecisionType.APPROVE_FOR_SESSION, path_scope=...)`
  - `_loop.py:L1174-1195` → `approve_always()` → `self._permission_store.add_rule(ApprovedRule(...))`

#### Option 3 : Always allow (permanent)
- **Ajoute une règle dans `PermissionStore._rules`** (session)
- **Persiste dans config.toml** via `ConfigOrchestrator`
- **Source :**
  - `approval_app.py:L307-315` → `ApprovalGrantedAlwaysPermanent`
  - `app.py:L2138-2140` → `_respond_to_approval(ApprovalDecisionType.APPROVE_PERMANENTLY, path_scope=...)`
  - `_loop.py:L1174-1195` → `approve_always(save_permanently=True)` → `config_orchestrator.set_field_or_warn(f"/tools/{tool_name}/allowlist", [...])`

---

### Comment supprimer une règle "Always allow"

#### Règles de session (Allow for remainder of this session)
- **Automatique** : Les règles de session sont **effacées** quand la session se termine
- `PermissionStore.reset()` est appelé entre les sessions (`permissions.py:L25-27`)
- **Manuellement** : Redémarrer Vibe

#### Règles permanentes (Always allow)
- **Modifier config.toml** : Supprimer l'entrée dans `[tools.{nom_outil}.allowlist]`
- **Utiliser la commande** : `/config unset tools.{nom_outil}.allowlist` (si disponible)
- **Note** : Aucune commande dédiée n'existe dans le code pour supprimer une permission permanente. Il faut éditer manuellement le fichier de configuration.

---

## Que se passe-t-il si le fichier est invalide ou absent ?

### config.toml
- **Absent** : Utilise les **valeurs par défaut** définies dans `BaseToolConfig` (`permission = ToolPermission.ASK`)
- **Invalide** : Erreur de validation Pydantic → Vibe affiche une erreur et utilise les defaults
- **Source :** `vibe/core/config/vibe_schema.py` (validation via Pydantic)

### trusted_folders.toml
- **Absent** : `TrustedFoldersManager._load()` (L230-245) crée un fichier vide avec les sections `[trusted]` et `[untrusted]` vides
- **Invalide** (erreur TOML ou OSError) : Même comportement → efface les listes et recrée le fichier
- **Mode** : Le fichier est créé avec `mode=0o600` (owner-only) pour des raisons de sécurité
- **Source :** `vibe/core/trusted_folders.py:L230-245`

---

## Exemples concrets

### Exemple 1 : Configurer bash en ALWAYS pour un projet

**Fichier :** `.vibe/config.toml`
```toml
[tools.bash]
permission = "always"
allowlist = ["git status", "ls", "cd"]
denylist = ["rm", "sudo"]
```

**Comportement :**
- Les commandes `git status`, `ls`, `cd` sont **automatiquement autorisées**
- Les commandes `rm` et `sudo` (et leurs variantes) **demandent confirmation**
- Toute autre commande **demande confirmation**

---

### Exemple 2 : Désactiver complètement write_file

**Fichier :** `~/.vibe/config.toml`
```toml
[tools.write_file]
permission = "never"
```

**Comportement :**
- Toute tentative d'utiliser `write_file` **échoue systématiquement** avec le message "Tool 'write_file' is permanently disabled"
- Aucun callback n'est ouvert à l'utilisateur
- **Source :** `_loop.py:L3047-3051`

---

### Exemple 3 : Autoriser l'accès à /etc/hosts

**Via l'UI :**
1. L'utilisateur tente de lire `/etc/hosts` avec `read_file`
2. Vibe détecte que le fichier est **hors workspace** → demande permission
3. L'utilisateur sélectionne "Always allow for this session"
4. Vibe ajoute une règle : `ApprovedRule(tool_name="read_file", scope=OUTSIDE_DIRECTORY, session_pattern="/etc/hosts")`

**Via config.toml :**
```toml
[tools.read_file]
permission = "ask"
allowlist = ["vibe-path:exact:/etc/hosts"]
```

**Note :** Le format `vibe-path:exact:/etc/hosts` est généré par `path_grant_pattern()` (`vibe/permissions.py:L47-52`)
