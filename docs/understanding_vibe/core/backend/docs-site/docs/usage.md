---
sidebar_position: 1
title: Utilisation
---

# Configuration et Utilisation du Module Backend LLM

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

> ** Important** : Ne commitez jamais vos clés API dans le code source !

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
 "connect_timeout": 15.0, # Timeout pour établir la connexion
 "write_timeout": 30.0, # Timeout pour envoyer la requête
 "pool_timeout": 15.0, # Timeout pour obtenir une connexion du pool
}
```

**Explications des Timeouts** :

- **`timeout`** : Temps maximum total pour une requête (inclus le retry)
- **`retry_max_elapsed_time`** : Temps maximum à passer dans les retries
- **`connect_timeout`** : Temps pour établir la connexion TCP
- **`write_timeout`** : Temps pour envoyer la requête (uploads de gros messages)
- **`pool_timeout`** : Temps pour obtenir une connexion du pool de connexions

> ** Conseil** : Pour les modèles lents (comme les grands modèles avec reasoning), augmentez `timeout` et `retry_max_elapsed_time`.

---

### 2.3. Configuration des Options de Retry

Le module implémente une **stratégie de retrye** avec budget temporel.

```python
# Configuration du retry pour GenericBackend
retry_config = {
 "retry_max_elapsed_time": 300.0, # 5 minutes de budget pour les retries
}

# Pour MistralBackend, le retry est configuré via le SDK Mistral
# qui utilise un BackoffStrategy
from mistralai.client.utils.retries import BackoffStrategy, RetryConfig

mistral_retry_config = RetryConfig(
 strategy="backoff",
 backoff=BackoffStrategy(
 initial_interval=500, # 500ms initial
 max_interval=30000, # 30s max
 exponent=1.5, # Multiplicateur exponentiel
 max_elapsed_time=300000, # 5 minutes en ms
 ),
 retry_connection_errors=True,
)
```

**Statégie de Retry** :
- **Erreurs récupérables** : 429 (Rate Limit), 500, 502, 503, 504, NetworkErrors, Timeout
- **Erreurs non récupérables** : 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 400 (Bad Request)
- **Backoff** : Exponentiel avec `initial_interval * (exponent ** attempt_number)`
- **Budget temporel** : Arrête les retries après `retry_max_elapsed_time`

---

## 3. Création d'un Backend

---

### 3.1. Via la Factory (Méthode Recommandée)

La **Factory** est la manière recommandée de créer un backend. Elle gère :
- Le **lazy loading** des modules (pas de chargement inutile au démarrage)
- La **configuration des timeouts**
- La **sélection du bon backend** selon le provider

```python
from vibe.core.llm.backend.factory import create_backend
from vibe.core.config import ProviderConfig, ModelConfig
from vibe.core.types import Backend

# Configuration du provider
provider = ProviderConfig(
 name="mistral",
 backend=Backend.MISTRAL,
 api_base="https://api.mistral.ai/v1",
 api_key_env_var="MISTRAL_API_KEY",
 api_style="mistral",
 reasoning_field_name="reasoning_content",
)

# Création du backend via la Factory
backend = create_backend(
 provider=provider,
 timeout=300.0, # Timeout global
 retry_max_elapsed_time=180.0, # Budget pour les retries
 connect_timeout=15.0, # Timeout de connexion
 write_timeout=30.0, # Timeout d'écriture
 pool_timeout=15.0, # Timeout du pool
 enable_otel=False, # Désactiver OpenTelemetry
 on_retry=None, # Pas d'observateur de retry
)

print(f"Backend créé : {type(backend).__name__}")
# Output : Backend créé : MistralBackend (ou GenericBackend)
```

**Avantages de la Factory** :
 **Simple** : Une seule ligne pour créer un backend
 **Flexible** : Gère automatiquement la sélection du backend
 **Performant** : Lazy loading des modules lourds (ex: SDK Mistral)
 **Configurable** : Permet de configurer tous les paramètres

---

### 3.2. Instanciation Directe

Vous pouvez aussi créer un backend directement, mais cela **charge toutes les dépendances** immédiatement.

```python
from vibe.core.llm.backend.mistral import MistralBackend
from vibe.core.llm.backend.generic import GenericBackend
from vibe.core.config import ProviderConfig

# Création directe d'un MistralBackend
provider = ProviderConfig(
 name="mistral",
 backend=Backend.MISTRAL,
 api_base="https://api.mistral.ai/v1",
 api_key_env_var="MISTRAL_API_KEY",
)

backend = MistralBackend(
 provider=provider,
 timeout=300.0,
 retry_max_elapsed_time=180.0,
 connect_timeout=15.0,
 write_timeout=30.0,
 pool_timeout=15.0,
 enable_otel=False,
 on_retry=None,
)

# Création directe d'un GenericBackend
provider = ProviderConfig(
 name="openai",
 backend=Backend.GENERIC,
 api_base="https://api.openai.com/v1",
 api_key_env_var="OPENAI_API_KEY",
 api_style="openai",
)

backend = GenericBackend(
 provider=provider,
 timeout=300.0,
 retry_max_elapsed_time=180.0,
 on_retry=None,
)
```

> ** Attention** : L'instanciation directe charge toutes les dépendances immédiatement, ce qui peut ralentir le démarrage de votre application.

---

## 4. Utilisation de Base

---

### 4.1. Requête Synchrone (Non-Streaming)

Une requête **non-streaming** envoie la requête complète et attend la réponse complète avant de retourner.

```python
import asyncio
from vibe.core.llm.backend.factory import create_backend
from vibe.core.config import ProviderConfig, ModelConfig
from vibe.core.types import Backend, LLMMessage, Role

async def simple_completion():
 # Configuration
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
 
 messages = [
 LLMMessage(role=Role.system, content="Tu es un assistant utile."),
 LLMMessage(role=Role.user, content="Quelle est la capitale de la France ?"),
 ]
 
 # Création du backend
 backend = create_backend(provider=provider)
 
 # Utilisation avec context manager
 async with backend:
 # Exécution de la requête
 chunk = await backend.complete(
 model=model,
 messages=messages,
 temperature=0.2,
 tools=None,
 max_tokens=None,
 tool_choice=None,
 extra_headers=None,
 metadata=None,
 )
 
 # Affichage des résultats
 print(f"Réponse : {chunk.message.content}")
 print(f"Usage : {chunk.usage}")
 print(f"Stop Reason : {chunk.stop}")

# Exécution
asyncio.run(simple_completion())
```

**Exemple de Sortie** :
```
Réponse : La capitale de la France est Paris.
Usage : LLMUsage(prompt_tokens=25, completion_tokens=10, cached_tokens=0)
Stop Reason : StopInfo(reason='stop')
```

---

### 4.2. Requête Asynchrone (Streaming)

Une requête **streaming** retourne les tokens au fur et à mesure qu'ils sont générés, ce qui permet une expérience plus interactive.

```python
import asyncio
from vibe.core.llm.backend.factory import create_backend
from vibe.core.config import ProviderConfig, ModelConfig
from vibe.core.types import Backend, LLMMessage, Role

async def streaming_completion():
 # Configuration
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
 
 messages = [
 LLMMessage(role=Role.system, content="Tu es un assistant utile."),
 LLMMessage(role=Role.user, content="Raconte-moi une histoire."),
 ]
 
 # Création du backend
 backend = create_backend(provider=provider)
 
 # Utilisation avec context manager
 async with backend:
 # Exécution de la requête streaming
 async for chunk in backend.complete_streaming(
 model=model,
 messages=messages,
 temperature=0.7,
 tools=None,
 max_tokens=500,
 tool_choice=None,
 extra_headers=None,
 metadata=None,
 ):
 # Traitement de chaque chunk
 if chunk.message.content:
 print(chunk.message.content, end="", flush=True)
 
 if chunk.usage:
 print(f"\nUsage partiel : {chunk.usage}")
 
 if chunk.stop:
 print(f"\nRaison d'arrêt : {chunk.stop.reason}")

# Exécution
asyncio.run(streaming_completion())
```

**Exemple de Sortie** :
```
Il était une fois dans un petit village...
Usage partiel : LLMUsage(prompt_tokens=25, completion_tokens=10, cached_tokens=0)
...au sommet d'une montagne enchantée.

Raison d'arrêt : stop
Usage final : LLMUsage(prompt_tokens=25, completion_tokens=50, cached_tokens=0)
```

---

## 5. Gestion des Messages

---

### 5.1. Construction des Messages

Les messages sont des objets `LLMMessage` qui représentent les échanges dans une conversation.

```python
from vibe.core.types import LLMMessage, Role, Content

# Message système
system_msg = LLMMessage(
 role=Role.system,
 content="Tu es un expert en programmation Python. Réponds de manière concise.",
)

# Message utilisateur simple
user_msg = LLMMessage(
 role=Role.user,
 content="Comment créer une classe en Python ?",
)

# Message utilisateur avec reasoning (pour les modèles qui le supportent)
user_msg_with_reasoning = LLMMessage(
 role=Role.user,
 content="Explique la POO en Python.",
 reasoning_content="Je vais expliquer la POO de manière simple.",
)

# Message assistant
assistant_msg = LLMMessage(
 role=Role.assistant,
 content="Voici comment créer une classe :\nclass MaClasse:\n def __init__(self):\n pass",
)

# Message tool (réponse d'un outil)
tool_msg = LLMMessage(
 role=Role.tool,
 content='{"result": "success"}',
 name="mon_outil",
 tool_call_id="call_123",
)

# Liste de messages pour une conversation
messages = [system_msg, user_msg, assistant_msg, user_msg_with_reasoning]
```

**Attributs de LLMMessage** :

| Attribut | Type | Description | Obligatoire |
|----------|------|-------------|-------------|
| `role` | Role | Rôle du message | Oui |
| `content` | Content | Contenu textuel | Non (peut être None) |
| `reasoning_content` | Content | Contenu de reasoning | Non |
| `tool_calls` | list[ToolCall] | Appels d'outils | Non |
| `images` | list[ImageAttachment] | Images jointes | Non |
| `name` | str | Nom (pour les messages tool) | Non |
| `tool_call_id` | str | ID de l'appel d'outil | Non |

---

### 5.2. Gestion des Images

Le module supporte l'envoi d'**images** avec les messages utilisateur.

```python
from pathlib import Path
from vibe.core.types import LLMMessage, Role, ImageAttachment, ImageType

# À partir d'un chemin de fichier
image_path = Path("/path/to/image.jpg")
image_attachment = ImageAttachment(
 type=ImageType.PATH,
 path=str(image_path),
)

# À partir d'une URL
image_url = ImageAttachment(
 type=ImageType.URL,
 url="https://example.com/image.jpg",
)

# À partir de bytes (data URI)
with open("image.png", "rb") as f:
 image_bytes = f.read()
 image_bytes_attachment = ImageAttachment(
 type=ImageType.BYTES,
 data=image_bytes,
 )

# Message avec image
user_msg_with_image = LLMMessage(
 role=Role.user,
 content="Qu'est-ce qu'il y a sur cette image ?",
 images=[image_attachment],
)

messages = [user_msg_with_image]
```

**Types d'Images Supportés** :
- **PATH** : Chemin vers un fichier image local
- **URL** : URL vers une image distante
- **BYTES** : Données brutes de l'image

> ** Note** : Les images sont automatiquement converties en **Data URI** (format `data:image/jpeg;base64,...`) par les adapters.

---

### 5.3. Gestion des Tool Calls

Les **Tool Calls** permettent à l'agent d'appeler des outils externes.

```python
from vibe.core.types import (
 AvailableTool,
 FunctionDefinition,
 ToolCall,
 FunctionCall,
 LLMMessage,
 Role,
)

# Définition d'un outil disponible
tool_definition = AvailableTool(
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
)

# Message assistant avec appel d'outil
assistant_msg_with_tool = LLMMessage(
 role=Role.assistant,
 content="Je vais vérifier la météo pour toi.",
 tool_calls=[
 ToolCall(
 id="call_1",
 function=FunctionCall(
 name="get_weather",
 arguments='{"city": "Paris"}',
 ),
 index=0,
 )
 ],
)

# Message outil (réponse de l'outil)
tool_response_msg = LLMMessage(
 role=Role.tool,
 content='{"temperature": 20, "condition": "sunny"}',
 name="get_weather",
 tool_call_id="call_1",
)

# Liste de messages avec outils
messages = [
 LLMMessage(role=Role.user, content="Quelle est la météo à Paris ?"),
 assistant_msg_with_tool,
 tool_response_msg,
]
```

**Utilisation avec un Backend** :

```python
import asyncio
from vibe.core.llm.backend.factory import create_backend
from vibe.core.config import ProviderConfig, ModelConfig
from vibe.core.types import Backend, LLMMessage, Role, AvailableTool, FunctionDefinition

async def completion_with_tools():
 # Configuration
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
 
 # Définition des outils
 tools = [
 AvailableTool(
 function=FunctionDefinition(
 name="get_weather",
 description="Récupère la météo pour une ville",
 parameters={
 "type": "object",
 "properties": {
 "city": {"type": "string", "description": "Nom de la ville"}
 },
 "required": ["city"],
 },
 ),
 ),
 ]
 
 messages = [
 LLMMessage(role=Role.system, content="Tu as accès à des outils."),
 LLMMessage(role=Role.user, content="Quelle est la météo à Paris ?"),
 ]
 
 # Création du backend
 backend = create_backend(provider=provider)
 
 async with backend:
 chunk = await backend.complete(
 model=model,
 messages=messages,
 temperature=0.2,
 tools=tools,
 max_tokens=None,
 tool_choice="auto", # auto, none, ou un outil spécifique
 )
 
 print(f"Réponse : {chunk.message.content}")
 if chunk.message.tool_calls:
 print(f"Appels d'outils : {chunk.message.tool_calls}")

asyncio.run(completion_with_tools())
```

---

## 6. Configuration Avancée

---

### 6.1. Configuration du Pacing Adaptatif

Le **AdaptivePacer** est un mécanisme qui ajuste automatiquement le rythme des requêtes pour éviter les rate limits.

```python
from vibe.core.llm.backend.generic import GenericBackend
from vibe.core.utils import AdaptivePacer
from vibe.core.config import ProviderConfig

# Création d'un Pacer personnalisé
custom_pacer = AdaptivePacer(
 initial_interval=0.0, # Intervalle initial
 max_interval=10.0, # Intervalle maximum (10 secondes)
 recovery_factor=0.9, # Facteur de récupération
)

# Injection dans le backend
provider = ProviderConfig(
 name="openai",
 backend=Backend.GENERIC,
 api_base="https://api.openai.com/v1",
 api_key_env_var="OPENAI_API_KEY",
 api_style="openai",
)

backend = GenericBackend(
 provider=provider,
 pacer=custom_pacer, # Injection du Pacer personnalisé
)
```

**Paramètres du AdaptivePacer** :

| Paramètre | Type | Description | Valeur par défaut |
|-----------|------|-------------|-------------------|
| `initial_interval` | float | Intervalle initial entre les requêtes | 0.0 |
| `max_interval` | float | Intervalle maximum entre les requêtes | 10.0 |
| `recovery_factor` | float | Facteur de réduction de l'intervalle après succès | 0.9 |

**Comportement** :
- **`on_success()`** : Réduit l'intervalle de `recovery_factor` (récompense)
- **`on_failure()`** : Ne change pas l'intervalle (pas de pénalité)
- **`on_rate_limited()`** : Incrémente l'intervalle de 1 seconde (max `max_interval`)

---

### 6.2. Activation du Tracing OpenTelemetry

OpenTelemetry permet de **tracer** les appels aux modèles pour l'observabilité.

```python
from vibe.core.llm.backend.factory import create_backend
from vibe.core.config import ProviderConfig

# Activation du tracing
provider = ProviderConfig(
 name="mistral",
 backend=Backend.MISTRAL,
 api_base="https://api.mistral.ai/v1",
 api_key_env_var="MISTRAL_API_KEY",
)

backend = create_backend(
 provider=provider,
 enable_otel=True, # Active OpenTelemetry
)

# Dans un contexte async avec tracing
import asyncio
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, SimpleSpanProcessor

# Configuration du tracer
provider = TracerProvider()
processor = SimpleSpanProcessor(ConsoleSpanExporter())
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

async def traced_completion():
 async with backend:
 chunk = await backend.complete(
 model=ModelConfig(name="mistral-large-latest", thinking="off"),
 messages=[LLMMessage(role=Role.user, content="Hello")],
 temperature=0.2,
 )
 print(chunk.message.content)

asyncio.run(traced_completion())
```

**Sortie du Tracing** :
```
{name: model.call, context: {trace_id: ..., span_id: ...}, start_time: ..., end_time: ..., attributes: {provider: mistral, model: mistral-large-latest, streaming: false, temperature: 0.2, ...}}
```

---

### 6.3. Gestion des En-têtes Personnalisés

Vous pouvez ajouter des **en-têtes HTTP personnalisés** à vos requêtes.

```python
# En-têtes personnalisés pour OpenRouter
custom_headers = {
 "HTTP-Referer": "https://mon-application.com",
 "X-Title": "Mon Application Vibe",
}

async with backend:
 chunk = await backend.complete(
 model=model,
 messages=messages,
 temperature=0.2,
 extra_headers=custom_headers, # Ajout des en-têtes personnalisés
 )
```

**Cas d'utilisation des en-têtes personnalisés** :
- **OpenRouter** : Identifie votre application (`HTTP-Referer`, `X-Title`)
- **Mistral** : Ajoute des métadonnées pour le monitoring
- **Authentification personnalisée** : Pour les providers avec des schémas d'authentification spécifiques

---

### 6.4. Injection de Métadonnées

Les métadonnées permettent d'ajouter des **informations supplémentaires** aux requêtes pour le tracing ou le monitoring.

```python
metadata = {
 "user_id": "user_123",
 "session_id": "session_456",
 "application": "my-vibe-app",
 "version": "1.0.0",
}

async with backend:
 chunk = await backend.complete(
 model=model,
 messages=messages,
 temperature=0.2,
 metadata=metadata, # Injection des métadonnées
 )
```

**Utilisation des Métadonnées** :
- **Tracing** : Associées aux spans OpenTelemetry
- **Monitoring** : Pour suivre l'utilisation par utilisateur/session
- **Debugging** : Pour identifier la source des requêtes

---

## 7. Gestion des Erreurs

---

### 7.1. Types d'Erreurs

Le module backend peut lever plusieurs types d'erreurs :

```python
from vibe.core.llm.exceptions import BackendError, BackendErrorBuilder

# Exemple de gestion d'erreurs
try:
 async with backend:
 chunk = await backend.complete(
 model=model,
 messages=messages,
 )
except BackendError as e:
 print(f"Erreur du backend : {e}")
 print(f"Type : {e.error_type}")
 print(f"Message : {e.message}")
 print(f"Status Code : {e.status_code}")
 print(f"Provider : {e.provider}")
 print(f"Endpoint : {e.endpoint}")
 print(f"Model : {e.model}")
except Exception as e:
 print(f"Erreur inattendue : {e}")
```

**Types d'Erreurs** :

| Type d'Erreur | Description | HTTP Status Codes |
|---------------|-------------|------------------|
| `BackendHttpError` | Erreur HTTP du provider | 4xx, 5xx |
| `BackendRequestError` | Erreur réseau ou de requête | N/A |
| `BackendStreamError` | Erreur spécifique au streaming | N/A |
| `BackendTimeoutError` | Timeout de la requête | N/A |

---

### 7.2. Gestion des Retries

Le module gère automatiquement les retries, mais vous pouvez personnaliser le comportement.

```python
from vibe.core.utils import RetryObserver, RetryReason, RetryCategory
from typing import Callable

# Créer un observateur de retry personnalisé
class MyRetryObserver:
 def __init__(self):
 self.retry_count = 0
 self.retry_reasons = []
 
 async def __call__(self, reason: RetryReason) -> None:
 self.retry_count += 1
 self.retry_reasons.append(reason)
 print(f"Retry #{self.retry_count} - Raison : {reason.category.name} - {reason.detail}")

# Utilisation avec le backend
retry_observer = MyRetryObserver()

backend = create_backend(
 provider=provider,
 on_retry=retry_observer, # Injection de l'observateur
)

async with backend:
 chunk = await backend.complete(
 model=model,
 messages=messages,
 )

print(f"Nombre de retries : {retry_observer.retry_count}")
for reason in retry_observer.retry_reasons:
 print(f" - {reason.category.name}: {reason.detail}")
```

**Catégories de Retry** :

| Catégorie | Description | Exemples |
|-----------|-------------|----------|
| `RATE_LIMITED` | Rate limit du provider | HTTP 429, "Too Many Requests" |
| `SERVER_ERROR` | Erreur serveur | HTTP 500, 502, 503, 504 |
| `NETWORK_ERROR` | Erreur réseau | ConnectionError, Timeout |
| `UNKNOWN` | Erreur inconnue | Autres erreurs |

---

### 7.3. Observabilité des Erreurs

Pour une meilleure observabilité, activez le tracing et utilisez un observateur de retry.

```python
import logging
from vibe.core.utils import RetryObserver, RetryReason

# Configuration du logging
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger("vibe")

# Observateur de retry avec logging
class LoggingRetryObserver(RetryObserver):
 async def __call__(self, reason: RetryReason) -> None:
 logger.warning(
 f"Retrying request - Category: {reason.category.name}, "
 f"Detail: {reason.detail}"
 )

# Création du backend avec logging
backend = create_backend(
 provider=provider,
 on_retry=LoggingRetryObserver(),
 enable_otel=True, # Active aussi OpenTelemetry
)

# Exécution
async with backend:
 try:
 chunk = await backend.complete(
 model=model,
 messages=messages,
 )
 except Exception as e:
 logger.error(f"Request failed after retries: {e}")
```

---

## 8. Utilisation avec Différents Providers

---

### 8.1. Mistral

Mistral utilise le **SDK officiel MistralAI** pour une intégration optimale.

```python
from vibe.core.llm.backend.factory import create_backend
from vibe.core.config import ProviderConfig, ModelConfig
from vibe.core.types import Backend, LLMMessage, Role

# Configuration pour Mistral
provider = ProviderConfig(
 name="mistral",
 backend=Backend.MISTRAL, # Utilise MistralBackend
 api_base="https://api.mistral.ai/v1",
 api_key_env_var="MISTRAL_API_KEY",
 api_style="mistral",
 reasoning_field_name="reasoning_content",
)

model = ModelConfig(
 name="mistral-large-latest",
 thinking="high", # Niveaux : "off", "low", "medium", "high"
)

messages = [
 LLMMessage(role=Role.user, content="Bonjour !"),
]

backend = create_backend(
 provider=provider,
 timeout=600.0, # Mistral peut prendre plus de temps
 retry_max_elapsed_time=300.0,
 connect_timeout = 10.0 s,
 write_timeout = 30.0 s,
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

> ** Attention** : Anthropic utilise un **format d'API différent** (Messages API au lieu de Chat Completions API). L'adapter gère cette conversion automatiquement.

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

> ** Prochaine étape** : Si vous voulez **étendre** le module (ajouter un nouveau provider, créer un adapter personnalisé), consultez le document [13. Pour Aller Plus Loin](/docs/advanced).

---

## Navigation

| Précédent | Suivant |
|-----------|---------|
| [11. Diagrammes](/docs/diagrams) | [13. Pour Aller Plus Loin](/docs/advanced) |

[↩ Retour au README](/docs/intro)
