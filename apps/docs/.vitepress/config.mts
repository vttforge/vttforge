import { readdirSync } from 'node:fs';
import { defineConfig } from 'vitepress';

/**
 * The error pages are generated. `packages/core/scripts/codegen-errors.mjs`
 * writes one Markdown file per code in the registry, so the sidebar is read
 * from the directory rather than hand-listed — a new error code appears in
 * the docs by existing, not by someone remembering to add it here.
 */
function errorPages() {
  return readdirSync(new URL('../errors', import.meta.url))
    .filter((f) => f.endsWith('.md') && f !== 'index.md')
    .sort()
    .map((f) => ({ text: f.replace('.md', ''), link: `/errors/${f.replace('.md', '')}` }));
}

export default defineConfig({
  title: 'VTTForge',
  description: 'An SDK and CLI for building Foundry VTT v13+ systems and modules.',
  cleanUrls: true,
  lastUpdated: true,

  // Pagefind indexes the built output, so the built-in search is off.
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Recipes', link: '/recipes/' },
      { text: 'Errors', link: '/errors/' },
      { text: 'Stability', link: '/stability' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'Data models', link: '/guide/data-models' },
            { text: 'Sheets', link: '/guide/sheets' },
            { text: 'Modules', link: '/guide/modules' },
            { text: 'The dev loop', link: '/guide/dev-loop' },
            { text: 'Testing', link: '/guide/testing' },
          ],
        },
      ],
      '/recipes/': [
        {
          text: 'Recipes',
          items: [
            { text: 'Overview', link: '/recipes/' },
            { text: 'Migrating from v12', link: '/recipes/migrating-from-v12' },
            { text: 'Theme V2 binding', link: '/recipes/theme-v2' },
          ],
        },
      ],
      '/errors/': [
        { text: 'Error codes', items: [{ text: 'Overview', link: '/errors/' }, ...errorPages()] },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/vttforge/vttforge' }],

    footer: {
      message: 'MIT licensed.',
      copyright: 'Not affiliated with Foundry Gaming LLC.',
    },
  },
});
