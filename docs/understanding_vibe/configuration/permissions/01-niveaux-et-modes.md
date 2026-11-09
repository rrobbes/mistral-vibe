# Niveaux et modes de permission

---

## Niveaux de permission principaux

Le système définit **trois niveaux de permission fondamentaux** pour chaque outil, représentés par l'énumération `ToolPermission` dans `vibe/core/tools/models.py:L12-20` :

```python
class ToolPermission(StrEnum):
    ALWAYS = auto()    # Toujours autoriser
    NEVER = auto()     # Toujours refuser
    ASK = auto()       # Demander à l'utilisateur
```

### ALWAYS (Toujours autoriser)

- **Comportement** : L'outil est exécuté automatiquement sans demande de confirmation
- **Utilisation typique** : Outils à faible risque (lecture de fichiers dans le workspace, commandes sans effet de bord)
- **Configuration par défaut** : Aucune par défaut dans le code source. Chaque outil définit sa propre permission par défaut dans sa `BaseToolConfig`. Exemple : `read_file` n'a pas de permission par défaut explicite dans le code, elle dépend de la config.
- **Risque** : Une mauvaise configuration peut permettre des actions dangereuses sans validation
- **Source** : `vibe/core/tools/models.py:L12-20`

### NEVER (Toujours refuser)

- **Comportement** : L'outil est systématiquement bloqué, même si l'utilisateur le demande. Le flux est : `AgentLoop._should_execute_tool()` → détecte `ToolPermission.NEVER` → retourne `ToolDecision(verdict=SKIP, approval_source=NEVER)` → l'outil n'est pas exécuté
- **Utilisation typique** : Outils considérés comme trop dangereux pour un environnement donné
- **Exemple** : Un administrateur peut désactiver complètement `bash` en configurant `tools.bash.permission = "never"` dans `config.toml`
- **Sécurité** : Garantit qu'une action ne sera jamais exécutée, même par erreur
- **Source** : `vibe/core/tools/models.py:L12-20`, `vibe/core/agent_loop/_loop.py:L3047-3051`

### ASK (Demander à l'utilisateur)

- **Comportement** : L'exécution est suspendue et l'utilisateur doit explicitement approuver ou refuser. Le flux est : `AgentLoop._should_execute_tool()` → détecte `ToolPermission.ASK` avec des `required_permissions` non couvertes → appelle `_ask_approval()` → ouvre un callback UI → attend la réponse utilisateur
- **Utilisation typique** : Outils à risque modéré ou élevé (écriture de fichiers, commandes bash)
- **Configuration par défaut** : `bash` et `write_file` ont typiquement `ASK` comme permission par défaut dans la pratique
- **Flexibilité** : Permet un contrôle granulaire par appel
- **Source** : `vibe/core/tools/models.py:L12-20`, `vibe/core/agent_loop/_loop.py:L3053-3065`

---

## Modes de permission avancés

### Listes d'autorisation (Allowlist)

- **Fonctionnement** : Liste de motifs (patterns) qui, lorsqu'ils correspondent à une requête, permettent l'exécution automatique
- **Format** : Chaînes de caractères utilisant des wildcards. Les motifs sont comparés via `resolve_path_permission()` dans `vibe/core/tools/utils.py`
- **Exemples par défaut pour bash** (définis dans `vibe/core/tools/builtins/bash.py:L80-95`) :
  ```python
  ["cd", "echo", "git diff", "git log", "git status", "tree", "whoami"]
  + ["basename", "cat", "comm", "cut", "date", "diff", ...]  # commandes en lecture seule
  ```
- **Comportement** : Si une commande correspond à un motif de l'allowlist ET qu'aucun motif de denylist ne correspond → l'exécution est autorisée sans demande
- **Source** : `vibe/core/tools/builtins/bash.py:L80-95`, `vibe/core/tools/utils.py:L183-249`

### Listes de refus (Denylist)

- **Fonctionnement** : Liste de motifs qui, lorsqu'ils correspondent à une requête, bloquent systématiquement l'exécution
- **Priorité** : La denylist a une priorité plus élevée que l'allowlist. Dans `bash.py:L690-705`, les chemins en dehors du workspace sont filtrés par la denylist avant toute autre vérification
- **Exemples par défaut pour bash** (définis dans `vibe/core/tools/builtins/bash.py:L98-110`) :
  ```python
  ["gdb", "pdb", "passwd"]
  + ["nano", "vim", "vi", "emacs", "bash -i", "sh -i", "zsh -i", "fish -i", "screen", "tmux"]  # POSIX
  + ["cmd /k", "powershell -NoExit", "pwsh -NoExit", "notepad"]  # Windows
  ```
- **Sécurité** : Fournit une protection contre les commandes explicitement dangereuses
- **Source** : `vibe/core/tools/builtins/bash.py:L98-110`

### Motifs sensibles (Sensitive Patterns)

- **Fonctionnement** : Liste de motifs qui déclenchent **obligatoirement** une demande de confirmation (`ToolPermission.ASK`), même si la permission globale de l'outil est `ALWAYS`
- **Exemples par défaut** :
  - Pour les fichiers : Définis dans la config de chaque outil. Dans `vibe/core/tools/utils.py:L210-218`, si un fichier correspond à un motif sensible → `RequiredPermission(scope=FILE_PATTERN)` est ajouté
  - Pour bash : Le motif `sudo` est traité spécialement dans `bash.py`
- **Objectif** : Protéger les fichiers contenant des secrets ou des informations sensibles
- **Source** : `vibe/core/tools/utils.py:L210-218`

### Portées de permission (PermissionScope)

Le système définit plusieurs **portées** pour les permissions, représentées par `PermissionScope` dans `vibe/permissions.py:L18-24` :

```python
class PermissionScope(StrEnum):
    COMMAND_PATTERN = auto()      # Motif de commande
    OUTSIDE_DIRECTORY = auto()    # Accès en dehors du workspace
    FILE_PATTERN = auto()         # Motif de fichier
    URL_PATTERN = auto()          # Motif d'URL
```

Ces portées permettent de **scoper** finement les permissions accordées :

- **COMMAND_PATTERN** : Autorise une commande spécifique ou un motif de commande. Utilisé dans `bash.py` pour les commandes allowlistées/denylistées
- **OUTSIDE_DIRECTORY** : Autorise l'accès à un chemin spécifique en dehors du workspace. Utilisé dans `utils.py:L225-238` pour les fichiers hors workspace
- **FILE_PATTERN** : Autorise l'accès à un fichier ou un motif de fichier spécifique. Utilisé dans `utils.py:L210-218` pour les fichiers sensibles
- **URL_PATTERN** : Autorise l'accès à une URL ou un motif d'URL spécifique. Utilisé dans `web_fetch.py:L113-130`

**Source** : `vibe/permissions.py:L18-24`

### Portées de grant de chemin (PathGrantScope)

Pour les permissions de type `OUTSIDE_DIRECTORY`, le système propose deux niveaux de granularité, définis dans `vibe/permissions.py:L10-14` :

```python
class PathGrantScope(StrEnum):
    EXACT = auto()                  # Chemin exact uniquement
    DIRECTORY_RECURSIVE = auto()   # Chemin et tous ses sous-chemins
```

- **EXACT** : La permission s'applique uniquement au chemin exact spécifié. Utilisé dans `utils.py:L233` pour les fichiers individuels
- **DIRECTORY_RECURSIVE** : La permission s'applique au répertoire et à tous ses sous-répertoires et fichiers

**Source** : `vibe/permissions.py:L10-14`, `vibe/core/tools/utils.py:L233`

---

## Stockage des permissions

Le système maintient deux types de stockage pour les permissions :

### 1. Permissions de session (`PermissionStore`)

- **Implémentation** : `vibe/core/tools/permissions.py:L16-56`
- **Stockage** : En mémoire, valables pour la session courante uniquement
- **Contenu** :
  - `_rules: list[ApprovedRule]` : Liste des règles de permission accordées pendant la session
  - `_tool_permissions: dict[str, ToolPermission]` : Dictionnaire des permissions globales par outil pour la session
- **Méthodes clés** :
  - `covers(tool_name: str, rp: RequiredPermission) -> bool` : Vérifie si une permission requise est couverte par une règle existante
  - `add_rule(rule: ApprovedRule)` : Ajoute une règle de permission
  - `set_tool_permission(tool_name: str, permission: ToolPermission)` : Définit la permission globale pour un outil
  - `reset()` : Efface toutes les permissions de session (appelée entre les sessions)

### 2. Permissions permanentes

- **Stockage** : Dans le fichier de configuration (`~/.vibe/config.toml` ou `.vibe/config.toml` du projet)
- **Format** : TOML, dans la section `[tools.{nom_outil}]`
- **Exemple** :
  ```toml
  [tools.bash]
  permission = "ask"
  allowlist = ["git status", "ls"]
  denylist = ["rm -rf", "sudo"]
  ```
- **Persistance** : Les permissions permanentes sont chargées au démarrage via `ConfigOrchestrator` et appliquées à `PermissionStore`

**Source** : `vibe/core/tools/permissions.py:L16-56`, `vibe/core/config/vibe_schema.py:L414-420`
