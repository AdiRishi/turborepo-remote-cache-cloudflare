# AGENTS.md

An open-source Turborepo remote cache server. It runs on Cloudflare Workers by default and on any other Nitro deployment target, and stores build artifacts through Files SDK in Cloudflare KV, R2, or any S3-compatible bucket.

## Layout

pnpm workspace orchestrated by Turborepo:

- `apps/server` (`@turborepo-remote-cache/server`): the Nitro server, its tests, `wrangler.jsonc`, and the vendored Remote Cache OpenAPI spec.
- `apps/docs` (`@turborepo-remote-cache/docs`): the documentation site.
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
pnpm build         # apps/server builds for Cloudflare Workers; set NITRO_PRESET for another target
pnpm docs:build

# One test file
pnpm --filter @turborepo-remote-cache/server exec vitest run tests/contract/artifacts.test.ts
```

## Remote cache

This repo uses its own deployed server as its Turborepo remote cache (`remoteCache` in `turbo.json`, signed artifacts). Root scripts load `TURBO_TOKEN` and `TURBO_REMOTE_CACHE_SIGNATURE_KEY` from `.env.turbo.local` (template: `.env.turbo.example`). Without that file, Turborepo uses only the local cache.

`.env.turbo.local` holds real secrets: never read, print, or commit it.

A cache hit replays outputs instead of running the task, so declare everything that changes a task's result in `turbo.json`: env vars under `env`, files outside the package under `inputs`, produced files under `outputs`. Workspace packages without a build step are hashed into their dependents through the `transit` task.

## TypeScript

TypeScript 7. Type-aware Oxlint (`oxlint-tsgolint`) also requires TypeScript 7 and rejects legacy tsconfig options such as `baseUrl`; use `paths` relative to the tsconfig instead.

`openapi-typescript` needs the TypeScript 5 compiler API, so `pnpm spec:types` runs it through `pnpm dlx` with TypeScript 5 pinned beside it.

## Server (`apps/server`)

Nitro 3 (`nitro.config.ts`, `serverDir: './server'`) built through Vite. File routes live under `server/routes/`; `server/middleware/` adds CORS for `/v8/**` and bearer auth for `/v8/**` and `/internal/**`; `server/error.ts` renders every error as the spec's `{ code, message }`. The catch-all routes under `/v8` and `/internal` keep unknown API paths from falling through to the `index.html` renderer.

- **Platform env.** `server/utils/env.ts` is the one place that knows where configuration comes from: the Worker env on Cloudflare (`event.req.runtime.cloudflare.env`, or the task context in scheduled tasks), `process.env` elsewhere. Variable names predate Nitro, so they bypass `runtimeConfig`.
- **Storage.** `server/utils/storage.ts` resolves one Files SDK adapter per request: `server/custom-adapter.ts` if it returns one, then a `KV_STORE` binding, then an `R2_STORE` binding, then the `S3_*` variables. Keys are `{team}/{hash}`. Artifact metadata uses the keys `artifactTag`, `artifactDuration`, `artifactSha`, and `artifactDirtyHash`, read case-insensitively because S3-compatible stores lowercase them.
- **Spec.** `openapi/turborepo.openapi.json` is the official spec, vendored unmodified; `openapi/turborepo.ts` is generated from it. Refresh both with `pnpm spec:sync`, and type request schemas and response bodies against the generated types with `satisfies`.
- **Expiry.** The `cache:delete-expired` task (`server/tasks/`) runs on the `scheduledTasks` cron, and `POST /internal/delete-expired-objects` runs the same deletion on demand.

## Testing

`apps/server` has two Vitest projects in `vite.config.ts`:

- `nitro` runs route and contract tests in Node through `serverFetch`. Nitro 3.0.260903-beta ships no Vitest integration, so `tests/support/nitro-environment.ts` and `nitro-setup.ts` create the app, the `closeNitroWithVite` plugin closes Nitro's file watchers, and `noExternals` in `nitro.config.ts` stops Nitro's dev externals from failing to load `files-sdk`. Swap storage at its seam with `vi.mock('../server/custom-adapter', () => import('./support/memory-storage'))`.
- `workerd` runs `tests/workerd/` inside workerd with real Miniflare KV and R2 bindings, for code that needs Cloudflare bindings rather than the Nitro app.

`tests/contract/` talks only HTTP, so it also runs against a built server: start one (`pnpm preview:worker` for the Worker on port 8787, or `pnpm start` after a `NITRO_PRESET=node_server` build), then run `pnpm test:contract`, `pnpm test:schemathesis [url]`, and `pnpm test:turbo [url]` from `apps/server`. `e2e/s3.sh` starts a local S3-compatible store for the Node server. Against `wrangler dev`, set `SCHEMATHESIS_MODE=positive`: it fails the request after one the Worker answers without reading a large body.

Contract tests use random hashes, so they pass against a store that already holds data.

## Documentation

Docs live in `apps/docs`. Every functional or configuration change updates the matching docs page in the same PR.
