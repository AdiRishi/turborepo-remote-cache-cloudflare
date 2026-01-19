# CLAUDE.md

This file provides guidance to AI Agents when working with code in this repository.

## Project Overview

An open-source Turborepo custom remote cache server built for Cloudflare Workers. Enables Turborepo remote caching using Cloudflare R2 (object storage) or KV (key-value) storage backends instead of Vercel's cache.

## Commands

```bash
# Development
pnpm install          # Install dependencies (requires Node >= 22, pnpm 10.28.0)
pnpm dev              # Start development server
pnpm build            # Build for production (outputs to dist/)

# Testing
pnpm test             # Run tests with coverage
pnpm test:watch       # Run tests in watch mode
pnpm vitest run tests/routes/v8/artifacts.test.ts  # Run single test file

# Code Quality
pnpm typecheck        # TypeScript type checking
pnpm lint             # ESLint + Prettier check
pnpm format           # Auto-format with Prettier

# Documentation
pnpm docs:dev         # Start docs dev server
pnpm docs:build       # Build documentation
```

## Architecture

### Worker Entry Point (`src/index.ts`)

Exports Cloudflare Worker with two handlers:

- `fetch`: Initializes `StorageManager`, delegates to Hono router
- `scheduled`: Cron handler running `deleteOldCache` daily at 3 AM

### Storage Layer (`src/storage/`)

Interface-based abstraction with two backends:

- `R2Storage`: Uses Cloudflare R2 bucket, metadata stored via `customMetadata`
- `KvStorage`: Uses Cloudflare KV namespace with TTL-based expiration
- `StorageManager`: Factory that selects backend (KV preferred when both available)

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

Deletes objects older than `BUCKET_OBJECT_EXPIRATION_HOURS` (default 720h/30 days). Uses cursor-based pagination with batch size of 500 to avoid Cloudflare limits.

## Testing

Uses Vitest with `@cloudflare/vitest-pool-workers` for Workers simulation. Test config (`wrangler.vitest.jsonc`) provides both R2 and KV bindings.

```typescript
import { createExecutionContext, env } from 'cloudflare:test';
import { workerHandler } from '~/index';
import { StorageManager } from '~/storage';

beforeEach(() => {
    workerEnv = env;
    workerEnv.STORAGE_MANAGER = new StorageManager(workerEnv);
    ctx = createExecutionContext();
});
```

Tests mirror source structure in `tests/` directory. Use unique IDs (`Math.random()`) for test isolation.

## Documentation

VitePress documentation in `docs/`. Any functional or configuration changes should include corresponding documentation updates in the same PR.
