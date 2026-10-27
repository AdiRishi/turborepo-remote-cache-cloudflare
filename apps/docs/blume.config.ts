import { defineConfig } from 'blume';
import { googleAnalytics } from 'blume/analytics';
import { openapi } from 'blume/reference';
import { fileURLToPath } from 'node:url';

import apiPackage from '../api/package.json' with { type: 'json' };

const repositoryUrl = 'https://github.com/AdiRishi/turborepo-remote-cache-cloudflare';
const changelogUrl = `${repositoryUrl}/blob/master/apps/api/CHANGELOG.md`;

const deployment =
  process.env.DOCS_CLOUDFLARE_DEPLOYMENT === 'true'
    ? { site: 'https://cloudflare.turborepo-remote-cache.dev' }
    : { site: 'https://adirishi.github.io', base: '/turborepo-remote-cache-cloudflare' };

// Pages that moved. The VitePress site also served every page at `<route>.html`.
const movedPages: Record<string, string> = {
  '/introduction/getting-started': '/get-started',
  '/introduction/setup-turborepo': '/connect-turbo',
  '/configuration/project-configuration': '/retention',
  '/configuration/r2-storage': '/storage/r2',
  '/configuration/kv-storage': '/storage/kv',
};

export default defineConfig({
  content: { root: 'content' },
  title: 'Turborepo Remote Cache',
  description:
    'Self-host the Turborepo remote cache on Cloudflare Workers, Node.js, Vercel, or AWS Lambda, with artifacts in R2, KV, or any S3-compatible bucket.',
  logo: { image: '/brand/lockup.svg', text: '' },
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
    tabs: [
      { label: 'Docs', path: '/' },
      { label: 'API reference', path: '/api' },
    ],
    actions: [{ label: `v${apiPackage.version}`, href: changelogUrl }],
  },
  reference: [
    openapi({
      spec: fileURLToPath(import.meta.resolve('@turborepo-remote-cache/spec/openapi.json')),
      overlays: ['./openapi-overlay.yaml'],
      route: '/api',
    }),
  ],
  footer: {
    copyright:
      'Turborepo Remote Cache is an independent, MIT-licensed project. It is not affiliated with Vercel or Cloudflare.',
    links: [
      { label: 'Changelog', href: changelogUrl },
      { label: 'Contributing', href: `${repositoryUrl}/blob/master/.github/CONTRIBUTING.md` },
    ],
  },
  redirects: Object.entries(movedPages).flatMap(([from, to]) => [
    { from, to },
    { from: `${from}.html`, to },
  ]),
  analytics: [googleAnalytics({ id: 'G-4FKXFQBLZR' })],
  deployment,
});
