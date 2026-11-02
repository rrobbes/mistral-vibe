# ️ Configuration et Utilisation du Module Backend LLM

> **Module** : `vibe/core/llm/backend/` 
> **Fork** : `rrobbes/mistral-vibe` 
> **Partie** : 12/13 - Guide Pratique d'Utilisation

---

## Introduction

Ce document est un **guide pratique** pour comprendre comment **configurer** et **utiliser** le module backend LLM dans Mistral Vibe. Contrairement aux documents précédents qui expliquent l'architecture et la conception, ce document se concentre sur **l'utilisation concrète** du module.

> ** Public Cible** :
> - Développeurs qui veulent utiliser le module backend dans leur code
> - Contributeurs qui doivent tester ou étendre le module
> - Utilisateurs avancés qui veulent comprendre comment Vibe interagit avec les API LLM

---

## ️ Table des Matières

1. [Prérequis](#1-prérequis)
2. [Configuration de Base](#2-configuration-de-base)
 - [2.1. Configuration d'un Provider](#21-configuration-dun-provider)
 - [2.2. Configuration des Timeouts](#22-configuration-des-timeouts)
 - [2.3. Configuration des Options de Retry](#23-configuration-des-options-de-retry)
3. [Création d'un Backend](#3-création-dun-backend)
 - [3.1. Via la Factory (Méthode Recommandée)](#31-via-la-factory-méthode-recommandée)
 - [3.2. Instanciation Directe](#32-instanciation-directe)
4. [Utilisation de Base](#4-utilisation-de-base)
 - [4.1. Requête Synchrone (Non-Streaming)](#41-requête-synchrone-non-streaming)
 - [4.2. Requête Asynchrone (Streaming)](#42-requête-asynchrone-streaming)
5. [Gestion des Messages](#5-gestion-des-messages)
 - [5.1. Construction des Messages](#51-construction-des-messages)
 - [5.2. Gestion des Images](#52-gestion-des-images)
 - [5.3. Gestion des Tool Calls](#53-gestion-des-tool-calls)
6. [Configuration Avancée](#6-configuration-avancée)
 - [6.1. Configuration du Pacing Adaptatif](#61-configuration-du-pacing-adaptatif)
 - [6.2. Activation du Tracing OpenTelemetry](#62-activation-du-tracing-opentelemetry)
 - [6.3. Gestion des En-têtes Personnalisés](#63-gestion-des-en-têtes-personnalisés)
 - [6.4. Injection de Métadonnées](#64-injection-de-métadonnées)
7. [Gestion des Erreurs](#7-gestion-des-erreurs)
 - [7.1. Types d'Erreurs](#71-types-derreurs)
 - [7.2. Gestion des Retries](#72-gestion-des-retries)
 - [7.3. Observabilité des Erreurs](#73-observabilité-des-erreurs)
8. [Utilisation avec Différents Providers](#8-utilisation-avec-différents-providers)
 - [8.1. Mistral](#81-mistral)
 - [8.2. OpenAI](#82-openai)
 - [8.3. Anthropic](#83-anthropic)
 - [8.4. Vertex AI](#84-vertex-ai)
 - [8.5. OpenRouter](#85-openrouter)
9. [Bonnes Pratiques](#9-bonnes-pratiques)
10. [Exemples Complets](#10-exemples-complets)
11. [Dépannage](#11-dépannage)

---

## 1. Prérequis

Avant d'utiliser le module backend, assurez-vous que :

### 1.1. Dépendances Installées

```bash
# Installer les dépendances principales
uv add httpx mistralai pydantic

# Pour OpenTelemetry (optionnel)
uv add opentelemetry-api opentelemetry-sdk

# Pour les tests
uv add pytest pytest-asyncio pytest-mock
```

### 1.2. Variables d'Environnement

Configurez vos clés API dans votre environnement :

```bash
# Mistral
 export MISTRAL_API_KEY="votre_clé_mistral"

# OpenAI
 export OPENAI_API_KEY="votre_clé_openai"

# Anthropic
 export ANTHROPIC_API_KEY="votre_clé_anthropic"

# Google Cloud (Vertex AI)
 export GOOGLE_APPLICATION_CREDENTIALS="/path/vers/votre/service-account.json"

# OpenRouter
 export OPENROUTER_API_KEY="votre_clé_openrouter"
```

> **️ Important** : Ne commitez jamais vos clés API dans le code source !

### 1.3. Imports Nécessaires

```python
# Imports de base
from vibe.core.llm.backend.factory import create_backend
from vibe.core.config import ProviderConfig, ModelConfig
from vibe.core.types import LLMMessage, Role

# Pour les types avancés
from vibe.core.types import (
 AvailableTool,
 FunctionCall,
 ToolCall,
 LLMChunk,
 LLMUsage,
 StopInfo,
)
```

---

## 2. Configuration de Base

---

### 2.1. Configuration d'un Provider

Un `ProviderConfig` définit **comment** se connecter à un fournisseur de modèles.

```python
from vibe.core.config import ProviderConfig
from vibe.core.types import Backend

# Configuration pour Mistral
mistral_provider = ProviderConfig(
 name="mistral",
 backend=Backend.MISTRAL,
 api_base="https://api.mistral.ai/v1",
 api_key_env_var="MISTRAL_API_KEY",
 api_style="mistral", # Utilise le SDK Mistral
 reasoning_field_name="reasoning_content", # Champ pour le reasoning
)

# Configuration pour OpenAI
openai_provider = ProviderConfig(
 name="openai",
 backend=Backend.GENERIC,
 api_base="https://api.openai.com/v1",
 api_key_env_var="OPENAI_API_KEY",
 api_style="openai", # Utilise l'adapter OpenAI
 reasoning_field_name="reasoning_content",
)

# Configuration pour Anthropic
anthropic_provider = ProviderConfig(
 name="anthropic",
 backend=Backend.GENERIC,
 api_base="https://api.anthropic.com/v1",
 api_key_env_var="ANTHROPIC_API_KEY",
 api_style="anthropic", # Utilise l'adapter Anthropic
 reasoning_field_name="thinking", # Anthropic utilise "thinking"
)

# Configuration pour Vertex AI
vertex_provider = ProviderConfig(
 name="vertex",
 backend=Backend.GENERIC,
 api_base="https://us-central1-aiplatform.googleapis.com/v1",
 api_key_env_var="GOOGLE_APPLICATION_CREDENTIALS",
 api_style="vertex-anthropic", # Utilise l'adapter Vertex
 reasoning_field_name="reasoning_content",
)
```

**Attributs du ProviderConfig** :

| Attribut | Type | Description | Valeurs Possibles |
|----------|------|-------------|------------------|
| `name` | str | Nom du provider | "mistral", "openai", "anthropic", etc. |
| `backend` | Backend | Type de backend | `Backend.MISTRAL` ou `Backend.GENERIC` |
| `api_base` | str | URL de base de l'API | "https://api.mistral.ai/v1" |
| `api_key_env_var` | str | Variable d'environnement contenant la clé API | "MISTRAL_API_KEY", etc. |
| `api_style` | str | Style d'API à utiliser | "openai", "anthropic", "reasoning", "mistral", "vertex-anthropic", "openai-responses" |
| `reasoning_field_name` | str | Nom du champ pour le reasoning | "reasoning_content", "thinking" |

---

### 2.2. Configuration des Timeouts

Les timeouts contrôlent **combien de temps** attendre pour les différentes phases d'une requête.

```python
from vibe.core.config._defaults import (
 DEFAULT_API_TIMEOUT, # 720.0 secondes (12 minutes)
 DEFAULT_API_connect_timeout = 10.0 s secondes
 DEFAULT_API_write_timeout = 30.0 s secondes
 DEFAULT_API_pool_timeout = 10.0 s secondes
 DEFAULT_API_RETRY_MAX_ELAPSED_TIME, # 300.0 secondes (5 minutes)
)

# Configuration personnalisée avec timeouts
custom_timeout_config = {
 "timeout": 300.0, # Timeout global pour la requête
 "retry_max_elapsed_time": 180.0, # Budget temporel pour les retries
 "connect_timeout = 10.0 s, # Timeout pour envoyer la requête
 "pool_timeout = 10.0 s s,
 pool_timeout = 10.0 s,
)

async with backend:
 # MistralBackend supporte nativement le reasoning
 async for chunk in backend.complete_streaming(
 model=model,
 messages=messages,
 temperature=0.7,
 max_tokens=500,
 ):
 if chunk.message.content:
 print(chunk.message.content, end="")
 if chunk.message.reasoning_content:
 print(f"[Reasoning: {chunk.message.reasoning_content}]")
```

**Modèles Mistral Supportés** :
- `mistral-tiny`
- `mistral-small`
- `mistral-medium`
- `mistral-large-latest`
- `mistral-large-2407`
- Et les modèles personnalisés

---

### 8.2. OpenAI

OpenAI utilise l'adapter **OpenAIAdapter** avec GenericBackend.

```python
from vibe.core.config import ProviderConfig, ModelConfig
from vibe.core.types import Backend, LLMMessage, Role

# Configuration pour OpenAI
provider = ProviderConfig(
 name="openai",
 backend=Backend.GENERIC, # Utilise GenericBackend
 api_base="https://api.openai.com/v1",
 api_key_env_var="OPENAI_API_KEY",
 api_style="openai", # Utilise OpenAIAdapter
 reasoning_field_name="reasoning_content",
)

model = ModelConfig(
 name="gpt-4o",
 thinking="off", # OpenAI utilise "reasoning" dans le payload
)

messages = [
 LLMMessage(role=Role.system, content="You are a helpful assistant."),
 LLMMessage(role=Role.user, content="Hello!"),
]

backend = create_backend(provider=provider)

async with backend:
 chunk = await backend.complete(
 model=model,
 messages=messages,
 temperature=0.7,
 max_tokens=500,
 )
 print(chunk.message.content)
```

**Modèles OpenAI Supportés** :
- `gpt-4o`
- `gpt-4o-mini`
- `gpt-4-turbo`
- `gpt-3.5-turbo`
- Et tous les modèles de la plateforme OpenAI

---

### 8.3. Anthropic

Anthropic utilise l'adapter **AnthropicAdapter** avec GenericBackend.

```python
from vibe.core.config import ProviderConfig, ModelConfig
from vibe.core.types import Backend, LLMMessage, Role

# Configuration pour Anthropic
provider = ProviderConfig(
 name="anthropic",
 backend=Backend.GENERIC,
 api_base="https://api.anthropic.com/v1",
 api_key_env_var="ANTHROPIC_API_KEY",
 api_style="anthropic", # Utilise AnthropicAdapter
 reasoning_field_name="thinking", # Anthropic utilise "thinking"
)

model = ModelConfig(
 name="claude-3-5-sonnet-20241022",
 thinking="off",
)

messages = [
 LLMMessage(role=Role.user, content="What is the capital of France?"),
]

backend = create_backend(provider=provider)

async with backend:
 chunk = await backend.complete(
 model=model,
 messages=messages,
 temperature=0.7,
 max_tokens=1024,
 )
 print(chunk.message.content)
```

**Modèles Anthropic Supportés** :
- `claude-3-5-sonnet-20241022`
- `claude-3-haiku-20240307`
- `claude-3-sonnet-20240229`
- `claude-3-opus-20240229`
- `claude-2:1`

> **️ Attention** : Anthropic utilise un **format d'API différent** (Messages API au lieu de Chat Completions API). L'adapter gère cette conversion automatiquement.

---

### 8.4. Vertex AI

Vertex AI (Google Cloud) utilise l'adapter **VertexAnthropicAdapter** avec GenericBackend.

```python
from vibe.core.config import ProviderConfig, ModelConfig
from vibe.core.types import Backend, LLMMessage, Role

# Configuration pour Vertex AI
provider = ProviderConfig(
 name="vertex",
 backend=Backend.GENERIC,
 api_base="https://us-central1-aiplatform.googleapis.com/v1",
 api_key_env_var="GOOGLE_APPLICATION_CREDENTIALS",
 api_style="vertex-anthropic", # Utilise VertexAnthropicAdapter
 reasoning_field_name="reasoning_content",
)

# Pour Vertex, le nom du modèle doit inclure le projet et la région
model = ModelConfig(
 name="projects/my-project/locations/us-central1/publishers/anthropic/models/claude-3-5-sonnet-20241022",
 thinking="off",
)

messages = [
 LLMMessage(role=Role.user, content="Hello from Vertex AI!"),
]

backend = create_backend(provider=provider)

async with backend:
 chunk = await backend.complete(
 model=model,
 messages=messages,
 temperature=0.7,
 )
 print(chunk.message.content)
```

**Modèles Vertex AI Supportés** :
- Claude (via Anthropic)
- PaLM 2
- Gemini
- Et autres modèles disponibles sur Vertex AI

---

### 8.5. OpenRouter

OpenRouter est un **gateway** qui permet d'accéder à de multiples providers via une seule API.

```python
from vibe.core.config import ProviderConfig, ModelConfig
from vibe.core.types import Backend, LLMMessage, Role

# Configuration pour OpenRouter
provider = ProviderConfig(
 name="openrouter",
 backend=Backend.GENERIC,
 api_base="https://openrouter.ai/api/v1",
 api_key_env_var="OPENROUTER_API_KEY",
 api_style="openai", # OpenRouter utilise le format OpenAI
 reasoning_field_name="reasoning_content",
)

# Vous pouvez utiliser n'importe quel modèle disponible sur OpenRouter
model = ModelConfig(
 name="openai/gpt-4o", # ou "anthropic/claude-3-5-sonnet", "mistral/mistral-large", etc.
 thinking="off",
)

# En-têtes personnalisés pour OpenRouter (optionnel mais recommandé)
extra_headers = {
 "HTTP-Referer": "https://mon-application.com",
 "X-Title": "Mon Application",
}

messages = [
 LLMMessage(role=Role.user, content="Hello via OpenRouter!"),
]

backend = create_backend(provider=provider)

async with backend:
 chunk = await backend.complete(
 model=model,
 messages=messages,
 temperature=0.7,
 extra_headers=extra_headers, # En-têtes OpenRouter
 )
 print(chunk.message.content)
```

**Avantages d'OpenRouter** :
 **Accès à de multiples providers** via une seule API
 **Statistiques et monitoring** via le dashboard OpenRouter
 **Support des modèles les plus récents** (Mistral, OpenAI, Anthropic, etc.)

---

## 9. Bonnes Pratiques

### À Faire

1. **Utilisez toujours la Factory** pour créer les backends
 ```python
 # Bien
 backend = create_backend(provider=provider)
 
 # À éviter
 backend = GenericBackend(provider=provider)
 ```

2. **Utilisez le context manager** pour une gestion propre des ressources
 ```python
 # Bien
 async with backend:
 chunk = await backend.complete(...)
 
 # À éviter (ressources non libérées)
 chunk = await backend.complete(...)
 ```

3. **Gérez les erreurs** avec des blocs try/except
 ```python
 try:
 async with backend:
 chunk = await backend.complete(...)
 except BackendError as e:
 logger.error(f"Backend error: {e}")
 ```

4. **Configurez des timeouts raisonnables**
 ```python
 backend = create_backend(
 provider=provider,
 timeout=600.0, # 10 minutes pour les grands modèles
 )
 ```

5. **Utilisez le streaming** pour les réponses longues
 ```python
 async for chunk in backend.complete_streaming(...):
 # Traitement en temps réel
 ```

6. **Activez le tracing** en production pour le debugging
 ```python
 backend = create_backend(
 provider=provider,
 enable_otel=True,
 )
 ```

### À Éviter

1. **Ne pas utiliser le context manager**
 ```python
 # Mauvaise pratique
 backend = create_backend(provider=provider)
 chunk = await backend.complete(...) # Ressources non libérées
 ```

2. **Ne pas gérer les erreurs**
 ```python
 # Mauvaise pratique
 chunk = await backend.complete(...) # Pas de try/except
 ```

3. **Utiliser des timeouts trop courts**
 ```python
 # Mauvaise pratique pour les grands modèles
 backend = create_backend(provider=provider, timeout=10.0)
 ```

4. **Créer un backend par requête** (sauf si nécessaire)
 ```python
 # Mauvaise pratique (coûteux)
 for i in range(100):
 backend = create_backend(provider=provider)
 async with backend:
 chunk = await backend.complete(...)
 
 # Meilleure pratique (réutilisation)
 backend = create_backend(provider=provider)
 async with backend:
 for i in range(100):
 chunk = await backend.complete(...)
 ```

---

## 10. Exemples Complets

---

### 10.1. Chatbot Simple avec Memory

```python
import asyncio
from vibe.core.llm.backend.factory import create_backend
from vibe.core.config import ProviderConfig, ModelConfig
from vibe.core.types import Backend, LLMMessage, Role

class SimpleChatbot:
 def __init__(self, provider: ProviderConfig, model: ModelConfig):
 self.provider = provider
 self.model = model
 self.messages = []
 
 async def __aenter__(self):
 self.backend = create_backend(provider=self.provider)
 await self.backend.__aenter__()
 return self
 
 async def __aexit__(self, exc_type, exc_val, exc_tb):
 await self.backend.__aexit__(exc_type, exc_val, exc_tb)
 
 async def add_message(self, role: Role, content: str):
 self.messages.append(LLMMessage(role=role, content=content))
 
 async def generate_response(self):
 chunk = await self.backend.complete(
 model=self.model,
 messages=self.messages,
 temperature=0.7,
 )
 response = chunk.message.content
 self.messages.append(LLMMessage(role=Role.assistant, content=response))
 return response

async def main():
 provider = ProviderConfig(
 name="mistral",
 backend=Backend.MISTRAL,
 api_base="https://api.mistral.ai/v1",
 api_key_env_var="MISTRAL_API_KEY",
 )
 
 model = ModelConfig(
 name="mistral-large-latest",
 thinking="off",
 )
 
 chatbot = SimpleChatbot(provider, model)
 
 async with chatbot:
 await chatbot.add_message(Role.system, "Tu es un assistant utile.")
 
 while True:
 user_input = input("Vous: ")
 if user_input.lower() in ["quit", "exit", "bye"]:
 break
 
 await chatbot.add_message(Role.user, user_input)
 response = await chatbot.generate_response()
 print(f"Assistant: {response}")

if __name__ == "__main__":
 asyncio.run(main())
```

---

### 10.2. Traitement de Fichiers avec Images

```python
import asyncio
from pathlib import Path
from vibe.core.llm.backend.factory import create_backend
from vibe.core.config import ProviderConfig, ModelConfig
from vibe.core.types import (
 Backend,
 LLMMessage,
 Role,
 ImageAttachment,
 ImageType,
)

async def analyze_image(image_path: str):
 provider = ProviderConfig(
 name="mistral",
 backend=Backend.MISTRAL,
 api_base="https://api.mistral.ai/v1",
 api_key_env_var="MISTRAL_API_KEY",
 )
 
 model = ModelConfig(
 name="mistral-large-latest",
 thinking="off",
 )
 
 # Chargement de l'image
 image = ImageAttachment(
 type=ImageType.PATH,
 path=image_path,
 )
 
 messages = [
 LLMMessage(
 role=Role.user,
 content="Décris ce que tu vois sur cette image.",
 images=[image],
 ),
 ]
 
 backend = create_backend(provider=provider)
 
 async with backend:
 chunk = await backend.complete(
 model=model,
 messages=messages,
 temperature=0.2,
 )
 print(f"Description: {chunk.message.content}")

if __name__ == "__main__":
 asyncio.run(analyze_image("photo.jpg"))
```

---

### 10.3. Utilisation d'Outils avec un Agent

```python
import asyncio
import json
from vibe.core.llm.backend.factory import create_backend
from vibe.core.config import ProviderConfig, ModelConfig
from vibe.core.types import (
 Backend,
 LLMMessage,
 Role,
 AvailableTool,
 FunctionDefinition,
 StrToolChoice,
)

# Simulation d'un outil externe
async def get_weather(city: str) -> dict:
 """Simule une API météo"""
 return {"city": city, "temperature": 20, "condition": "sunny"}

async def run_agent_with_tools():
 provider = ProviderConfig(
 name="mistral",
 backend=Backend.MISTRAL,
 api_base="https://api.mistral.ai/v1",
 api_key_env_var="MISTRAL_API_KEY",
 )
 
 model = ModelConfig(
 name="mistral-large-latest",
 thinking="medium",
 )
 
 # Définition des outils
 tools = [
 AvailableTool(
 function=FunctionDefinition(
 name="get_weather",
 description="Récupère la météo pour une ville donnée",
 parameters={
 "type": "object",
 "properties": {
 "city": {
 "type": "string",
 "description": "Nom de la ville",
 }
 },
 "required": ["city"],
 },
 ),
 ),
 ]
 
 messages = [
 LLMMessage(
 role=Role.system,
 content="Tu as accès à un outil get_weather pour obtenir la météo.",
 ),
 LLMMessage(role=Role.user, content="Quelle est la météo à Paris ?"),
 ]
 
 backend = create_backend(provider=provider)
 
 async with backend:
 # Première requête : l'assistant décide d'appeler l'outil
 chunk = await backend.complete(
 model=model,
 messages=messages,
 temperature=0.2,
 tools=tools,
 tool_choice="auto",
 )
 
 print(f"Réponse initiale: {chunk.message.content}")
 
 if chunk.message.tool_calls:
 # Exécution de l'outil
 tool_call = chunk.message.tool_calls[0]
 if tool_call.function.name == "get_weather":
 args = json.loads(tool_call.function.arguments)
 weather = await get_weather(args["city"])
 
 # Ajout de la réponse de l'outil
 messages.append(chunk.message)
 messages.append(
 LLMMessage(
 role=Role.tool,
 content=json.dumps(weather),
 name=tool_call.function.name,
 tool_call_id=tool_call.id,
 )
 )
 
 # Deuxième requête : l'assistant génère la réponse finale
 chunk = await backend.complete(
 model=model,
 messages=messages,
 temperature=0.2,
 tools=tools,
 tool_choice="none", # Pas d'outil pour la réponse finale
 )
 
 print(f"Réponse finale: {chunk.message.content}")

if __name__ == "__main__":
 asyncio.run(run_agent_with_tools())
```

---

## 11. Dépannage

### Problèmes Courants et Solutions

| Problème | Cause Possible | Solution |
|----------|----------------|----------|
| **`ModuleNotFoundError: No module named 'mistralai'`** | SDK Mistral non installé | `uv add mistralai` |
| **`AttributeError: 'NoneType' object has no attribute 'chat'`** | Backend non initialisé | Utilisez `async with backend:` |
| **`BackendError: Authentication failed`** | Clé API invalide ou manquante | Vérifiez vos variables d'environnement |
| **`HTTP 429 Too Many Requests`** | Rate limit atteint | Augmentez `retry_max_elapsed_time`, utilisez le pacing |
| **`TimeoutError` ou `asyncio.TimeoutError`** | Timeout trop court | Augmentez `timeout` et `retry_max_elapsed_time` |
| **`ValueError: Invalid API base URL`** | Format d'URL incorrect | Vérifiez que l'URL se termine par `/v1` |
| **`TypeError: unsupported operand type(s) for +: 'NoneType' and 'int'`** | Usage None | Vérifiez que l'API retourne bien les champs d'usage |

### Debugging

1. **Activez le logging** :
 ```python
 import logging
 logging.basicConfig(level=logging.DEBUG)
 ```

2. **Activez le tracing** :
 ```python
 backend = create_backend(provider=provider, enable_otel=True)
 ```

3. **Utilisez un observateur de retry** :
 ```python
 class DebugRetryObserver:
 async def __call__(self, reason):
 print(f"Retry: {reason.category.name} - {reason.detail}")
 
 backend = create_backend(
 provider=provider,
 on_retry=DebugRetryObserver(),
 )
 ```

4. **Testez avec un backend factice** :
 ```python
 from vibe.core.llm.backend.base import BackendLike
 from vibe.core.types import LLMChunk, LLMMessage, Role, LLMUsage
 
 class FakeBackend:
 async def __aenter__(self):
 return self
 
 async def __aexit__(self, *args):
 pass
 
 async def complete(self, **kwargs):
 return LLMChunk(
 message=LLMMessage(
 role=Role.assistant,
 content="Fake response",
 ),
 usage=LLMUsage(prompt_tokens=10, completion_tokens=5),
 )
 
 def complete_streaming(self, **kwargs):
 yield self.complete(**kwargs)
 ```

---

## Conclusion

Ce document a couvert **tout ce que vous devez savoir** pour utiliser le module backend LLM dans Mistral Vibe :

- **Configuration** des providers et des timeouts
- **Création** de backends via la Factory ou directement
- **Utilisation** des requêtes synchrones et asynchrones
- **Gestion** des messages, images et outils
- **Configuration avancée** (pacing, tracing, métadonnées)
- **Gestion des erreurs** et retry
- **Intégration** avec différents providers
- **Bonnes pratiques** et exemples complets

> ** Prochaine étape** : Si vous voulez **étendre** le module (ajouter un nouveau provider, créer un adapter personnalisé), consultez le document [13. Pour Aller Plus Loin](./13-ADVANCED.md).

---

## Navigation

| Précédent | Suivant |
|-----------|---------|
| [11. Diagrammes](./11-DIAGRAMS.md) | [13. Pour Aller Plus Loin](./13-ADVANCED.md) |

[↩ Retour au README](../README.md)
