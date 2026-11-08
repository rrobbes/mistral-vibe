# Sécurité et sandbox

---

## Protections intégrées

Le système de permissions de Mistral Vibe implémente plusieurs couches de protection contre les actions dangereuses :

### 1. Détection des fichiers sensibles

**Mécanisme :** Les motifs sensibles (`sensitive_patterns`) déclenchent **obligatoirement** une demande de confirmation (`ToolPermission.ASK`), même si la permission globale de l'outil est `ALWAYS`.

**Implémentation :**
- Dans `vibe/core/tools/utils.py:L210-218` (`resolve_file_tool_permission`) :
  ```python
  if matches_sensitive_pattern(file_str, sensitive_patterns):
      required.append(RequiredPermission(
          scope=PermissionScope.FILE_PATTERN,
          invocation_pattern=file_str,
          session_pattern=glob.escape(file_str),
          label=f"accessing sensitive files ({tool_name})",
      ))
  ```
- Dans `vibe/core/tools/builtins/bash.py` : Détection spécifique de `sudo`

**Exemples de motifs sensibles :**
- Fichiers : `**/.env`, `**/.env.*`, `**/.envrc`, `**/.ssh/*`, `**/config.json`
- Commandes : `sudo`, `passwd`

**Source :** `vibe/core/tools/utils.py:L210-218`

---

### 2. Vérification des limites du workspace

**Mécanisme :** Tout accès à un fichier ou répertoire **en dehors du workspace** nécessite une permission explicite.

**Implémentation :**
- `vibe/core/tools/utils.py:L225-238` (`resolve_file_tool_permission`) :
  ```python
  if not is_path_within_workdir(path_str, workspace=workspace):
      if config_permission == ToolPermission.NEVER:
          return PermissionContext(permission=ToolPermission.NEVER)
      resolved = str(file_path.resolve())
      required.append(RequiredPermission(
          scope=PermissionScope.OUTSIDE_DIRECTORY,
          invocation_pattern=resolved,
          session_pattern=path_grant_pattern(resolved, PathGrantScope.EXACT),
          label=f"outside workdir ({resolved})",
          path_scope_root=shell_path_scope_root(resolved),
      ))
  ```
- `vibe/core/workspace.py` : Définit les racines de confiance du workspace

**Comportement :**
- Si `config_permission == NEVER` pour l'outil → **refus immédiat**
- Sinon → demande d'approbation avec `RequiredPermission(scope=OUTSIDE_DIRECTORY)`

**Source :** `vibe/core/tools/utils.py:L225-238`, `vibe/core/workspace.py:L1-100`

---

### 3. Analyse syntaxique des commandes shell

**Mécanisme :** Analyse approfondie des commandes bash pour détecter les motifs dangereux.

**Implémentation :**
- **tree-sitter** : Parser syntaxique utilisé dans `_shell_permission_analysis.py`
- Détection de :
  - **Commandes enchaînées** : `&&`, `||`, `;`, `&`
  - **Substitutions** : `$(...)`, `` `...` ``
  - **Expansions** : `${...}`, `$VAR`
  - **Groupements** : `(...)`, `{...}`
  - **Redirections** : `>`, `>>`, `<`, `2>`, `|`
  - **Nœuds dynamiques** : `command_substitution`, `arithmetic_expansion`, `variable_assignment`, etc.

**Source :** `vibe/core/tools/builtins/_shell_permission_analysis.py:L1-150`

---

### 4. Listes de refus par défaut

**Mécanisme :** Certaines commandes sont **toujours bloquées** ou nécessitent une approbation explicite.

**Implémentation dans `vibe/core/tools/builtins/bash.py` :**

**Denylist (toujours refusé ou demande approval) :**
```python
_DEFAULT_DENYLIST = [
    "gdb", "pdb", "passwd",
    # POSIX
    "nano", "vim", "vi", "emacs", "bash -i", "sh -i", "zsh -i", 
    "fish -i", "dash -i", "screen", "tmux",
    # Windows
    "cmd /k", "powershell -NoExit", "pwsh -NoExit", "notepad"
]
```

**Denylist standalone (refusé sans arguments) :**
```python
_DEFAULT_DENYLIST_STANDALONE = [
    "python", "python3", "ipython",
    # Windows
    "cmd", "powershell", "pwsh", "notepad"
]
```

**Allowlist (automatiquement autorisé) :**
```python
_DEFAULT_ALLOWLIST = [
    "cd", "echo", "git diff", "git log", "git status", "tree", "whoami",
    # + commandes en lecture seule selon le système
]
```

**Source :** `vibe/core/tools/builtins/bash.py:L80-110`

---

### 5. Guardrails (protections spécifiques)

**Mécanisme :** Détection de motifs nécessitant une approbation spécifique.

**Implémentation :**
- `vibe/core/tools/builtins/_shell_command_policy.py` :
  - `git_repository_requires_approval()` : Détecte les commandes git dans un repository
  - `has_option_guardrails()` : Vérifie les options dangereuses
  - `git_repository_identity()` : Identifie les repositories git

**Exemple :** Les commandes git dans un repository peuvent nécessiter une approbation spécifique selon la configuration.

**Source :** `vibe/core/tools/builtins/_shell_command_policy.py:L1-150`

---

### 6. Normalisation des chemins

**Mécanisme :** Gestion des différences entre systèmes (Windows vs POSIX).

**Implémentation :**
- `vibe/permissions.py:L40-90` :
  - `_is_windows_path()` : Détecte les chemins Windows
  - `_normalized_path()` : Normalise les chemins selon le système
  - `path_grant_pattern()` : Encode une permission de chemin sans donner de sens aux caractères globaux
  - `path_pattern_matches()` : Match les permissions encodées et les anciens motifs globaux

**Source :** `vibe/permissions.py:L40-90`

---

### 7. Scratchpad (bac à sable temporaire)

**Mécanisme :** Les fichiers dans le scratchpad sont **toujours autorisés** sans demande de permission.

**Implémentation :**
- `vibe/core/tools/utils.py:L187-190` :
  ```python
  if is_scratchpad_path(path_str, scratchpad_dir=scratchpad_dir):
      return PermissionContext(permission=ToolPermission.ALWAYS)
  ```
- Le scratchpad est un répertoire temporaire où l'agent peut écrire des fichiers sans restriction

**Source :** `vibe/core/tools/utils.py:L187-190`, `vibe/core/scratchpad.py:L1-50`

---

## Limites du système

### 1. Dépendance à l'analyse syntaxique

**Problème :** Commandes complexes ou mal formées peuvent échapper à la détection.

**Exemples :**
- Commandes avec des variables non résolues : `rm $FILE` (si `$FILE` pointe vers un chemin dangereux)
- Commandes avec des substitutions imbriquées : `eval $(echo "rm -rf /")`
- Commandes avec des caractères spéciaux mal échappés

**Atténuation :**
- Analyse syntaxique avec tree-sitter (meilleure que regex)
- Détection des nœuds dynamiques (command_substitution, etc.)
- Demande d'approbation pour toute commande non analysable

**Source :** `_shell_permission_analysis.py:L80-100` (détection des nœuds non fidèles)

---

### 2. Configuration utilisateur

**Problème :** L'utilisateur peut **désactiver les protections** en modifiant la configuration.

**Exemples :**
- `bypass_tool_permissions = true` → **contourne toutes les vérifications**
- `tools.bash.permission = "always"` avec `denylist = []` → **autorise toutes les commandes bash**

**Atténuation :**
- Aucune protection contre la mauvaise configuration utilisateur
- Documentation claire des risques
- Messages d'avertissement dans les logs

**Source :** `vibe/core/config/vibe_schema.py:L630` (`bypass_tool_permissions`)

---

### 3. Outils personnalisés (custom tools)

**Problème :** Les outils personnalisés (plugins, MCP, connectors) peuvent **contourner le système de permission** s'ils ne respectent pas le contrat.

**Atténuation :**
- Tous les outils **doivent** hériter de `BaseTool` et implémenter `resolve_permission()`
- `ToolManager` vérifie que les outils sont valides avant de les enregistrer
- Les outils MCP et connectors sont intégrés via `ToolManager` et passent par le même système

**Source :** `vibe/core/tools/manager.py:L200-250`, `L560-600`

---

### 4. Fausses positives/négatives

**Problème :** Erreurs de classification possibles.

**Exemples :**
- **Fausse positive** : Une commande inoffensive est bloquée parce qu'elle correspond à un motif de denylist
- **Fausse négative** : Une commande dangereuse n'est pas détectée par l'analyse syntaxique

**Atténuation :**
- Allowlist/denylist configurables par l'utilisateur
- Possibilité de contourner une décision (en modifiant la config)
- Logs détaillés des décisions de permission

---

### 5. Performances

**Problème :** L'analyse syntaxique des commandes complexes peut être **lente**.

**Atténuation :**
- Utilisation de tree-sitter (parseur efficace)
- Cache des analyses déjà effectuées
- Analyse en arrière-plan pour les commandes longues

**Note :** Ce point n'a pas été vérifié dans le code. Aucune mesure de performance n'a été trouvée.

---

### 6. Cross-platform

**Problème :** Différences de comportement entre Windows et POSIX.

**Atténuation :**
- Normalisation des chemins (`_normalized_path()`)
- Gestion séparée des outils : `bash.py` (POSIX) vs `windows_shell.py` (Windows)
- Détection du système (`uses_posix_shell()`)

**Source :** `vibe/permissions.py:L40-90`, `vibe/core/tools/builtins/bash.py:L1-50`

---

## Sandbox : Y en a-t-il une ?

### Recherche exhaustive

**Recherche effectuée :**
```bash
# Recherche dans tout le dépôt (code Python, Rust, docs, ADR)
grep -r "sandbox\|isolation\|confinement\|chroot\|seccomp\|container\|namespace\|cgroup" \
  /home/ben-ayed-yasmine/Desktop/Agentique/mistral-vibe/ \
  --include="*.py" --include="*.rs" --include="*.md" --include="*.toml"
```

**Résultat :** **Aucune occurrence** trouvée dans :
- Le code Python (`vibe/`)
- Le code Rust (`vibe/cli-rust/`, `harness/`)
- La documentation (`docs/`)
- Les ADR (`docs/adr/`)

---

### Conclusion

**❌ Mistral Vibe n'utilise PAS de sandbox technique.**

La distinction est claire :

| **Permissions** | **Sandbox** |
|----------------|-------------|
| Demander l'autorisation à l'utilisateur avant d'exécuter des actions sensibles | Limiter techniquement ce que le processus peut faire |
| Implémenté via `ToolPermission`, `PermissionStore`, `resolve_permission()` | Implémenté via seccomp, namespaces, chroot, conteneurs |
| **Présent** dans Mistral Vibe | **Absent** dans Mistral Vibe |
| Niveau **application** | Niveau **système d'exploitation** |
| Peut être contourné par une mauvaise configuration | Ne peut pas être contourné (sauf bug du kernel) |

**Le système de permissions de Mistral Vibe est uniquement basé sur :**
1. La **demande d'autorisation** avant les actions sensibles
2. La **détection de motifs dangereux** (denylist, fichiers sensibles, etc.)
3. La **validation des chemins** (workspace boundaries)
4. L'**analyse syntaxique** des commandes

**Il n'y a AUCUNE isolation technique au niveau du système d'exploitation.**

---

### Conséquences

⚠️ **Les permissions ne protègent pas contre :**
- Un bug dans le code de Vibe lui-même
- Un accès direct au système par d'autres moyens
- Une exécution de code avec des privilèges élevés (sudo, root)
- Une exploitation de vulnérabilités dans les dépendances

✅ **Les permissions protègent contre :**
- L'exécution involontaire de commandes dangereuses par l'agent
- L'accès à des fichiers sensibles sans l'approbation de l'utilisateur
- La sortie du workspace autorisé
- Les actions non intentionnelles

---

### Recommandations de sécurité

1. **Ne pas exécuter Vibe en tant que root** : Toujours utiliser un utilisateur normal
2. **Configurer correctement les permissions** : Ne pas désactiver `bypass_tool_permissions`
3. **Utiliser le scratchpad** : Pour les fichiers temporaires sensibles
4. **Vérifier les allowlists** : Ne pas autoriser de commandes dangereuses
5. **Mettre à jour régulièrement** : Pour bénéficier des dernières corrections de sécurité
6. **Auditer les configurations** : Vérifier que les denylists sont correctement configurées
7. **Utiliser des worktrees Git** : Pour isoler les projets entre eux
