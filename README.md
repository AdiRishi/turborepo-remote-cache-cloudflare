<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="apps/docs/public/brand/lockup-on-dark.svg">
  <img src="apps/docs/public/brand/lockup-on-light.svg" alt="Turborepo Remote Cache" width="360">
</picture>

<br>
<br>

[![CI](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/actions/workflows/ci.yml/badge.svg)](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/actions/workflows/ci.yml) [![Coverage Status](https://coveralls.io/repos/github/AdiRishi/turborepo-remote-cache-cloudflare/badge.svg)](https://coveralls.io/github/AdiRishi/turborepo-remote-cache-cloudflare) ![GitHub License](https://img.shields.io/github/license/AdiRishi/turborepo-remote-cache-cloudflare) [![Contributing](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](.github/CONTRIBUTING.md)

</div>

## Turborepo Remote Cache

An open-source Turborepo remote cache server that you host yourself. Developers and CI runners share build outputs through storage in your account, without a Vercel account.

**[Get started on Cloudflare](https://turborepo-remote-cache.dev/get-started)** walks through deployment and verifies your first remote cache hit. Cloudflare Workers with R2 is the recommended setup and the deployment tested end to end in CI.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/AdiRishi/turborepo-remote-cache-cloudflare)

The deployment includes an R2 bucket, a stats database, and a public usage dashboard. Artifact requests use a shared token. You maintain your own copy of this repository and bring in updates from upstream.

## Documentation

- [How the cache works and who can access it](https://turborepo-remote-cache.dev/introduction)
- [Connect developers and CI](https://turborepo-remote-cache.dev/connect-turbo)
- [Deploy with Wrangler or GitHub Actions](https://turborepo-remote-cache.dev/deploy/cloudflare)
- [Choose another platform](https://turborepo-remote-cache.dev/deploy), including Node.js, Bun, Deno, Vercel, Netlify, and AWS Lambda
- [Choose storage](https://turborepo-remote-cache.dev/storage), including R2, KV, S3-compatible buckets, and custom Files SDK adapters
- [Troubleshoot](https://turborepo-remote-cache.dev/troubleshooting) and [update your deployment](https://turborepo-remote-cache.dev/update)

## Contributing

Read [CONTRIBUTING.md](.github/CONTRIBUTING.md) for local setup and checks. Report vulnerabilities through the [security policy](.github/SECURITY.md).

Turborepo Remote Cache is an independent, MIT-licensed project. It is not affiliated with Vercel or Cloudflare.
