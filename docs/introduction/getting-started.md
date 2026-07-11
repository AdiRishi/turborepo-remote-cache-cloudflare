---
layout: doc
---

# Getting started

Cloudflare Workers is the default deployment target. The repository includes the Nitro and Wrangler configuration needed to build and deploy a Worker backed by Cloudflare R2.

## Prerequisites

- Node.js 22 or newer
- pnpm 11.6.0
- A Cloudflare account with Workers and R2 enabled
- Wrangler authenticated with that account

## Deploy with R2

The included `wrangler.jsonc` selects R2 and binds the `turborepo-cache` bucket as `R2_STORE`. No provider code or configuration changes are needed for this path.

```sh
# 1. Clone the repository
git clone https://github.com/AdiRishi/turborepo-remote-cache-cloudflare.git
cd turborepo-remote-cache-cloudflare

# 2. Install dependencies
pnpm install

# 3. Create the bucket referenced by wrangler.jsonc
pnpm wrangler r2 bucket create turborepo-cache

# 4. Build and deploy the Worker
pnpm deploy

# 5. Set the Bearer token accepted by the cache API
echo "YOUR_SECRET" | pnpm wrangler secret put TURBO_TOKEN
```

Keep the token private. Every Turborepo artifact endpoint and internal management endpoint requires it.

Open `https://<your-worker-domain>/ping` after deployment. A successful response confirms that the Worker is reachable. Then follow [Setup Turborepo](/introduction/setup-turborepo) to connect a repository to it.

::: tip Explicit provider selection
Provider auto-detection makes the default deployment work without another setting. For new configurations, setting `STORAGE_PROVIDER` explicitly to `r2`, `kv`, or `s3` makes the selected provider unambiguous.
:::

## Choose another storage provider

R2, KV, and S3 are first-class providers. Switching among them is configuration-only:

- [Cloudflare R2](/configuration/r2-storage) supports a native binding on Workers and credentials on other targets.
- [Cloudflare KV](/configuration/kv-storage) uses a native Worker binding and has a 25 MiB artifact limit.
- [Amazon S3](/configuration/s3-storage) works through standard S3 credentials and can also target compatible services.
- [Custom storage](/configuration/custom-storage) connects another Files SDK adapter through `storage.config.ts`.

## Local development and builds

Nitro powers development, builds, previews, and deployment output:

```sh
cp .dev.vars.example .dev.vars
# Replace the example TURBO_TOKEN before starting the server.
pnpm dev
pnpm build
pnpm preview
```

The default build targets Cloudflare. Read [Deployment targets](/introduction/deployment-targets) before building for Node or another Nitro preset.

## One-click deploy

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/AdiRishi/turborepo-remote-cache-cloudflare)

Cloudflare's one-click flow can create a fork, connect it to a Cloudflare account, and deploy the project. Before starting it:

1. Enable R2 for the Cloudflare account.
2. Create the `turborepo-cache` bucket expected by the default binding.
3. Add `TURBO_TOKEN` after the first deployment.
4. Configure the GitHub Actions secrets listed below if the fork will use the included deployment workflow.

![One Click Deployment Step 3](https://public-assets.turborepo-remote-cache.dev/cdn-cgi/image/width=960,quality=80,format=auto/images/one-click-deploy-preview-step-3.png)

## GitHub Actions

The included [deployment workflow](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/blob/master/.github/workflows/deploy.yml) requires these repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `TURBO_TOKEN`

The upstream [release](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/blob/master/.github/workflows/release.yml), [documentation preview](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/blob/master/.github/workflows/docs-pr-preview.yml), and [documentation deployment](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/blob/master/.github/workflows/deploy-docs.yml) workflows are not required in a self-hosted fork.
