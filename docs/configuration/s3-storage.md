---
layout: doc
---

# ☁️ Storing artifacts in Amazon S3

[Amazon S3](https://aws.amazon.com/s3/) provides scalable, reliable object storage that can be used to store your build artifacts. With S3, you can leverage AWS's global infrastructure for storing and retrieving your build cache.

Follow these steps to store your build artifacts in Amazon S3:

## 1. Create an S3 Bucket

An S3 bucket is a container for objects in Amazon S3. You can create a bucket via the [AWS Management Console](https://console.aws.amazon.com/) or using the [AWS CLI](https://aws.amazon.com/cli/).

### Using the AWS CLI

```sh
aws s3 mb s3://your-bucket-name --region your-region
```

### Using the AWS Management Console

1. Navigate to the [AWS S3 console](https://console.aws.amazon.com/s3/)
2. Click the `Create bucket` button
3. Enter a name for your bucket and select the region
4. Configure bucket settings as needed
5. Click `Create bucket`

::: tip
Choose a region closest to where the bulk of your API requests will be coming from. For example, if you want to optimize for requests coming from GitHub Actions in the US, pick a US region.

You can find the list of available regions [here](https://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region).
:::

## 2. Create IAM User and Access Keys

You'll need AWS access credentials to authenticate with S3. Follow these steps to create an IAM user with S3 permissions:

### Using the AWS Management Console

1. Navigate to the [IAM console](https://console.aws.amazon.com/iam/)
2. Click `Users` in the left sidebar
3. Click `Create user`
4. Enter a username and select `Programmatic access`
5. Click `Next: Permissions`
6. Click `Attach existing policies directly`
7. Search for and select `AmazonS3FullAccess` (or create a custom policy with minimal S3 permissions)
8. Complete the user creation process
9. Save the Access Key ID and Secret Access Key

### Minimal S3 Policy

If you prefer to create a custom policy with minimal permissions, use this policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
            "Resource": ["arn:aws:s3:::your-bucket-name", "arn:aws:s3:::your-bucket-name/*"]
        }
    ]
}
```

## 3. Update Your Configuration

Update your `wrangler.jsonc` file to include the S3 configuration. Since S3 credentials are sensitive, they should be set as secrets:

```jsonc{5-15}
{
  "name": "turborepo-remote-cache",
  // Other settings...

  "vars": {
    "ENVIRONMENT": "production",
    "BUCKET_OBJECT_EXPIRATION_HOURS": 720,
    "S3_BUCKET_NAME": "your-bucket-name",
    "S3_REGION": "us-east-1"
  },

  // Comment out R2 and KV configurations when using S3
  // "r2_buckets": [...],
  // "kv_namespaces": [...]
}
```

Set the sensitive S3 credentials as secrets:

```sh
echo "your-access-key-id" | wrangler secret put S3_ACCESS_KEY_ID
echo "your-secret-access-key" | wrangler secret put S3_SECRET_ACCESS_KEY
```

## 4. Deploy Your Worker

Once you've updated your Worker script and `wrangler.jsonc` file, deploy your Worker using the Wrangler CLI or your GitHub actions workflow.

And that's it! Your build artifacts will now be stored in Amazon S3.

## Configuration Options

| Variable               | Required | Description                  | Default     |
| ---------------------- | -------- | ---------------------------- | ----------- |
| `S3_ACCESS_KEY_ID`     | Yes      | AWS access key ID            | -           |
| `S3_SECRET_ACCESS_KEY` | Yes      | AWS secret access key        | -           |
| `S3_BUCKET_NAME`       | Yes      | S3 bucket name               | -           |
| `S3_REGION`            | No       | AWS region for the S3 bucket | `us-east-1` |

::: info
When S3 storage is configured, it takes priority over R2 and KV storage. The storage priority order is: S3 > KV > R2.
:::
