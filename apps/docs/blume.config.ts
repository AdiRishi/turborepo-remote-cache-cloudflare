import { defineConfig } from 'blume';
import { googleAnalytics, script } from 'blume/analytics';
import { openapi } from 'blume/reference';
import { fileURLToPath } from 'node:url';

import apiPackage from '../api/package.json' with { type: 'json' };

const repositoryUrl = 'https://github.com/AdiRishi/turborepo-remote-cache';
const changelogUrl = `${repositoryUrl}/blob/master/apps/api/CHANGELOG.md`;
const measurementId = 'G-4FKXFQBLZR';
const site = 'https://turborepo-remote-cache.dev';

// Pages that moved. The VitePress site also served every page at `<route>.html`.
const movedPages: Record<string, string> = {
  '/introduction/getting-started': '/get-started',
  '/introduction/setup-turborepo': '/connect-turbo',
  '/configuration/project-configuration': '/retention',
  '/configuration/r2-storage': '/storage/r2',
  '/configuration/kv-storage': '/storage/kv',
  '/how-it-works': '/introduction',
};

export default defineConfig({
  content: { root: 'content' },
  title: 'Turborepo Remote Cache',
  description:
    'Self-hosted remote cache server for Turborepo. One-click deploy to Cloudflare Workers and R2, or run on Node.js, Bun, Deno, Vercel, Netlify, or AWS Lambda with S3-compatible storage.',
  logo: { image: '/brand/lockup.svg', text: '' },
  theme: {
    accent: { light: '#0068e0', dark: '#0096ff' },
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
    repo: 'turborepo-remote-cache',
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
  analytics: [
    script({
      content: `window['ga-disable-${measurementId}'] = location.origin !== '${site}';`,
    }),
    googleAnalytics({ id: measurementId }),
  ],
  deployment: { site },
});
