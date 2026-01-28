---
layout: doc
---

# S3-Compatible Storage

This project supports any S3-compatible storage service as a backend for storing build artifacts. This includes:

- Amazon S3
- MinIO
- DigitalOcean Spaces
- Backblaze B2
- Wasabi
- And other S3-compatible services

::: tip
S3 storage is an alternative to Cloudflare R2 and KV storage. If you're already using Cloudflare, consider using [R2 Storage](/configuration/r2-storage) or [KV Storage](/configuration/kv-storage) for better integration and lower latency.
:::

## Storage Priority

When multiple storage backends are configured, the following priority order is used:

1. **KV Storage** (highest priority - multi-region)
2. **R2 Storage** (native Cloudflare integration)
3. **S3 Storage** (external alternative)

To use S3 as your primary storage, ensure KV and R2 bindings are not configured in your `wrangler.jsonc`.

## Configuration

### 1. Create an S3 Bucket

Create a bucket in your S3-compatible storage service. The exact steps vary by provider:

**Amazon S3:**

```sh
aws s3 mb s3://your-turborepo-cache-bucket
```

**MinIO:**

```sh
mc mb myminio/your-turborepo-cache-bucket
```

### 2. Get Access Credentials

You'll need:

- **Access Key ID**: Your S3 access key
- **Secret Access Key**: Your S3 secret key
- **Endpoint URL**: The S3 API endpoint (including bucket name)
- **Region**: The region where your bucket is located (optional, defaults to "auto")

### 3. Configure Environment Variables

Add the following secrets to your Cloudflare Worker using Wrangler:

```sh
# Required: Set your S3 credentials as secrets
wrangler secret put S3_ACCESS_KEY_ID
wrangler secret put S3_SECRET_ACCESS_KEY
```

Then add the following variables to your `wrangler.jsonc`:

```jsonc
{
    "name": "turborepo-remote-cache",
    // Other settings...

    "vars": {
        "ENVIRONMENT": "production",
        "TURBO_TOKEN": "your-turbo-token",
        "BUCKET_OBJECT_EXPIRATION_HOURS": 720,
        "S3_ENDPOINT": "https://s3.us-east-1.amazonaws.com/your-bucket-name",
        "S3_REGION": "us-east-1",
    },

    // Ensure R2 and KV are NOT configured if you want to use S3
    // "r2_buckets": [],
    // "kv_namespaces": []
}
```

::: info
The bucket name should be included in the `S3_ENDPOINT` URL path. For example: `https://s3.us-east-1.amazonaws.com/your-bucket-name`
:::

::: warning
Never commit your `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` to version control. Always use `wrangler secret put` to securely store these values.
:::

## Endpoint Format Examples

The `S3_ENDPOINT` should be the full URL to your S3-compatible API endpoint, including the bucket name in the path.

### Amazon S3

```
https://s3.{region}.amazonaws.com/{bucket-name}
```

Example: `https://s3.us-east-1.amazonaws.com/my-turborepo-cache`

### MinIO

```
https://{minio-host}:{port}/{bucket-name}
```

Example: `https://minio.example.com:9000/my-turborepo-cache`

### DigitalOcean Spaces

```
https://{space-name}.{region}.digitaloceanspaces.com
```

Example: `https://my-turborepo-cache.nyc3.digitaloceanspaces.com`

### Backblaze B2

```
https://s3.{region}.backblazeb2.com/{bucket-name}
```

Example: `https://s3.us-west-004.backblazeb2.com/my-turborepo-cache`

### Cloudflare R2 (via S3 API)

```
https://{account-id}.r2.cloudflarestorage.com/{bucket-name}
```

::: tip
For Cloudflare R2, we recommend using the native R2 binding instead of the S3 API for better performance. See [R2 Storage](/configuration/r2-storage).
:::

## Environment Variables Reference

| Variable               | Required | Description                                              |
| ---------------------- | -------- | -------------------------------------------------------- |
| `S3_ACCESS_KEY_ID`     | Yes      | S3 access key ID (store as secret)                       |
| `S3_SECRET_ACCESS_KEY` | Yes      | S3 secret access key (store as secret)                   |
| `S3_ENDPOINT`          | Yes      | Full S3 API endpoint URL (including bucket name in path) |
| `S3_REGION`            | No       | S3 region (defaults to "auto")                           |

## Deploy Your Worker

Once configured, deploy your Worker:

```sh
wrangler deploy
```

Your build artifacts will now be stored in your S3-compatible storage service.

## Troubleshooting

### Access Denied Errors

Ensure your S3 credentials have the following permissions on your bucket:

- `s3:GetObject`
- `s3:PutObject`
- `s3:DeleteObject`
- `s3:ListBucket`

### Connection Timeouts

If you experience timeouts, ensure:

1. Your S3 endpoint is accessible from Cloudflare Workers
2. The endpoint URL is correct and includes the bucket name
3. Your bucket exists and is in the correct region

### CORS Issues

If testing locally, you may need to configure CORS on your S3 bucket to allow requests from your development environment.
