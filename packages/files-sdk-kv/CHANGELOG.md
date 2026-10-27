# @turborepo-remote-cache/files-sdk-kv

## 0.1.0

### Minor Changes

- [#1067](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/pull/1067) [`58271d7`](https://github.com/AdiRishi/turborepo-remote-cache-cloudflare/commit/58271d7067af5e66bd6951cbe1bda4074931d4e6) Thanks [@AdiRishi](https://github.com/AdiRishi)! - Rebuild the server on Nitro and Files SDK. It still deploys to Cloudflare Workers by default, and now also builds for any Nitro preset (`NITRO_PRESET`), with storage in a KV namespace, an R2 bucket, any S3-compatible bucket, or any Files SDK adapter returned from `src/custom-adapter.ts`.
  
  Existing deployments keep their `TURBO_TOKEN`, `BUCKET_OBJECT_EXPIRATION_HOURS`, `R2_STORE`, and `KV_STORE` configuration, and existing R2 artifacts stay readable.
  
  Breaking changes:
  
  - The API follows the official Remote Cache spec: non-hexadecimal hashes and invalid artifact headers return 400, errors return `{ code, message }`, and `POST /v8/artifacts` answers batch queries.
  - `GET /v8/artifacts/:hash` no longer keeps a Cloudflare Cache API copy of artifacts.
  - `POST /internal/delete-expired-objects` returns `{ deleted }` instead of `{ success: true }`.
  - `POST /internal/populate-random-objects` and `GET /internal/count-objects` are removed.
  - KV artifacts written by earlier versions are served without their tag, so clients that verify signatures skip them, and the next daily expiry deletes them.
