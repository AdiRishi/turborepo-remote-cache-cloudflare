---
layout: doc
---

# Remote Cache API contract

Turborepo's published [Remote Cache API specification](https://turborepo.dev/api/remote-cache-spec) is the compatibility authority for the public cache routes. Turborepo also provides [interactive API documentation](https://turborepo.dev/docs/openapi). The project keeps a canonical snapshot at `openapi/turborepo-remote-cache.json` so installs, builds, and tests remain reproducible and do not depend on the Turborepo website being available.

The snapshot describes paths below `/artifacts`. This project mounts those operations below the Turborepo API version prefix, `/v8`, and keeps Hono responsible for HTTP routing and streaming request and response bodies.

## Generated contract types

`src/protocol/remote-cache/generated.ts` contains TypeScript types and a small operation-to-route manifest generated from the checked-in snapshot. The manifest keeps each Hono route's method and path tied to the published operation. Do not edit either generated output or the upstream snapshot by hand.

Generation is deliberately separate from normal development commands:

```sh
pnpm api:generate
pnpm api:check
```

`api:generate` reads only the local snapshot. Binary OpenAPI bodies are represented as `ReadableStream<Uint8Array>` so artifact uploads and downloads stay streaming. `api:check` is read-only and network-free; it fails when the snapshot is not canonical or the generated types are stale.

## Sync with Turborepo

Updating the snapshot is the only API-contract workflow that accesses the network:

```sh
pnpm api:sync
git diff -- openapi/turborepo-remote-cache.json
pnpm api:generate
pnpm api:check
pnpm vitest run tests/routes/v8/artifacts.test.ts
pnpm test:turbo
```

Always review the snapshot diff before regenerating. In particular, check for changed operation IDs, paths, required headers, status codes, response headers, and request or response schemas. A sync should be committed with its regenerated TypeScript and any route, validation, test, or documentation changes required by the new contract.

The focused route test covers all six published operations, bearer authentication, structured errors, raw artifact streaming, metadata headers, and Hono's HEAD behavior. `test:turbo` then runs the pinned Turbo CLI twice against Nitro's local Cloudflare target and proves that a signed artifact is restored from remote storage without executing the task again. CI and ordinary builds use the pinned snapshot; they never silently adopt a new upstream contract.
