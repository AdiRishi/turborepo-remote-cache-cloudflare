<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="apps/docs/public/brand/lockup-on-dark.svg">
  <img src="apps/docs/public/brand/lockup-on-light.svg" alt="Turborepo Remote Cache" width="360">
</picture>

<br>
<br>

[![CI](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/actions/workflows/ci.yml/badge.svg)](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/actions/workflows/ci.yml) [![Coverage Status](https://coveralls.io/repos/github/AdiRishi/turborepo-remote-cache-cloudflare/badge.svg)](https://coveralls.io/github/AdiRishi/turborepo-remote-cache-cloudflare) ![GitHub License](https://img.shields.io/github/license/AdiRishi/turborepo-remote-cache-cloudflare) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](.github/CONTRIBUTING.md)

<a href="https://adirishi.github.io/turborepo-remote-cache-cloudflare" target="_blank">
  <img src="https://img.shields.io/badge/Visit-Developer%20Docs-%230572BE?style=for-the-badge&logo=readthedocs&logoColor=white" alt="Visit Developer Docs">
</a>

</div>

## 🚀 Introduction

An open-source [Turborepo remote cache](https://turborepo.dev/docs/core-concepts/remote-caching) server that you host yourself, **built first for [Cloudflare Workers](https://developers.cloudflare.com/workers/)**. Deploy it in one click, and every laptop and CI runner on your team shares build outputs through storage you own.

📚 The [documentation](https://adirishi.github.io/turborepo-remote-cache-cloudflare) covers every storage option, platform, and setting.

## 🤔 Why should I use this?

- ⚡ **Faster builds.** A task that ran on any machine, with the same inputs, replays from the cache instead of running again.
- 🌐 **No Vercel account.** `turbo` talks to your server through the official Remote Cache API, and your artifacts never leave your storage.
- 💰 **Free to start.** The Workers free plan includes 100,000 requests a day, and R2 includes 10 GB of storage a month. R2 charges [nothing for egress](https://www.cloudflare.com/learning/cloud/what-are-data-egress-fees/), so the bandwidth of every cache download is free.
- 🌍 **Close to your builds.** The Worker runs in Cloudflare data centers around the world.
- 💿 **Your choice of storage.** 🪣 [R2](https://adirishi.github.io/turborepo-remote-cache-cloudflare/storage/r2), 🔑 [KV](https://adirishi.github.io/turborepo-remote-cache-cloudflare/storage/kv), any [S3-compatible bucket](https://adirishi.github.io/turborepo-remote-cache-cloudflare/storage/s3), or anything with a [Files SDK](https://files-sdk.dev) adapter.
- 🧳 **Not only Cloudflare.** The same server builds for [Node.js, Bun, Deno, Vercel, Netlify, and AWS Lambda](https://adirishi.github.io/turborepo-remote-cache-cloudflare/deploy).

## ⚡️ Quick start

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/AdiRishi/turborepo-remote-cache-cloudflare)

The button copies this repository to your GitHub or GitLab account and deploys it as a Worker with an R2 bucket. When it finishes, add a secret named `TURBO_TOKEN` to the Worker, with a long random value such as the output of `openssl rand -hex 32`.

### Deploy with the CLI

You need Node.js 24 or later and pnpm. [Wrangler](https://developers.cloudflare.com/workers/wrangler/) comes with the repository and creates the R2 bucket on the first deploy.

```sh
# 1. Clone the repository
git clone https://github.com/AdiRishi/turborepo-remote-cache-cloudflare.git
cd turborepo-remote-cache-cloudflare

# 2. Install packages
pnpm install

# 3. Build and deploy the Worker
pnpm build
pnpm run deploy

# 4. Set the bearer token
cd apps/api && pnpm exec wrangler secret put TURBO_TOKEN
```

## ▲ Point turbo at your cache

Set these variables wherever `turbo` runs, with your Worker's URL and no trailing slash:

```sh
export TURBO_API=https://turborepo-remote-cache.<your-subdomain>.workers.dev
export TURBO_TOKEN=<your token>
export TURBO_TEAM=my-team
```

Then run a build, and run it again with only the remote cache. The second run replays everything from your Worker:

```
$ turbo run build
$ turbo run build --cache=remote:r

• Remote caching enabled

build: cache hit, replaying logs edf677b2880f0799

 Tasks:    1 successful, 1 total
Cached:    1 cached, 1 total
  Time:    19ms >>> FULL TURBO
```

And that's it 🎉🎉

[Connect turbo](https://adirishi.github.io/turborepo-remote-cache-cloudflare/connect-turbo) covers CI, signed artifacts, and keeping the URL and team in `turbo.json`.

## 🤝 Contributing

Read [CONTRIBUTING.md](.github/CONTRIBUTING.md) to get started. Turborepo Remote Cache is an independent, MIT-licensed project, not affiliated with Vercel or Cloudflare.

---

<div align="center">

Made with ❤️

</div>
