import projectPackageJson from '../../package.json';
import { defineConfig } from 'vitepress';

const isCloudflareDeployment = process.env.DOCS_CLOUDFLARE_DEPLOYMENT === 'true';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Turborepo Remote Cache',
  description:
    'An implementation of the turborepo-remote-cache server custom made for Cloudflare Workers',
  sitemap: {
    hostname: isCloudflareDeployment
      ? 'https://cloudflare.turborepo-remote-cache.dev/'
      : 'https://adirishi.github.io/turborepo-remote-cache-cloudflare/',
  },
  base: isCloudflareDeployment ? undefined : '/turborepo-remote-cache-cloudflare/',
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
    logo: 'https://public-assets.turborepo-remote-cache.dev/cdn-cgi/image/width=32,quality=80,format=auto/images/logo.png',
    nav: [
      { text: 'Docs', link: '/introduction/getting-started' },
      {
        text: projectPackageJson.version,
        items: [
          {
            text: 'Changelog',
            link: 'https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/blob/master/CHANGELOG.md',
          },
          {
            text: 'Contributing',
            link: 'https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/blob/master/.github/CONTRIBUTING.md',
          },
        ],
      },
    ],
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Getting Started', link: '/introduction/getting-started' },
          { text: 'Setup Turborepo', link: '/introduction/setup-turborepo' },
        ],
      },
      {
        text: 'Configuration',
        items: [
          { text: 'Project Configuration', link: '/configuration/project-configuration' },
          { text: 'R2 Storage', link: '/configuration/r2-storage' },
          { text: 'KV Storage', link: '/configuration/kv-storage' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/AdiRishi/turborepo-remote-cache-cloudflare' },
    ],
    footer: {
      message: 'Made with ❤️',
    },
  },
  head: [
    ['link', { rel: 'icon', href: '/turborepo-remote-cache-cloudflare/favicon.ico' }],
    ['script', { async: '', src: 'https://www.googletagmanager.com/gtag/js?id=G-4FKXFQBLZR' }],
    [
      'script',
      {},
      `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());

      gtag('config', 'G-4FKXFQBLZR');
      `,
    ],
  ],
});
