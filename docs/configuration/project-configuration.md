---
layout: doc
---

# ⚙️ Project Configuration

## Automatic deletion of old cache files

This project sets up a [cron trigger](https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/) for Cloudflare workers, which automatically deletes old cache files within the bound R2 bucket. This behavior can be customized:

-   To disable the automatic deletion, remove the [triggers] configuration in [wrangler.toml](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/blob/master/wrangler.toml)
-   To change the retention period for objects, adjust the `BUCKET_OBJECT_EXPIRATION_HOURS` option in [wrangler.toml](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/blob/master/wrangler.toml) or set it via [workers environment variables](https://developers.cloudflare.com/workers/platform/environment-variables/)
