---
layout: doc
---

# Cloudflare KV storage

[Cloudflare KV](https://developers.cloudflare.com/kv/) provides globally distributed key-value storage through a native Worker binding. This project retains KV through its own Files SDK adapter.

KV is a first-class provider, but it is Cloudflare-only and each artifact is limited to 25 MiB. Choose R2 or S3 when cache artifacts can exceed that limit.

## 1. Create a namespace

Create a namespace in the [Cloudflare dashboard](https://dash.cloudflare.com/) or with Wrangler:

```sh
pnpm wrangler kv namespace create turborepo-cache --binding KV_STORE --update-config
```

If you update `wrangler.jsonc` manually, copy the namespace ID returned by Wrangler.

## 2. Bind it as `KV_STORE`

Select KV and add its namespace binding:

```jsonc
{
    "vars": {
        "STORAGE_PROVIDER": "kv",
    },
    "kv_namespaces": [
        {
            "binding": "KV_STORE",
            "id": "YOUR_NAMESPACE_ID",
            "preview_id": "YOUR_PREVIEW_NAMESPACE_ID",
        },
    ],
}
```

An existing deployment may omit `STORAGE_PROVIDER`: `KV_STORE` is detected before `R2_STORE` for compatibility. Explicit selection is clearer and lets both bindings remain configured.

For a fresh KV-only deployment, remove the default `r2_buckets` block after adding `KV_STORE`. This avoids requiring an unused R2 bucket; existing deployments may safely leave both bindings in place.

## 3. Deploy

```sh
pnpm deploy
```

The adapter stores artifact tags with each value, so signed Turborepo caching works without sidecar keys.

## Artifact size and buffering

Cloudflare KV limits a value to 25 MiB. The adapter rejects an artifact that exceeds that boundary.

Files SDK needs an accurate size when it stores a value. The KV adapter therefore buffers streamed artifact uploads while enforcing the same 25 MiB bound. Already-sized in-memory bodies can be written directly. R2 and S3 uploads remain streamed and do not have this KV-specific buffering behavior.

## Retention

KV applies a non-zero `CACHE_RETENTION_HOURS` value as native per-key expiration. Set it to `0` to disable both KV TTL and application cleanup. The legacy `BUCKET_OBJECT_EXPIRATION_HOURS` setting remains a fallback.

Existing KV values remain reachable after upgrading when the same namespace is bound and `STORAGE_PREFIX` remains unset.

## Runtime limitation

The custom KV adapter requires the Cloudflare `KVNamespace` binding API. A Node or other Nitro deployment cannot use credential-based KV access. Use [R2 credential mode](/configuration/r2-storage#credential-mode), [S3](/configuration/s3-storage), or a [custom adapter](/configuration/custom-storage) instead.
