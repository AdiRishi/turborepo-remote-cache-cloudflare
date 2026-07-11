<div align="center">

# Turborepo Remote Cache

**Cloudflare-first, deploy anywhere.**

[![CI](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/actions/workflows/ci.yml/badge.svg)](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/actions/workflows/ci.yml) [![Coverage Status](https://coveralls.io/repos/github/AdiRishi/turborepo-remote-cache-cloudflare/badge.svg)](https://coveralls.io/github/AdiRishi/turborepo-remote-cache-cloudflare) ![GitHub License](https://img.shields.io/github/license/AdiRishi/turborepo-remote-cache-cloudflare) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](.github/CONTRIBUTING.md)

<a href="https://adirishi.github.io/turborepo-remote-cache-cloudflare" target="_blank">
  <img src="https://img.shields.io/badge/Visit-Developer%20Docs-%230572BE?style=for-the-badge&logo=readthedocs&logoColor=white" alt="Visit Developer Docs">
</a>

</div>

An open-source [Turborepo custom remote cache](https://turborepo.dev/docs/core-concepts/remote-caching) that defaults to Cloudflare Workers while remaining portable through [Nitro](https://nitro.build/). [Files SDK](https://files-sdk.dev/) provides a small, consistent storage layer across Cloudflare R2, Cloudflare KV, Amazon S3, and custom providers.

## Why use it?

- **Simple to self-host:** clone the repository, create a bucket, and deploy with Wrangler.
- **Storage choice without source changes:** select R2, KV, or S3 with `STORAGE_PROVIDER`.
- **Cloudflare-first:** the included configuration and primary deployment workflow target Cloudflare Workers.
- **Portable:** build for Node or another supported Nitro preset when Cloudflare is not the right target.
- **Extensible:** connect another Files SDK adapter through the typed `storage.config.ts` escape hatch.
- **Turborepo-compatible:** bearer authentication, signed artifacts, and the existing `/v8/artifacts` API remain supported.

## Quick start on Cloudflare

The included Wrangler configuration selects R2 and binds it as `R2_STORE`, so the default path needs no provider code or configuration changes.

```sh
# 1. Clone and install
git clone https://github.com/AdiRishi/turborepo-remote-cache-cloudflare.git
cd turborepo-remote-cache-cloudflare
pnpm install

# 2. Create the bucket referenced by wrangler.jsonc
pnpm wrangler r2 bucket create turborepo-cache

# 3. Deploy the Worker
pnpm deploy

# 4. Set the Bearer token used by Turborepo
echo "YOUR_SECRET" | pnpm wrangler secret put TURBO_TOKEN
```

Then point Turborepo at the deployed Worker. The [Turborepo setup guide](https://adirishi.github.io/turborepo-remote-cache-cloudflare/introduction/setup-turborepo) covers signed caching and local environment configuration.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/AdiRishi/turborepo-remote-cache-cloudflare)

## Storage providers

R2, KV, and S3 are first-class providers. Set `STORAGE_PROVIDER` to select a storage mode at runtime:

| Value    | Provider                                | Required configuration                                                                                         |
| -------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `r2`     | Cloudflare R2                           | `R2_STORE` binding on Workers, or `R2_BUCKET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` |
| `kv`     | Cloudflare KV                           | `KV_STORE` binding; Cloudflare Workers only                                                                    |
| `s3`     | Amazon S3 or an S3-compatible service   | `S3_BUCKET`, `AWS_REGION`, and AWS credentials; optionally `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE`             |
| `custom` | Adapter exported by `storage.config.ts` | The adapter package and its provider-specific configuration                                                    |

For compatibility with existing deployments, `STORAGE_PROVIDER` can be omitted. The service checks `KV_STORE`, `R2_STORE`, `S3_BUCKET`, and then `R2_BUCKET`. Set it explicitly for new deployments and whenever more than one provider is configured.

See the provider guides for [R2](https://adirishi.github.io/turborepo-remote-cache-cloudflare/configuration/r2-storage), [KV](https://adirishi.github.io/turborepo-remote-cache-cloudflare/configuration/kv-storage), [S3](https://adirishi.github.io/turborepo-remote-cache-cloudflare/configuration/s3-storage), and [custom Files SDK adapters](https://adirishi.github.io/turborepo-remote-cache-cloudflare/configuration/custom-storage).

> [!NOTE]
> KV has a 25 MiB per-artifact limit and is only available through a Cloudflare binding. Streamed KV uploads are buffered with that limit enforced; R2 and S3 uploads remain streamed.

## Deployment targets

Cloudflare Workers is the default target:

```sh
cp .dev.vars.example .dev.vars
# Replace the example TURBO_TOKEN before starting the server.
pnpm dev
pnpm build
pnpm deploy
```

There is also a Node build shortcut:

```sh
pnpm build:node
```

For another Nitro target, select its documented preset when building:

```sh
NITRO_PRESET=<preset> pnpm build
```

Deployment after that build is provider-specific; follow the [Nitro deployment guide](https://nitro.build/deploy) for the selected preset. The project intentionally keeps those platform commands outside its core workflow.

## Configuration

Common settings are documented in [Project configuration](https://adirishi.github.io/turborepo-remote-cache-cloudflare/configuration/project-configuration). The most important are:

- `TURBO_TOKEN`: required bearer token.
- `STORAGE_PROVIDER`: `r2`, `kv`, `s3`, or `custom`; optional when a provider can be auto-detected.
- `CACHE_RETENTION_HOURS`: artifact retention period. Set it to `0` to disable application cleanup and KV TTL. The legacy `BUCKET_OBJECT_EXPIRATION_HOURS` name remains a fallback.
- `STORAGE_PREFIX`: optional object-key prefix. Leave it unset when upgrading if existing artifact keys must remain reachable.

Cleanup runs through the Nitro task `cache:delete-expired`; the default Cloudflare deployment schedules it with a Cron Trigger.

## GitHub Actions

Forks using the included deployment workflow need these repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `TURBO_TOKEN`

The repository's release and documentation workflows serve the upstream project and can be removed from a fork.

## Upgrading

This architecture is a major release, but existing Turborepo API behavior, bearer authentication, `R2_STORE` and `KV_STORE` bindings, stored object keys, and the legacy retention variable remain compatible wherever practical. Read the [migration guide](https://adirishi.github.io/turborepo-remote-cache-cloudflare/introduction/migration) before upgrading a deployed cache.

---

<div align="center">

Made with ❤️

</div>
