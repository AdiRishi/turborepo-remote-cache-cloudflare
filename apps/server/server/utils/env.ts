import type { H3Event } from 'nitro';
import type { CloudflareEnv } from 'srvx';

declare module 'srvx' {
  interface CloudflareEnv {
    KV_STORE?: KVNamespace;
    R2_STORE?: R2Bucket;
  }
}

/**
 * Variables, secrets and bindings of the running platform: the Worker env on Cloudflare, `process.env` elsewhere.
 * `KV_STORE` and `R2_STORE` are only ever bindings, so they are absent off Cloudflare.
 */
export type PlatformEnv = Readonly<CloudflareEnv>;

const processEnv = (): PlatformEnv => ({
  ...process.env,
  KV_STORE: undefined,
  R2_STORE: undefined,
});

export const eventEnv = (event: H3Event): PlatformEnv =>
  event.req.runtime?.cloudflare?.env ?? processEnv();
