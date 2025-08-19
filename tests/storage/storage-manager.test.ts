import { env } from 'cloudflare:test';
import { beforeEach, describe, afterEach, test, expect, vi } from 'vitest';
import { Env } from '~/index';
import { R2Storage, KvStorage, StorageManager, S3Storage } from '~/storage';

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
    const emptyEnv = { ...workerEnv, R2_STORE: undefined, KV_STORE: undefined };
    expect(() => new StorageManager(emptyEnv)).toThrowError('No storage provided');
  });

  test('getActiveStorage() returns kv if both are available', () => {
    storageManager = new StorageManager(workerEnv);
    expect(storageManager.getActiveStorage()).toBeInstanceOf(KvStorage);
  });

  test('getActiveStorage() returns s3 if only s3 is configured', () => {
    const s3OnlyEnv = {
      ...workerEnv,
      R2_STORE: undefined,
      KV_STORE: undefined,
      AWS_ACCESS_KEY_ID: 'test',
      AWS_SECRET_ACCESS_KEY: 'test',
      AWS_REGION: 'us-east-1',
      S3_BUCKET: 'bucket',
      S3_ENDPOINT: 'https://mock-s3.local',
    } as unknown as Required<Env>;
    storageManager = new StorageManager(s3OnlyEnv);
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
