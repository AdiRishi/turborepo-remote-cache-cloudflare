---
layout: doc
---

# 🪣 Storing artifacts in Cloudflare R2

[Cloudflare R2](https://developers.cloudflare.com/r2/) offers scalable, low-cost object storage ideal for storing build artifacts globally. With R2, you can leverage Cloudflare's global network for quick access and efficient management of your build artifacts.

Follow these steps to store your build artifacts in Cloudflare R2:

## 1. Create an R2 Bucket

An R2 bucket is a container for objects in Cloudflare R2. You can create a bucket via the [Cloudflare dashboard](https://dash.cloudflare.com/) or using the [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update)

### Using the Wrangler CLI

```sh
wrangler r2 bucket create YOUR_BUCKET_NAME
```

::: tip
Using the Wrangler CLI to create a bucket will result in the bucket being **created** in a **region closest to you**.

It is worth considering the region in which you create your bucket, as workers spun up father away from the bucket's region will experience higher latency.

**In order to create a bucket in a specific region, you will have to use the Cloudflare dashboard.**
:::

::: tip
If you have true multi-region requirements, consider using Cloudflare KV as the store. Read the [next page](/configuration/kv-storage) to find out how.
:::

### Using the Cloudflare Dashboard

1. Navigate to the [cloudflare dashboard](https://dash.cloudflare.com/) and select the `R2` tab on the left-hand side bar.
2. Click the `Create Bucket` button.
3. Enter a name for your bucket and select the region in which you would like to create the bucket.
   ![R2 Create Dashboard](https://public-assets.turborepo-remote-cache.dev/cdn-cgi/image/width=960,quality=80,format=auto/images/r2-create-bucket-dashboard.jpg)
4. Click `Create Bucket`.

::: tip
Try picking a region closest to where the bulk of your API requests will be coming from. E.g if you want to optimize for requests coming from Github actions in the US, pick a US region.

You can find the list of regions and their codes [here](https://developers.cloudflare.com/r2/reference/data-location/#available-hints).
:::

## 2. Update Your Configuration

Update your `wrangler.toml` file to include the R2 bucket details.

```toml{6,8}
name = "turborepo-remote-cache"
# Other settings...

[[r2_buckets]] // [!code focus]
binding = 'R2_STORE' // [!code focus]
bucket_name = 'your-bucket-name' // [!code focus]
# Preview bucket can be the same as the main bucket // [!code focus]
preview_bucket_name = 'your-preview-bucket-name' // [!code focus]

# [[kv_namespaces]]
# binding = "KV_STORE"
# id = "ea20b0eb60f44b13b8d013eeace98ca2"
# preview_id = "ea20b0eb60f44b13b8d013eeace98ca2"
```

::: info
If you want to use R2 as the store, ensure that the `kv_namespaces` section is commented out.
:::

## 3. Deploy Your Worker

Once you've updated your Worker script and `wrangler.toml` file, deploy your Worker using the Wrangler CLI or your GitHub actions workflow.
And that's it! Your build artifacts will now be stored in Cloudflare R2.
