# Cas limites (edge cases)

---

## Chemins avec ".."

**Comportement :** Les chemins relatifs avec `..` sont **normalisés et résolus** avant la vérification des permissions.

**Implémentation :**
- `vibe/core/tools/utils.py:L175-180` (`_make_absolute`) :
  ```python
  try:
      resolved = _make_absolute(path_str, workspace.cwd).resolve()
  except (ValueError, OSError):
      return False
  return workspace.allows(resolved)
  ```
- `Path.resolve()` résout les `..` et les liens symboliques
- Si le chemin résolu est en dehors du workspace → `RequiredPermission(scope=OUTSIDE_DIRECTORY)`

**Exemple :**
```bash
# Depuis /home/user/projet/
read_file("../../../etc/passwd")  # Résolu en /etc/passwd → hors workspace → demande permission
```

**Source :** `vibe/core/tools/utils.py:L175-249`

**Test existant :** ❌ Non trouvé dans les tests

---

## Liens symboliques

**Comportement :** Les liens symboliques sont **résolus** avant la vérification des permissions.

**Implémentation :**
- `vibe/core/tools/utils.py:L175-180` : `_make_absolute()` + `.resolve()` résout les liens symboliques
- `vibe/core/trusted_folders.py:L270-280` : `_closest_decision()` utilise `Path(self._normalize_path(path)).resolve()`
- Dans `_shell_permission_analysis.py:L60-70` : Les redirections de fichiers ignorent les liens symboliques (pour éviter de suivre des liens dangereux)

**Exemple :**
```bash
# Si /home/user/projet/link -> /etc/
read_file("link/passwd")  # Résolu en /etc/passwd → hors workspace → demande permission
```

**Comportement spécial :**
- Dans `_shell_permission_analysis.py:L60-70` :
  ```python
  if stat.S_ISLNK(info.st_mode):
      return 0  # Skip symlinks
  ```
  Les liens symboliques sont **exclu** de la restriction de permissions pour éviter de suivre des liens en dehors du contrôle.

**Source :** `vibe/core/tools/utils.py:L175-180`, `vibe/core/trusted_folders.py:L270-280`, `vibe/core/tools/builtins/_shell_permission_analysis.py:L60-70`

**Test existant :** ❌ Non trouvé dans les tests

---

## Commandes enchaînées (&&, |, ;)

**Comportement :** Les commandes enchaînées sont **analysées récursivement** et chaque partie est vérifiée.

**Implémentation :**
- `vibe/core/tools/builtins/_shell_permission_analysis.py:L1-150` :
  - `analyze_shell_command(command)` : Parse la commande avec tree-sitter
  - Retourne un `ShellPermissionAnalysis` avec `command_parts` (liste de toutes les commandes dans la chaîne)
  - Détecte les opérateurs : `&&`, `||`, `;`, `&`, `|`

**Exemple :**
```bash
bash("rm file.txt && echo done")
```
→ `command_parts = ["rm file.txt", "echo done"]` → Chaque partie est vérifiée séparément

**Source :** `vibe/core/tools/builtins/_shell_permission_analysis.py:L1-150`, `vibe/core/tools/builtins/bash.py:L684-690`

**Test existant :** ✅ Oui, tests dans `tests/tools/test_windows_shell.py` et `tests/tools/test_bash.py` (analyse des commandes complexes)

---

## Substitutions $(...)

**Comportement :** Les substitutions de commandes (`$(...)`) sont **détectées comme nœuds dynamiques** et déclenchent une demande d'approbation.

**Implémentation :**
- `vibe/core/tools/builtins/_shell_permission_analysis.py:L80-90` :
  ```python
  _DYNAMIC_NODES = {
      "command_substitution": "command substitution",
      "arithmetic_expansion": "arithmetic expansion",
      "brace_expression": "brace expansion",
      "expansion": "parameter expansion",
      "process_substitution": "process substitution",
      "simple_expansion": "variable expansion",
      "variable_assignment": "environment assignments",
  }
  ```
- Si un nœud dynamique est détecté → la commande **nécessite une approbation**

**Exemple :**
```bash
bash("echo $(cat /etc/passwd)")
```
→ Détecte `command_substitution` → `analysis.requires_approval = True` → demande permission

**Source :** `vibe/core/tools/builtins/_shell_permission_analysis.py:L80-90`, `vibe/core/tools/builtins/bash.py:L730-739`

**Test existant :** ❌ Non trouvé dans les tests (mais le code de détection est présent)

---

## Commandes non analysables

**Comportement :** Si le parse tree contient des **nœuds non fidèles** (`_UNFAITHFUL_PARSE_NODES`), la commande **nécessite une approbation**.

**Implémentation :**
- `vibe/core/tools/builtins/_shell_permission_analysis.py:L95-100` :
  ```python
  _UNFAITHFUL_PARSE_NODES = {"function_definition"}
  ```
- Si un nœud non fidèle est présent → la commande est considérée comme **non analysable** → `analysis.requires_approval = True`

**Exemple :**
```bash
bash("function test() { rm -rf /; }")
```
→ Détecte `function_definition` → nécessite une approbation

**Source :** `vibe/core/tools/builtins/_shell_permission_analysis.py:L95-100`

**Test existant :** ❌ Non trouvé dans les tests

---

## Windows vs POSIX

**Comportement :** Le système gère les différences entre Windows et POSIX.

**Implémentation :**

### Détection du système
- `vibe/core/utils/shell.py:L1-50` : `uses_posix_shell()` détermine si le shell est POSIX ou Windows
- `vibe/core/tools/builtins/bash.py:L686` : `if not uses_posix_shell(): return None` (bash n'est utilisé que sur POSIX)
- `vibe/core/tools/builtins/windows_shell.py` : Outils spécifiques à Windows

### Normalisation des chemins
- `vibe/permissions.py:L40-90` :
  - `_is_windows_path()` : Détecte les chemins Windows (C:\...)
  - `_normalized_path()` : Normalise selon le système (ntpath vs posixpath)

### Commandes par défaut
- **POSIX** : `read_file` utilise les commandes POSIX (`cat`, `ls`, etc.)
- **Windows** : `read_file` utilise PowerShell (`Get-Content`, etc.)
- **Allowlist/denylist** : Différentes listes pour chaque système (`bash.py:L80-110`)

**Exemple :**
```python
# Sur Windows
def uses_posix_shell() -> bool:
    return False  # ou True si Git Bash

# Sur POSIX
def uses_posix_shell() -> bool:
    return True
```

**Source :** `vibe/core/utils/shell.py:L1-50`, `vibe/permissions.py:L40-90`, `vibe/core/tools/builtins/bash.py:L1-50`

**Test existant :** ✅ Oui, `tests/tools/test_windows_shell.py`

---

## Fichier inexistant

**Comportement :** L'existence du fichier est **vérifiée avant l'exécution**, pas pendant la résolution des permissions.

**Implémentation :**
- **read_file** : `vibe/core/tools/builtins/read_file.py:L150-200` :
  - `ToolError` si le fichier n'existe pas
  - La permission est vérifiée **avant** la vérification d'existence
- **write_file** : `vibe/core/tools/builtins/write_file.py:L130-150` :
  - Vérifie que le fichier parent existe
  - `ToolError` si le parent n'existe pas

**Exemple :**
```bash
read_file("/nonexistent/file.txt")
```
→ Vérification des permissions → autorisé → **puis** `ToolError("File not found")`

**Source :** `vibe/core/tools/builtins/read_file.py:L150-200`, `vibe/core/tools/builtins/write_file.py:L130-150`

**Test existant :** ✅ Oui, tests des outils builtin

---

## Motifs sensibles combinés avec ALWAYS

**Comportement :** Même si la permission globale de l'outil est `ALWAYS`, les **motifs sensibles** forcent une demande d'approbation.

**Implémentation :**
- `vibe/core/tools/utils.py:L210-218` :
  ```python
  if matches_sensitive_pattern(file_str, sensitive_patterns):
      required.append(RequiredPermission(
          scope=PermissionScope.FILE_PATTERN,
          invocation_pattern=file_str,
          session_pattern=glob.escape(file_str),
          label=f"accessing sensitive files ({tool_name})",
      ))
  ```
- Si `required_permissions` n'est pas vide → retourne `PermissionContext(permission=ToolPermission.ASK, required_permissions=required)`
- **Priorité** : Les motifs sensibles **l'emportent** sur la permission globale

**Exemple :**
```toml
# config.toml
[tools.read_file]
permission = "always"
sensitive_patterns = ["**/.env"]
```
```bash
read_file(".env")  # → Demande permission malgré ALWAYS
```

**Source :** `vibe/core/tools/utils.py:L210-218`

**Test existant :** ❌ Non trouvé dans les tests

---

## Conflits allowlist/denylist

**Comportement :** **La denylist a priorité sur l'allowlist.**

**Implémentation :**
- `vibe/core/tools/builtins/bash.py:L690-705` :
  ```python
  outside_paths = {
      path
      for path in outside_paths
      if not any(
          path_grant_pattern_matches(path, pattern)
          for pattern in self.config.allowlist
      )
  }
  ```
- `vibe/core/tools/utils.py:L200-210` (`resolve_path_permission`) :
  - Vérifie d'abord la denylist
  - Puis vérifie l'allowlist
  - **Si un motif est dans les deux → denylist l'emporte**

**Exemple :**
```toml
[tools.bash]
allowlist = ["rm"]
denylist = ["rm -rf"]
```
```bash
bash("rm file.txt")      # → Allowlist match → ALWAYS (si pas d'autres checks)
bash("rm -rf /")         # → Denylist match → ASK ou NEVER
```

**Source :** `vibe/core/tools/builtins/bash.py:L690-705`, `vibe/core/tools/utils.py:L200-210`

**Test existant :** ❌ Non trouvé dans les tests

---

## Résumé des edge cases

| Cas limite | Comportement | Source | Test existant |
|------------|--------------|--------|---------------|
| Chemins avec ".." | Normalisés et résolus → vérification des limites workspace | `utils.py:L175-180` | ❌ Non |
| Liens symboliques | Résolus avant vérification → hors workspace si cible hors workspace | `utils.py:L175-180` | ❌ Non |
| Commandes enchaînées (&&, |, ;) | Analysées récursivement → chaque partie vérifiée | `_shell_permission_analysis.py:L1-150` | ✅ Oui |
| Substitutions $(...) | Détectées comme nœuds dynamiques → demande approval | `_shell_permission_analysis.py:L80-90` | ❌ Non |
| Commandes non analysables | Nœuds non fidèles → demande approval | `_shell_permission_analysis.py:L95-100` | ❌ Non |
| Windows vs POSIX | Géré séparément → normalisation des chemins | `shell.py:L1-50`, `permissions.py:L40-90` | ✅ Oui |
| Fichier inexistant | Permission vérifiée avant existence → ToolError après | `read_file.py:L150-200` | ✅ Oui |
| Motifs sensibles + ALWAYS | Motifs sensibles l'emportent → demande approval | `utils.py:L210-218` | ❌ Non |
| Conflits allowlist/denylist | Denylist l'emporte | `bash.py:L690-705`, `utils.py:L200-210` | ❌ Non |

---

## Recommandations

1. **Pour les développeurs d'outils personnalisés :**
   - Toujours implémenter `resolve_permission()`
   - Vérifier les chemins avec `is_path_within_workdir()`
   - Utiliser `matches_sensitive_pattern()` pour les fichiers sensibles
   - Tester les edge cases (chemins relatifs, liens symboliques, etc.)

2. **Pour les utilisateurs :**
   - Configurer correctement les allowlists/denylists
   - Ne pas désactiver `bypass_tool_permissions`
   - Vérifier les motifs sensibles
   - Utiliser le scratchpad pour les fichiers temporaires

3. **Pour les mainteneurs :**
   - Ajouter des tests pour les edge cases non couverts
   - Améliorer la détection des commandes dangereuses
   - Documenter les comportements spécifiques
