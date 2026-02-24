---
layout: doc
---

# 🪣 Storing artifacts in Amazon S3

You can store artifacts in Amazon S3 (or any S3-compatible provider) using the `s3mini` backend.

## 1. Create an S3 Bucket

Create a bucket in AWS (or your S3-compatible provider), then create credentials with read/write access to that bucket.

### Minimum IAM permissions

The access key should be limited to these S3 actions on your cache bucket:

- `s3:ListBucket`
- `s3:GetObject`
- `s3:PutObject`
- `s3:DeleteObject`

## 2. Add Worker Configuration

Update your `wrangler.jsonc` file with S3 settings:

```jsonc{7-11}
{
  "name": "turborepo-remote-cache",
  // Other settings...
  "vars": {
    "ENVIRONMENT": "production",
    "STORAGE_BACKEND": "s3",
    "S3_ENDPOINT": "https://my-turbo-cache.s3.amazonaws.com",
    "S3_REGION": "us-east-1",
    "BUCKET_OBJECT_EXPIRATION_HOURS": 720
  }
}
```

::: info
Set credentials as Wrangler secrets (not plain vars):

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
  :::

```sh
echo "YOUR_ACCESS_KEY_ID" | wrangler secret put AWS_ACCESS_KEY_ID
echo "YOUR_SECRET_ACCESS_KEY" | wrangler secret put AWS_SECRET_ACCESS_KEY
```

## 3. Endpoint Format

`S3_ENDPOINT` must include the bucket:

- AWS (virtual-host style): `https://my-bucket.s3.amazonaws.com`
- AWS (regional virtual-host style): `https://my-bucket.s3.us-east-1.amazonaws.com`
- Path-style compatible providers: `https://s3.us-east-1.amazonaws.com/my-bucket`

## 4. Deploy Your Worker

Deploy with Wrangler or your CI pipeline after updating config and secrets.
