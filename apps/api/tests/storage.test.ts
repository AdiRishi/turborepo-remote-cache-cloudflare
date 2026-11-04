import type { ServerRequest } from 'srvx';

import { serverFetch } from 'nitro';
import { afterAll, afterEach, describe, expect, test, vi } from 'vitest';
import { getPlatformProxy } from 'wrangler';

import {
  authorized,
  clientFor,
  randomHash,
  readError,
  TOKEN,
  uploadArtifact,
} from './support/client';
import { startFakeS3 } from './support/fake-s3';

interface Bindings {
  KV_STORE: KVNamespace;
  R2_STORE: R2Bucket;
}

const platform = await getPlatformProxy<Bindings>({
  configPath: new URL('support/wrangler.jsonc', import.meta.url).pathname,
  persist: false,
});
const s3 = await startFakeS3();

afterAll(async () => {
  await platform.dispose();
  await s3.close();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const { KV_STORE, R2_STORE } = platform.env;

const S3_VARIABLES = {
  S3_BUCKET: 'turborepo-cache',
  S3_ENDPOINT: s3.url,
  S3_REGION: 'eu-west-1',
  S3_ACCESS_KEY_ID: 'AKIDEXAMPLE',
  S3_SECRET_ACCESS_KEY: 'secret',
  S3_FORCE_PATH_STYLE: 'true',
};

/** A client for the server running as a Worker, with `env` as its variables and bindings. */
const onWorker = (env: Record<string, unknown>) =>
  clientFor((path, init) => {
    const request: ServerRequest = Object.assign(
      new Request(new URL(path, 'http://localhost'), init),
      {
        runtime: {
          name: 'cloudflare',
          cloudflare: { env: { TURBO_TOKEN: TOKEN, ...env }, context: platform.ctx },
        },
      },
    );
    return serverFetch(request);
  });

const deleteExpired = async (
  client: ReturnType<typeof clientFor>,
  body: { expireInHours?: number } = {},
) => {
  const response = await client.authorized('/internal/delete-expired-objects', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  expect(response.status).toBe(200);
  return response.json();
};

const bytesOf = async (response: Response) => new Uint8Array(await response.arrayBuffer());

describe('choosing the store', () => {
  const storeInEach = async (key: string) => {
    await KV_STORE.put(key, 'KV_STORE');
    await R2_STORE.put(key, 'R2_STORE');
    s3.objects.set(`/${S3_VARIABLES.S3_BUCKET}/${key}`, {
      body: Buffer.from('S3'),
      metadata: {},
      lastModified: new Date(),
    });
  };

  test.each([
    ['KV_STORE over R2_STORE and S3', { KV_STORE, R2_STORE, ...S3_VARIABLES }, 'KV_STORE'],
    ['R2_STORE over S3', { R2_STORE, ...S3_VARIABLES }, 'R2_STORE'],
    ['S3 without a binding', S3_VARIABLES, 'S3'],
  ])('uses %s', async (_case, env, expected) => {
    const hash = randomHash();
    await storeInEach(`team_default_team/${hash}`);

    const download = await onWorker(env).authorized(`/v8/artifacts/${hash}`);
    expect(await download.text()).toBe(expected);
  });
});

describe('KV_STORE', () => {
  test('stores each artifact with a TTL of BUCKET_OBJECT_EXPIRATION_HOURS', async () => {
    const worker = onWorker({ KV_STORE, BUCKET_OBJECT_EXPIRATION_HOURS: 48 });
    const hash = randomHash();
    const body = crypto.getRandomValues(new Uint8Array(32));
    const writtenAt = Math.floor(Date.now() / 1000);

    await worker.uploadArtifact({ hash, body, headers: { 'x-artifact-tag': 'signature' } });

    const download = await worker.authorized(`/v8/artifacts/${hash}`);
    expect(download.headers.get('x-artifact-tag')).toBe('signature');
    expect(await bytesOf(download)).toEqual(body);
    const { keys } = await KV_STORE.list({ prefix: `team_default_team/${hash}` });
    expect(keys[0]?.expiration).toBeGreaterThanOrEqual(writtenAt + 48 * 3600);
    expect(keys[0]?.expiration).toBeLessThanOrEqual(writtenAt + 48 * 3600 + 5);
  });

  test('rejects an artifact over the 25 MiB KV limit with a 400 that says why', async () => {
    const hash = randomHash();
    const response = await onWorker({ KV_STORE }).uploadArtifact({
      hash,
      body: new Uint8Array(25 * 1024 * 1024 + 1),
    });

    expect(response.status).toBe(400);
    const error = await readError(response);
    expect(error.code).toBe('bad_request');
    expect(error.message).toContain('25 MiB');
    expect(await KV_STORE.get(`team_default_team/${hash}`)).toBeNull();
  });

  test('serves a version 4 entry without its signature, and the next expiry deletes it', async () => {
    const worker = onWorker({ KV_STORE });
    const v4Hash = randomHash();
    const v5Hash = randomHash();
    const body = new TextEncoder().encode('built by version 4');
    await KV_STORE.put(`team_default_team/${v4Hash}`, body, {
      metadata: {
        createdAtEpochMilliseconds: Date.now(),
        customMetadata: { artifactTag: 'v4-signature' },
      },
    });
    await worker.uploadArtifact({ hash: v5Hash, body: new Uint8Array(1) });

    const download = await worker.authorized(`/v8/artifacts/${v4Hash}`);
    expect(download.status).toBe(200);
    expect(download.headers.has('x-artifact-tag')).toBe(false);
    expect(await bytesOf(download)).toEqual(body);

    await deleteExpired(worker);
    expect(await KV_STORE.get(`team_default_team/${v4Hash}`)).toBeNull();
    expect(await KV_STORE.get(`team_default_team/${v5Hash}`)).not.toBeNull();
  });
});

// The platform proxy's R2 binding rejects a stream of unknown length, which a request body in Node is.
// A Worker's request body has a known length, so these tests write to the bucket through the binding.
describe('R2_STORE', () => {
  test('serves a version 4 artifact with its signature', async () => {
    const hash = randomHash();
    const body = new TextEncoder().encode('built by version 4');
    await R2_STORE.put(`team_default_team/${hash}`, body, {
      customMetadata: { artifactTag: 'v4-signature' },
    });

    const download = await onWorker({ R2_STORE }).authorized(`/v8/artifacts/${hash}`);
    expect(download.status).toBe(200);
    expect(download.headers.get('x-artifact-tag')).toBe('v4-signature');
    expect(download.headers.has('x-artifact-duration')).toBe(false);
    expect(await bytesOf(download)).toEqual(body);
  });

  test('expiry deletes every expired artifact from the bucket', async () => {
    for (let index = 0; index < 3; index++) {
      await R2_STORE.put(`team_default_team/${randomHash()}`, new Uint8Array(1));
    }
    const stored = (await R2_STORE.list()).objects.length;

    expect(await deleteExpired(onWorker({ R2_STORE }), { expireInHours: 0 })).toEqual({
      deleted: stored,
    });
    expect((await R2_STORE.list()).objects).toEqual([]);
  });
});

describe('S3 variables', () => {
  test('store artifacts at S3_ENDPOINT in path style, signed with the S3 credentials and region', async () => {
    for (const [name, value] of Object.entries(S3_VARIABLES)) {
      vi.stubEnv(name, value);
    }
    const hash = randomHash();
    const body = crypto.getRandomValues(new Uint8Array(16));
    s3.requests.length = 0;

    await uploadArtifact({
      hash,
      body,
      headers: { 'x-artifact-tag': 'signature', 'x-artifact-duration': '42' },
    });

    expect(s3.requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
      `PUT /turborepo-cache/team_default_team/${hash}`,
    ]);
    expect(s3.requests[0]?.credential).toMatch(
      /^AKIDEXAMPLE\/\d{8}\/eu-west-1\/s3\/aws4_request$/u,
    );
    // S3 returns metadata keys in lowercase.
    const download = await authorized(`/v8/artifacts/${hash}`);
    expect(download.headers.get('x-artifact-tag')).toBe('signature');
    expect(await bytesOf(download)).toEqual(body);
    const query = await authorized('/v8/artifacts', {
      method: 'POST',
      body: JSON.stringify({ hashes: [hash] }),
    });
    expect(await query.json()).toEqual({
      [hash]: { size: 16, taskDurationMs: 42, tag: 'signature' },
    });
  });
});
