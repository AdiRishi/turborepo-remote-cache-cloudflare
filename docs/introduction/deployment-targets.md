---
layout: doc
---

# Deployment targets

The application keeps Hono as its HTTP layer and uses Nitro for development, builds, scheduled tasks, and deployment presets. The same API and storage configuration therefore work across supported Nitro targets.

## Cloudflare Workers

Cloudflare Workers is the default and takes priority if a portable behavior conflicts with the Cloudflare experience.

```sh
cp .dev.vars.example .dev.vars
# Replace the example TURBO_TOKEN before starting the server.
pnpm dev
pnpm build
pnpm preview
pnpm deploy
```

- `pnpm build` uses Nitro's Cloudflare preset by default.
- `pnpm deploy` builds the application and deploys the default Cloudflare target.
- `pnpm preview` previews the generated application.
- The scheduled `cache:delete-expired` Nitro task maps to the configured Cloudflare Cron Trigger.

Cloudflare deployments can use all three first-class providers. R2 and KV use native bindings; S3 uses environment credentials.

## Node

The repository includes a convenience build for Nitro's Node server preset:

```sh
pnpm build:node
```

Choose R2 credential mode, S3, or a custom adapter for a Node deployment. KV is not available because its adapter depends on a Cloudflare `KV_STORE` binding.

The process manager, container, network exposure, and task schedule are operational choices for the host. Follow Nitro's generated output and deployment documentation instead of assuming Cloudflare's Wrangler workflow applies.

## Other Nitro presets

Select another [Nitro deployment preset](https://nitro.build/deploy) at build time:

```sh
NITRO_PRESET=<preset> pnpm build
```

The selected platform's Nitro documentation is the source of truth for the deployment command, generated output, environment variables, and task support. This project does not maintain a second set of bespoke scripts for every host.

Before moving away from Cloudflare, verify:

1. The selected storage provider is reachable from the target runtime.
2. Its credentials are available as runtime environment variables.
3. The target supports the selected Files SDK adapter's runtime dependencies.
4. The target runs the `cache:delete-expired` Nitro task on the intended schedule.

## Storage portability

Changing the deployment target does not require changing the Turborepo API. It can require changing storage access:

| Storage | Cloudflare Workers            | Other targets                                                                              |
| ------- | ----------------------------- | ------------------------------------------------------------------------------------------ |
| R2      | Prefer the `R2_STORE` binding | Use the R2 S3-compatible credentials documented in [R2 storage](/configuration/r2-storage) |
| KV      | `KV_STORE` binding            | Not supported                                                                              |
| S3      | Environment credentials       | Environment credentials                                                                    |
| Custom  | Adapter-dependent             | Adapter-dependent                                                                          |

Keep `STORAGE_PREFIX` unchanged when moving a deployment that must continue reading existing artifacts.
