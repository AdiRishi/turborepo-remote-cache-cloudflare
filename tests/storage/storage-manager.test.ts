import { env } from 'cloudflare:test';
import { beforeEach, describe, afterEach, test, expect, vi } from 'vitest';
import { Env } from '~/index';
import { KvStorage, R2Storage, S3Storage, StorageManager } from '~/storage';

describe('storage-manager', () => {
  let workerEnv: Required<Env>;
  let storageManager: StorageManager;

  beforeEach(() => {
    workerEnv = env as Required<Env>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('getActiveStorage() returns r2 if available', () => {
    const r2OnlyEnv = { ...workerEnv, KV_STORE: undefined };
    storageManager = new StorageManager(r2OnlyEnv);
    expect(storageManager.getActiveStorage()).toBeInstanceOf(R2Storage);
  });

  test('getActiveStorage() returns kv if r2 is not available', () => {
    const kvOnlyEnv = { ...workerEnv, R2_STORE: undefined };
    storageManager = new StorageManager(kvOnlyEnv);
    expect(storageManager.getActiveStorage()).toBeInstanceOf(KvStorage);
  });

  test('getActiveStorage() returns s3 if only s3 is available', () => {
    const s3OnlyEnv: Env = {
      ...workerEnv,
      R2_STORE: undefined,
      KV_STORE: undefined,
      S3_ENDPOINT: 'https://example.s3.amazonaws.com/my-bucket',
      S3_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'access-key-id',
      AWS_SECRET_ACCESS_KEY: 'secret-access-key',
    };
    storageManager = new StorageManager(s3OnlyEnv);
    expect(storageManager.getActiveStorage()).toBeInstanceOf(S3Storage);
  });

  test('getActiveStorage() throws if no storage is available', () => {
    const emptyEnv = {
      ...workerEnv,
      R2_STORE: undefined,
      KV_STORE: undefined,
      S3_ENDPOINT: undefined,
      S3_REGION: undefined,
      AWS_ACCESS_KEY_ID: undefined,
      AWS_SECRET_ACCESS_KEY: undefined,
    };
    expect(() => new StorageManager(emptyEnv)).toThrowError('No storage provided');
  });

  test('getActiveStorage() returns r2 if both r2 and kv are available', () => {
    storageManager = new StorageManager(workerEnv);
    expect(storageManager.getActiveStorage()).toBeInstanceOf(R2Storage);
  });

  test('getActiveStorage() returns r2 if r2, kv, and s3 are all available', () => {
    const allStorageEnv: Env = {
      ...workerEnv,
      S3_ENDPOINT: 'https://example.s3.amazonaws.com/my-bucket',
      S3_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'access-key-id',
      AWS_SECRET_ACCESS_KEY: 'secret-access-key',
    };
    storageManager = new StorageManager(allStorageEnv);
    expect(storageManager.getActiveStorage()).toBeInstanceOf(R2Storage);
  });

  test('getActiveStorage() respects STORAGE_BACKEND selector for kv', () => {
    const kvSelectedEnv: Env = {
      ...workerEnv,
      STORAGE_BACKEND: 'kv',
      S3_ENDPOINT: 'https://example.s3.amazonaws.com/my-bucket',
      S3_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'access-key-id',
      AWS_SECRET_ACCESS_KEY: 'secret-access-key',
    };
    storageManager = new StorageManager(kvSelectedEnv);
    expect(storageManager.getActiveStorage()).toBeInstanceOf(KvStorage);
  });

  test('getActiveStorage() respects STORAGE_BACKEND selector for r2', () => {
    const r2SelectedEnv: Env = {
      ...workerEnv,
      STORAGE_BACKEND: 'r2',
      S3_ENDPOINT: 'https://example.s3.amazonaws.com/my-bucket',
      S3_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'access-key-id',
      AWS_SECRET_ACCESS_KEY: 'secret-access-key',
    };
    storageManager = new StorageManager(r2SelectedEnv);
    expect(storageManager.getActiveStorage()).toBeInstanceOf(R2Storage);
  });

  test('getActiveStorage() respects STORAGE_BACKEND selector for s3', () => {
    const s3SelectedEnv: Env = {
      ...workerEnv,
      STORAGE_BACKEND: 's3',
      S3_ENDPOINT: 'https://example.s3.amazonaws.com/my-bucket',
      S3_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'access-key-id',
      AWS_SECRET_ACCESS_KEY: 'secret-access-key',
    };
    storageManager = new StorageManager(s3SelectedEnv);
    expect(storageManager.getActiveStorage()).toBeInstanceOf(S3Storage);
  });

  test('getActiveStorage() throws if STORAGE_BACKEND points to backend that is not configured', () => {
    const s3SelectedWithoutConfigEnv: Env = {
      ...workerEnv,
      STORAGE_BACKEND: 's3',
      S3_ENDPOINT: undefined,
      S3_REGION: undefined,
      AWS_ACCESS_KEY_ID: undefined,
      AWS_SECRET_ACCESS_KEY: undefined,
    };
    expect(() => new StorageManager(s3SelectedWithoutConfigEnv)).toThrowError(
      'STORAGE_BACKEND is set to "s3" but this backend is not configured'
    );
  });

  test('getActiveStorage() throws if STORAGE_BACKEND is invalid', () => {
    const invalidBackendEnv = { ...workerEnv, STORAGE_BACKEND: 'not-a-storage' };
    expect(() => new StorageManager(invalidBackendEnv as Env)).toThrowError(
      'Invalid STORAGE_BACKEND value'
    );
  });

  test('getActiveStorage() throws if S3_ENDPOINT is configured without credentials', () => {
    const incompleteS3Env: Env = {
      ...workerEnv,
      S3_ENDPOINT: 'https://example.s3.amazonaws.com/my-bucket',
      AWS_ACCESS_KEY_ID: undefined,
      AWS_SECRET_ACCESS_KEY: undefined,
    };
    expect(() => new StorageManager(incompleteS3Env)).toThrowError(
      'Incomplete S3 storage configuration: missing AWS_ACCESS_KEY_ID'
    );
  });

  test('readableStreamToText() returns text from stream', async () => {
    const text = 'hello world';
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    });
    expect(await StorageManager.readableStreamToText(stream)).toBe(text);
  });

  test('readableStreamToBuffer() returns buffer from stream', async () => {
    const uint8Array = new Uint8Array(8);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(uint8Array);
        controller.close();
      },
    });
    const buffer = await StorageManager.readableStreamToBuffer(stream);
    expect(buffer).toEqual(uint8Array.buffer);
  });
});
