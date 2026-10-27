# turborepo-remote-cache-cf

## 5.0.0

### Major Changes

- [#1067](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/pull/1067) [`58271d7`](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/commit/58271d7067af5e66bd6951cbe1bda4074931d4e6) Thanks [@AdiRishi](https://github.com/AdiRishi)! - Rebuild the server on Nitro and Files SDK. It still deploys to Cloudflare Workers by default, and now also builds for any Nitro preset (`NITRO_PRESET`), with storage in a KV namespace, an R2 bucket, any S3-compatible bucket, or any Files SDK adapter returned from `src/custom-adapter.ts`.
  
  Existing deployments keep their `TURBO_TOKEN`, `BUCKET_OBJECT_EXPIRATION_HOURS`, `R2_STORE`, and `KV_STORE` configuration, and existing R2 artifacts stay readable.
  
  Breaking changes:
  
  - The API follows the official Remote Cache spec: non-hexadecimal hashes and invalid artifact headers return 400, errors return `{ code, message }`, and `POST /v8/artifacts` answers batch queries.
  - `GET /v8/artifacts/:hash` no longer keeps a Cloudflare Cache API copy of artifacts.
  - `POST /internal/delete-expired-objects` returns `{ deleted }` instead of `{ success: true }`.
  - `POST /internal/populate-random-objects` and `GET /internal/count-objects` are removed.
  - KV artifacts written by earlier versions are served without their tag, so clients that verify signatures skip them, and the next daily expiry deletes them.

### Patch Changes

- Updated dependencies [[`58271d7`](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/commit/58271d7067af5e66bd6951cbe1bda4074931d4e6)]:
  - @turborepo-remote-cache/files-sdk-kv@0.1.0

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
