import { afterEach, expect, test, vi } from 'vitest';

import { authorized, randomHash } from './support/client';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const S3 = { S3_BUCKET: 'turborepo-cache', S3_ENDPOINT: 'https://s3.us-east-1.amazonaws.com' };

const artifact = `/v8/artifacts/${randomHash()}`;

test.each([
  ['an empty TURBO_TOKEN', { TURBO_TOKEN: '' }, '/v8/artifacts/status', 'TURBO_TOKEN'],
  ['no artifact storage', {}, artifact, 'no artifact storage'],
  [
    'an S3_ENDPOINT that is not a URL',
    { ...S3, S3_ENDPOINT: 's3.amazonaws.com' },
    artifact,
    'S3_ENDPOINT',
  ],
  [
    'an S3_FORCE_PATH_STYLE other than true or false',
    { ...S3, S3_FORCE_PATH_STYLE: 'yes' },
    artifact,
    'S3_FORCE_PATH_STYLE',
  ],
  [
    'a BUCKET_OBJECT_EXPIRATION_HOURS below 1',
    { BUCKET_OBJECT_EXPIRATION_HOURS: '0' },
    '/stats',
    'BUCKET_OBJECT_EXPIRATION_HOURS',
  ],
])('answers %s with a generic 500, and logs the reason', async (_case, env, path, reason) => {
  for (const [name, value] of Object.entries(env)) {
    vi.stubEnv(name, value);
  }
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});

  const response = await authorized(path);
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    code: 'internal_server_error',
    message: 'Internal server error',
  });
  const logged = log.mock.calls.map(([error]) => String(error)).join('\n');
  expect(logged).toMatch(new RegExp(`Invalid server configuration: .*${reason}`, 'su'));
});
