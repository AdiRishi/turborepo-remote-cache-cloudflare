# turborepo-remote-cache-cf

## 5.1.0

### Minor Changes

- [#1070](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/pull/1070) [`25714a2`](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/commit/25714a263bfbe4e41159dcf09ae1c545b13d994e) Thanks [@AdiRishi](https://github.com/AdiRishi)! - Serve a usage dashboard at the server's root, in place of the redirect to the documentation. It shows the time the caches saved, hit rates, where tasks came from, storage, clients, and teams, over a range from the last 24 hours to the last 90 days, and compares each figure with the period before. `GET /stats` returns the same numbers as JSON. Both are public.
  
  The server records stats in a database through Nitro's database layer, after each response. Cloudflare builds bind a D1 database as `STATS_DB`, which Wrangler creates on the next deploy. Node.js and Deno builds use a SQLite file in `.data/`. Without a database, the cache works as before and the dashboard reports that stats are off.
  
  If you deploy from CI, give the Cloudflare API token permission to edit D1. Vercel and Netlify builds now run `turbo run build`, so the dashboard builds before the server.

## 5.0.0

**Turborepo Remote Cache 5.0 is no longer Cloudflare-only.** We rebuilt the server on [Nitro](https://nitro.build) and [Files SDK](https://files-sdk.dev). It still deploys to Cloudflare Workers in one click, and the same code now builds for Node.js, Bun, Deno, Vercel, Netlify, and AWS Lambda, with artifacts in R2, KV, any S3-compatible bucket, or anything Files SDK can talk to.

Already running on Cloudflare? Your `TURBO_TOKEN`, retention period, and R2 or KV binding carry over, and your R2 artifacts stay readable. Read the [upgrade guide](https://adirishi.github.io/turborepo-remote-cache-cloudflare/upgrade-from-v4) before you deploy, because the repository layout changed.

### 🌍 Deploy it wherever your builds run

Pick a target with `NITRO_PRESET` and build:

```sh
NITRO_PRESET=node_server pnpm build
```

Cloudflare Workers stays the default. `node_server`, `bun`, `deno_server`, `vercel`, `netlify`, and `aws_lambda` each have a [deployment guide](https://adirishi.github.io/turborepo-remote-cache-cloudflare/deploy), with the expiry schedule and the largest artifact each platform can carry.

### 💿 Keep artifacts in storage you already have

- 🪣 **R2 and 🔑 KV** on Workers, through bindings, as before.
- **Any S3-compatible bucket**, such as Amazon S3, R2 over its S3 API, or MinIO, through the new `S3_*` variables. On AWS Lambda, the function's IAM role supplies the credentials.
- **Anything else Files SDK supports**, such as Google Cloud Storage or a local disk. Return the adapter from `apps/api/src/custom-adapter.ts`, and the server uses it ahead of everything else.

[Choose storage](https://adirishi.github.io/turborepo-remote-cache-cloudflare/storage) compares the options and recommends one for each platform.

### ✅ The whole Remote Cache spec

The server now implements the [official Remote Cache API](https://turborepo.dev/docs/core-concepts/remote-caching#remote-cache-api), and its types are generated from the spec that Vercel publishes. `POST /v8/artifacts` answers batch queries for many hashes in one request, every error has the spec's `{ code, message }` shape, and the server validates hashes and artifact headers before it touches storage.

On every change, CI runs the contract tests against the built Worker, then a real `turbo` build with signed artifacts that must restore from the remote cache.

### 🧹 Expiry on every platform

The daily cleanup is now a Nitro scheduled task, `cache:delete-expired`. It runs as a Cron Trigger on Workers, inside the process on Node.js, Bun, and Deno, and as a Vercel Cron Job on Vercel. On platforms without a scheduler, `POST /internal/delete-expired-objects` runs the same deletion and returns how many artifacts it removed. See [Retention and expiry](https://adirishi.github.io/turborepo-remote-cache-cloudflare/retention).

### 🩺 Configuration errors that say what's wrong

The server checks its configuration on every request. A missing token, a malformed retention period, or no storage at all fails with a `500` and a log line that names the problem, such as `Invalid server configuration: no artifact storage`.

### 📚 New documentation

The [documentation site](https://adirishi.github.io/turborepo-remote-cache-cloudflare) is rewritten from scratch, with guides for every platform and storage backend, CI setup for GitHub Actions and GitLab, artifact signing, and an [API reference](https://adirishi.github.io/turborepo-remote-cache-cloudflare/api) rendered from the spec.

### ⚠️ Breaking changes

- **The repository is a pnpm workspace.** The server, its `wrangler.jsonc`, and its source moved to `apps/api`. Build and deploy from the root with `pnpm build` and `pnpm run deploy`. The cron trigger now comes from `scheduledTasks` in `apps/api/nitro.config.ts`, and the `ENVIRONMENT` variable is gone.
- **The API follows the spec strictly.** A hash that isn't hexadecimal, or an invalid artifact header, returns `400`. Errors return `{ code, message }`. `turbo` handles all of this, but check any script of your own that calls the server.
- **Downloads skip the Cloudflare Cache API.** Version 4 kept a five-minute copy of each downloaded artifact and sent a `Cache-Control` header. Version 5 reads every download from storage and sends no `Cache-Control` header.
- **`POST /internal/delete-expired-objects` returns `{ deleted }`** instead of `{ success: true }`.
- **`POST /internal/populate-random-objects` and `GET /internal/count-objects` are removed.** They return `404`.
- **KV entries from version 4 lose their signatures.** Version 5 serves them without one, so clients that verify signatures treat them as misses, and the next daily expiry deletes them. Expect one miss per task after the upgrade. R2 artifacts keep their signatures.

The [upgrade guide](https://adirishi.github.io/turborepo-remote-cache-cloudflare/upgrade-from-v4) walks through each step.

Shipped in [#1067](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/pull/1067) by [@AdiRishi](https://github.com/AdiRishi).

## 4.0.0

### Major Changes

- [#633](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/pull/633) [`9a4fe22`](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/commit/9a4fe22e4bfeb586e3f52eab0bd653f8aae65d9f) Thanks [@ItsWendell](https://github.com/ItsWendell)! - replace hono with hono/tiny and zod with valibot to decrease bundle size and improve performance

### Patch Changes

- [#1049](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/pull/1049) [`ce7af83`](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/commit/ce7af83542b1f36a8939ff0aed790f07af78d17a) Thanks [@AdiRishi](https://github.com/AdiRishi)! - Fix bearerAuth middleware usage by returning the middleware result instead of just awaiting it

## 3.2.0

### Minor Changes

- [#449](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/pull/449) [`b765ed4`](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/commit/b765ed4de8d3bdd2c55942ca722895d9b6f6506e) Thanks [@AdiRishi](https://github.com/AdiRishi)! - Use KV key expiry to cost effectively remove cache keys

## 3.1.0

### Minor Changes

- [#394](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/pull/394) [`2005a64`](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/commit/2005a64d7c661cafb1c3f651a9248a206db032c3) Thanks [@AdiRishi](https://github.com/AdiRishi)! - Update routes to conform to the new Turborepo OpenAPI spec.

  Overall this is not a breaking change as most additions are optional.

## 3.0.0

### Major Changes

- [#287](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/pull/287) [`7851729`](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/commit/78517294d281182c7f6e7e27b69d7f22ea5115cc) Thanks [@AdiRishi](https://github.com/AdiRishi)! - This project now has brand new web documentation powered by VitePress. You can visit these docs at https://adirishi.github.io/turborepo-remote-cache-cloudflare

- [#287](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/pull/287) [`7851729`](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/commit/78517294d281182c7f6e7e27b69d7f22ea5115cc) Thanks [@AdiRishi](https://github.com/AdiRishi)! - You can now store your build artifacts in either Cloudflare 🪣 R2 or 🔑 KV storage. Find out how in our [official documentation](https://adirishi.github.io/turborepo-remote-cache-cloudflare/configuration/kv-storage)

## 2.6.2

### Patch Changes

- 6455295: Use a default value for secrets.TURBO_TOKEN to prevent one-click deployment (fork) failures

## 2.6.1

### Patch Changes

- 273c29e: Fix incorrect usage of wranglerVersion in deploy.yml - this fixes the wrangler deploy github action

## 2.6.0

### Minor Changes

- 0a87179: Move release process to changesets cli
