# Turborepo Remote Cache (For Cloudflare Workers!) [![CI](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/actions/workflows/ci.yml/badge.svg)](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/actions/workflows/ci.yml)

An open source implementation of the [Turborepo custom remote cache server](https://turbo.build/repo/docs/core-concepts/remote-caching).
This implementation is **built from the ground up for [Cloudflare Workers](https://developers.cloudflare.com/workers/)**

## Quick start

The easiest way to deploy this repository is using the link below

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/AdiRishi/turborepo-remote-cache-cloudflare)

If you want to clone the repository and deploy it via the CLI, use the following steps

```lang=sh
# 1. Clone the repository
git clone https://github.com/AdiRishi/turborepo-remote-cache-cloudflare.git custom-cache

# 2. Install packages
yarn install

# 3. Create the R2 bucket for storage
wrangler r2 bucket create turborepo-cache

# 4. Publish the project
wrangler publish

# 5. (Optional) Set a Bearer auth token
echo "SECRET" |  wrangler secret put AUTH_SECRET
```
