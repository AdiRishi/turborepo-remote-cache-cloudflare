import { defineConfig } from 'blume';
import { googleAnalytics } from 'blume/analytics';

import serverPackage from '../server/package.json' with { type: 'json' };

const repositoryUrl = 'https://github.com/AdiRishi/turborepo-remote-cache-cloudflare';
const changelogUrl = `${repositoryUrl}/blob/master/apps/server/CHANGELOG.md`;

// The VitePress site also served every page at `<route>.html`.
const vitepressHtmlRoutes = [
  '/introduction/getting-started',
  '/introduction/setup-turborepo',
  '/configuration/project-configuration',
  '/configuration/r2-storage',
  '/configuration/kv-storage',
];

export default defineConfig({
  title: 'Turborepo Remote Cache',
  description:
    'An implementation of the turborepo-remote-cache server custom made for Cloudflare Workers',
  logo: { image: 'node_modules/@turborepo-remote-cache/brand/assets/lockup.svg', text: '' },
  theme: {
    accent: { light: '#8f5b00', dark: '#ffb224' },
    action: '#ffb224',
    radius: 'md',
    mode: 'system',
    fonts: {
      display: { name: 'Host Grotesk', weights: [500, 600, 700] },
      body: { name: 'Host Grotesk', weights: [400, 500, 600] },
      mono: { name: 'Martian Mono', weights: [400, 500] },
    },
  },
  github: {
    owner: 'AdiRishi',
    repo: 'turborepo-remote-cache-cloudflare',
    branch: 'master',
    dir: 'apps/docs',
  },
  navigation: {
    actions: [{ label: `v${serverPackage.version}`, href: changelogUrl }],
  },
  footer: {
    copyright:
      'Turborepo Remote Cache is an independent, MIT-licensed project. It is not affiliated with Vercel or Cloudflare.',
    links: [
      { label: 'Changelog', href: changelogUrl },
      { label: 'Contributing', href: `${repositoryUrl}/blob/master/.github/CONTRIBUTING.md` },
    ],
  },
  redirects: vitepressHtmlRoutes.map((route) => ({ from: `${route}.html`, to: route })),
  analytics: [googleAnalytics({ id: 'G-4FKXFQBLZR' })],
  deployment:
    process.env.DOCS_CLOUDFLARE_DEPLOYMENT === 'true'
      ? { site: 'https://cloudflare.turborepo-remote-cache.dev' }
      : { site: 'https://adirishi.github.io', base: '/turborepo-remote-cache-cloudflare' },
});
