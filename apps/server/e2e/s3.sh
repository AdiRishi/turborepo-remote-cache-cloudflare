#!/usr/bin/env sh
# Starts a throwaway S3-compatible store (RustFS) on localhost:9000 with an empty `turborepo-cache` bucket.
# Usage: sh e2e/s3.sh   (access key e2e-access-key, secret key e2e-secret-key)
set -eu

docker rm --force turborepo-cache-s3 > /dev/null 2>&1 || true
docker run --detach --name turborepo-cache-s3 --publish 9000:9000 \
  --env RUSTFS_ACCESS_KEY=e2e-access-key --env RUSTFS_SECRET_KEY=e2e-secret-key \
  rustfs/rustfs:1.0.3 > /dev/null

until curl --silent --output /dev/null http://localhost:9000; do sleep 1; done
curl --silent --show-error --fail --request PUT \
  --aws-sigv4 'aws:amz:us-east-1:s3' --user e2e-access-key:e2e-secret-key \
  http://localhost:9000/turborepo-cache
