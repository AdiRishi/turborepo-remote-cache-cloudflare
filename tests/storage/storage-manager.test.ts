import { env } from 'cloudflare:test';
import { beforeEach, describe, afterEach, test, expect, vi } from 'vitest';
import { Env } from '~/index';
import { R2Storage, KvStorage, StorageManager } from '~/storage';
import { S3Storage } from '~/storage/s3-storage';

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

  test('getActiveStorage() throws if no storage is available', () => {
    const emptyEnv = {
      ...workerEnv,
      R2_STORE: undefined,
      KV_STORE: undefined,
      S3_ACCESS_KEY_ID: undefined,
    };
    expect(() => new StorageManager(emptyEnv)).toThrowError('No storage provided');
  });

  test('getActiveStorage() returns kv if both r2 and kv are available', () => {
    const r2KvEnv = { ...workerEnv, S3_ACCESS_KEY_ID: undefined };
    storageManager = new StorageManager(r2KvEnv);
    expect(storageManager.getActiveStorage()).toBeInstanceOf(KvStorage);
  });

  test('getActiveStorage() returns s3 if s3 is available', () => {
    const s3Env = {
      ...workerEnv,
      S3_ACCESS_KEY_ID: 'test-key',
      S3_SECRET_ACCESS_KEY: 'test-secret',
      S3_BUCKET_NAME: 'test-bucket',
    };
    storageManager = new StorageManager(s3Env);
    expect(storageManager.getActiveStorage()).toBeInstanceOf(S3Storage);
  });

  test('getActiveStorage() returns s3 if all storage options are available', () => {
    const allStorageEnv = {
      ...workerEnv,
      S3_ACCESS_KEY_ID: 'test-key',
      S3_SECRET_ACCESS_KEY: 'test-secret',
      S3_BUCKET_NAME: 'test-bucket',
    };
    storageManager = new StorageManager(allStorageEnv);
    expect(storageManager.getActiveStorage()).toBeInstanceOf(S3Storage);
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
