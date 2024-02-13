---
layout: doc
---

# 🔑 Storing artifacts in Cloudflare KV

[Cloudflare KV](https://developers.cloudflare.com/kv/) offers a distributed, high-performance data store ideal for storing build artifacts globally, providing quicker access and improved build efficiency over centralized storage like Cloudflare R2.

Follow these steps to store your build artifacts in Cloudflare KV:

## 1. Create a KV Namespace

A namespace is a container for key-value pairs in Cloudflare KV. You can create a namespace via the [Cloudflare dashboard](https://dash.cloudflare.com/) or using the [Wrangler CLI](https://developers.cloudflare.com/workers/cli-wrangler/commands/#kvnamespace).

### Using the Wrangler CLI

```sh
wrangler kv:namespace create <YOUR_NAMESPACE>
```

This will create a KV namespace and give you the following output

```sh
wrangler kv:namespace create <YOUR_NAMESPACE>
🌀  Creating namespace with title <YOUR_WORKER-YOUR_NAMESPACE>
✨  Success!
Add the following to your configuration file:
kv_namespaces = [
  { binding = <YOUR_BINDING>, id = "e29b263ab50e42ce9b637fa8370175e8" }
]
```

### Using the Cloudflare Dashboard

1. Navigate to the [Cloudflare dashboard](https://dash.cloudflare.com/) and select the `KV` tab on the left-hand side bar.
2. Click the `Create a namespace` button.
   ![KV Create Dashboard](https://public-assets.turborepo-remote-cache.dev/cdn-cgi/image/width=960,quality=80,format=auto/images/kv-create-dashboard.jpg)
3. Enter a name for your namespace and click `Create`.

## 2. Update Your Configuration

Update your `wrangler.toml` file to include the KV namespace details.

```toml{11,12}
name = "turborepo-remote-cache"
# Other settings...

# [[r2_buckets]]
# binding = 'R2_STORE'
# bucket_name = 'turborepo-cache'
# preview_bucket_name = 'turborepo-cache-preview'

[[kv_namespaces]] // [!code focus]
binding = "KV_STORE" // [!code focus]
id = "ea20b0eb60f44b13b8d013eeace98ca2" // [!code focus]
preview_id = "ea20b0eb60f44b13b8d013eeace98ca2" // [!code focus]
```

::: info
If you want to use KV as the store, ensure that the `r2_buckets` section is commented out.
:::

## 3. Deploy Your Worker

Once you've updated your Worker script and `wrangler.toml` file, deploy your Worker using the Wrangler CLI or your GitHub actions workflow.
And that's it! Your build artifacts will now be stored in Cloudflare KV.
