# Le Data Model de Mistral Vibe (`vibe/core/types.py`)

Documentation de Hafsa pour le groupe **Core** ([issue #6](https://github.com/rrobbes/mistral-vibe/issues/6), [PR #15](https://github.com/rrobbes/mistral-vibe/pull/15)).

## Objectif

[`vibe/core/types.py`](../../../../vibe/core/types.py) n'est pas une fonctionnalité qu'on exécute : c'est le **vocabulaire commun du moteur**. Il définit, principalement sous forme de modèles Pydantic, les objets qui circulent entre les backends LLM, la boucle d'agent, les outils, la persistance des sessions et l'App Server.

Cette documentation répond à une question : **comment les données sont-elles représentées, transformées et échangées entre les composants de Mistral Vibe ?**

| Famille | Types principaux | Rôle |
|---|---|---|
| Messages | `LLMMessage`, `Role`, `ToolCall`, `FunctionCall` | un message de la conversation et les appels d'outils demandés par le modèle |
| Streaming | `LLMChunk`, `LLMUsage`, `StopInfo` | les fragments de réponse, additionnables avec `+` |
| Événements | `BaseEvent` et 19 sous-classes | le contrat entre la boucle d'agent et l'App Server |
| Historique | `MessageList` | la conversation, protégée pour un accès concurrent |
| Sessions | `SessionMetadata`, `ChildSessionLink`, `WorktreeContext`, `ScheduledLoop` | ce qui est enregistré sur disque |
| Statistiques | `AgentStats` | tokens, appels d'outils, coût |
| Erreurs | `RateLimitError`, `ContextTooLongError`, `ResponseTooLongError`, `RefusalError` | échecs remontés par les fournisseurs |

> **Deux moteurs.** Depuis la v2.26.1, le moteur par défaut est le *Unified Harness*, qui a ses propres types et n'utilise de `types.py` que `SessionMetadata` et `ScheduledLoop`. Le modèle complet (messages, chunks, événements) est celui du moteur Python, accessible avec `vibe --legacy-harness`, et le format historique des sessions. Voir [Two runtimes](types.md#two-runtimes-where-typespy-is-and-isnt-used).

## Fichiers de ce dossier

| Fichier | Contenu |
|---|---|
| [`index.html`](index.html) | **site interactif** utilisé pour la présentation (5 à 6 minutes) |
| [`assets/styles.css`](assets/styles.css), [`assets/app.js`](assets/app.js) | style et comportement du site, sans dépendance |
| [`types.md`](types.md) | rapport technique détaillé (en anglais) : architecture, catalogue des types, diagrammes Mermaid, déroulement d'un tour, extraits de code, spécifications, tests et observations |
| `README.md` | ce guide |

## Ouvrir le site

Double-cliquer sur [`index.html`](index.html), ou l'ouvrir dans Firefox ou Chromium. Aucun serveur, aucune installation, aucun accès réseau n'est nécessaire : le site n'utilise que du HTML, du CSS et du JavaScript natifs, sans CDN ni police externe. Seuls les liens « Dans le code » (vers GitHub) et les liens vers les autres sujets demandent une connexion.

Raccourcis : `1` à `6` pour aller à une section, `0` pour revenir en haut ; `←` `→` pour avancer dans les démonstrations des sections 3 et 4.

## Structure du site

| Section | Contenu | Interaction |
|---|---|---|
| Accueil | question centrale, un `LLMMessage` d'exemple, chiffres clés | — |
| §1 Vue d'ensemble | schéma conceptuel Interface ↔ App Server ↔ Agent Loop ↔ Backend LLM, avec `types.py` comme socle | clic ou survol d'une flèche, d'un composant ou d'une famille de types : types échangés et liens vers le code |
| §2 Diagrammes de classes | A : messages et streaming ; B : hiérarchie des événements (notation UML : héritage, composition, agrégation, dépendance) | clic sur une classe : déclaration complète, rôle, relations surlignées |
| §3 La vie d'un message | « Liste les fichiers de mon projet. » en 9 étapes, de `act()` à la réponse finale | Précédent / Suivant / Recommencer, variante `rm -rf build` pour la demande d'approbation |
| §4 Streaming Lab | reconstruction de `"Bon" + "jour" + " !"` et d'arguments JSON d'un appel d'outil | fragment par fragment, règles appliquées, comparaison naïf/réel, cas limites |
| §5 Choix de conception | 11 choix classés en style architectural, patterns et techniques | filtres, cartes dépliables (problème, solution, avantage, exemple) |
| §6 Conclusion | trois messages à retenir et liens vers les sujets voisi## Sources

- Code étudié : [`vibe/core/types.py`](https://github.com/rrobbes/mistral-vibe/blob/5e931ff306602964a7abbabb7d3026dd76c71e31/vibe/core/types.py) au commit `5e931ff3` (v2.26.1). Aucun fichier Python de `vibe/` n'a changé entre ce commit et `origin/main` au 15/11/2026.
- Code lu pour suivre les flux : `vibe/core/agent_loop/_loop.py`, `_request_broker.py`, `vibe/core/agent_loop_hooks.py`, `vibe/core/llm/backend/{mistral,generic}.py`, `vibe/core/llm/format.py`, `vibe/core/tools/builtins/bash.py`, `vibe/core/session/`, `vibe/core/rewind/manager.py`, `vibe/app_server/{_projector,_turns,_runtime}.py`, `vibe/_experimental_harness.py`.
- Décisions d'architecture : [ADR 0002](../../../adr/0002-core-engine-and-delivery-surfaces.md) (moteur et surfaces), [ADR 0003](../../../adr/0003-event-driven-agent-loop.md) (boucle événementielle), [ADR 0006](../../../adr/0006-local-sessions.md) (sessions locales).
- Chaque lien « Dans le code » du site pointe vers une ligne précise ; tous ont été vérifiés automatiquement contre le texte attendu sur cette ligne.

## Limites des démonstrations

- **Moteur simulé.** Les sections 1 et 3 décrivent le moteur Python (`AgentLoop`, `vibe --legacy-harness`), le seul qui utilise tout le modèle de `types.py`. Le moteur par défaut, le Unified Harness, n'est pas couvert.
- **Valeurs d'exemple.** Identifiants, nombres de tokens, découpage des fragments et sorties de commandes sont fictifs ; aucun modèle ni outil n'est appelé. La valeur exacte de `StopInfo.reason` dépend du fournisseur.
- **Scénario simplifié.** Un seul appel d'outil, sans hooks, middleware ni compaction ; la liste des outils envoyée au modèle est réduite à `bash`. L'analyse de la commande bash (`ls` autorisé d'office) s'applique sous un shell POSIX.
- **Streaming Lab.** Les états sont calculés par une transcription en JavaScript de `LLMMessage.__add__` et `LLMChunk.__add__`, limitée aux champs affichés. Elle a été relue ligne à ligne contre le code mais **pas exécutée face au vrai Python** (pas d'environnement `uv` disponible).
- **Schéma conceptuel.** Le schéma de la section 1 montre les données échangées, pas chaque appel réel.

## Liens avec les autres sujets

- **Backends LLM** : [`core/backend`](https://github.com/rrobbes/mistral-vibe/tree/main/docs/understanding_vibe/core/backend), producteurs des `LLMChunk`.
- **Agent Loop** : [PR #24](https://github.com/rrobbes/mistral-vibe/pull/24), qui émet les événements et possède la `MessageList`.
- **Permissions** : [`configuration/permissions`](https://github.com/rrobbes/mistral-vibe/tree/main/docs/understanding_vibe/configuration/permissions), qui s'appuient sur `ApprovalRequestEvent` et `ToolResultEvent.approval_source`.
- **Outils** : [`tools`](https://github.com/rrobbes/mistral-vibe/tree/main/docs/understanding_vibe/tools), qui utilisent `ToolCall`, `ToolCallEvent`, `ToolStreamEvent` et `ToolResultEvent`.
- **Configuration** : [`configuration/config-system`](https://github.com/rrobbes/mistral-vibe/tree/main/docs/understanding_vibe/configuration/config-system), dont un instantané est conservé dans `SessionMetadata.config`.
- **Sessions** : [`gestion_sessions/sessions`](https://github.com/rrobbes/mistral-vibe/tree/main/docs/understanding_vibe/gestion_sessions/sessions), qui persistent `LLMMessage` et `SessionMetadata`.
- **Sujet encore à documenter** : le [Unified Harness](https://github.com/rrobbes/mistral-vibe/tree/main/harness), moteur par défaut.

Documentation réalisée avec l'aide d'un agent IA ; les affirmations ont été vérifiées dans le code (méthode et limites détaillées dans [`types.md` §10](types.md#10-method-and-limits)).
