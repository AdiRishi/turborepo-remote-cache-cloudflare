# AGENTS.md

An open-source Turborepo remote cache server. It runs on Cloudflare Workers by default and on any other Nitro deployment target, and stores build artifacts through Files SDK in Cloudflare KV, R2, or any S3-compatible bucket.

## Layout

pnpm workspace orchestrated by Turborepo:

- `apps/api` (`@turborepo-remote-cache/api`): the Nitro server, its tests, and `wrangler.jsonc`.
- `apps/docs` (`@turborepo-remote-cache/docs`): the Blume documentation site. Pages are in `content/`, and the favicon, touch icon, and brand marks are in `public/`.
- `packages/files-sdk-kv` (`@turborepo-remote-cache/files-sdk-kv`): a Cloudflare Workers KV adapter for Files SDK. Keep Turborepo and app logic out of it so it can be published or upstreamed. Its tests run in workerd against Miniflare KV.
- `packages/spec` (`@turborepo-remote-cache/spec`): the official Remote Cache OpenAPI spec, vendored unmodified, and the types generated from it. The server imports the types, and the docs render the spec.

Root holds only shared tooling: `turbo.json`, `tsconfig.base.json` (which every package extends), `oxlint.config.ts`, and `oxfmt.config.ts`.

## Commands

Run everything from the root. `build`, `dev`, `typecheck`, `test`, `test:e2e`, and `check` go through Turborepo, so they are cached. `lint` and `format` run their tools directly. `codegen` and `codegen:check` run in every package that has them, `spec:sync` runs in `packages/spec`, `docs:preview` runs in `apps/docs`, and the rest forward to `apps/api`.

```bash
pnpm install
pnpm dev            # the server (Nitro through Vite) and the docs site in development
pnpm check          # lint, typecheck, test, and build: what CI's Verify job runs
pnpm lint           # oxlint (fails on any finding) + oxfmt --check
pnpm lint:fix       # oxlint --fix + oxfmt
pnpm format
pnpm typecheck
pnpm test           # Vitest with coverage in apps/api and packages/files-sdk-kv; blume validate in apps/docs
pnpm test:e2e       # builds the Worker, runs it, and runs the contract tests and a real turbo round trip
pnpm build          # apps/api builds for Cloudflare Workers (set NITRO_PRESET for another target); apps/docs builds the site
pnpm preview        # the built Worker under wrangler dev, on port 8787
pnpm start          # the built Node.js server, after a NITRO_PRESET=node_server build
pnpm deploy         # wrangler deploy of the built Worker

pnpm codegen        # regenerate the spec types and the Worker types
pnpm codegen:check  # fail if either generated file is stale
pnpm spec:sync      # download the latest Remote Cache spec and regenerate its types

pnpm docs:preview   # the built docs site

# One package, or one test file
pnpm build --filter=@turborepo-remote-cache/docs
pnpm --filter @turborepo-remote-cache/api exec vitest run tests/contract/artifacts.test.ts
```

## Remote cache

This repo uses its own deployed server as its Turborepo remote cache (`remoteCache` in `turbo.json`, signed artifacts). Root scripts load `TURBO_TOKEN` and `TURBO_REMOTE_CACHE_SIGNATURE_KEY` from `.env.turbo.local` (template: `.env.turbo.example`). Without that file, Turborepo uses only the local cache. New worktrees get a copy of it: the setup script in `t3.json` copies it for T3 Code, and `.worktreeinclude` lists it for Claude Code.

`.env.turbo.local` holds real secrets: never read, print, or commit it.

A cache hit replays outputs instead of running the task, so declare everything that changes a task's result in `turbo.json`: env vars under `env`, files outside the package under `inputs`, produced files under `outputs`. Workspace packages without a build step are hashed into their dependents through the `transit` task.

## CI

All of CI is one workflow, `.github/workflows/ci.yml`, whose jobs form a single graph: checks and the end-to-end run on every push and pull request, docs previews on pull requests, and deploys and releases on `master`. Add new work as a job in that graph rather than as a new workflow, and start each job with `actions/checkout` followed by `./.github/actions/setup`, which installs Node.js, pnpm, and the dependencies.

The `master` ruleset requires the checks `Verify`, `End-to-end`, and `Dependency review` by name, and allows only squash merges. Renaming those jobs means updating the ruleset too.

## TypeScript

TypeScript 7. Type-aware Oxlint (`oxlint-tsgolint`) also requires TypeScript 7 and rejects legacy tsconfig options such as `baseUrl`; use `paths` relative to the tsconfig instead.

`openapi-typescript` needs the TypeScript 5 compiler API, so `packages/spec` runs it through `pnpm dlx` with TypeScript 5 pinned beside it.

## Server (`apps/api`)

Nitro 3 (`nitro.config.ts`, `serverDir: './src'`) built through Vite. File routes live under `src/routes/`; `src/middleware/` adds CORS for `/v8/**` and bearer auth for `/v8/**` and `/internal/**`; `src/error.ts` renders every error, including Nitro's own 404s, as the spec's `{ code, message }`. `/` redirects to the documentation.

- **Platform env.** `src/utils/env.ts` is the one place that knows where configuration comes from: the Worker env on Cloudflare (`event.req.runtime.cloudflare.env`, or the task context in scheduled tasks), `process.env` elsewhere. Variable names predate Nitro, so they bypass `runtimeConfig`.
- **Storage.** `src/utils/storage.ts` resolves one Files SDK adapter per request: `src/custom-adapter.ts` if it returns one, then a `KV_STORE` binding, then an `R2_STORE` binding, then the `S3_*` variables. Keys are `{team}/{hash}`. Artifact metadata uses the keys `artifactTag`, `artifactDuration`, `artifactSha`, and `artifactDirtyHash`, read case-insensitively because S3-compatible stores lowercase them.
- **Worker types.** `worker-configuration.d.ts` is generated by `wrangler types` and committed, as Cloudflare recommends. Run `pnpm codegen` after changing `wrangler.jsonc`; CI runs `pnpm codegen:check`.
- **Spec.** Type request schemas and response bodies against `@turborepo-remote-cache/spec` with `satisfies`. Refresh the spec and its types with `pnpm spec:sync`.
- **Expiry.** The `cache:delete-expired` task (`src/tasks/`) runs on the `scheduledTasks` cron, and `POST /internal/delete-expired-objects` runs the same deletion on demand.

## Testing

`apps/api` tests run in Node through Nitro's `serverFetch`. Nitro 3.0.260903-beta ships no Vitest integration, so `tests/support/nitro-environment.ts` and `nitro-setup.ts` create the app, the `closeNitroWithVite` plugin in `vite.config.ts` closes Nitro's file watchers, and `noExternals` in `nitro.config.ts` stops Nitro's dev externals from failing to load `files-sdk`. Swap storage at its seam with `vi.mock('../src/custom-adapter', () => import('./support/memory-storage'))`.

`tests/contract/` talks only HTTP, so `pnpm test:e2e` also runs it against the built Worker under `wrangler dev`, followed by a real `turbo` round trip (`e2e/turbo-roundtrip.sh`). `e2e/run.sh` starts and stops the Worker and refuses to run while something else holds port 8787.

Test our own behaviour only. Rely on Files SDK, Nitro, and the platforms to do what they document; don't test them.

Contract tests use random hashes, so they pass against a store that already holds data.

## Documentation

Docs live in `apps/docs`. Every functional or configuration change updates the matching docs page in the same PR.

The site is built with [Blume](https://useblume.dev). Its own docs ship in `apps/docs/node_modules/blume/docs`. Read them instead of answering from memory.

- Pages are `.mdx` files under `apps/docs/content/`. The file path is the route, and a parenthesized folder such as `(get-started)` groups pages without adding a URL segment. The `meta.ts` in each folder sets the sidebar order.
- Frontmatter is strict: a key Blume doesn't know fails the build. The `title` renders as the page H1, and the `description` renders below it, so don't repeat the description in the first paragraph.
- Write callouts as `:::tip` … `:::`, with no space after the colons. `::: tip` renders as literal text.
- The home page is `content/index.mdx` in Blume's `custom` mode.
- The API reference under `/api` renders the vendored spec in `packages/spec/`. Fix spec problems in `apps/docs/openapi-overlay.yaml`, never in the vendored file.
- When you move a page, add a redirect in `apps/docs/blume.config.ts`.
- The site shows no "Last updated" dates: CI builds from a shallow clone, so Blume would read the wrong dates from Git history.
