# CLAUDE.md

This file provides guidance to AI Agents when working with code in this repository.

## Project Overview

An open-source Turborepo custom remote cache server that defaults to Cloudflare Workers and deploys through Nitro. Files SDK provides first-class Cloudflare R2, Cloudflare KV, and Amazon S3 storage, plus a typed custom-adapter escape hatch.

## Commands

```bash
# Development
pnpm install          # Install dependencies (requires Node >= 22, pnpm 11.6.0)
pnpm dev              # Start the Nitro development server
pnpm build            # Build the default Cloudflare target into .output/
pnpm build:node       # Build the portable Node server target

# Testing
pnpm test             # Run tests with coverage
pnpm test:watch       # Run tests in watch mode
pnpm test:turbo       # Smoke-test signed remote caching with the real Turbo CLI
pnpm vitest run tests/routes/v8/artifacts.test.ts  # Run single test file

# Code Quality
pnpm typecheck        # TypeScript type checking
pnpm lint             # Oxlint + Oxfmt check
pnpm lint:fix         # Auto-fix safe Oxlint findings
pnpm format           # Auto-format with Oxfmt

# Documentation
pnpm docs:dev         # Start docs dev server
pnpm docs:build       # Build documentation
```

## Architecture

### Runtime Entry Points

- `server.ts`: Nitro server entry point; resolves runtime bindings and delegates every request to Hono
- `tasks/cache/delete-expired.ts`: Nitro retention task, scheduled daily at 3 AM by the Cloudflare preset
- `src/index.ts`: compatibility Cloudflare Worker facade retained for integrations and Worker-pool tests

Cloudflare Workers is the default deployment target. Nitro also supports Node and other presets.

### Storage Layer (`src/storage/`)

Files SDK provides the storage abstraction:

- R2 and S3 use the official Files SDK adapters.
- `cloudflareKv`: Project-owned Files SDK adapter for the native Cloudflare KV binding.
- `prepareUploadBody`: Restores Cloudflare's fixed-length stream marker only for the native R2 adapter.
- `createStorageServices`: Selects `r2`, `kv`, `s3`, or `custom` from runtime configuration. Legacy auto-detection keeps KV precedence when both bindings exist.
- `storage.config.ts`: Typed source escape hatch for other Files SDK adapters.

### Routing (`src/routes/`)

Uses Hono (`hono/tiny` for smaller bundle) with valibot validation:

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

### Cron Job (`src/crons/deleteOldCache.ts`)

Deletes objects older than `CACHE_RETENTION_HOURS` (default 720h/30 days), with `BUCKET_OBJECT_EXPIRATION_HOURS` retained as a fallback. Uses Files SDK cursor pagination with a batch size of 500. A value of `0` disables cleanup and KV TTL.

## Testing

Uses Vitest with `@cloudflare/vitest-pool-workers` for Workers simulation. The Vitest config uses the `cloudflareTest()` plugin with `wrangler.jsonc` plus Miniflare overrides for test-only bindings like `KV_STORE`. Route tests can construct a Files SDK memory adapter and pass `AppBindings` directly to Hono.

```typescript
import { Files } from 'files-sdk';
import { memory } from 'files-sdk/memory';

const files = new Files({ adapter: memory() });
```

Tests mirror source structure in `tests/` directory. Use unique IDs (`crypto.randomUUID()`) for test isolation.

## Documentation

VitePress documentation in `docs/`. Any functional or configuration changes should include corresponding documentation updates in the same PR.
