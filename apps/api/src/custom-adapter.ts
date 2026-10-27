import type { CustomAdapter } from './utils/storage';

/**
 * Returns the Files SDK adapter that stores artifacts, overriding the built-in selection
 * (a `KV_STORE` binding, then an `R2_STORE` binding, then the `S3_*` variables).
 * Return `undefined` to keep the built-in selection.
 *
 * Import the provider here so the bundle only contains the one you use, and add its SDK to
 * `apps/api/package.json`. For example, Google Cloud Storage (`pnpm add @google-cloud/storage`):
 *
 * ```ts
 * import { gcs } from 'files-sdk/gcs';
 *
 * export const customAdapter: CustomAdapter = (env) =>
 *   typeof env.GCS_BUCKET === 'string' ? gcs({ bucket: env.GCS_BUCKET }) : undefined;
 * ```
 *
 * `env` holds the Worker env on Cloudflare and `process.env` elsewhere. See https://files-sdk.dev for every adapter.
 */
export const customAdapter: CustomAdapter = () => undefined;
