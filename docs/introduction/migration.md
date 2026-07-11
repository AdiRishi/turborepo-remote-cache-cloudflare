---
layout: doc
---

# Migration guide

The Nitro and Files SDK revamp is a major release because it changes the project's build and internal storage architecture. It still preserves the established self-hosting contract wherever practical.

## Preserved behavior

- The Turborepo `/v8/artifacts` HTTP API and bearer authentication continue to work.
- `TURBO_TOKEN` keeps the same purpose.
- Existing `R2_STORE` and `KV_STORE` Cloudflare bindings are recognized.
- Existing artifact object keys remain readable when `STORAGE_PREFIX` is left unset.
- `BUCKET_OBJECT_EXPIRATION_HOURS` remains a fallback for the new `CACHE_RETENTION_HOURS` setting.
- When no provider is selected, legacy binding detection checks `KV_STORE` before `R2_STORE`, preserving the previous preference when both are present.
- Without a binding, provider detection next checks `S3_BUCKET` and then `R2_BUCKET`.

## Recommended upgrade

1. Save the deployed version and current `wrangler.jsonc` so it is easy to compare or roll back configuration.
2. Upgrade the repository and install its dependencies.
3. Keep the existing `R2_STORE` or `KV_STORE` binding unchanged for the first deployment.
4. Leave `STORAGE_PREFIX` unset unless object-key isolation is intentional.
5. Optionally set `STORAGE_PROVIDER` explicitly to `r2` or `kv`. Explicit selection is recommended for new deployments and required when auto-detection cannot identify the intended provider.
6. Rename `BUCKET_OBJECT_EXPIRATION_HOURS` to `CACHE_RETENTION_HOURS` when convenient. Do not set both to different values; the new name takes precedence.
7. Build and test the upgrade against a non-production environment, including `/ping`, one upload, and one cache restore.
8. Deploy with `pnpm deploy` after confirming storage access and retention behavior.

::: warning Selecting a different prefix
`STORAGE_PREFIX` becomes part of every storage key. Changing it makes artifacts under the previous prefix invisible to the new deployment; it does not migrate or delete them.
:::

## Moving from R2 or KV to S3

Selecting `STORAGE_PROVIDER=s3` sends new reads and writes to S3. It does not copy existing artifacts from a Cloudflare binding. Either accept a cold cache or migrate objects separately while preserving their keys and metadata.

Signed artifacts include an artifact tag in object metadata. A storage migration must preserve that metadata, not only object bodies, if signed cache hits must remain valid.

## Retention changes

Cleanup now runs as the Nitro task `cache:delete-expired`. The default Cloudflare deployment schedules that task through a Cron Trigger. KV also applies its retention as a native per-key TTL. Setting `CACHE_RETENTION_HOURS=0` disables both application cleanup and the KV TTL.

For another Nitro target, confirm that the selected preset supports the intended task schedule. Do not run duplicate schedulers against the same storage unless that behavior is deliberate.

## Custom adapters

The internal TypeScript storage APIs are not a compatibility boundary. A project that previously imported them should instead use the typed [custom storage configuration](/configuration/custom-storage) and a Files SDK-compatible adapter.
