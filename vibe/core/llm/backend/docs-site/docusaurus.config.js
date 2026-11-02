// @ts-check
// Docusaurus configuration for Vibe Backend LLM Documentation

const { themes } = require('prism-react-renderer');
const lightCodeTheme = themes.github;
const darkCodeTheme = themes.dracula;

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Backend LLM - Mistral Vibe',
  tagline: 'Documentation du module vibe/core/llm/backend/',
  favicon: 'img/favicon.ico',
  
  // URL de production (à adapter selon le déploiement)
  url: 'https://rrobbes.github.io',
  baseUrl: '/mistral-vibe/backend-llm/',
  
  organizationName: 'rrobbes',
  projectName: 'mistral-vibe',
  
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  
  i18n: {
    defaultLocale: 'fr',
    locales: ['fr'],
  },
  
  // Polices personnalisées
  customFields: {
    fontUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap',
  },
  
  // Injection de la police dans le head
  headTags: [
    {
      tagName: 'link',
      attributes: {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossorigin: 'anonymous',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap',
      },
    },
  ],
  
  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/rrobbes/mistral-vibe/edit/main/vibe/core/llm/backend/',
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],
  
  themeConfig: {
    // Mermaid pour les diagrammes
    mermaid: {
      theme: { light: 'base', dark: 'dark' },
      options: { themeVariables: { primaryColor: '#f59e0b', primaryTextColor: '#1e293b', primaryBorderColor: '#d97706', lineColor: '#64748b', secondaryColor: '#f1f5f9', tertiaryColor: '#e2e8f0' } },
      options: {},
    },
    navbar: {
      title: 'Backend LLM',
      logo: {
        alt: 'Vibe Logo',
        src: 'img/logo.svg',
      },
      hideOnScroll: false,
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          to: '/docs/synthese',
          label: 'Synthèse',
          position: 'left',
        },
        {
          href: 'https://github.com/rrobbes/mistral-vibe',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Vue d\'ensemble',
              to: '/docs/overview',
            },
            {
              label: 'Architecture',
              to: '/docs/architecture',
            },
            {
              label: 'Diagrammes',
              to: '/docs/diagrams',
            },
          ],
        },
        {
          title: 'Ressources',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/rrobbes/mistral-vibe',
            },
            {
              label: 'Mistral AI',
              href: 'https://mistral.ai',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Mistral Vibe - Fork éducatif rrobbes/mistral-vibe.`,
    },
    prism: {
      theme: lightCodeTheme,
      darkTheme: darkCodeTheme,
      additionalLanguages: ['python', 'bash', 'json', 'mermaid'],
      magicComments: [
        {
          className: 'theme-code-block-highlighted-line',
          line: 'highlight-next-line',
          block: { start: 'highlight-start', end: 'highlight-end' },
        },
      ],
    },
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
  },
  
  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],
};

module.exports = config;
