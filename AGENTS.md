# AGENTS.md

An open-source Turborepo remote cache server for Cloudflare Workers. It stores build artifacts in Cloudflare R2 or KV.

## Layout

pnpm workspace orchestrated by Turborepo:

- `apps/server` (`@turborepo-remote-cache/server`): the Worker, its tests, and `wrangler.jsonc`.
- `apps/docs` (`@turborepo-remote-cache/docs`): the VitePress documentation site.
- `packages/files-sdk-kv` (`@turborepo-remote-cache/files-sdk-kv`): a Cloudflare Workers KV adapter for Files SDK. Keep Turborepo and app logic out of it so it can be published or upstreamed. Its tests run in workerd against Miniflare KV.

Root holds shared tooling: `turbo.json`, `tsconfig.base.json` (every package extends it), `oxlint.config.ts`, and `oxfmt.config.ts`.

## Commands

Run from the root. `build`, `dev`, `test`, `typecheck`, and `docs:build` go through Turborepo; `lint` and `format` run Oxlint and Oxfmt across the whole repo directly.

```bash
pnpm install
pnpm lint          # oxlint (fails on any finding) + oxfmt --check
pnpm lint:fix      # oxlint --fix + oxfmt
pnpm typecheck
pnpm test          # Vitest with coverage, in apps/server and packages/files-sdk-kv
pnpm build
pnpm docs:build

# One test file
pnpm --filter @turborepo-remote-cache/server exec vitest run tests/routes/v8/artifacts.test.ts
```

## Remote cache

This repo uses its own deployed server as its Turborepo remote cache (`remoteCache` in `turbo.json`, signed artifacts). Root scripts load `TURBO_TOKEN` and `TURBO_REMOTE_CACHE_SIGNATURE_KEY` from `.env.turbo.local` (template: `.env.turbo.example`). Without that file, Turborepo uses only the local cache.

`.env.turbo.local` holds real secrets: never read, print, or commit it.

A cache hit replays outputs instead of running the task, so declare everything that changes a task's result in `turbo.json`: env vars under `env`, files outside the package under `inputs`, produced files under `outputs`.

## TypeScript

TypeScript 7. Type-aware Oxlint (`oxlint-tsgolint`) also requires TypeScript 7 and rejects legacy tsconfig options such as `baseUrl`; use `paths` relative to the tsconfig instead.

`apps/server` has two projects: `tsconfig.worker.json` (Worker runtime types, covers `src/` and `tests/`) and `tsconfig.node.json` (Node types, covers the Vite and Vitest configs). Keep Node-only code out of the Worker project.

## Architecture

### Worker entry point (`apps/server/src/index.ts`)

Exports the Worker with two handlers:

- `fetch`: initializes `StorageManager`, then delegates to the Hono router.
- `scheduled`: cron handler that runs `deleteOldCache` daily at 3 AM.

### Storage layer (`apps/server/src/storage/`)

Interface-based abstraction with two backends:

- `R2Storage`: Cloudflare R2 bucket, metadata in `customMetadata`.
- `KvStorage`: Cloudflare KV namespace with TTL-based expiration.
- `StorageManager`: selects the backend (KV wins when both are bound).

### Routing (`apps/server/src/routes/`)

Hono (`hono/tiny` for a smaller bundle) with valibot validation:

```
/                     → Landing page HTML
/ping                 → Health check
/v8/artifacts/*       → Turborepo API (bearer auth required)
  PUT /:artifactId    → Upload artifact
  GET /:artifactId    → Download artifact (5 min cache)
  HEAD /:artifactId   → Check artifact exists
  GET /status         → Cache status
  POST /events        → Event tracking (placeholder)
/internal/*           → Cache management (bearer auth required)
  POST /delete-expired-objects
  POST /populate-random-objects
  GET /count-objects
```

### Cron job (`apps/server/src/crons/deleteOldCache.ts`)

Deletes objects older than `BUCKET_OBJECT_EXPIRATION_HOURS` (default 720h, 30 days). Paginates with a cursor in batches of 500 to stay under Cloudflare limits.

## Testing

Tests run inside the Workers runtime through `@cloudflare/vitest-plugin`. `apps/server/vitest.config.ts` uses `cloudflareTest()` with `wrangler.jsonc` plus Miniflare overrides for test-only bindings such as `KV_STORE`.

```typescript
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

import { workerHandler } from '~/index';
import { StorageManager } from '~/storage';

beforeEach(() => {
    workerEnv = env;
    workerEnv.STORAGE_MANAGER = new StorageManager(workerEnv);
    ctx = createExecutionContext();
});

afterEach(async () => {
    await waitOnExecutionContext(ctx);
});
```

Await `waitOnExecutionContext(ctx)` before a test ends whenever the handler calls `waitUntil`. Otherwise the next test's `reset()` aborts the background work and leaves partial state, such as a truncated cache entry, behind.

Tests mirror the source tree under `apps/server/tests/`. Use unique IDs (`Math.random()`) for test isolation.

## Documentation

Docs live in `apps/docs`. Every functional or configuration change updates the matching docs page in the same PR.
