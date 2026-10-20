import type { Adapter } from 'files-sdk';
import type { H3Event } from 'nitro';

import { kv } from '@turborepo-remote-cache/files-sdk-kv';
import { Files } from 'files-sdk';
import { r2 } from 'files-sdk/r2';
import { s3Fetch } from 'files-sdk/s3-fetch';

import type { PlatformEnv } from './env';

import { customAdapter } from '../custom-adapter';
import { configError, readExpirationHours, readS3Options } from './config';
import { eventEnv } from './env';

export type CustomAdapter = (env: PlatformEnv) => Adapter | undefined;

const SECONDS_PER_HOUR = 3600;

export const resolveAdapter = (env: PlatformEnv): Adapter => {
  const custom = customAdapter(env);
  if (custom) {
    return custom;
  }
  if (env.KV_STORE) {
    return kv({
      binding: env.KV_STORE,
      expirationTtl: readExpirationHours(env) * SECONDS_PER_HOUR,
    });
  }
  if (env.R2_STORE) {
    return r2({ binding: env.R2_STORE });
  }
  const s3 = readS3Options(env);
  if (s3) {
    return s3Fetch(s3);
  }
  throw configError(
    'no artifact storage. Bind KV_STORE or R2_STORE on Cloudflare, set S3_BUCKET and S3_ENDPOINT, or return an adapter from server/custom-adapter.ts.',
  );
};

export const openStorage = (env: PlatformEnv) => new Files({ adapter: resolveAdapter(env) });

export const useStorage = (event: H3Event) => openStorage(eventEnv(event));
