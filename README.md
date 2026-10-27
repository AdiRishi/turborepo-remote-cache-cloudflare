<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/brand/lockup-on-dark.svg">
  <img src="public/brand/lockup-on-light.svg" alt="Turborepo Remote Cache" width="360">
</picture>

<br>
<br>

[![CI](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/actions/workflows/ci.yml/badge.svg)](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/actions/workflows/ci.yml) [![Coverage Status](https://coveralls.io/repos/github/AdiRishi/turborepo-remote-cache-cloudflare/badge.svg)](https://coveralls.io/github/AdiRishi/turborepo-remote-cache-cloudflare) ![GitHub License](https://img.shields.io/github/license/AdiRishi/turborepo-remote-cache-cloudflare) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](.github/CONTRIBUTING.md)

</div>

Turborepo Remote Cache is an open-source server for the [Turborepo Remote Cache API](https://turborepo.dev/docs/core-concepts/remote-caching#remote-cache-api). You host it yourself, so your build artifacts stay in storage you own and `turbo` needs no Vercel account.

It runs on Cloudflare Workers with R2 or KV storage by default. It also builds for Node.js, Bun, Deno, Vercel, Netlify, and AWS Lambda, with artifacts in any S3-compatible bucket or any [Files SDK](https://files-sdk.dev) adapter.

[Read the documentation](https://adirishi.github.io/turborepo-remote-cache-cloudflare)

## Quick start

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/AdiRishi/turborepo-remote-cache-cloudflare)

The button copies this repository into your GitHub or GitLab account and deploys it as a Worker with an R2 bucket. Keep the build command (`pnpm run build`) and deploy command (`pnpm run deploy`) it suggests. Then add a `TURBO_TOKEN` secret to the Worker.

To deploy from your own machine instead, use Node.js 24 or later and pnpm:

```sh
git clone https://github.com/AdiRishi/turborepo-remote-cache-cloudflare.git
cd turborepo-remote-cache-cloudflare
pnpm install
pnpm --filter @turborepo-remote-cache/server exec wrangler login
pnpm build
pnpm run deploy
pnpm --filter @turborepo-remote-cache/server exec wrangler secret put TURBO_TOKEN
```

Then point `turbo` at the Worker:

```sh
export TURBO_API=https://turborepo-remote-cache.<your-subdomain>.workers.dev
export TURBO_TOKEN=<your token>
export TURBO_TEAM=my-team
turbo run build
```

## Documentation

- [Get started on Cloudflare](https://adirishi.github.io/turborepo-remote-cache-cloudflare/get-started)
- [Connect turbo](https://adirishi.github.io/turborepo-remote-cache-cloudflare/connect-turbo), including CI and signed artifacts
- [Storage](https://adirishi.github.io/turborepo-remote-cache-cloudflare/storage) in R2, KV, an S3-compatible bucket, or a custom adapter
- [Deploy to other platforms](https://adirishi.github.io/turborepo-remote-cache-cloudflare/deploy)
- [Configuration reference](https://adirishi.github.io/turborepo-remote-cache-cloudflare/configuration)
- [API reference](https://adirishi.github.io/turborepo-remote-cache-cloudflare/api)
- [Upgrade from v4](https://adirishi.github.io/turborepo-remote-cache-cloudflare/upgrade-from-v4)

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md). The repository is a pnpm workspace. The server is in `apps/server`, the KV adapter is in `packages/files-sdk-kv`, and the documentation site is in `docs/`.

Turborepo Remote Cache is an independent, MIT-licensed project. It is not affiliated with Vercel or Cloudflare.
