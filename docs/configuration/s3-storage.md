---
layout: doc
---

# Amazon S3 storage

Amazon S3 is a first-class provider on Cloudflare Workers, Node, and other compatible Nitro targets. It uses Files SDK's S3 adapter, streams artifact bodies, and persists the metadata required for signed Turborepo caching.

## Configuration

Always provide the bucket. A static configuration suitable for Cloudflare Workers and most serverless targets is:

```dotenv
STORAGE_PROVIDER=s3
S3_BUCKET=YOUR_BUCKET
AWS_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_SECRET_ACCESS_KEY
```

Temporary AWS credentials can also include:

```dotenv
AWS_SESSION_TOKEN=YOUR_SESSION_TOKEN
```

Grant the credentials only the object operations required for the cache bucket. Keep access keys in the deployment target's secret store. `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` must be configured together.

On compatible non-Cloudflare targets, omit static credentials to use the standard AWS credential chain, including an IAM role, shared profile, container credentials, or environment variables. `AWS_REGION` is required unless that target's AWS configuration supplies the region.

For Cloudflare Workers, ordinary variables can be placed in `wrangler.jsonc` and credentials can be added with Wrangler:

```sh
echo "YOUR_ACCESS_KEY_ID" | pnpm wrangler secret put AWS_ACCESS_KEY_ID
echo "YOUR_SECRET_ACCESS_KEY" | pnpm wrangler secret put AWS_SECRET_ACCESS_KEY
```

## S3-compatible services

To use a compatible object store, provide its endpoint:

```dotenv
STORAGE_PROVIDER=s3
S3_BUCKET=YOUR_BUCKET
AWS_REGION=YOUR_REGION
AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_SECRET_ACCESS_KEY
S3_ENDPOINT=https://s3.example.com
S3_FORCE_PATH_STYLE=true
```

Set `S3_FORCE_PATH_STYLE=true` only when the service expects the bucket in the request path instead of the hostname. Compatibility depends on the service implementing the S3 operations and metadata behavior used by Files SDK.

::: tip Cloudflare R2
R2 also exposes an S3-compatible API, but use `STORAGE_PROVIDER=r2` and the dedicated `R2_*` settings for a first-class R2 configuration. That keeps provider validation and endpoint construction straightforward.
:::

## Cloudflare deployment

S3 does not use an R2 or KV binding. After setting the variables and secrets, deploy through the normal Cloudflare workflow:

```sh
pnpm deploy
```

An unused `R2_STORE` or `KV_STORE` binding can remain in `wrangler.jsonc`; explicit `STORAGE_PROVIDER=s3` takes precedence over legacy binding detection. For a fresh S3-only deployment, remove the default `r2_buckets` block so Wrangler does not require an R2 bucket that the service will never use.

## Retention and prefixes

The `cache:delete-expired` Nitro task removes S3 objects older than `CACHE_RETENTION_HOURS`; set the value to `0` to make cleanup a no-op. Use `STORAGE_PREFIX` when several cache deployments intentionally share a bucket, and keep it stable after deployment.

Selecting S3 does not copy artifacts from an existing R2 or KV store. Start with a cold cache or migrate object bodies, keys, and artifact-tag metadata separately.
