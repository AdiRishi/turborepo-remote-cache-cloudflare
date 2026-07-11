---
'turborepo-remote-cache-cf': major
---

Rebuild the cache around Files SDK and Nitro with first-class R2, KV, and S3 storage and portable deployment targets.

Align `/v8/artifacts` with Turborepo's published Remote Cache API contract, including batch queries, artifact metadata, request validation, and structured errors. Uploads now require `Content-Length`, and artifact hashes must use the contract's hexadecimal format.
