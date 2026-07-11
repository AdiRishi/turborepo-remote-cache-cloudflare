---
layout: doc
---

# Project configuration

Runtime configuration selects storage and controls cache behavior. Keep credentials in your host's secret store rather than committing them to `wrangler.jsonc` or another configuration file.

## Core settings

| Setting                          | Required | Default                 | Purpose                                                          |
| -------------------------------- | -------- | ----------------------- | ---------------------------------------------------------------- |
| `TURBO_TOKEN`                    | Yes      | —                       | Bearer token accepted by artifact and internal API routes        |
| `STORAGE_PROVIDER`               | Usually  | Provider auto-detection | Selects `r2`, `kv`, `s3`, or `custom`                            |
| `CACHE_RETENTION_HOURS`          | No       | `720`                   | Number of hours an artifact remains eligible for retention       |
| `BUCKET_OBJECT_EXPIRATION_HOURS` | No       | —                       | Legacy fallback used only when `CACHE_RETENTION_HOURS` is absent |
| `STORAGE_PREFIX`                 | No       | Empty                   | Prefix prepended to artifact object keys                         |

Use a non-negative number for the retention period. Setting it to `0` disables the cleanup task and KV's native TTL. If both retention variables are present, `CACHE_RETENTION_HOURS` takes precedence.

::: warning Existing data and prefixes
Leave `STORAGE_PREFIX` unset when upgrading an existing deployment. Adding or changing a prefix points the server at a different key space; it does not move old artifacts.
:::

## Provider selection

The three first-class providers can be selected without a source change:

```dotenv
STORAGE_PROVIDER=r2
```

Valid values are:

- `r2` for [Cloudflare R2](/configuration/r2-storage)
- `kv` for [Cloudflare KV](/configuration/kv-storage)
- `s3` for [Amazon S3](/configuration/s3-storage)
- `custom` for the adapter exported by [`storage.config.ts`](/configuration/custom-storage)

### Provider auto-detection

`STORAGE_PROVIDER` may be omitted when the configuration identifies one provider. The server checks in this order:

1. `KV_STORE`
2. `R2_STORE`
3. `S3_BUCKET`
4. `R2_BUCKET`

The first two entries preserve the previous behavior when both legacy bindings exist. Set `STORAGE_PROVIDER=r2` to choose R2 without removing a `KV_STORE` binding. New deployments should select a provider explicitly unless they use the repository's unchanged default R2 configuration.

## Provider settings

### R2

On Cloudflare Workers, prefer the native `R2_STORE` binding. Credential-based R2 access uses:

- `R2_BUCKET`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

### KV

KV requires the native Cloudflare `KV_STORE` binding. It cannot be selected on another deployment target.

### S3

S3 always uses `S3_BUCKET`. It also accepts:

- `AWS_REGION`, required unless the target's AWS configuration supplies it
- `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`, configured together for static credentials
- `AWS_SESSION_TOKEN`, when temporary credentials require it
- `S3_ENDPOINT`, for an S3-compatible endpoint
- `S3_FORCE_PATH_STYLE`, when that endpoint requires path-style bucket URLs

Read the provider page before configuring its credentials and bindings.

## Cloudflare variables and secrets

Non-sensitive values can live in `wrangler.jsonc`:

```jsonc
{
    "vars": {
        "STORAGE_PROVIDER": "r2",
        "CACHE_RETENTION_HOURS": 720,
        "STORAGE_PREFIX": "",
    },
}
```

Store sensitive values with Wrangler:

```sh
echo "YOUR_SECRET" | pnpm wrangler secret put TURBO_TOKEN
```

For local development, copy `.dev.vars.example` to the ignored `.dev.vars` file and replace its placeholder token. Wrangler loads that file only into the local runtime.

Use the same command for access keys when the selected provider needs them. Do not define a value in both `vars` and Wrangler secrets.

## Retention and Nitro Tasks

Expired-object cleanup is implemented as the Nitro task `cache:delete-expired`. The default Cloudflare build exposes it to the configured Cron Trigger, keeping retention work outside artifact requests. A retention value of `0` makes the task a no-op.

KV also applies a non-zero retention period as a native per-key TTL. R2, S3, and compatible custom providers are cleaned by the task.

The task skips listed objects that do not include `lastModified` metadata and logs the skipped count. A custom adapter must return that field for task-based retention to cover its objects.

When using another Nitro preset, configure that platform to schedule the same Nitro task and confirm the preset's current task support. Avoid running multiple schedules against the same provider unless duplicate cleanup runs are intentional.

## Build-time deployment selection

`NITRO_PRESET` selects a deployment target at build time; it does not select a storage provider:

```sh
NITRO_PRESET=<preset> pnpm build
```

See [Deployment targets](/introduction/deployment-targets) for the Cloudflare default and portability constraints.
