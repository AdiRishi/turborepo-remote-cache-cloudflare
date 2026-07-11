---
layout: doc
---

# Cloudflare R2 storage

[Cloudflare R2](https://developers.cloudflare.com/r2/) is the default provider. Cloudflare Workers can access it through a native binding, while other Nitro targets can use R2's S3-compatible API credentials.

R2 persists artifact metadata and supports signed Turborepo caching.

## Native binding on Cloudflare Workers

### 1. Create a bucket

The included Wrangler configuration expects a bucket named `turborepo-cache`:

```sh
pnpm wrangler r2 bucket create turborepo-cache
```

You can also create the bucket in the [Cloudflare dashboard](https://dash.cloudflare.com/) and choose a location hint appropriate for most cache clients.

### 2. Bind it as `R2_STORE`

Keep or add the native binding in `wrangler.jsonc`:

```jsonc
{
    "vars": {
        "STORAGE_PROVIDER": "r2",
    },
    "r2_buckets": [
        {
            "binding": "R2_STORE",
            "bucket_name": "turborepo-cache",
            "preview_bucket_name": "turborepo-cache-preview",
        },
    ],
}
```

`STORAGE_PROVIDER=r2` is explicit but optional when `R2_STORE` is the only legacy storage binding. If `KV_STORE` is also present and no provider is selected, compatibility auto-detection chooses KV.

You do not need to comment out an unused KV binding. Provider selection decides which storage is active.

### 3. Deploy

```sh
pnpm deploy
```

The native binding does not require an R2 API access key.

Native-binding uploads must include `Content-Length`; Turborepo sends this header for cache artifacts. A chunked client without a known length receives the API's structured `400 bad_request` response because buffering an unbounded R2 artifact inside a Worker is unsafe.

## Credential mode

Use credential mode when R2 is selected outside Cloudflare Workers or when a deployment cannot expose an `R2_STORE` binding:

```dotenv
STORAGE_PROVIDER=r2
R2_BUCKET=turborepo-cache
R2_ACCOUNT_ID=YOUR_CLOUDFLARE_ACCOUNT_ID
R2_ACCESS_KEY_ID=YOUR_R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY=YOUR_R2_SECRET_ACCESS_KEY
```

Create an R2 API token with access to the chosen bucket. Treat both credential values as secrets. On Cloudflare, add them using Wrangler rather than committing them:

```sh
echo "YOUR_R2_ACCESS_KEY_ID" | pnpm wrangler secret put R2_ACCESS_KEY_ID
echo "YOUR_R2_SECRET_ACCESS_KEY" | pnpm wrangler secret put R2_SECRET_ACCESS_KEY
```

`R2_BUCKET` and `R2_ACCOUNT_ID` may be ordinary runtime variables. The adapter derives the R2 endpoint from the account ID.

## Retention and existing artifacts

The `cache:delete-expired` Nitro task removes R2 objects older than `CACHE_RETENTION_HOURS`. Set the value to `0` to make cleanup a no-op. `BUCKET_OBJECT_EXPIRATION_HOURS` remains a compatibility fallback.

Existing objects remain reachable after upgrading as long as the same bucket and object keys are used. Leave `STORAGE_PREFIX` unset to preserve legacy keys. Changing to credential mode does not itself migrate objects; its credentials must point at the same bucket if the existing cache should remain warm.
