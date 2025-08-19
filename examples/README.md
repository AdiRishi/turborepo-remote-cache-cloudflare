# Configuration Examples

This directory contains example configuration files for different storage backends.

## Available Examples

- **`s3-config.jsonc`** - Configuration for Amazon S3 storage
- **`r2-config.jsonc`** - Configuration for Cloudflare R2 storage (if you have one)
- **`kv-config.jsonc`** - Configuration for Cloudflare KV storage (if you have one)

## Usage

1. Copy the appropriate configuration file to your project root
2. Rename it to `wrangler.jsonc`
3. Update the values to match your setup
4. Set the required secrets using `wrangler secret put`

## Setting Secrets

For S3 storage, you'll need to set these secrets:

```bash
echo "your-access-key-id" | wrangler secret put S3_ACCESS_KEY_ID
echo "your-secret-access-key" | wrangler secret put S3_SECRET_ACCESS_KEY
```

For all storage types, you'll also need:

```bash
echo "your-turbo-token" | wrangler secret put TURBO_TOKEN
```
