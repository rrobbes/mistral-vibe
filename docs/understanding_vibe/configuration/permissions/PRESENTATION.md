# Support de présentation : Système de permissions de Mistral Vibe

---

## 1. Message principal (à retenir)

Le système de permissions de Mistral Vibe **protège contre les effets de bord dangereux** en demandant explicitement l'autorisation de l'utilisateur avant toute action sensible, comme exécuter des commandes shell, lire des fichiers sensibles ou sortir du workspace.

**À retenir** : C'est une **couche de sécurité applicative** (pas de sandbox OS), centralisée dans l'app-server, qui applique un contrat strict pour tous les outils : chaque appel doit être validé, et l'utilisateur garde le contrôle final.

---

## 2. Concepts clés à expliquer

### 1. Les trois niveaux de permission (ALWAYS, NEVER, ASK)
- **Définition** : Trois états fondamentaux qui déterminent si un outil s'exécute automatiquement, jamais, ou demande confirmation
- **Exemple** : `read_file` est typiquement en ASK pour les fichiers hors workspace, `bash` en ASK par défaut
- **Code** : `vibe/core/tools/models.py:L12-20` (enum `ToolPermission`)

### 2. Allowlist et denylist
- **Définition** : Listes de motifs qui autorisent ou bloquent automatiquement des commandes ou fichiers
- **Exemple** : `bash` autorise automatiquement `git status` (allowlist) mais bloque `sudo` (denylist)
- **Code** : `vibe/core/tools/builtins/bash.py:L80-110`

### 3. Motifs sensibles (sensitive patterns)
- **Définition** : Fichiers ou commandes (comme `.env`, `sudo`) qui **forcent toujours une demande**, même si l'outil est en ALWAYS
- **Exemple** : Lire un fichier `.env` déclenche toujours une demande de permission
- **Code** : `vibe/core/tools/utils.py:L210-218`

### 4. Périmètre du workspace
- **Définition** : Limite invisible qui protège contre l'accès à des fichiers en dehors du projet courant
- **Exemple** : `read_file("/etc/passwd")` depuis `/home/user/projet/` demande une permission
- **Code** : `vibe/core/tools/utils.py:L225-238` (via `is_path_within_workdir()`)

### 5. Règles de session et permanentes ("Always allow")
- **Définition** : Permissions accordées temporairement (session) ou définitivement (config.toml)
- **Exemple** : Cliquer "Always allow" dans l'UI ajoute la règle à `config.toml`
- **Code** : `vibe/core/tools/permissions.py:L16-56` (`PermissionStore`)

### 6. Cas de refus
- **Définition** : Quand l'utilisateur dit "Deny", appuie sur Esc, ou qu'une permission est NEVER/denylist match
- **Exemple** : Appuyer sur Esc → l'outil est skipé, l'agent continue, un message d'erreur est retourné au LLM
- **Code** : `vibe/core/agent_loop/_loop.py:L3047-3070`

### 7. Permissions vs Sandbox
- **Définition** : Les permissions **demandent** l'autorisation (niveau application), une sandbox **limite techniquement** (niveau OS)
- **Exemple** : Mistral Vibe n'a **pas de sandbox** (aucune occurrence dans tout le code)
- **Code** : Recherche exhaustive : aucun fichier ne mentionne sandbox/chroot/seccomp/container

---

## 3. Déroulé oral (5 minutes)

### 0-1 min : Accroche et message principal
**À dire :**
"Imaginez un agent IA qui peut exécuter `rm -rf /` ou lire votre fichier `.env` avec vos mots de passe. Le système de permissions de Mistral Vibe est la barrière qui l'en empêche. Son principe : **aucun effet de bord sans votre accord explicite**. Et surtout : **ce n'est pas une sandbox OS**, c'est une sécurité applicative."

**Diagramme à montrer :** `README.md` → Diagramme en couches (section Architecture en couches)
- Pointer les 5 couches : Interface, Application/Resolver, Outils, Stockage, Configuration
- Insister sur : **L'app-server est l'autorité centrale** (carré App)

---

### 1-3 min : Les 3 niveaux et le flux
**À dire :**
"Chaque outil a une permission : ALWAYS (exécution automatique), NEVER (toujours bloqué), ou ASK (demande confirmation).

Prenez `bash` : par défaut en ASK. Quand vous demandez `git status`, c'est dans l'allowlist → exécution immédiate. Mais `sudo rm` est dans la denylist → demande confirmation.

Et si vous avez déjà autorisé une commande, la permission est stockée dans `PermissionStore`. Vous pouvez choisir : une fois, pour la session, ou définitivement dans `config.toml`."

**Diagramme à montrer :** `02-deroulement-et-scenarios.md` → Diagramme principal du flux de permission
- Pointer : UI → App Server → Agent Loop → BaseTool → PermissionStore
- Expliquer : "Le flux va de la demande utilisateur à la décision finale"

**Exemple concret :**
"Si je demande `read_file("/etc/passwd")` depuis mon projet :
1. L'outil détecte que `/etc/passwd` est **hors workspace**
2. Il retourne `RequiredPermission(scope=OUTSIDE_DIRECTORY)`
3. L'app-server voit que ce n'est pas couvert → ouvre un callback
4. Vous voyez la fenêtre de permission, vous choisissez"

---

### 3-5 min : Sécurité, edge cases et limites
**À dire :**
"Attention, ce système a des limites. D'abord, il n'y a **pas de sandbox** : c'est de la demande d'autorisation, pas de l'isolation technique. Ensuite, les fichiers `.env` sont toujours protégés, même en ALWAYS. Et si vous appuie sur Esc ou cliquez Deny, l'outil est simplement skipé, l'agent continue son travail.

Pour les edge cases : les commandes comme `rm $VAR` ou `echo $(cat /etc/passwd)` sont détectées comme **dynamiques** et demandent toujours confirmation. Les chemins avec `..` sont normalisés. Et sur Windows, c'est géré séparément."

**Diagramme à montrer :** `02-deroulement-et-scenarios.md` → Diagramme de séquence "l'utilisateur refuse"
- Pointer : User → UI → App Server → Agent Loop → Tool (skip)
- Expliquer : "Toutes les étapes du refus, avec le message d'erreur retourné au LLM"

**Terminer par :**
"En résumé : Mistral Vibe vous protège en **vous demandant toujours la permission**, avec une analyse fine des commandes. Mais ce n'est pas magique : sans sandbox OS, un bug dans Vibe lui-même pourrait poser problème. La sécurité, c'est vous + Vibe, pas Vibe tout seul."

---

## 4. Démonstration de 1 minute

### Commande à demander
```
Lis le fichier /etc/passwd
```

### Fenêtre de permission qui apparaît
- **Titre** : "Permission Request"
- **Outil** : `read_file`
- **Fichier** : `/etc/passwd`
- **Raison** : "accessing file outside workspace"
- **Options** :
  1. Allow once
  2. Allow for remainder of this session
  3. Always allow
  4. Deny

### Ce que je commente
"Voilà ce qui se passe :
1. Vibe détecte que `/etc/passwd` est **hors workspace** → demande permission
2. Vous voyez le chemin exact et la raison
3. Si je choisis **Deny** (ou Esc) → l'outil est annulé, l'agent continue
4. Si je choisis **Always allow** → la règle est sauvée dans `config.toml`
5. Regardez les logs : on voit `Tool call denied` avec le nom de l'outil

C'est le cœur du système : **transparence totale, contrôle utilisateur, pas de surprise**."

---

## 5. Liens avec les autres groupes

### Avec la configuration (Arthur)
**Ce qui est vérifié dans le code :**
- `config.toml` (global et projet) : `vibe/core/config/vibe_schema.py:L100-150`
- Système de layers : CLI > env > fichier projet > fichier utilisateur > defaults
- `bypass_tool_permissions` : `vibe/core/config/vibe_schema.py:L630`

**Hypothèses à confirmer avec Arthur :**
- Est-ce que Arthur a documenté comment `config.toml` interagit avec les permissions ? (non vérifié)
- Comment sont gérées les migrations de config quand on ajoute de nouveaux champs de permission ? (non vérifié)

**Où mes permissions interviennent :**
- Les permissions **utilisent** la configuration (niveau global par outil dans `[tools.{nom}]`)
- La configuration **définit** les règles par défaut (allowlist, denylist, permission)
- Les permissions **étendent** la configuration avec des règles de session

---

### Avec la télémétrie (Sohayb)
**Ce qui est vérifié dans le code :**
- Compteur : `stats.tool_calls_rejected += 1` dans `_loop.py:L2868`
- Journalisation : `logger.info("Tool call denied...")` dans `_loop.py:L2863-2865`

**Hypothèses à confirmer avec Sohayb :**
- Est-ce que les événements de permission (`approval_requested`, `approval_denied`) sont envoyés à la télémétrie ? (non vérifié dans le code)
- Comment la télémétrie remplace-elle `stats` et `logger` ? (non vérifié)

**Où mes permissions interviennent :**
- Les permissions **génèrent** des événements (ToolResultEvent avec decision=SKIP)
- La télémétrie **pourrait capturer** ces événements pour l'analyse
- Les refus sont **logués** et **comptés** (données utiles pour Sohayb)

---

### Avec le groupe Agent Loop
**Ce qui est vérifié dans le code :**
- `_should_execute_tool()` : `vibe/core/agent_loop/_loop.py:L3027-3070`
- `_ask_approval()` : `vibe/core/agent_loop/_loop.py:L3053-3065`
- Gestion des décisions : `vibe/core/agent_loop/_loop.py:L2855-2871`

**Où mes permissions interviennent :**
- L'agent loop **applique** les permissions avant d'exécuter un outil
- Les permissions **interrompent** la boucle (skip l'outil) mais ne l'arrêtent pas
- L'agent loop **transmet** les callbacks de permission à l'UI

---

### Avec le groupe Outils
**Ce qui est vérifié dans le code :**
- `BaseTool.resolve_permission()` : `vibe/core/tools/base.py:L448-450`
- Implémentations concrètes : `read_file.py`, `write_file.py`, `bash.py`
- `ToolManager` : `vibe/core/tools/manager.py:L200-250`

**Où mes permissions interviennent :**
- Chaque outil **doit implémenter** `resolve_permission()`
- Les outils **déclarent** leurs besoins en permission
- Les permissions **valident** les arguments de chaque outil

---

### Avec le groupe Sessions
**Ce qui est vérifié dans le code :**
- `PermissionStore` : `vibe/core/tools/permissions.py:L16-56` (stockage en mémoire)
- `ToolResultEvent` : `vibe/core/agent_loop/_loop.py:L2873-2890`

**Hypothèses à confirmer avec Sessions :**
- Est-ce que les permissions de session sont **sérialisées** dans le session log ? (non vérifié)
- Comment les permissions sont-elles **restaurées** après un resume ? (non vérifié)

**Où mes permissions interviennent :**
- Les permissions **utilisent** le session storage pour `PermissionStore._rules`
- Les sessions **enregistrent** les ToolResultEvent (y compris les refus)

---

## 6. Mini-glossaire (10 termes)

| Terme | Définition |
|-------|------------|
| **ADR** | Architecture Decision Record : document qui explique une décision architecturale importante (ex: ADR 0004 définit le contrat des outils) |
| **Tool contract** | Contrat que chaque outil doit respecter : typage fort, déclaration des permissions, implémentation de `resolve_permission()` |
| **Scope** | Portée d'une permission : peut être COMMAND_PATTERN, OUTSIDE_DIRECTORY, FILE_PATTERN ou URL_PATTERN |
| **Workspace** | Répertoire de travail courant où l'agent opère, délimite la zone de confiance par défaut |
| **Sandbox** | Mécanisme d'isolation technique au niveau OS (chroot, conteneurs, seccomp) → **absent dans Mistral Vibe** |
| **Edge case** | Cas limite ou situation rare qui teste les limites du système (ex: chemins avec `..`, liens symboliques) |
| **Allowlist** | Liste de motifs autorisés automatiquement (ex: `git status` pour bash) |
| **Denylist** | Liste de motifs toujours bloqués ou nécessitant approval (ex: `sudo`, `rm -rf`) → priorité sur allowlist |
| **RequiredPermission** | Permission requise pour une action spécifique, doit être couverte par une règle existante |
| **PermissionStore** | Stockage en mémoire des permissions accordées pour la session courante |

---

## 7. Questions anticipées (8 questions)

### Q1 : Que se passe-t-il en cas de refus ?
**Réponse :** L'outil est **skipé** (non exécuté), l'agent continue, un message d'erreur est retourné au LLM (`ToolResultEvent` avec `decision=SKIP`), et un log est écrit. Le compteur `stats.tool_calls_rejected` est incrémenté.
**Source :** `vibe/core/agent_loop/_loop.py:L2855-2890`

### Q2 : Y a-t-il une sandbox ?
**Réponse :** **Non**. Mistral Vibe utilise uniquement des **permissions** (demande d'autorisation), pas de sandbox technique (chroot, conteneurs, seccomp). Recherche exhaustive : aucune occurrence dans tout le code.
**Source :** Recherche complète dans le dépôt

### Q3 : Quels sont les cas limites (edge cases) ?
**Réponse :** Chemins avec `..` (normalisés), liens symboliques (résolus), commandes enchaînées (`&&`, `|`, `;`) analysées récursivement, substitutions `$(...)` détectées comme dynamiques, Windows vs POSIX géré séparément, fichiers inexistants (permission vérifiée avant), motifs sensibles + ALWAYS (sensibles l'emportent), conflits allowlist/denylist (denylist l'emporte).
**Source :** `06-edge-cases.md`

### Q4 : Que se passe-t-il si l'analyse d'une commande bash échoue ?
**Réponse :** Si la commande contient des **nœuds non fidèles** (comme `function_definition`), elle est marquée comme `requires_approval = True` → demande de permission. L'analyse utilise tree-sitter pour détecter les structures dangereuses.
**Source :** `vibe/core/tools/builtins/_shell_permission_analysis.py:L95-100`

### Q5 : Peut-on contourner les permissions ?
**Réponse :** Oui, via `bypass_tool_permissions = true` dans `config.toml`, ou en modifiant la configuration pour désactiver les denylists. **À éviter** : cela désactive toutes les protections.
**Source :** `vibe/core/config/vibe_schema.py:L630`

### Q6 : Où sont stockées les permissions permanentes ?
**Réponse :** Dans `~/.vibe/config.toml` ou `.vibe/config.toml` (projet), dans la section `[tools.{nom_outil}]`. Les règles "Always allow" sont ajoutées via l'UI et persISTées dans ce fichier.
**Source :** `03-fichiers-utilisateur.md`

### Q7 : Quelle est la différence entre NEVER et un motif dans denylist ?
**Réponse :** **NEVER** bloque **toujours** l'outil, quel que soit l'argument. Un motif dans **denylist** bloque seulement si l'argument correspond. NEVER est configuré au niveau de l'outil (`tools.bash.permission = "never"`), denylist au niveau des arguments.
**Source :** `vibe/core/tools/models.py:L12-20`, `01-niveaux-et-modes.md`

### Q8 : Comment sont gérées les commandes avec des variables ($VAR) ?
**Réponse :** Les **substitutions de commandes** (`$(...)`) et **expansions de variables** (`$VAR`) sont détectées comme **nœuds dynamiques** → la commande **nécessite toujours une approbation**. L'analyse ne résout pas les valeurs réelles.
**Source :** `vibe/core/tools/builtins/_shell_permission_analysis.py:L80-90`

---

## 8. Limites de ma documentation

### Non vérifié (hypothèses à confirmer)

1. **Intégration avec la télémétrie** : Les événements de permission (`approval_requested`, `approval_denied`) ne sont pas explicitement vérifiés comme étant envoyés à la télémétrie. à confirmer avec Sohayb.

2. **Sérialisation des permissions de session** : Je n'ai pas vérifié si `PermissionStore._rules` est sérialisé dans le session log pour la restauration après resume. à confirmer avec le groupe Sessions.

3. **Interaction avec les worktrees Git** : Mentionné dans `05-securite-et-sandbox.md` comme recommandation, mais pas vérifié dans le code.

4. **Migrations de configuration** : Comment les anciens fichiers de config sont migrés vers les nouveaux champs de permission. à confirmer avec Arthur.

5. **Commandes de suppression de permissions** : Aucune commande dédiée n'a été trouvée pour supprimer une permission permanente via CLI. à vérifier.

### Incomplet (manque dans la documentation)

1. **Détails d'implémentation Rust** : La documentation se concentre sur le Python. Le code Rust (vibe/cli-rust) n'a pas été analysé en détail pour les permissions.

2. **Tests end-to-end** : Les tests existants sont mentionnés mais pas détaillés. Une section sur comment tester son propre outil personnalisé serait utile.

3. **Exemples concrets par OS** : Plus d'exemples spécifiques à Windows vs POSIX.

4. **Benchmark de performance** : Aucune mesure de performance n'a été trouvée ou réalisée pour l'analyse syntaxique.

### Ce qui est sûr et vérifié

✅ Tous les fichiers de code cités existent et ont été vérifiés ligne par ligne
✅ Tous les flux de permission (ALWAYS, NEVER, ASK, refus) sont documentés avec sources
✅ Tous les edge cases listés ont été vérifiés dans le code
✅ La recherche exhaustive "sandbox" a été effectuée
✅ Les diagrammes Mermaid sont corrects et sourcés
✅ Les tableaux de scénarios sont complets et vérifiés

---

## Fin de la présentation

**Message final :**
"Mistral Vibe vous donne le contrôle. Le système de permissions, c'est : **demander avant d'agir**, **analyser finement**, et **centraliser la décision**. Mais rappelez-vous : sans sandbox OS, la sécurité finale, c'est vous."
