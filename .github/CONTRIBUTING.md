# Contributing

## Set up the repository

Install Node.js 24 or later and the pnpm version in `package.json`. Then clone the repository:

```sh
git clone https://github.com/AdiRishi/turborepo-remote-cache-cloudflare.git
cd turborepo-remote-cache-cloudflare
pnpm install --frozen-lockfile
```

The server lives in `apps/api`, the dashboard in `apps/dashboard`, and the documentation site in `apps/docs`. `packages/files-sdk-kv` is a standalone Files SDK adapter. `packages/spec` contains the upstream API specification and generated types.

Run commands from the repository root. You do not need the maintainer's remote-cache credentials to contribute. Without them, Turbo uses the local cache.

## Run locally

`pnpm dev` starts the workspace development tasks. For the built Cloudflare Worker, run `pnpm build` followed by `pnpm preview`.

For the documentation site alone, run `pnpm --filter @turborepo-remote-cache/docs dev`. Before changing the site, read the relevant Blume documentation in `apps/docs/node_modules/blume/docs`.

## Check a change

Run `pnpm check` for every change. It runs lint, typechecking, tests, and builds. Use `pnpm lint:fix` to fix formatting and supported lint findings.

If a change affects the deployed server, also run `pnpm test:e2e`. This builds a Worker, starts Wrangler locally on port 8787, and tests the HTTP contract and real Turbo clients. It does not deploy to Cloudflare.

After changing `wrangler.jsonc` or the API specification, run `pnpm codegen` and include the generated files. Check them with `pnpm codegen:check`. Keep the upstream specification unmodified; put documentation corrections in `apps/docs/openapi-overlay.yaml`.

Add or update focused tests for changed behavior. Update the matching page in `apps/docs/content` when behavior or configuration changes. When moving a public page, preserve its URL or add a redirect in `apps/docs/blume.config.ts`.

## Open a pull request

Use a branch such as `fix/cache-expiry` or `docs/client-setup`. Keep the change focused and sign your commits. The pull request should explain the problem, the resulting behavior, and how you verified it.

Repository-specific engineering constraints are recorded in [AGENTS.md](../AGENTS.md). Contributors follow the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately through the [security policy](SECURITY.md).
