import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Turborepo Remote Cache',
  description:
    'An implementation of the turborepo-remote-cache server custom made for Cloudflare Workers',
  sitemap: {
    hostname: 'https://turborepo-remote-cache.dev',
  },
  cleanUrls: true,
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    search: {
      provider: 'local',
    },
    editLink: {
      pattern:
        'https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/edit/master/docs/:path',
    },
    // @ts-expect-error - Bug in type definition
    lastUpdated: true,
    nav: [{ text: 'Docs', link: '/introduction/getting-started' }],
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Getting Started', link: '/introduction/getting-started' },
          { text: 'Project Configuration', link: '/introduction/configuration' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/AdiRishi/turborepo-remote-cache-cloudflare' },
    ],
  },
});
