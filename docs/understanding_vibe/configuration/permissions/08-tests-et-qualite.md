# Tests et qualité

---

## Couverture des tests

### Tests unitaires et d'intégration

| Fichier de test | Couverture | Description | Source |
|-----------------|------------|-------------|--------|
| `tests/app_server/test_approval_permissions.py` | Permissions d'approbation | Tests des path scopes, validation des grants, intégration app-server | `tests/app_server/test_approval_permissions.py` |
| `tests/session/test_session_permissions.py` | Permissions de session | Tests de la restriction des permissions des logs de session (owner-only) | `tests/session/test_session_permissions.py` |
| `tests/agent_loop/test_agent_override_resolve_permission.py` | resolve_permission | Vérification des mécanismes de résolution des permissions par outil | `tests/agent_loop/test_agent_override_resolve_permission.py` |
| `tests/agent_loop/test_agent_tool_call.py` | Appels d'outils | Tests des appels d'outils avec vérification des permissions | `tests/agent_loop/test_agent_tool_call.py` |
| `tests/agent_loop/test_approve_always_permanent.py` | Always allow | Tests des approbations permanentes | `tests/agent_loop/test_approve_always_permanent.py` |

### Tests des outils builtins

| Fichier de test | Outil testé | Couverture | Source |
|-----------------|-------------|------------|--------|
| `tests/tools/test_bash.py` | bash | Analyse des commandes, permissions, allowlist/denylist | `tests/tools/test_bash.py` |
| `tests/tools/test_windows_shell.py` | windows_shell | Analyse des commandes Windows, permissions | `tests/tools/test_windows_shell.py` |
| `tests/tools/test_edit.py` | edit | Permission d'édition, modification de fichiers | `tests/tools/test_edit.py` |
| `tests/tools/test_read_file.py` | read_file | Permission de lecture, accès aux fichiers | `tests/tools/test_read_file.py` |
| `tests/tools/test_write_file.py` | write_file | Permission d'écriture, création de fichiers | `tests/tools/test_write_file.py` |
| `tests/tools/test_grep.py` | grep | Permission de recherche dans les fichiers | `tests/tools/test_grep.py` |
| `tests/tools/test_mcp.py` | MCP tools | Intégration des outils MCP, permissions | `tests/tools/test_mcp.py` |
| `tests/tools/test_websearch.py` | web_search | Permission de recherche web | `tests/tools/test_websearch.py` |
| `tests/tools/test_webfetch.py` | web_fetch | Permission de récupération URL | `tests/tools/test_webfetch.py` |

---

## Exemples de tests

### Test de resolve_permission pour bash

**Source :** `tests/agent_loop/test_agent_override_resolve_permission.py:L1-100`

```python
class TestPlanAgentResolvePermission:
    """Plan agent overrides write_file/edit to NEVER with allowlist=[plans/*]"""
    
    def test_write_file_to_non_plan_path_denied_in_plan_mode(self) -> None:
        config = build_test_vibe_config()
        agent = build_test_agent_loop(config=config, agent_name=BuiltinAgentName.PLAN)
        
        tool = agent.tool_manager.get("write_file")
        from vibe.core.tools.builtins.write_file import WriteFileArgs
        
        args = WriteFileArgs(file_path="/some/random/file.py", content="hello")
        ctx = tool.resolve_permission(args)
        
        # Avec plan agent override: permission should be NEVER
        assert ctx is not None
        assert ctx.permission == ToolPermission.NEVER

    def test_write_file_to_plan_path_allowed_in_plan_mode(self) -> None:
        config = build_test_vibe_config()
        agent = build_test_agent_loop(config=config, agent_name=BuiltinAgentName.PLAN)
        
        tool = agent.tool_manager.get("write_file")
        from vibe.core.tools.builtins.write_file import WriteFileArgs
        
        plan_path = str(PLANS_DIR.path / "my-plan.md")
        args = WriteFileArgs(file_path=plan_path, content="# Plan")
        
        ctx = tool.resolve_permission(args)
        
        # Plan path is in the allowlist, so should be ALWAYS
        assert ctx is not None
        assert ctx.permission == ToolPermission.ALWAYS
```

**Ce que ce test vérifie :**
- L'agent `PLAN` surcharge `write_file` avec `permission = NEVER` et `allowlist = ["plans/*"]`
- Les chemins **hors** de `plans/` → `NEVER`
- Les chemins **dans** `plans/` → `ALWAYS`

---

### Test des permissions de session

**Source :** `tests/session/test_session_permissions.py:L1-100`

```python
def test_start_restrict_session_log_permissions_runs_once_per_process(
    session_config: SessionLoggingConfig, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The session-config build starts the sweep per session; only the first wins."""
    started: list[object] = []
    
    class RecordingThread:
        def __init__(self, *, args: tuple[object, ...], **_unused: object) -> None:
            self._args = args
        
        def start(self) -> None:
            started.append(self._args[0])
    
    monkeypatch.setattr(session_permissions, "_STARTED", False)
    monkeypatch.setattr(session_permissions, "Thread", RecordingThread)
    
    start_restrict_session_log_permissions(session_config)
    start_restrict_session_log_permissions(session_config)
    
    assert started == [session_config]
```

**Ce que ce test vérifie :**
- Le sweep de restriction des permissions du session log ne s'exécute **qu'une seule fois par processus**
- C'est un test du **mécanisme de sécurité** des logs de session (pas des permissions des outils)

---

### Test des approbations permanentes

**Source :** `tests/agent_loop/test_approve_always_permanent.py`

Ce fichier teste le mécanisme "Always allow" :
- Vérification que les règles sont **persistées** dans la configuration
- Vérification que les règles sont **appliquées** aux appels suivants

---

## Points à améliorer

### Couverture manquante identifiée

| Edge case | Test existant | Statut | Recommandation |
|-----------|---------------|--------|----------------|
| Chemins avec ".." | ❌ Non | Non testé | Ajouter des tests dans `test_bash.py` ou `test_read_file.py` |
| Liens symboliques | ❌ Non | Non testé | Ajouter des tests pour les liens vers /etc/passwd |
| Substitutions $(...) | ❌ Non | Non testé | Ajouter des tests pour les command substitutions |
| Commandes non analysables | ❌ Non | Non testé | Ajouter des tests pour les function_definition |
| Motifs sensibles + ALWAYS | ❌ Non | Non testé | Vérifier que les motifs sensibles l'emportent |
| Conflits allowlist/denylist | ❌ Non | Non testé | Vérifier que denylist l'emporte |
| Denylist standalone | ❌ Non | Non testé | Tester `python` vs `python script.py` |

### Complexité du code

**Points identifiés dans le code :**
- `_shell_permission_analysis.py` : Analyse syntaxique complexe avec tree-sitter
- `bash.py:resolve_permission()` : Logique complexe avec de nombreuses conditions
- `_loop.py:_should_execute_tool()` : Multiple chemins de décision

**Recommandation :**
- Ajouter plus de tests unitaires pour couvrir tous les chemins
- Documenter les cas limites dans le code
- Simplifier la logique si possible

---

## Outils de qualité utilisés

### Linting et formatting
- **Ruff** : Linter Python utilisé dans le projet
- **Configuration** : Voir `pyproject.toml` pour les règles Ruff

### Vérification des types
- **Pyright** : Vérificateur de types statique
- **Configuration** : Voir `pyproject.toml` pour la configuration Pyright

### Tests
- **Pytest** : Framework de test principal
- **Pytest-xdist** : Exécution parallèle des tests
- **Configuration** : Voir `pyproject.toml` pour les options pytest

**Commandes utiles :**
```bash
# Exécuter tous les tests
uv run pytest

# Exécuter les tests des permissions
uv run pytest tests/agent_loop/test_agent_override_resolve_permission.py
uv run pytest tests/app_server/test_approval_permissions.py

# Exécuter les tests d'un outil spécifique
uv run pytest tests/tools/test_bash.py

# Vérification des types
uv run pyright

# Linting
uv run ruff check --fix .
```

---

## Recommandations pour les développeurs

### Pour les mainteneurs du système de permissions

1. **Ajouter des tests pour les edge cases** :
   - Chemins relatifs avec `..`
   - Liens symboliques
   - Substitutions de commandes
   - Conflits allowlist/denylist

2. **Améliorer la documentation** :
   - Documenter les comportements spécifiques dans le code
   - Ajouter des exemples concrets dans les docstrings

3. **Simplifier la logique** :
   - Réduire la complexité cyclomatique dans `bash.py:resolve_permission()`
   - Extraire des fonctions utilitaires pour les vérifications communes

4. **Améliorer l'analyse syntaxique** :
   - Ajouter plus de motifs dangereux dans la denylist par défaut
   - Améliorer la détection des commandes malveillantes

---

### Pour les développeurs d'outils personnalisés

1. **Toujours implémenter resolve_permission()** :
   ```python
   def resolve_permission(self, args: MyToolArgs) -> PermissionContext | None:
       # Vérifier les chemins
       if not is_path_within_workdir(args.path, self.workspace):
           return PermissionContext(
               permission=ToolPermission.ASK,
               required_permissions=[...
           ]
       # Vérifier les motifs sensibles
       if matches_sensitive_pattern(args.path, self.config.sensitive_patterns):
           return PermissionContext(
               permission=ToolPermission.ASK,
               required_permissions=[...
           ]
       return None  # Utilise la permission de la config
   ```

2. **Utiliser les fonctions utilitaires** :
   - `resolve_file_tool_permission()` pour les outils basés sur des fichiers
   - `is_path_within_workdir()` pour vérifier les limites
   - `matches_sensitive_pattern()` pour les fichiers sensibles

3. **Tester les permissions** :
   - Vérifier que `resolve_permission()` retourne les bons contextes
   - Tester avec différents niveaux de permission (ALWAYS, NEVER, ASK)
   - Tester les edge cases (chemins relatifs, liens symboliques, etc.)

4. **Documenter les permissions** :
   - Documenter la permission par défaut dans la docstring
   - Documenter les comportements spécifiques (allowlist, denylist, etc.)

---

### Pour les utilisateurs

1. **Configurer correctement les permissions** :
   - Utiliser `ALWAYS` pour les outils sûrs
   - Utiliser `ASK` pour les outils à risque
   - Utiliser `NEVER` pour les outils dangereux
   - Configurer les allowlists/denylists de manière appropriée

2. **Ne pas désactiver les protections** :
   - Ne pas utiliser `bypass_tool_permissions = true`
   - Ne pas vider les denylists par défaut
   - Ne pas autoriser `sudo` sans restriction

3. **Utiliser le scratchpad** :
   - Pour les fichiers temporaires
   - Pour les fichiers sensibles (les fichiers dans le scratchpad sont **toujours autorisés**)

4. **Vérifier les configurations** :
   - Auditer régulièrement `config.toml`
   - Vérifier que les allowlists/denylists sont correctes
   - Supprimer les règles permanentes inutiles

---

## Conclusion

Le système de permissions de Mistral Vibe a une **bonne couverture de tests**, mais il reste des **edge cases non testés** :
- Chemins avec `..`
- Liens symboliques
- Substitutions de commandes
- Conflits allowlist/denylist
- Motifs sensibles avec ALWAYS

**Recommandation principale :** Ajouter des tests pour ces edge cases et améliorer la documentation des comportements spécifiques.
