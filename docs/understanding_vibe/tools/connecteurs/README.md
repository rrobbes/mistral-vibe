Documentation : Connectors

Documentation technique du sous-système Connectors de Mistral Vibe : les outils distants fournis par l'API Mistral (/v1/connectors-gateway/) et exposés à Vibe comme des outils natifs.

Elle fait partie de la documentation du groupe Outils (docs/understanding_vibe/tools/), aux côtés des Builtins, de MCP et de la documentation générale.

Contenu
Fichier	Description
connectors.md	Étude détaillée : architecture, fonctionnement, cache, authentification, erreurs, tests, avantages, limites, recommandations
README.md	Ce fichier : présentation et guide de lecture
À qui s'adresse cette documentation
Développeurs de Vibe qui doivent comprendre, maintenir ou faire évoluer le sous-système Connectors.
Relecteurs qui veulent évaluer la robustesse, la couverture de tests et les limites connues.
Contributeurs qui comparent Builtins, MCP et Connectors.
Guide de lecture
Vous voulez...	Lisez la section de connectors.md
Situer les Connectors par rapport aux Builtins et à MCP	1. Positionnement
Comprendre la hiérarchie de classes et les composants	2. Architecture
Suivre la découverte et l'exécution d'un outil	3. Fonctionnement
Comprendre le cache (niveaux, TTL, contenu, résilience)	4. Cache en détail
Vérifier le traitement de la clé d'API	5. Authentification et sécurité
Connaître les messages d'erreur	6. Gestion des erreurs
Évaluer la couverture de tests et ses lacunes	7. Tests en détail
Voir les points forts du design	8. Avantages
Voir les risques et défauts connus	9. Limites et risques
Savoir quoi améliorer en priorité	10. Recommandations
En bref
Les Connectors sont des outils MCP spécialisés : ConnectorProxyTool hérite de MCPTool et réutilise call_tool_http.
La découverte passe par /v1/connectors/bootstrap, avec un cache à deux niveaux (fichier 10 min, mémoire de session).
L'authentification est un Bearer MISTRAL_API_KEY ; la clé n'est jamais écrite dans le cache fichier.
Le point faible principal est la dépendance à l'API Mistral : sans bootstrap valide, aucun outil connector n'est disponible.
Conventions du document
Références de code : fichiers et noms de fonctions, sans numéros de ligne, qui évoluent trop vite.
[non vérifié] : point déduit ou non confirmé par lecture directe du code ou des tests. À valider avant de s'y fier.
Gravité des limites : Faible, Moyenne, Élevée. Ce sont des appréciations de relecture, pas des mesures.
Chiffres de performance : volontairement absents, aucun benchmark n'existe dans le dépôt.
Périmètre et limites de cette documentation
Elle décrit l'état du code au moment de sa rédaction (commit de référence : à renseigner).
Les fichiers de tests autres que tests/tools/test_connectors.py sont décrits d'après leur nom et leur rôle, pas d'après une relecture complète.
Les comportements dépendant du serveur Mistral (support d'ETag, évolutions de l'API) ne sont pas documentés ici.
Maintenance

À mettre à jour lorsque l'un de ces éléments change :

_BOOTSTRAP_CACHE_TTL_SECONDS ou le format du cache fichier
la hiérarchie MCPTool / ConnectorProxyTool
l'URL de la gateway ou le mode d'authentification
la suite de tests (nouveaux fichiers ou nouvelles lacunes couvertes)

Après une correction d'une limite listée en section 9, mettre à jour le tableau récapitulatif et retirer la recommandation correspondante.

Documentation liée
../tools.md : vue d'ensemble du groupe Outils
../mcp/ : documentation MCP
../builtins/ : documentation des outils Builtins
../general/ : documentation générale
docs/adr/0004-typed-permissioned-tools.md : contexte de conception des outils typés et permissionnés
