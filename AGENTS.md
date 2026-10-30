# AGENTS.md

A self-hosted Turborepo remote cache server. It runs on Cloudflare Workers by default, builds for other platforms through Nitro, and stores artifacts through Files SDK.

## Where things are

- `apps/api`: the server and its tests.
- `apps/docs`: the documentation site, built with Blume. Blume's own docs are in `apps/docs/node_modules/blume/docs`. Read them before you change the site.
- `packages/files-sdk-kv`: a Workers KV adapter for Files SDK. Keep Turborepo and server logic out of it, so it can be published on its own.
- `packages/spec`: the official Remote Cache OpenAPI spec and the types generated from it.
- `.github/workflows/ci.yml`: all of CI, as one graph of jobs. It deploys the docs to the Worker in `apps/docs/wrangler.jsonc`, which serves `turborepo-remote-cache.dev`, and to GitHub Pages. A redirect rule in the Cloudflare zone sends `www.` and `cloudflare.` to the apex.

## Check your changes

Run every command from the repository root.

1. Run `pnpm check` for every change. It runs lint, typecheck, the tests, and both builds, the same steps as CI's `Verify` job. `pnpm lint:fix` fixes most lint and formatting findings.
2. If you change anything the built Worker runs, also run `pnpm test:e2e`. That covers `apps/api/src`, `nitro.config.ts`, `vite.config.ts`, `wrangler.jsonc`, and the server's dependencies. The script builds the Worker, starts it under `wrangler dev` on port 8787, and runs the contract tests and the real `turbo` CLI against it.
3. If you change `wrangler.jsonc` or the spec, run `pnpm codegen` and commit the generated files. CI fails when they are stale.
4. If you change behaviour or configuration, update the matching page in `apps/docs/content/` in the same change.

Test this project's behaviour, and trust Files SDK, Nitro, and the platforms to do what they document. Tests in `apps/api/tests/contract/` talk only HTTP and use random hashes, because `pnpm test:e2e` runs them against a real Worker whose store can already hold data. For the same reason, each test in `apps/api/e2e/` uses its own team.

## Decisions the code doesn't explain

- `.env.turbo.local` holds the credentials for this repository's own remote cache. Never read, print, or commit it. Without it, `turbo` uses only the local cache.
- A cache hit replays a task's outputs instead of running it, so an undeclared input hides a failure. Declare every env var, file outside the package, and output that affects a task in `turbo.json`. Write `inputs` as `$TURBO_DEFAULT$` (`$TURBO_EXTENDS$` in a package) followed by `!` exclusions. Depend on `^transit`, not `transit`, because a package's own `transit` hashes all of its files and undoes the exclusions.
- To change the stats database's tables or data, append a migration to `apps/api/src/migrations/index.ts` and follow the rules written there.
- The server's variable names predate Nitro, so it reads them through `apps/api/src/utils/env.ts` instead of `runtimeConfig`.
- `packages/spec` holds the spec unmodified, so `pnpm spec:sync` can replace it. Fix spec problems in `apps/docs/openapi-overlay.yaml`.
- The `master` ruleset requires the checks `Verify`, `End-to-end`, and `Dependency review` by name. Renaming those jobs blocks merges until the ruleset changes too. Add new CI work as a job in `ci.yml`.
- Type-aware Oxlint needs TypeScript 7, which rejects `baseUrl`. Use `paths` relative to the tsconfig.
- In the docs, Blume renders the frontmatter `title` as the page's H1 and the `description` below it, so start the body with new information. Write callouts as `:::tip`, with no space after the colons. When you move a page, add a redirect in `apps/docs/blume.config.ts`.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": true` in the root `turbo.json` or `turbo.jsonc` to opt in; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
