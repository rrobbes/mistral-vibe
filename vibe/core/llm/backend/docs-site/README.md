# 🌐 Site Web de Documentation - Backend LLM

Site web généré avec **Docusaurus** pour la documentation du module `vibe/core/llm/backend/` de Mistral Vibe.

## 🚀 Démarrage Rapide

```bash
# Installer les dépendances (une seule fois)
npm install

# Lancer le serveur de développement
npm start

# Le site sera accessible sur http://localhost:3000
```

## 📦 Build de Production

```bash
# Générer les fichiers statiques
npm run build

# Servir le build localement
npm run serve
```

## 📁 Structure du Site

```
docs-site/
├── docusaurus.config.js    # Configuration principale
├── sidebars.js              # Navigation sidebar
├── package.json             # Dépendances
├── docs/                    # Pages de documentation
│   ├── intro.md            # Page d'introduction
│   ├── overview.md         # Vue d'ensemble
│   ├── synthese.md         # Synthèse condensée
│   ├── architecture.md     # Architecture et design
│   ├── foundations.md      # BackendLike et APIAdapter
│   ├── factory.md          # Factory pattern
│   ├── generic-backend.md  # GenericBackend
│   ├── mistral-backend.md  # MistralBackend
│   ├── adapters.md         # Les adapters
│   ├── images.md           # Gestion des images
│   ├── flows.md            # Flux et interactions
│   ├── resilience.md       # Stratégies de résilience
│   ├── diagrams.md         # Diagrammes Mermaid
│   ├── usage.md            # Guide d'utilisation
│   └── advanced.md         # Sujets avancés
├── src/
│   ├── css/custom.css      # Styles personnalisés
│   └── pages/
│       ├── index.js        # Page d'accueil
│       └── index.module.css
└── static/img/             # Images et logo
```

## ✨ Fonctionnalités

- ✅ **Diagrammes Mermaid** intégrés (architecture, séquences, flux)
- ✅ **Mode sombre/clair** automatique
- ✅ **Recherche** intégrée (Ctrl+K)
- ✅ **Navigation par sidebar** organisée par catégories
- ✅ **Responsive** (mobile-friendly)
- ✅ **Édition sur GitHub** (liens vers les sources)
- ✅ **Dernière mise à jour** affichée sur chaque page

## 🔧 Personnalisation

### Changer l'URL de base
Modifiez `baseUrl` dans `docusaurus.config.js` :

```js
baseUrl: '/mistral-vibe/backend-llm/',  // Pour GitHub Pages
// ou
baseUrl: '/',  // Pour un domaine racine
```

### Ajouter une page
1. Créez un fichier `.md` dans `docs/`
2. Ajoutez le frontmatter :
```markdown
---
sidebar_position: 5
title: Ma Page
---
```
3. Ajoutez la page dans `sidebars.js`

## 🌍 Déploiement

### GitHub Pages
```bash
# Configurer le déploiement dans docusaurus.config.js
# puis :
GIT_USER=<votre-username> npm run deploy
```

### Netlify / Vercel
Connectez le dépôt GitHub et configurez :
- **Build command** : `npm run build`
- **Publish directory** : `build`

## 📚 Sources

La documentation est générée à partir des fichiers markdown situés dans :
- `../docs/` (documentation détaillée)
- `../SYNTHESE.md` (synthèse)
- `../README.md` (index)

## 🤝 Contribution

Pour modifier la documentation :
1. Éditez les fichiers `.md` dans le dossier parent
2. Relancez `npm start` pour voir les changements en temps réel
3. Committez vos modifications
