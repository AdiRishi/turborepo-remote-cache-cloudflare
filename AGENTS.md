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
5. The README's GIF is a recording of `apps/docs/islands/LiveCache.tsx`, which renders the dashboard's own components. If you change either in a way that shows, run `pnpm --filter @turborepo-remote-cache/docs record` and commit the new `.github/assets/live-cache.gif`. It needs ffmpeg.

Test this project's behaviour, and trust Files SDK, Nitro, and the platforms to do what they document. Tests in `apps/api/tests/contract/` talk only HTTP and use random hashes, because `pnpm test:e2e` runs them against a real Worker whose store can already hold data. For the same reason, each test in `apps/api/e2e/` uses its own team.
