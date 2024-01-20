import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Turborepo Remote Cache',
  description:
    'An implementation of the turborepo-remote-cache server custom made for Cloudflare Workers',
  sitemap: {
    hostname: 'https://turborepo-remote-cache.dev',
  },
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    search: {
      provider: 'local',
    },
    nav: [{ text: 'Docs', link: '/introduction/getting-started' }],
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Getting Started', link: '/introduction/getting-started' },
          { text: 'Project Configuration', link: '/introduction/configuration' },
          { text: 'Turborepo setup', link: '/introduction/turborepo-setup' },
        ],
      },
      {
        text: 'Examples',
        items: [
          { text: 'Markdown Examples', link: '/examples/markdown-examples' },
          { text: 'Runtime API Examples', link: '/examples/api-examples' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/AdiRishi/turborepo-remote-cache-cloudflare' },
    ],
  },
});
