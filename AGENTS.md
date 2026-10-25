# AGENTS.md

An open-source Turborepo remote cache server. It runs on Cloudflare Workers by default and on any other Nitro deployment target, and stores build artifacts through Files SDK in Cloudflare KV, R2, or any S3-compatible bucket.

## Layout

pnpm workspace orchestrated by Turborepo:

- `apps/server` (`@turborepo-remote-cache/server`): the Nitro server, its tests, `wrangler.jsonc`, and the vendored Remote Cache OpenAPI spec.
- `packages/files-sdk-kv` (`@turborepo-remote-cache/files-sdk-kv`): a Cloudflare Workers KV adapter for Files SDK. Keep Turborepo and app logic out of it so it can be published or upstreamed. Its tests run in workerd against Miniflare KV.

Root holds shared tooling (`turbo.json`, `tsconfig.base.json`, which every package extends, `oxlint.config.ts`, and `oxfmt.config.ts`) and the Blume documentation site: `blume.config.ts`, `theme.css`, `public/` (favicon, touch icon, and the brand marks in `public/brand/`), and the pages in `docs/`.

## Commands

Run from the root. `build`, `dev`, `test`, and `typecheck` go through Turborepo; `lint` and `format` run Oxlint and Oxfmt across the whole repo, and `docs:dev` and `docs:build` run Blume directly.

```bash
pnpm install
pnpm lint          # oxlint (fails on any finding) + oxfmt --check
pnpm lint:fix      # oxlint --fix + oxfmt
pnpm typecheck
pnpm test          # Vitest with coverage, in apps/server and packages/files-sdk-kv
pnpm build         # apps/server builds for Cloudflare Workers; set NITRO_PRESET for another target
pnpm docs:dev
pnpm docs:build

# Check docs links, anchors, and redirects
pnpm exec blume validate --strict

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

Nitro 3 (`nitro.config.ts`, `serverDir: './src'`) built through Vite. File routes live under `src/routes/`; `src/middleware/` adds CORS for `/v8/**` and bearer auth for `/v8/**` and `/internal/**`; `src/error.ts` renders every error, including Nitro's own 404s, as the spec's `{ code, message }`. `/` redirects to the documentation.

- **Platform env.** `src/utils/env.ts` is the one place that knows where configuration comes from: the Worker env on Cloudflare (`event.req.runtime.cloudflare.env`, or the task context in scheduled tasks), `process.env` elsewhere. Variable names predate Nitro, so they bypass `runtimeConfig`.
- **Storage.** `src/utils/storage.ts` resolves one Files SDK adapter per request: `src/custom-adapter.ts` if it returns one, then a `KV_STORE` binding, then an `R2_STORE` binding, then the `S3_*` variables. Keys are `{team}/{hash}`. Artifact metadata uses the keys `artifactTag`, `artifactDuration`, `artifactSha`, and `artifactDirtyHash`, read case-insensitively because S3-compatible stores lowercase them.
- **Spec.** `openapi/turborepo.openapi.json` is the official spec, vendored unmodified; `openapi/turborepo.ts` is generated from it. Refresh both with `pnpm spec:sync`, and type request schemas and response bodies against the generated types with `satisfies`.
- **Expiry.** The `cache:delete-expired` task (`src/tasks/`) runs on the `scheduledTasks` cron, and `POST /internal/delete-expired-objects` runs the same deletion on demand.

## Testing

`apps/server` tests run in Node through Nitro's `serverFetch`. Nitro 3.0.260903-beta ships no Vitest integration, so `tests/support/nitro-environment.ts` and `nitro-setup.ts` create the app, the `closeNitroWithVite` plugin in `vite.config.ts` closes Nitro's file watchers, and `noExternals` in `nitro.config.ts` stops Nitro's dev externals from failing to load `files-sdk`. Swap storage at its seam with `vi.mock('../src/custom-adapter', () => import('./support/memory-storage'))`.

`tests/contract/` talks only HTTP, so it also runs against a built Worker: start it with `pnpm preview:worker` (port 8787), then run `pnpm test:contract` and `pnpm test:turbo` from `apps/server`.

Test our own behaviour only. Rely on Files SDK, Nitro, and the platforms to do what they document; don't test them.

Contract tests use random hashes, so they pass against a store that already holds data.

## Documentation

Docs live in `docs/` at the root. Every functional or configuration change updates the matching docs page in the same PR.

The site is built with [Blume](https://useblume.dev). Its own docs ship in `node_modules/blume/docs`. Read them instead of answering from memory.

- Pages are `.mdx` files under `docs/`. The file path is the route, and a parenthesized folder such as `(get-started)` groups pages without adding a URL segment. The `meta.ts` in each folder sets the sidebar order.
- Frontmatter is strict: a key Blume doesn't know fails the build. The `title` renders as the page H1, and the `description` renders below it, so don't repeat the description in the first paragraph.
- Write callouts as `:::tip` … `:::`, with no space after the colons. `::: tip` renders as literal text.
- The home page is `docs/index.mdx` in Blume's `custom` mode.
- The API reference under `/api` renders the vendored spec in `apps/server/openapi/`. Fix spec problems in `docs/openapi-overlay.yaml`, never in the vendored file.
- When you move a page, add a redirect in `blume.config.ts`.
- The site shows no "Last updated" dates: CI builds from a shallow clone, so Blume would read the wrong dates from Git history.
