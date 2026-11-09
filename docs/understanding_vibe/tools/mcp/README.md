# MCP — Model Context Protocol

## 1. Introduction

MCP (Model Context Protocol) est un protocole standardisé qui permet à Mistral Vibe de communiquer avec des serveurs externes afin d'utiliser leurs outils.

Grâce à MCP, l'agent peut accéder à des fonctionnalités qui ne sont pas nécessairement intégrées directement dans Mistral Vibe. Par exemple, il peut interagir avec des services externes qui exposent leurs fonctionnalités sous forme d'outils.

## 2. Rôle de MCP dans Mistral Vibe

Dans Mistral Vibe, MCP constitue une troisième source d'outils, en complément des Builtins et des Connectors.

- **Builtins** : outils intégrés directement dans Mistral Vibe.
- **Connectors** : outils permettant d'interagir avec des services externes.
- **MCP** : outils fournis par des serveurs distants qui communiquent selon le protocole Model Context Protocol.

## 3. Fonctionnement général

Le fonctionnement de MCP dans Mistral Vibe peut être résumé en plusieurs étapes :

1. L'utilisateur configure un ou plusieurs serveurs MCP.
2. Le registre MCP (`MCPRegistry`) découvre les outils disponibles sur ces serveurs.
3. Mistral Vibe crée des proxies qui rendent ces outils utilisables par l'agent.
4. L'agent peut appeler ces outils comme les autres outils disponibles.
5. Le résultat de l'appel est récupéré et transmis à l'agent.

## 4. Architecture technique

L'implémentation MCP s'appuie principalement sur plusieurs composants :

- **Registry (`registry.py`)** : gère la découverte des serveurs et des outils disponibles.
- **Tools (`tools.py`)** : construit les proxies et gère les appels aux outils MCP.
- **Pool (`pool.py`)** : gère les connexions STDIO et leur réutilisation.
- **Descriptor cache (`descriptor_cache.py`)** : conserve les descriptions des outils pour éviter des découvertes répétées.
- **Management (`management.py`)** : gère l'ajout et la suppression des serveurs MCP.
- **Authorization (`authorization.py`)** : définit les mécanismes liés à l'autorisation et à l'authentification.

## 5. Modes de communication

Mistral Vibe prend en charge deux modes de communication avec les serveurs MCP :

- **HTTP** : communication avec un serveur distant via HTTP.
- **STDIO** : communication avec un processus local à travers ses entrées et sorties standard.

## 6. Conclusion

MCP permet donc d'étendre les capacités de Mistral Vibe en donnant à l'agent accès à des outils fournis par des serveurs externes. Il s'intègre au système général des outils tout en conservant une gestion spécifique de la découverte, des connexions, des appels et des autorisations.
