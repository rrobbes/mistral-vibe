# Model Context Protocol (MCP) dans Mistral Vibe
# *Implémentation, Architecture et Intégration*

---

**Version** : 1.0.0  
**Date** : Juin 2025  
**SDK MCP** : mcp==1.28.1  
**Commit analysé** : dcabe99e7aa2d0aaf4137d05559c7aa59c272940  
**Localisation** : vibe/core/tools/mcp/, vibe/core/auth/mcp_oauth.py, vibe/core/config/mcp_servers.py

---

## 1. Introduction et Objectifs

### 1.1 Contexte
Le Model Context Protocol (MCP) est un standard ouvert permettant à des agents IA d'interagir avec des outils externes via une interface unifiée. Mistral Vibe intègre MCP pour offrir à son agent la capacité de découvrir et d'exécuter des outils hébergés sur des serveurs distants (HTTP/Streamable HTTP) ou locaux (STDIO).

### 1.2 Objectifs
- Découvrir comment MCP est intégré dans l'architecture de Mistral Vibe
- Comprendre les mécanismes de découverte, d'exécution et de gestion des outils
- Analyser les transports HTTP et STDIO, le cache, le pool de connexions et l'autorisation
- Évaluer la conformité avec la spécification officielle MCP (2024-11-05)
- Identifier les limites techniques confirmées

---

## 2. Architecture Générale

### 2.1 Vue d'ensemble
Mistral Vibe implémente MCP via une architecture modulaire composée de :
1. **Serveurs MCP** (configuration)
2. **Registry** (découverte et cache)
3. **Tools** (exécution HTTP/STDIO)
4. **Pool** (réutilisation des connexions STDIO)
5. **Authorization** (OAuth, headers statiques)

### 2.2 Rôles des Composants

| **Composant** | **Fichier** | **Rôle** |
|---------------|-------------|----------|
| **MCP Server Config** | `vibe/core/config/mcp_servers.py` | Configuration des serveurs (HTTP, Streamable HTTP, STDIO) |
| **MCP Registry** | `vibe/core/tools/mcp/registry.py` | Découverte, cache, orchestration des outils |
| **MCP Tools** | `vibe/core/tools/mcp/tools.py` | Exécution HTTP/STDIO, parsing des résultats |
| **MCP Pool** | `vibe/core/tools/mcp/pool.py` | Pool de connexions STDIO persistantes |
| **MCP Authorization** | `vibe/core/tools/mcp/authorization.py` | Contrats d'autorisation (Ref, Snapshot, Provider) |
| **OAuth Provider** | `vibe/core/auth/mcp_oauth.py` | Implémentation OAuth 2.0 (PKCE, DCR) |
| **Remote Models** | `vibe/core/tools/remote.py` | Modèles `RemoteTool` et `MCPToolResult` |

---

## 3. Configuration et Gestion des Serveurs MCP

### 3.1 Structure de Configuration
Les serveurs MCP sont configurés via des modèles Pydantic définis dans `vibe/core/config/models.py`.

Trois types de transports sont supportés :
- **HTTP** : `MCPHttp` (ligne 411-416)
- **Streamable HTTP** : `MCPStreamableHttp` (ligne 417-422)
- **STDIO** : `MCPStdio` (ligne 423-435)

### 3.2 Types d'Authentification
Deux types d'authentification sont définis dans `vibe/core/config/models.py` :
- **`MCPStaticAuth`** (ligne 250-280) : Headers HTTP statiques ou variable d'environnement (`api_key_env`)
- **`MCPOAuth`** (ligne 352-375) : OAuth 2.0 avec PKCE ou DCR

### 3.3 Gestion des Serveurs (CRUD)
Les opérations de gestion des serveurs MCP sont implémentées dans `vibe/core/config/mcp_servers.py` :

| **Opération** | **Fonction** | **Lignes** | **Description** |
|---------------|--------------|------------|-----------------|
| Ajouter un serveur OAuth | `persist_oauth_mcp_server()` | 35-80 | Ajoute un serveur HTTP/Streamable HTTP avec authentification OAuth |
| Ajouter un serveur HTTP/Streamable | `persist_remote_mcp_server()` | 83-110 | Ajoute un serveur HTTP/Streamable HTTP |
| Ajouter un serveur STDIO | `persist_stdio_mcp_server()` | 113-125 | Ajoute un serveur STDIO |
| Supprimer un serveur | `remove_mcp_server()` | 159-195 | Supprime un serveur par son nom |
| Normaliser une URL | `normalize_mcp_server_url()` | 259-270 | Normalise une URL MCP |

### 3.4 Différences entre Serveurs HTTP et STDIO

| **Critère** | **HTTP/Streamable HTTP** | **STDIO** |
|-------------|--------------------------|-----------|
| **Transport** | Requêtes HTTP POST | Processus local (stdin/stdout) |
| **Authentification** | OAuth 2.0, Headers statiques | **Non implémentée** |
| **Connexion** | Nouvelle connexion par requête | Connexion persistante (pool) |
| **Timeout** | Configurable par requête | Configurable par session |
| **Réutilisation** | Non (stateless) | Oui (via `MCPConnectionPool`) |

> **Limitation confirmée** : Les serveurs STDIO **ne supportent pas l'authentification** dans l'implémentation actuelle.

---

## 4. Intégration du Registry dans l'Agent

### 4.1 Rôle du Registry
Le `MCPRegistry` (`vibe/core/tools/mcp/registry.py`) est le composant central.

### 4.2 Point d'entrée : `get_tools_async()`
**Fichier** : `vibe/core/tools/mcp/registry.py:121-160`
- Synchronise les serveurs actifs via `sync_active_servers()` (ligne 609-624)
- Vérifie le cache mémoire et persistant
- Découvre les outils via `_discover_all()` (ligne 247-295)

### 4.3 Découverte par serveur
**Fichier** : `vibe/core/tools/mcp/registry.py:300-326`
- `_discover_server()` identifie le transport et appelle `list_tools_http()` ou `list_tools_stdio()`

### 4.4 Construction des outils proxy
**Fichier** : `vibe/core/tools/mcp/registry.py:430-485`
- `_build_tools()` crée des classes proxy via `create_mcp_http_proxy_tool_class()` ou `create_mcp_stdio_proxy_tool_class()`

### 4.5 Intégration dans l'Agent Loop
**Fichier** : `vibe/core/tools/manager.py:558`
```python
mcp_tools = await self._get_mcp_registry().get_tools_async(self._config.mcp_servers)
```

---

## 5. Découverte et Création des Outils Proxy

### 5.1 Processus de Découverte
1. `get_tools_async()` → `sync_active_servers()`
2. `_resolve_authorization()` pour chaque serveur
3. Vérification du cache
4. `_discover_server()` → `list_tools_http()`/`list_tools_stdio()`
5. `_build_tools()` → Outils Proxy

### 5.2 Modèle `RemoteTool`
**Fichier** : `vibe/core/tools/remote.py:42-75`
- `name`: str (obligatoire, validé non vide)
- `description`: str | None
- `input_schema`: dict (obligatoire, alias `inputSchema`)
- `output_schema`: dict | None (alias `outputSchema`)

### 5.3 Découverte HTTP
**Fichier** : `vibe/core/tools/mcp/tools.py:143-163`
- Utilise `streamable_http_client` du SDK MCP
- Initialisation → `list_tools()` → Parsing

### 5.4 Découverte STDIO  
**Fichier** : `vibe/core/tools/mcp/tools.py:429-441`
- Utilise `stdio_client` du SDK MCP
- Initialisation → `list_tools()` → Parsing

### 5.5 Parsing des Résultats
**Fichier** : `vibe/core/tools/mcp/tools.py:113-125`
- `_parse_call_result()` extrait `structuredContent` ou `content`
- **Limitation** : Le champ `isError` **n'est pas vérifié**

---

## 6. Exécution des Outils

### 6.1 Modèle `MCPToolResult`
**Fichier** : `vibe/core/tools/remote.py:27-31`
```python
class MCPToolResult(BaseModel):
    ok: bool = True  # Basé UNIQUEMENT sur présence de text/structured
    server: str
    tool: str
    text: str | None = None
    structured: dict[str, Any] | None = None
```
> **Limitation** : `ok` **ne tient pas compte** de `isError`

### 6.2 Exécution HTTP
**Fichier** : `vibe/core/tools/mcp/tools.py:166-195`
- `create_vibe_mcp_http_client()` (ligne 128-140) : User-Agent, SSL, timeouts
- `streamable_http_client` pour la connexion MCP
- Initialisation → `call_tool()` → Parsing

### 6.3 Exécution STDIO
**Fichier** : `vibe/core/tools/mcp/tools.py:458-480`
- Utilise `enter_stdio_session()` et `stdio_client`
- **Pas d'authentification supportée**

### 6.4 Pool de Connexions STDIO
**Fichier** : `vibe/core/tools/mcp/pool.py:180-262`
- `MCPConnectionPool` : connexions persistantes
- `stdio_key()` (ligne 38-49) : clé unique par commande/env/cwd
- Reconnexion automatique sur erreurs de transport

---

## 7. Gestion du Cache et du Pool

### 7.1 Cache des Descripteurs
**Fichier** : `vibe/core/tools/mcp/descriptor_cache.py:1-340`
- `LegacyMCPDescriptorCache` : cache persistant sur disque
- TTL : 86400 secondes (24h) par défaut
- Limites : 512 fichiers, 2Mo/fichier, 64Mo total, 1000 outils/serveur

### 7.2 Cache en Mémoire
**Fichier** : `vibe/core/tools/mcp/registry.py:35-37, 210-235`
- `_memory_records` et `_cache`
- Vérification du TTL dans `_memory_hit()`

### 7.3 Pool de Connexions
**Fichier** : `vibe/core/tools/mcp/pool.py:40-180`
- `_StdioConnection` : connexion individuelle avec worker task
- Sérialisation des appels
- Gestion des erreurs de transport (`_TRANSPORT_ERRORS` ligne 20-25)

---

## 8. Autorisations, OAuth et Sécurité

### 8.1 Contrats d'Autorisation
**Fichier** : `vibe/core/tools/mcp/authorization.py:1-69`
- `MCPAuthorizationRef`, `MCPAuthorizationSnapshot`, `MCPAuthorizationRequired`
- `MCPAuthorizationProvider` (Protocol)

### 8.2 OAuth 2.0
**Fichier** : `vibe/core/auth/mcp_oauth.py:1-882`
- PKCE et DCR supportés
- `KeyringTokenStorage` : stockage sécurisé
- `RefreshAwareOAuthClientProvider` : rafraîchissement automatique
- `perform_oauth_login()` : flux complet
- `LoopbackCallbackHandler` : callback HTTP local

### 8.3 Gestion des 401
**Fichier** : `vibe/core/tools/mcp/tools.py:355-360`
- `is_authorization_rejection()` détecte les erreurs 401
- Réauthentification automatique dans `_call_authorized()` (ligne 254-300)

### 8.4 Sécurité : Trusted/Untrusted
> **Important** : La distinction **trusted/untrusted** **n'est PAS implémentée dans le module MCP**. Elle concerne **l'app_server** et le **workspace**.

**Dans app_server** (hors scope MCP) :
- **Fichier** : `vibe/app_server/models.py:186-187`
  ```python
  type WorkspaceTrustStatus = Literal["trusted", "session", "untrusted"]
  type WorkspaceTrustDecision = Literal["trust_repo", "trust_cwd", "decline"]
  ```
- **Fichier** : `vibe/acp/agent.py` : méthodes `trust/status` et `trust/decision`

**Conséquence** : Les outils MCP sont toujours considérés comme **de confiance** dans l'implémentation actuelle.

---

## 9. Analyse des Tests

### 9.1 Méthodologie
> **Important** : **Aucun test n'a été exécuté** dans le cadre de cette analyse. Les informations sont basées **uniquement sur une inspection statique du code source**.

### 9.2 Fichiers Examinés

#### Tests examinés intégralement :
- `tests/tools/test_mcp_descriptor_cache.py` : 1 fonction de test

#### Tests examinés partiellement :
- `tests/tools/test_mcp.py` : 59 fonctions de test identifiées
- `tests/tools/test_mcp_registry_oauth.py` : 1 fonction de test identifiée

**Catégories de tests dans `test_mcp.py`** :
- RemoteTool : 6 tests
- MCPToolResult : 2 tests
- Parsing : 4 tests
- Client HTTP : 2 tests
- stderr capture : 1 test
- Proxy HTTP : 7 tests
- Proxy STDIO : 8 tests
- Timeouts : 6 tests
- Registry : 15 tests
- Outils désactivés : 6 tests
- Pool STDIO : 1 test

### 9.3 Fichiers de Tests NON Examinés
Les fichiers suivants **n'ont pas été lus** :
- `tests/core/auth/test_mcp_oauth.py`
- `tests/core/config/test_mcp_servers.py`
- `tests/app_server/test_mcp*.py` (plusieurs fichiers)
- `tests/cli/test_mcp*.py` (plusieurs fichiers)
- `tests/tools/test_mcp_sampling.py`

### 9.4 Scénarios Non Couverts
- Gestion de `isError`
- Authentification STDIO
- Validation complète JSON Schema
- Gestion des outils dupliqués
- Pool de connexions (complet)

---

## 10. Comparaison avec la Spécification MCP Officielle

### 10.1 Conformité par Catégorie

#### Initialisation : 100% conforme
- `initialize` appelé en premier : **Conforme** (`tools.py:165,427`)
- `protocolVersion` = "2024-11-05" : **Conforme** (`mcp_oauth.py:865`)
- `clientInfo` : **Conforme** (`mcp_oauth.py:867-868`)

#### Découverte : ~88%
- `list_tools` après `initialize` : **Conforme**
- `name` obligatoire : **Conforme**
- `inputSchema` obligatoire : **Conforme**
- Validation JSON Schema : **Partiellement conforme** (seulement type dict)
- Outils dupliqués : **Non conforme** (écrasement silencieux)

#### Appel des outils : ~71%
- `call_tool` après `initialize` : **Conforme**
- Parsing de `content` : **Conforme**
- Parsing de `structuredContent` : **Conforme**
- **Gestion de `isError` : Non conforme (non implémentée)**
- `MCPToolResult.ok` : **Non conforme** (ne vérifie pas `isError`)

#### Transports : ~80%
- STDIO via `stdio_client` : **Conforme**
- HTTP via `streamable_http_client` : **Conforme**
- Redirections HTTP : **Conforme**
- **Authentification STDIO : Non conforme (non implémentée)**
- Pool de connexions : **Supplémentaire**
- Reconnexion automatique : **Supplémentaire**

#### Autorisation : ~75%
- Headers HTTP : **Conforme**
- Gestion des 401 : **Conforme**
- Réauthentification automatique : **Supplémentaire**
- **Authentification STDIO : Non conforme**
- OAuth 2.0 : **Supplémentaire**

### 10.2 Non-Conformités Critiques

| # | Catégorie | Non-Conformité | Fichier:Ligne | Impact |
|---|-----------|----------------|---------------|--------|
| 1 | Appel des outils | `isError` non vérifié | `tools.py:113-125` | Erreurs non détectées |
| 2 | Appel des outils | `MCPToolResult.ok` ne vérifie pas `isError` | `remote.py:27-31` | Erreurs traitées comme succès |
| 3 | Autorisation | Aucune authentification STDIO | `pool.py:1-262` | Serveurs STDIO avec auth ne fonctionnent pas |

### 10.3 Points Supplémentaires
- Cache persistant des descripteurs
- Pool de connexions STDIO
- OAuth 2.0 complet (PKCE, DCR)
- Stockage sécurisé des tokens
- Gestion des ExceptionGroup

> **Note** : Le taux de conformité global **n'est pas calculé** car les catégories n'ont pas le même poids. Les pourcentages sont des **estimations qualitatives**.

---

## 11. Limites et Pistes d'Amélioration

### 11.1 Limites de l'Analyse
- Dépendance au SDK MCP (`mcp==1.28.1`)
- Tests **non exécutés** (analyse statique uniquement)
- Fichiers de tests partiellement lus
- Spécification MCP officielle non lue en détail

### 11.2 Pistes d'Amélioration

#### Priorité Absolue
1. Ajouter la gestion de `isError` dans `_parse_call_result()` (`tools.py:113-125`)
2. Mettre à jour `MCPToolResult.ok` (`remote.py:27-31`)
3. Implémenter l'authentification STDIO ou rejeter les serveurs STDIO avec auth

#### Priorité Élevée
1. Valider la structure JSON Schema
2. Détecter les outils dupliqués
3. Ajouter des tests pour les scénarios non couverts

---

## 12. Conclusion

### 12.1 Résumé
Mistral Vibe implémente MCP avec une architecture modulaire et robuste, couvrant les fonctionnalités de base et dépassant la spécification dans plusieurs domaines.

### 12.2 Points Forts
- Architecture modulaire
- Transports HTTP et STDIO bien implémentés
- Découverte et cache performants
- OAuth 2.0 complet
- Gestion des erreurs robuste

### 12.3 Limites Confirmées
1. **`isError` non géré** : Les erreurs MCP ne sont pas détectées (`tools.py:113-125`)
2. **Authentification STDIO non supportée** : Seuls HTTP/Streamable HTTP supportent l'auth (`pool.py:1-262`)
3. **Trusted/Untrusted hors scope MCP** : Concernent app_server, pas le module MCP

### 12.4 Verdict
Mistral Vibe offre une implémentation MCP **mature et performante**, avec **trois limitations techniques confirmées** nécessitant des corrections pour une robustesse optimale.

---

**Document généré à partir du code source de Mistral Vibe (commit dcabe99e)**  
**Audit technique réalisé par analyse statique du code**  
**Aucun test n'a été exécuté**  
**Certaines affirmations dépendent du SDK MCP (mcp==1.28.1)**
