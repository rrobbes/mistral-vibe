# BackendLike et APIAdapter : Les Fondations du Module Backend

> **Module** : `vibe/core/llm/backend/` 
> **Fork** : `rrobbes/mistral-vibe` 
> **Partie** : 3/13 - Les Classes de Base

---

## Introduction

Ce document explique **les deux classes fondamentales** sur lesquelles repose tout le module `backend/` :

1. **`BackendLike`** : Le **Protocol** (interface) que tous les backends doivent implémenter
2. **`APIAdapter`** : La **classe abstraite** qui définit comment traduire entre Vibe et les API externes

Ces deux composants forment **l'ossature** du module et permettent son **extensibilité** et sa **flexibilité**.

---

## ️ BackendLike : L'Interface Universelle

### Qu'est-ce qu'un Protocol ?

En Python, un **Protocol** (introduit dans Python 3.8 via PEP 544) est une manière de définir une **interface** sans utiliser l'héritage. C'est le **duck typing structuré** : si une classe implémente toutes les méthodes d'un Protocol, elle est considérée comme compatible, même sans héritage explicite.

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class MonProtocol(Protocol):
 def methode_obligatoire(self) -> str: ...

class MaClasse:
 def methode_obligatoire(self) -> str:
 return "Hello"

# MaClasse est compatible avec MonProtocol même sans héritage
assert isinstance(MaClasse(), MonProtocol)
```

### Définition de BackendLike

`BackendLike` est défini dans `vibe/core/llm/types.py` :

```python
from typing import Protocol, runtime_checkable
from collections.abc import AsyncGenerator, Sequence
import types

from vibe.core.types import LLMChunk, LLMMessage, ModelConfig, AvailableTool, StrToolChoice

@runtime_checkable
class BackendLike(Protocol):
 """Port protocol for dependency-injectable LLM backends.
 
 Any backend used by AgentLoop should implement this async context manager
 interface with `complete` and `complete_streaming` methods.
 """

 async def __aenter__(self) -> "BackendLike": ...
 async def __aexit__(
 self,
 exc_type: type[BaseException] | None,
 exc_val: BaseException | None,
 exc_tb: types.TracebackType | None,
 ) -> None: ...

 async def complete(
 self,
 *,
 model: ModelConfig,
 messages: Sequence[LLMMessage],
 temperature: float,
 tools: list[AvailableTool] | None,
 max_tokens: int | None,
 tool_choice: StrToolChoice | AvailableTool | None,
 extra_headers: dict[str, str] | None,
 metadata: dict[str, str] | None = None,
 ) -> LLMChunk: ...

 def complete_streaming(
 self,
 *,
 model: ModelConfig,
 messages: Sequence[LLMMessage],
 temperature: float,
 tools: list[AvailableTool] | None,
 max_tokens: int | None,
 tool_choice: StrToolChoice | AvailableTool | None,
 extra_headers: dict[str, str] | None,
 metadata: dict[str, str] | None = None,
 ) -> AsyncGenerator[LLMChunk, None]: ...
```

### Analyse des Méthodes

#### 1. Context Manager Async

```python
async def __aenter__(self) -> "BackendLike": ...
async def __aexit__(self, exc_type, exc_val, exc_tb) -> None: ...
```

**Pourquoi ces méthodes ?**

Elles permettent d'utiliser le backend avec le **pattern context manager async** (`async with`) :

```python
async with backend:
 # Le backend est initialisé et prêt à l'emploi
 chunk = await backend.complete(...)
# Le backend est proprement fermé, les ressources sont libérées
```

**Ce que fait `__aenter__`** :
- Initialise le client HTTP (si ce n'est pas déjà fait)
- Configure les connexions
- Prépare le backend pour l'utilisation

**Ce que fait `__aexit__`** :
- Ferme le client HTTP
- Libère les ressources (files, sockets, connexions)
- Effectue le cleanup même en cas d'erreur

**Avantages** :
- **Gestion automatique des ressources** : Pas besoin de se souvenir de fermer le backend
- **Sécurité** : Les ressources sont libérées même en cas d'exception
- **Lisibilité** : Le code est plus propre et plus clair

#### 2. `complete()` - Requête Synchrone

```python
async def complete(
 self,
 *,
 model: ModelConfig,
 messages: Sequence[LLMMessage],
 temperature: float,
 tools: list[AvailableTool] | None,
 max_tokens: int | None,
 tool_choice: StrToolChoice | AvailableTool | None,
 extra_headers: dict[str, str] | None,
 metadata: dict[str, str] | None = None,
) -> LLMChunk:
```

**Paramètres** :

| Paramètre | Type | Description | Obligatoire |
|-----------|------|-------------|-------------|
| `model` | `ModelConfig` | Configuration du modèle à utiliser | Oui |
| `messages` | `Sequence[LLMMessage]` | Historique de la conversation | Oui |
| `temperature` | `float` | Niveau de créativité (0.0 à 1.0) | Oui |
| `tools` | `list[AvailableTool] \| None` | Outils disponibles pour le modèle | Non |
| `max_tokens` | `int \| None` | Nombre maximum de tokens à générer | Non |
| `tool_choice` | `StrToolChoice \| AvailableTool \| None` | Comment choisir les outils | Non |
| `extra_headers` | `dict[str, str] \| None` | Headers HTTP supplémentaires | Non |
| `metadata` | `dict[str, str] \| None` | Métadonnées pour le tracing | Non |

**Retour** : `LLMChunk` - Un chunk contenant la réponse complète

**Cas d'usage** :
- Requêtes simples où on veut toute la réponse d'un coup
- Tests où on n'a pas besoin de streaming
- Outils qui traitent la réponse complète

**Exemple** :
```python
async with backend:
 chunk = await backend.complete(
 model=model,
 messages=messages,
 temperature=0.2
 )
 print(chunk.message.content)
```

#### 3. `complete_streaming()` - Requête Asynchrone

```python
def complete_streaming(
 self,
 *,
 model: ModelConfig,
 messages: Sequence[LLMMessage],
 temperature: float,
 tools: list[AvailableTool] | None,
 max_tokens: int | None,
 tool_choice: StrToolChoice | AvailableTool | None,
 extra_headers: dict[str, str] | None,
 metadata: dict[str, str] | None = None,
) -> AsyncGenerator[LLMChunk, None]:
```

**Paramètres** : Identiques à `complete()`

**Retour** : `AsyncGenerator[LLMChunk, None]` - Un générateur asynchrone qui yield des chunks

**Cas d'usage** :
- Interface utilisateur interactive (affichage progressif)
- Longues générations où on veut montrer la progression
- Traitement incrémental des réponses

**Exemple** :
```python
async with backend:
 async for chunk in backend.complete_streaming(
 model=model,
 messages=messages,
 temperature=0.7
 ):
 # Affiche chaque morceau de réponse au fur et à mesure
 print(chunk.message.content, end="", flush=True)
```

### Pourquoi BackendLike est-il Important ?

1. **Abstraction** : Le code utilisateur (AgentLoop) ne voit que l'interface, pas l'implémentation
2. **Polymorphisme** : On peut passer n'importe quel backend tant qu'il implémente le protocol
3. **Extensibilité** : Ajouter un nouveau backend = implémenter BackendLike
4. **Testabilité** : Facile de créer des mocks (FakeBackend)
5. **Découplage** : AgentLoop n'a pas besoin de connaître les détails des backends

### Implémentations de BackendLike

Actuellement, ces classes implémentent BackendLike :

| Classe | Fichier | Description |
|--------|---------|-------------|
| `GenericBackend` | `generic.py` | Backend HTTP pour la plupart des providers |
| `MistralBackend` | `mistral.py` | Backend utilisant le SDK Mistral |
| `FakeBackend` | `tests/stubs/` | Backend mock pour les tests |

**À venir** : D'autres backends pourront être ajoutés en implémentant simplement ce protocol.

---

## APIAdapter : Le Traducteur Universel

### Qu'est-ce qu'une Classe Abstraite (ABC) ?

En Python, une **Abstract Base Class** (ABC) est une classe qui :
- Ne peut pas être instanciée directement
- Définit une **interface** (méthodes abstraites) que les sous-classes doivent implémenter
- Peut contenir des **méthodes concrètes** (implémentées)

```python
from abc import ABC, abstractmethod

class MaClasseAbstraite(ABC):
 @abstractmethod
 def methode_obligatoire(self): ... # Doit être implémentée
 
 def methode_facultative(self): # Peut être héritée
 print("Implémentation par défaut")

class MaSousClasse(MaClasseAbstraite):
 def methode_obligatoire(self):
 print("Implémentation requise")
```

### Définition de APIAdapter

`APIAdapter` est défini dans `vibe/core/llm/backend/base.py` :

```python
from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator, Sequence
from typing import Any, ClassVar

from vibe.core.types import LLMChunk, LLMMessage, AvailableTool, StrToolChoice
from vibe.core.config import ProviderConfig

class APIAdapter(ABC):
 """Abstract base class for API-specific adapters.
 
 Adapters handle the conversion between Vibe's internal types and
 the specific API formats of different LLM providers.
 """

 endpoint: ClassVar[str]
 """The API endpoint for this adapter (e.g., "/chat/completions")."""

 @abstractmethod
 def prepare_request(
 self,
 *,
 model_name: str,
 messages: Sequence[LLMMessage],
 temperature: float,
 tools: list[AvailableTool] | None,
 max_tokens: int | None,
 tool_choice: StrToolChoice | AvailableTool | None,
 enable_streaming: bool,
 provider: ProviderConfig,
 api_key: str | None = None,
 thinking: str = "off",
 ) -> PreparedRequest:
 """Prepare a request for the specific API."""
 ...

 @abstractmethod
 def parse_response(
 self,
 data: dict[str, Any],
 provider: ProviderConfig,
 ) -> LLMChunk:
 """Parse a response from the specific API into a LLMChunk."""
 ...

 async def parse_stream(
 self,
 responses: AsyncGenerator[dict[str, Any]],
 provider: ProviderConfig,
 ) -> AsyncGenerator[ParsedStreamChunk]:
 """Parse a stream of responses from the specific API."""
 async with aclosing(responses):
 async for data in responses:
 yield ParsedStreamChunk(data, self.parse_response(data, provider))
```

### Analyse des Composants

#### 1. ClassVar : endpoint

```python
endpoint: ClassVar[str]
```

**Qu'est-ce que `ClassVar` ?** : Indique que cette variable est **propre à la classe** (pas à l'instance).

**Exemples** :
```python
class OpenAIAdapter(APIAdapter):
 endpoint = "/chat/completions"

class AnthropicAdapter(APIAdapter):
 endpoint = "/v1/messages"

class OpenAIResponsesAdapter(APIAdapter):
 endpoint = "/responses"
```

**Utilité** : Permet de connaître le point d'entrée de l'API pour chaque adapter.

#### 2. `prepare_request()` - Préparation de la Requête

```python
@abstractmethod
def prepare_request(
 self,
 *,
 model_name: str,
 messages: Sequence[LLMMessage],
 temperature: float,
 tools: list[AvailableTool] | None,
 max_tokens: int | None,
 tool_choice: StrToolChoice | AvailableTool | None,
 enable_streaming: bool,
 provider: ProviderConfig,
 api_key: str | None = None,
 thinking: str = "off",
) -> PreparedRequest:
```

**Paramètres** :

| Paramètre | Type | Description |
|-----------|------|-------------|
| `model_name` | `str` | Nom du modèle à utiliser |
| `messages` | `Sequence[LLMMessage]` | Messages de la conversation |
| `temperature` | `float` | Niveau de créativité |
| `tools` | `list[AvailableTool] \| None` | Outils disponibles |
| `max_tokens` | `int \| None` | Limite de tokens |
| `tool_choice` | `StrToolChoice \| AvailableTool \| None` | Comment choisir les outils |
| `enable_streaming` | `bool` | Si on veut du streaming |
| `provider` | `ProviderConfig` | Configuration du provider |
| `api_key` | `str \| None` | Clé API (optionnelle, peut venir du provider) |
| `thinking` | `str` | Niveau de reasoning ("off", "low", "medium", etc.) |

**Retour** : `PreparedRequest` - Une structure contenant :
- `endpoint` : Le point d'entrée (peut être différent de `self.endpoint`)
- `headers` : Les headers HTTP
- `body` : Le corps de la requête (bytes)
- `base_url` : L'URL de base (optionnelle)

**Ce que fait cette méthode** :
1. **Convertit les messages** : `LLMMessage` → Format spécifique de l'API
2. **Convertit les outils** : `AvailableTool` → Format des outils de l'API
3. **Ajoute les paramètres** : temperature, max_tokens, thinking, etc.
4. **Gère le streaming** : Ajoute `stream: true` si nécessaire
5. **Constitue la requête** : Crée le JSON et l'encode

**Exemple d'implémentation (simplifié)** :
```python
class OpenAIAdapter(APIAdapter):
 endpoint = "/chat/completions"
 
 def prepare_request(self, *, model_name, messages, temperature, ...):
 # 1. Convertir les messages
 converted_messages = [
 {"role": msg.role.value, "content": msg.content}
 for msg in messages
 ]
 
 # 2. Construire la payload
 payload = {
 "model": model_name,
 "messages": converted_messages,
 "temperature": temperature,
 }
 
 # 3. Ajouter le streaming si nécessaire
 if enable_streaming:
 payload["stream"] = True
 payload["stream_options"] = {"include_usage": True}
 
 # 4. Construire les headers
 headers = {"Content-Type": "application/json"}
 if api_key:
 headers["Authorization"] = f"Bearer {api_key}"
 
 # 5. Retourner la requête préparée
 body = json.dumps(payload).encode("utf-8")
 return PreparedRequest(
 endpoint=self.endpoint,
 headers=headers,
 body=body
 )
```

#### 3. `parse_response()` - Parsing de la Réponse

```python
@abstractmethod
def parse_response(
 self,
 data: dict[str, Any],
 provider: ProviderConfig,
) -> LLMChunk:
```

**Paramètres** :
- `data` : La réponse brute de l'API (dictionnaire JSON)
- `provider` : Configuration du provider (pour des informations spécifiques)

**Retour** : `LLMChunk` - La réponse parsée dans le format Vibe

**Ce que fait cette méthode** :
1. **Extraire les données** : Contenu, tool calls, reasoning depuis la réponse
2. **Convertir en objets Vibe** : Créer `LLMMessage`, `LLMUsage`, `StopInfo`
3. **Normaliser** : Retirer les champs spécifiques à l'API, garder seulement ce que Vibe utilise
4. **Gérer les spécificités** : Chaque API retourne les données différemment

**Exemple de données d'entrée (OpenAI)** :
```json
{
 "id": "chatcmpl-abc123",
 "object": "chat.completion",
 "created": 1234567890,
 "model": "gpt-4",
 "choices": [
 {
 "index": 0,
 "message": {
 "role": "assistant",
 "content": "Bonjour !",
 "tool_calls": null
 },
 "finish_reason": "stop"
 }
 ],
 "usage": {
 "prompt_tokens": 10,
 "completion_tokens": 5,
 "total_tokens": 15
 }
}
```

**Exemple de données d'entrée (Anthropic)** :
```json
{
 "id": "msg_abc123",
 "type": "message",
 "role": "assistant",
 "content": [
 {"type": "text", "text": "Bonjour !"}
 ],
 "model": "claude-3-sonnet",
 "stop_reason": "end_turn",
 "stop_sequence": null,
 "usage": {
 "input_tokens": 10,
 "output_tokens": 5
 }
}
```

**Exemple d'implémentation (simplifié)** :
```python
class OpenAIAdapter(APIAdapter):
 def parse_response(self, data, provider):
 # 1. Extraire le message
 choice = data["choices"][0]
 message_dict = choice["message"]
 
 # 2. Créer LLMMessage
 message = LLMMessage(
 role=Role(message_dict["role"]),
 content=message_dict.get("content"),
 tool_calls=self._parse_tool_calls(message_dict.get("tool_calls"))
 )
 
 # 3. Extraire l'usage
 usage_data = data.get("usage", {})
 usage = LLMUsage(
 prompt_tokens=usage_data.get("prompt_tokens", 0),
 completion_tokens=usage_data.get("completion_tokens", 0)
 )
 
 # 4. Extraire la raison d'arrêt
 stop = StopInfo(reason=choice.get("finish_reason"))
 
 # 5. Retourner le chunk
 return LLMChunk(
 message=message,
 usage=usage,
 stop=stop
 )
```

#### 4. `parse_stream()` - Parsing du Stream

```python
async def parse_stream(
 self,
 responses: AsyncGenerator[dict[str, Any]],
 provider: ProviderConfig,
) -> AsyncGenerator[ParsedStreamChunk]:
```

**Paramètres** :
- `responses` : Un générateur asynchrone de chunks bruts (dictionnaires JSON)
- `provider` : Configuration du provider

**Retour** : `AsyncGenerator[ParsedStreamChunk]` - Un générateur de chunks parsés

**Ce que fait cette méthode** :
1. Pour chaque chunk brut du stream
2. Parse le chunk en `LLMChunk` via `parse_response()`
3. Yield un `ParsedStreamChunk` contenant le chunk brut et le chunk parsé

**Implémentation par défaut** :
```python
async def parse_stream(
 self, responses: AsyncGenerator[dict[str, Any]], provider: ProviderConfig
) -> AsyncGenerator[ParsedStreamChunk]:
 async with aclosing(responses):
 async for data in responses:
 yield ParsedStreamChunk(data, self.parse_response(data, provider))
```

**Note** : Certains adapters (comme `AnthropicAdapter` ou `OpenAIResponsesAdapter`) **surchargent** cette méthode pour gérer des streams plus complexes avec état.

### Pourquoi APIAdapter est-il Important ?

1. **Isolation des formats** : Chaque provider a son propre format, l'adapter le gère
2. **Centralisation** : La logique de conversion est au même endroit
3. **Maintenabilité** : Si une API change, seul l'adapter correspondant doit être modifié
4. **Extensibilité** : Ajouter un provider = créer un nouvel adapter
5. **Testabilité** : Facile de tester chaque adapter indépendamment

### Implémentations de APIAdapter

Actuellement, ces classes implémentent APIAdapter :

| Classe | Fichier | Provider | Complexité |
|--------|---------|----------|------------|
| `OpenAIAdapter` | `generic.py` | OpenAI, OpenRouter, Local LLM | Moyenne |
| `AnthropicAdapter` | `anthropic.py` | Anthropic | Élevée |
| `OpenAIResponsesAdapter` | `openai_responses.py` | OpenAI (Nouvelle API) | Élevée |
| `ReasoningAdapter` | `reasoning_adapter.py` | Providers avec reasoning | Simple |
| `VertexAnthropicAdapter` | `vertex.py` | Vertex AI (Anthropic) | Moyenne |

---

## Interaction entre BackendLike et APIAdapter

### Comment Ils Travailent Ensemble

### Exemple Complet : Requête avec GenericBackend

```python
# 1. Création du backend
backend = create_backend(provider=provider_config)

# 2. Appel à complete()
async with backend:
 chunk = await backend.complete(
 model=model,
 messages=messages,
 temperature=0.2
 )
```

**Ce qui se passe sous le capot** :

```python
# Dans GenericBackend.complete()

# Étape 1 : Résoudre les credentials
api_key, api_key_origin = self._resolve_credential(api_style)

# Étape 2 : Sélectionner l'adapter
adapter = _get_adapter(api_style) # Retourne OpenAIAdapter() par exemple

# Étape 3 : Préparer la requête
req = adapter.prepare_request(
 model_name=model.name,
 messages=messages,
 temperature=temperature,
 tools=None,
 max_tokens=None,
 tool_choice=None,
 enable_streaming=False,
 provider=self._provider,
 api_key=api_key,
 thinking=model.thinking,
)

# Étape 4 : Envoyer la requête HTTP
url = f"{req.base_url or self._provider.api_base}{req.endpoint}"
response = await self._make_request(url, req.body, req.headers)

# Étape 5 : Parser la réponse
chunk = adapter.parse_response(response.data, self._provider)

# Étape 6 : Retourner le résultat
return chunk
```

### Comprendre la Séparation

| Responsabilité | BackendLike | APIAdapter |
|----------------|-------------|-------------|
| Transport HTTP | Oui | Non |
| Gestion du streaming | Oui | ️ Partiel |
| Retry et Pacing | Oui | Non |
| Tracing | Oui | Non |
| Conversion des formats | Non | Oui |
| Parsing des réponses | Non | Oui |
| Gestion des spécificités API | Non | Oui |

**BackendLike** = **Transport et Logique Métier** 
**APIAdapter** = **Traduction et Parsing**

---

## Fonctions Utilitaires dans base.py

Le fichier `base.py` contient également des **fonctions utilitaires** partagées par tous les adapters :

### 1. `apply_reasoning_effort()`

```python
def apply_reasoning_effort(payload: dict[str, Any], thinking: str) -> None:
 if thinking != "off":
 payload["reasoning_effort"] = thinking
```

**Rôle** : Ajoute le champ `reasoning_effort` à la payload si le reasoning est activé.

**Utilisation** :
```python
payload = {"model": "gpt-4", "messages": messages}
apply_reasoning_effort(payload, "high")
# payload = {"model": "gpt-4", "messages": messages, "reasoning_effort": "high"}
```

### 2. `build_chat_payload()`

```python
def build_chat_payload(
 *,
 model_name: str,
 messages: list[dict[str, Any]],
 temperature: float,
 tools: list[AvailableTool] | None,
 max_tokens: int | None,
 tool_choice: StrToolChoice | AvailableTool | None,
 thinking: str,
) -> dict[str, Any]:
 payload: dict[str, Any] = {
 "model": model_name,
 "messages": messages,
 "temperature": temperature,
 }
 apply_reasoning_effort(payload, thinking)
 if tools:
 payload["tools"] = [tool.model_dump(exclude_none=True) for tool in tools]
 if tool_choice:
 payload["tool_choice"] = (
 tool_choice if isinstance(tool_choice, str) else tool_choice.model_dump()
 )
 if max_tokens is not None:
 payload["max_tokens"] = max_tokens
 return payload
```

**Rôle** : Construit une **payload de chat standardisée** avec tous les paramètres courants.

**Utilisation** :
```python
payload = build_chat_payload(
 model_name="gpt-4",
 messages=converted_messages,
 temperature=0.2,
 tools=tools,
 max_tokens=100,
 tool_choice="auto",
 thinking="medium"
)
```

### 3. `build_auth_headers()`

```python
def build_auth_headers(api_key: str | None) -> dict[str, str]:
 headers: dict[str, str] = {"Content-Type": "application/json"}
 if api_key:
 headers["Authorization"] = f"Bearer {api_key}"
 return headers
```

**Rôle** : Construit les **headers d'authentification** pour une requête API.

**Utilisation** :
```python
headers = build_auth_headers("sk-1234567890")
# headers = {"Content-Type": "application/json", "Authorization": "Bearer sk-1234567890"}
```

### 4. `finalize_chat_request()`

```python
def finalize_chat_request(
 *,
 payload: dict[str, Any],
 enable_streaming: bool,
 stream_options: dict[str, Any],
 api_key: str | None,
 endpoint: str,
) -> PreparedRequest:
 if enable_streaming:
 payload["stream"] = True
 payload["stream_options"] = stream_options
 headers = build_auth_headers(api_key)
 body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
 return PreparedRequest(endpoint, headers, body)
```

**Rôle** : Finalise une requête en ajoutant le streaming, les headers et en encodant le body.

**Utilisation** :
```python
payload = build_chat_payload(...)
req = finalize_chat_request(
 payload=payload,
 enable_streaming=True,
 stream_options={"include_usage": True},
 api_key="sk-1234567890",
 endpoint="/chat/completions"
)
```

### 5. Types Utilitaires

**`PreparedRequest`** : Structure immutable pour une requête préparée
```python
class PreparedRequest(NamedTuple):
 endpoint: str
 headers: dict[str, str]
 body: bytes
 base_url: str = ""
```

**`ParsedStreamChunk`** : Structure pour un chunk de stream parsé
```python
class ParsedStreamChunk(NamedTuple):
 data: dict[str, Any] # Données brutes
 chunk: LLMChunk # Chunk parsé
```

---

## À Retenir

### Points Clés sur BackendLike

1. **C'est un Protocol** : Interface sans héritage, basée sur le duck typing
2. **3 méthodes obligatoires** : `__aenter__`, `__aexit__`, `complete`, `complete_streaming`
3. **Permet le polymorphisme** : Tous les backends sont interchangeables
4. **Gère le transport** : HTTP, SDK, streaming, retry, pacing
5. **Ne gère pas la conversion** : C'est le rôle des adapters

### Points Clés sur APIAdapter

1. **C'est une ABC** : Classe abstraite qui définit une interface
2. **3 méthodes abstraites** : `endpoint`, `prepare_request`, `parse_response`
3. **1 méthode concrète** : `parse_stream` (implémentation par défaut)
4. **Gère la conversion** : Messages, outils, images entre Vibe et les API
5. **Spécifique à un provider** : Chaque provider a son adapter

### Comment Ils Interagissent

```
BackendLike (Transport) + APIAdapter (Traduction) = Backend Complet
```

**BackendLike** = **Comment** envoyer/recevoir les données 
**APIAdapter** = **Que** envoyer/recevoir et **comment** les traduire

### Prochaine Étape

Pour comprendre **comment les backends sont créés**, lisez :
→ **[Factory : Création Intelligente des Backends](./04-FACTORY.md)**
