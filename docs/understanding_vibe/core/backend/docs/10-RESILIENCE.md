# ️ Stratégies de Résilience : Gestion des Échecs et des Rate Limits

> **Module** : `vibe/core/llm/backend/` 
> **Fork** : `rrobbes/mistral-vibe` 
> **Partie** : 10/13 - Mécanismes de Tolerance aux Pannes

---

## Introduction

Les **stratégies de résilience** sont **critiques** pour un système qui interagit avec des APIs externes comme les LLM. Sans une bonne gestion des échecs, une application peut :

- **Planter** à la première erreur réseau
- **Être bloquée** par des rate limits
- **Consommer trop de ressources** en retryant indéfiniment
- **Ne jamais récupérer** d'une panne temporaire

Mistral Vibe implémente **plusieurs couches de résilience** :

1. **Retry avec budget temporel** - retry avec limite de temps
2. **Adaptive Pacing** - Éviter les rate limits de manière proactive
3. **Backoff exponentiel** - Espacer les retries pour éviter la surcharge
4. **Gestion fine des timeouts** - Timeouts par axe (connect, write, read, pool)
5. **Classification des erreurs** - Identifier les erreurs retryables vs fatales

---

## ️ Architecture de la Résilience

### Vue d'Ensemble

### 3. Utiliser des Callbacks pour le Tracing

```python
from vibe.core.utils import RetryReason
import logging

logger = logging.getLogger("vibe.retry")

async def log_retry(reason: RetryReason) -> None:
 logger.warning(
 f"Retry: attempt={reason.attempt}, "
 f"category={reason.category.name}, "
 f"delay={reason.delay:.2f}s, "
 f"detail={reason.detail}"
 )

backend = create_backend(
 provider=provider_config,
 on_retry=log_retry,
)
```

### 4. Gérer les Rate Limits de Manière Intelligente

```python
from vibe.core.utils import AdaptivePacer

# Pacer avec délai initial pour éviter les rate limits
pacer = AdaptivePacer(
 initial_delay=0.1, # 100ms entre les requêtes
 backoff=1.5,
 max_delay=30.0, # Maximum 30s de délai
)

backend = GenericBackend(
 provider=provider_config,
 pacer=pacer,
)
```

### 5. Combiner Retry et Pacing

```python
# Configuration optimale pour éviter les rate limits
backend = create_backend(
 provider=provider_config,
 timeout=600.0,
 retry_max_elapsed_time=300.0, # Budget de 5 minutes
 on_retry=lambda reason: print(f"Retry: {reason}"),
)

# Avec un pacer personnalisé
pacer = AdaptivePacer(initial_delay=0.05, backoff=1.5, max_delay=60.0)
backend = GenericBackend(
 provider=provider_config,
 pacer=pacer,
 retry_max_elapsed_time=300.0,
)
```

### 6. Déboguer les Problèmes de Résilience

```python
# Activer le logging détaillé
import logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("vibe")
logger.setLevel(logging.DEBUG)

# Tous les retries et pacing seront loggés
backend = create_backend(provider=provider_config)
async with backend:
 chunk = await backend.complete(...)
```

### 7. Tester la Résilience

```python
import pytest
from vibe.core.llm.backend.generic import GenericBackend
from vibe.core.types import ProviderConfig
import httpx

@pytest.mark.asyncio
async def test_retry_on_500():
 # Créer un mock qui retourne 500 puis 200
 call_count = 0
 
 async def mock_post(*args, **kwargs):
 nonlocal call_count
 call_count += 1
 if call_count == 1:
 response = httpx.Response(500, json={"error": "Server error"})
 response.request = httpx.Request("POST", "http://test")
 raise httpx.HTTPStatusError("Server error", response=response)
 return httpx.Response(200, json={"choices": [{"message": {"content": "Hello"}}]})
 
 # Patcher le client HTTP
 backend = GenericBackend(
 provider=ProviderConfig(name="test", api_base="http://test"),
 retry_max_elapsed_time=10.0,
 )
 backend._client = mock.Mock()
 backend._client.post = mock_post
 backend._owns_client = False
 
 async with backend:
 chunk = await backend.complete(
 model=model_config,
 messages=messages,
 )
 
 assert call_count == 2 # 1 échec + 1 succès
 assert chunk.message.content == "Hello"
```

---

## ️ Limitations et Pièges

### 1. Budget Temporel vs Nombre de Tentatives

**Problème** : Un budget temporel de 5 minutes peut entraîner **beaucoup de tentatives** si les erreurs sont rapides.

**Solution** : Combiner budget temporel et limite de tentatives :
```python
# Actuellement non supporté par async_retry
# Il faudrait modifier la fonction ou utiliser une approche différente
```

### 2. Pacing et Requêtes Concurrentes

**Problème** : Le `AdaptivePacer` est **par instance de backend**. Si plusieurs requêtes utilisent le même backend, elles partagent le même pacer.

**Solution** :
```python
# Créer un backend par thread/processus
# Ou utiliser un pacer global
from vibe.core.utils import AdaptivePacer

# Pacer global partagé
global_pacer = AdaptivePacer()

# Chaque backend utilise le même pacer
backend1 = GenericBackend(provider=config1, pacer=global_pacer)
backend2 = GenericBackend(provider=config2, pacer=global_pacer)
```

### 3. Timeouts et Requêtes Lentes

**Problème** : Un timeout trop court peut tuer une requête qui aurait réussi.

**Solution** : Adapter les timeouts au modèle :
- Modèles rapides : timeout court (30-60s)
- Modèles lents : timeout long (600-1200s)

### 4. Retry et État de la Session

**Problème** : Si une requête échoue après avoir modifié l'état (ex: tool calls), le retry peut ne pas être approprié.

**Solution** : Ne pas retryer les requêtes avec tool calls ou stateful :
```python
# Dans la configuration du retry
# Il faudrait ajouter une option pour désactiver le retry
# pour certaines requêtes
```

### 5. Rate Limits et Plusieurs Providers

**Problème** : Les rate limits sont **par provider**. Si vous utilisez plusieurs providers, le pacing doit être **par provider**.

**Solution** : Un pacer par provider :
```python
from collections import defaultdict
from vibe.core.utils import AdaptivePacer

# Dictionnaire de pacers
pacers: dict[str, AdaptivePacer] = defaultdict(AdaptivePacer)

# Utilisation
pacer = pacers[provider.name]
backend = GenericBackend(provider=provider, pacer=pacer)
```

---

## Tableau Récapitulatif

| Stratégie | Description | Implementation | Configuration |
|-----------|-------------|----------------|---------------|
| **Retry avec budget temporel** | Retry tant qu'on a du temps | `async_retry` | `retry_max_elapsed_time` |
| **Backoff exponentiel** | Espacer les retries de manière exponentielle | `async_retry` | `backoff=1.5` |
| **Adaptive Pacing** | Éviter les rate limits de manière proactive | `AdaptivePacer` | `initial_delay`, `backoff`, `max_delay` |
| **Timeouts par axe** | Timeouts fins pour connect/write/pool/read | `bound_transport_timeouts` | `connect_timeout`, `write_timeout`, `pool_timeout` |
| **Classification des erreurs** | Identifier les erreurs retryables | `RetryCategory` | Automatique |

---

## Résumé

| Concept | Implémentation | Valeur par Défaut | Personnalisable |
|---------|----------------|-------------------|------------------|
| **Retry** | `async_retry` | Budget 300s | Oui |
| **Backoff** | Facteur 1.5 | 1.5 | Oui |
| **Pacing** | `AdaptivePacer` | Délai 0s | Oui |
| **Timeout global** | httpx.Timeout | 720s | Oui |
| **Timeouts par axe** | `bound_transport_timeouts` | 30s/60s/5s | Oui (MistralBackend) |
| **Classification** | `RetryCategory` | Automatique | Non |

---

## Références

- [Exponential Backoff - Wikipedia](https://en.wikipedia.org/wiki/Exponential_backoff)
- [Retry Pattern - Microsoft Docs](https://docs.microsoft.com/en-us/azure/architecture/patterns/retry)
- [Circuit Breaker Pattern](https://en.wikipedia.org/wiki/Circuit_breaker_design_pattern)
- [Resilience Engineering - Google SRE](https://sre.google/sre-book/handling-overload/)
- [httpx Timeout Configuration](https://www.python-httpx.org/advanced/#timeout-configuration)

---

## Voir aussi

- **[09-FLOWS.md](./09-FLOWS.md)** - Flux complet des requêtes
- **[05-GENERIC_BACKEND.md](./05-GENERIC_BACKEND.md)** - Implémentation du retry et pacing
- **[06-MISTRAL_BACKEND.md](./06-MISTRAL_BACKEND.md)** - Implémentation des timeouts
- **[12-USAGE.md](./12-USAGE.md)** - Configuration en pratique
- **[13-ADVANCED.md](./13-ADVANCED.md)** - Personnalisation avancée

---

*Documentation spécifique au fork éducatif `rrobbes/mistral-vibe` - Dernière mise à jour: 30 octobre 2026*
