---
layout: doc
---

# ☁️ Storing artifacts in Amazon S3

[Amazon S3](https://aws.amazon.com/s3/) is a durable, scalable object store. You can use S3 as the backend for this remote cache using SigV4 requests signed via `aws4fetch`.

Follow these steps to store your build artifacts in S3:

## 1) Prepare an S3 bucket and IAM credentials

- Create or choose an S3 bucket
- Create an IAM user or role with permissions limited to the bucket (s3:PutObject, s3:GetObject, s3:DeleteObject, s3:ListBucket)
- Note the following values:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION`
  - `S3_BUCKET`

Optionally set `S3_ENDPOINT` if using an S3-compatible store (or for local testing).

## 2) Configure the Worker environment

Add the following `vars` to your `wrangler.jsonc` or set them as Worker secrets/vars:

```jsonc{8-14}
{
  "vars": {
    "ENVIRONMENT": "production",
    "BUCKET_OBJECT_EXPIRATION_HOURS": 720,
    "AWS_ACCESS_KEY_ID": "...",
    "AWS_SECRET_ACCESS_KEY": "...",
    "AWS_REGION": "us-east-1",
    "S3_BUCKET": "your-bucket-name"
    // "S3_ENDPOINT": "https://s3.compat.example.com" // optional
  }
}
```

To use S3, ensure both `r2_buckets` and `kv_namespaces` are not configured at the same time. The storage selection order is: KV first, then R2, then S3.

## 3) Deploy your Worker

Deploy as usual via the CLI or CI. The server will begin storing artifacts in the configured S3 bucket.

### Metadata behavior

Custom metadata is stored using S3 object metadata headers (`x-amz-meta-*`). The API responds with the `x-artifact-tag` header if it was stored for the artifact.

