import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { Env } from '~/index';
import { R2Storage, KvStorage, StorageManager } from '~/storage';

const describe = setupMiniflareIsolatedStorage();

describe('storage-manager', () => {
  let workerEnv: Required<Env>;
  let storageManager: StorageManager;

  beforeEach(() => {
    workerEnv = getMiniflareBindings();
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
