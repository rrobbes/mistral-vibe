# La télémétrie dans Mistral Vibe

Support de présentation de Sohayb pour le groupe **Configuration**. [Ouvrir le site interactif](index.html) directement dans Firefox ou Chromium ; aucun serveur, compte, CDN ou clé API n’est nécessaire.

## Parcours de présentation (environ 5 minutes)

1. **Comprendre** — distinguer l’appel au modèle de l’événement applicatif qui le décrit.
2. **Architecture** — sélectionner `types.py`, `build_metadata.py`, `session.py` et `send.py` pour voir leurs rôles ; comparer les chemins legacy et unified.
3. **Simulation** — faire avancer `vibe.request_sent` étape par étape dans les trois scénarios : activée avec clé Mistral, désactivée, activée sans clé appropriée. Les propriétés et le JSON apparaissent progressivement. La simulation n’effectue aucun appel réseau.
4. **Choix et limites** — expliquer l’envoi asynchrone, la tolérance aux erreurs, la déduplication de certains effets et les données observées.
5. **Conclusion** — relier télémétrie, configuration et permissions sans confondre leurs responsabilités.

## Points vérifiés dans le code

- Dans la voie legacy, `_complete` et `_chat_streaming` calculent les compteurs avant l’appel au modèle et appellent `send_request_sent` ([boucle d’agent](../../../../vibe/core/agent_loop/_loop.py)).
- `send_request_sent` construit les propriétés ; `send_telemetry_event` vérifie `enable_telemetry` puis la présence d’un fournisseur Mistral avec une clé, fusionne les métadonnées, construit le payload et programme une tâche `asyncio` ([envoi](../../../../vibe/core/telemetry/send.py)).
- La voie unified transmet les requêtes tamponnées via `SessionTelemetry.record_request_sent` ([adaptateur](../../../../vibe/app_server/_unified_harness_backend_adapter.py), [session](../../../../vibe/core/telemetry/session.py)). La déduplication par `claim(effect_id)` porte sur certains effets terminés, pas sur toutes les requêtes.
- Les valeurs `session-demo`, `legacy` et les compteurs affichés sont fictifs. Le JSON reproduit la **forme** du corps préparé pour `vibe.request_sent`, sans simuler une réception du service distant.

Le [rapport détaillé](telemetry.md) et les [statistiques du module](telemetry_statistics.md) étudient le commit historique `5e931ff3`. Le site a été revérifié contre les sources présentes sur `docs/telemetry` au moment de sa création. Les références récentes de `upstream/main` et des PR du groupe ont été consultées sans fusion ; elles ne font pas partie de cette branche.

## Limites à garder en tête

L’événement `vibe.request_sent` ne contient pas le texte du prompt, mais les événements de télémétrie ne sont pas tous anonymes : les métadonnées peuvent contenir des identifiants de session ou des attributs d’expérience. Le module n’a ni file persistante ni nouvelle tentative ; il ne garantit pas la réception des événements. Désactiver cette télémétrie n’empêche pas l’agent de fonctionner et ne supprime pas, à lui seul, les métadonnées jointes aux appels au modèle.
