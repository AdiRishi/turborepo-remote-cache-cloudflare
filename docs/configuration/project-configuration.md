---
layout: doc
---

# ⚙️ Project Configuration

## Storage Options

This project supports multiple storage backends for your build artifacts:

- **🪣 [R2 Storage](/configuration/r2-storage)**: Cloudflare's object storage with zero egress fees
- **🔑 [KV Storage](/configuration/kv-storage)**: Cloudflare's key-value storage with global distribution
- **☁️ [S3 Storage](/configuration/s3-storage)**: Amazon S3 for maximum compatibility and flexibility

The storage priority order is: S3 > KV > R2. When multiple storage options are configured, the highest priority one will be used.

## Automatic deletion of old cache files

This project sets up a [cron trigger](https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/) for Cloudflare workers, which automatically deletes old cache files within the configured storage backend. This behavior can be customized:

- To disable the automatic deletion, remove the [triggers] configuration in [wrangler.jsonc](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/blob/master/wrangler.jsonc)
- To change the retention period for objects, adjust the `BUCKET_OBJECT_EXPIRATION_HOURS` option in [wrangler.jsonc](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/blob/master/wrangler.jsonc) or set it via [workers environment variables](https://developers.cloudflare.com/workers/platform/environment-variables/)
