# Documentation de la partie Outils

## Général (Matheline)

> Doc complète : [`general/tools.md`](./general/tools.md)

`vibe/core/tools/` est le système qui permet à l'agent d'agir concrètement : lire des fichiers, lancer des commandes, appeler des services externes. Il se divise en deux :

- **À la racine : le moteur commun** (documenté dans cette partie). C'est lui qui fait fonctionner tous les outils, quelle que soit leur origine : la classe de base `BaseTool` dont chaque outil hérite, le `ToolManager` qui découvre et enregistre tous les outils disponibles, et le système de permissions (`ALWAYS` / `NEVER` / `ASK`) qui décide si une action s'exécute seule, est interdite, ou demande une confirmation à l'utilisateur.
- **Dans les sous-dossiers : les outils eux-mêmes**, venus de trois sources, chacun documenté par un membre de l'équipe :
    - `builtins/` → [Builtins (Eve)](#builtins-eve) — les outils intégrés à Vibe
    - `connectors/` → [Connecteurs (Ibtihel)](#connecteurs-ibtihel) — les outils de services externes
    - `mcp/` → [MCP (Aroua)](#mcp-aroua) — les outils de serveurs distants (protocole MCP)

Cette partie décrit le moteur qui fait tourner tous les outils ; les trois sections suivantes présentent chaque famille d'outils.

## MCP (Aroua)

Le **Model Context Protocol (MCP)** permet à Mistral Vibe de communiquer avec des serveurs externes qui exposent des outils utilisables par l'agent. Contrairement aux Builtins, qui sont intégrés directement dans Vibe, les outils MCP sont fournis par des serveurs indépendants.

L'implémentation repose principalement sur le `MCPRegistry`, qui découvre les serveurs et leurs outils, puis sur des proxies qui rendent ces outils accessibles à l'agent. Deux modes de communication sont pris en charge : HTTP pour communiquer avec des serveurs distants et STDIO pour communiquer avec des processus locaux. Le système comprend également un cache pour éviter les découvertes répétées, un pool pour gérer les connexions STDIO et des mécanismes d'autorisation.

Ainsi, MCP étend les capacités de l'agent en lui permettant d'utiliser des fonctionnalités externes tout en s'intégrant au système général des outils de Mistral Vibe.

**Documentation détaillée :** [`mcp/README.md`](mcp/README.md) et [`mcp/Etude_Implementation_MCP.md`](mcp/Etude_Implementation_MCP.md).

## Builtins (Eve)

> Doc complète : [`builtins/builtin-tools.md`](builtins/builtin-tools.md)

Les builtins sont les actions que Mistral Vibe peut exécuter dès l'installation. Chacun est une classe Python dans `vibe/core/tools/builtins/` qui hérite de `BaseTool` — son nom d'outil est la forme snake_case du nom de la classe (`ReadFile` → `read_file`) et sa description envoyée au modèle est chargée depuis un fichier correspondant dans `builtins/prompts/`. Un appel du modèle arrive sous forme d'arguments JSON bruts : ils sont d'abord validés dans un modèle typé (Pydantic), puis la boucle agent résout la permission — `ALWAYS` s'exécute immédiatement, `NEVER` refuse, `ASK` réutilise une règle de session approuvée ou demande une confirmation à l'utilisateur (les outils fichiers forcent `ASK` sur les chemins sensibles comme les fichiers `.env`). Une fois la permission accordée, `invoke()` exécute le `run()` de l'outil, qui émet des événements de progression et se termine par exactement un résultat typé ou une `ToolError`, les sorties trop grandes étant tronquées et signalées comme telles. En pratique, cela couvre les outils fichiers, shell (`bash` sans état ou shell managé par session), web et interaction utilisateur. Les détails de chaque outil sont dans [builtin-tools.md](builtins/builtin-tools.md), vérifiés contre le code source dans le [journal de corrections](builtins/builtin-tools-corrections.md) et navigables dans l'[explorateur interactif](builtins/interactive/index.html).

Les builtins ne forment pas un système à part — ce sont les instances par défaut de la machinerie générique décrite dans [Général (Matheline)](#général-matheline) ([`general/tools.md`](general/tools.md)). Chaque builtin est une sous-classe de `BaseTool` que le `ToolManager` découvre, enregistre et instancie. Ses arguments sont validés par Pydantic, son exécution est filtrée par le même `PermissionStore`, et son `run()` émet des événements avant de produire un unique `ToolResult` final.

## Connecteurs (Ibtihel)
Les **Connectors** permettent à Mistral Vibe d'utiliser des outils fournis par des services externes via l'API Mistral. Ils reposent sur le `ConnectorRegistry`, qui découvre les connectors disponibles à partir d'un mécanisme de bootstrap, gère leur authentification et met en cache leurs descriptions pour éviter les requêtes répétées. Chaque outil distant est exposé à Vibe à travers un `ConnectorProxyTool`, qui s'appuie sur les mécanismes de communication HTTP du protocole MCP pour transmettre les appels au service distant et récupérer les résultats. Le `ToolManager` intègre ensuite ces outils aux côtés des Builtins et des serveurs MCP classiques, ce qui permet à l'agent de les utiliser à travers une interface commune. Ainsi, les Connectors étendent les capacités de Vibe en donnant accès à des services externes sans avoir à implémenter directement leurs fonctionnalités dans le projet.
