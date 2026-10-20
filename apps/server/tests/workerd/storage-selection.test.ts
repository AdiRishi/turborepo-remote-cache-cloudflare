import { env } from 'cloudflare:workers';
import { describe, expect, test } from 'vitest';

import { openStorage } from '../../server/utils/storage';

const S3_ENV = {
  S3_BUCKET: 'artifacts',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret',
};

describe('storage selection', () => {
  test('stores in KV when both KV_STORE and R2_STORE are bound, expiring with the cache', async () => {
    const storage = openStorage({
      KV_STORE: env.KV_STORE,
      R2_STORE: env.R2_STORE,
      BUCKET_OBJECT_EXPIRATION_HOURS: 2,
    });
    await storage.upload('team/kv-wins', 'artifact');

    const { keys } = await env.KV_STORE.list({ prefix: 'team/kv-wins' });
    expect(keys).toHaveLength(1);
    expect(keys[0]?.expiration).toBeCloseTo(Date.now() / 1000 + 2 * 3600, -1);
    expect(await env.R2_STORE.head('team/kv-wins')).toBeNull();
  });

  test('stores in R2 when only R2_STORE is bound, ignoring S3 variables', async () => {
    await openStorage({ R2_STORE: env.R2_STORE, ...S3_ENV }).upload('team/r2-only', 'artifact');

    expect(await env.R2_STORE.head('team/r2-only')).not.toBeNull();
  });

  test('uses the S3 API when no binding is present', () => {
    expect(openStorage(S3_ENV).adapter.name).toBe('s3-fetch');
  });

  test.each([
    ['no storage at all', {}, /no artifact storage/u],
    ['S3_BUCKET without S3_ENDPOINT', { S3_BUCKET: 'artifacts' }, /S3_ENDPOINT/u],
    [
      'a malformed S3_FORCE_PATH_STYLE',
      { ...S3_ENV, S3_FORCE_PATH_STYLE: 'yes' },
      /S3_FORCE_PATH_STYLE/u,
    ],
    [
      'a non-integer expiration on KV',
      { KV_STORE: env.KV_STORE, BUCKET_OBJECT_EXPIRATION_HOURS: '1.5' },
      /BUCKET_OBJECT_EXPIRATION_HOURS/u,
    ],
  ])('reports a configuration error for %s', (_case, platformEnv, message) => {
    expect(() => openStorage(platformEnv)).toThrow(message);
  });
});
