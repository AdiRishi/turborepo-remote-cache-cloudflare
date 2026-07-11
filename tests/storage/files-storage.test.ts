import { reset } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, test } from 'vitest';

import { RuntimeConfigurationError, type RuntimeEnv } from '~/runtime/env';
import { createStorageServices, resolveStorageProvider } from '~/storage';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isKvNamespace = (value: unknown): value is KVNamespace =>
  isRecord(value) &&
  ['delete', 'get', 'getWithMetadata', 'list', 'put'].every(
    (method) => typeof value[method] === 'function',
  );

const getKvNamespace = (): KVNamespace => {
  const binding = Reflect.get(env, 'KV_STORE');
  if (!isKvNamespace(binding)) throw new Error('Expected KV_STORE to be configured for tests');
  return binding;
};

describe('storage provider selection', () => {
  beforeEach(async () => {
    await reset();
  });

  test('accepts each first-class provider without a source change', () => {
    expect(resolveStorageProvider({ STORAGE_PROVIDER: 'r2' })).toBe('r2');
    expect(resolveStorageProvider({ STORAGE_PROVIDER: 'KV' })).toBe('kv');
    expect(resolveStorageProvider({ STORAGE_PROVIDER: 's3' })).toBe('s3');
  });

  test('preserves legacy KV precedence when both bindings are present', () => {
    const runtimeEnv: RuntimeEnv = {
      KV_STORE: getKvNamespace(),
      R2_STORE: env.R2_STORE,
    };

    expect(resolveStorageProvider(runtimeEnv)).toBe('kv');
    expect(resolveStorageProvider({ ...runtimeEnv, STORAGE_PROVIDER: 'r2' })).toBe('r2');
  });

  test('auto-detects credential-based providers', () => {
    expect(resolveStorageProvider({ S3_BUCKET: 'cache' })).toBe('s3');
    expect(resolveStorageProvider({ R2_BUCKET: 'cache' })).toBe('r2');
  });

  test('rejects unknown or missing providers with actionable errors', () => {
    expect(() => resolveStorageProvider({ STORAGE_PROVIDER: 'gcs' })).toThrow(
      'STORAGE_PROVIDER must be one of: r2, kv, s3, custom',
    );
    expect(() => resolveStorageProvider({})).toThrow('No storage provider is configured');
  });

  test('creates a binding-native R2 Files client with metadata support', async () => {
    const key = crypto.randomUUID();
    const { files, provider, retentionHours } = await createStorageServices({
      CACHE_RETENTION_HOURS: '24',
      R2_STORE: env.R2_STORE,
      STORAGE_PROVIDER: 'r2',
    });

    expect(provider).toBe('r2');
    expect(retentionHours).toBe(24);
    expect(files.capabilities.metadata).toBe(true);

    await files.upload(key, 'artifact', {
      metadata: { artifactTag: 'tag' },
    });
    const stored = await files.download(key);
    expect(await stored.text()).toBe('artifact');
    expect(stored.metadata).toEqual({ artifactTag: 'tag' });
  });

  test('creates a prefixed KV Files client and disables TTL at zero retention', async () => {
    const key = crypto.randomUUID();
    const { files, provider, retentionHours } = await createStorageServices({
      CACHE_RETENTION_HOURS: 0,
      KV_STORE: getKvNamespace(),
      STORAGE_PREFIX: 'tenant',
      STORAGE_PROVIDER: 'kv',
    });

    expect(provider).toBe('kv');
    expect(retentionHours).toBe(0);

    await files.upload(key, 'artifact');
    expect(await files.download(key).then((file) => file.text())).toBe('artifact');
    expect(await getKvNamespace().get(`tenant/${key}`)).toBe('artifact');
  });

  test('constructs S3 with static credentials and validates partial credentials', async () => {
    const services = await createStorageServices({
      AWS_ACCESS_KEY_ID: 'access-key',
      AWS_REGION: 'us-east-1',
      AWS_SECRET_ACCESS_KEY: 'secret-key',
      S3_BUCKET: 'cache',
      STORAGE_PROVIDER: 's3',
    });

    expect(services.provider).toBe('s3');
    expect(services.files.capabilities.metadata).toBe(true);

    await expect(
      createStorageServices({
        AWS_ACCESS_KEY_ID: 'access-key',
        S3_BUCKET: 'cache',
        STORAGE_PROVIDER: 's3',
      }),
    ).rejects.toThrow('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be configured together');
  });

  test('requires a binding for KV and an adapter for custom storage', async () => {
    await expect(createStorageServices({ STORAGE_PROVIDER: 'kv' })).rejects.toThrow(
      'STORAGE_PROVIDER=kv requires a Cloudflare KV_STORE binding',
    );
    await expect(createStorageServices({ STORAGE_PROVIDER: 'custom' })).rejects.toThrow(
      'storage.config.ts to return a Files SDK adapter',
    );
  });

  test('reports configuration errors with their dedicated type', () => {
    expect(() => resolveStorageProvider({ STORAGE_PROVIDER: 'unknown' })).toThrow(
      RuntimeConfigurationError,
    );
  });
});
