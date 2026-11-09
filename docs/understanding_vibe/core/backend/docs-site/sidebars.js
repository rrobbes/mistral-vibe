/**
 * Configuration de la sidebar pour la documentation du backend LLM
 */

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Demarrage',
      items: [
        'intro',
        'overview',
        'synthese',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'architecture',
        'foundations',
        'factory',
      ],
    },
    {
      type: 'category',
      label: 'Backends',
      items: [
        'generic-backend',
        'mistral-backend',
      ],
    },
    {
      type: 'category',
      label: 'Adapters',
      items: [
        'adapters',
        'images',
      ],
    },
    {
      type: 'category',
      label: 'Fonctionnement',
      items: [
        'flows',
        'resilience',
        'diagrams',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'usage',
        'advanced',
      ],
    },
  ],
};

module.exports = sidebars;
