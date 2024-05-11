import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { Env } from '~/index';
import { StorageManager } from '~/storage';
import { KvStorage } from '~/storage/kv-storage';

const describe = setupMiniflareIsolatedStorage();

describe('kv-storage', () => {
  let workerEnv: Required<Env>;
  let storage: KvStorage;
  let startTime: number;

  beforeEach(() => {
    workerEnv = getMiniflareBindings();
    storage = new KvStorage(workerEnv.KV_STORE);
    startTime = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(startTime);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('listWithMetadata()', () => {
    const customMetadata = { foo: 'bar' };

    beforeEach(async () => {
      await storage.write('key1', 'value1', customMetadata);
      await storage.write('key2', 'value1', customMetadata);
      await storage.write('key3', 'value1', customMetadata);
    });

    test('returns preset keys with metadata', async () => {
      const result = await storage.listWithMetadata();
      expect(result.keys.map((k) => k.key)).toEqual(['key1', 'key2', 'key3']);
      expect(result.keys.map((k) => k.metadata?.customMetadata)).toEqual([
        customMetadata,
        customMetadata,
        customMetadata,
      ]);
      expect(result.keys.map((k) => k.metadata?.staticMetadata.createdAt)).toEqual([
        new Date(startTime),
        new Date(startTime),
        new Date(startTime),
      ]);
      expect(result.cursor).toBeUndefined();
      expect(result.truncated).toBe(false);
    });
  });

  describe('list()', () => {
    beforeEach(async () => {
      await storage.write('key1', 'value1');
      await storage.write('key2', 'value1');
      await storage.write('key3', 'value1');
    });

    test('returns preset keys', async () => {
      const result = await storage.list();
      expect(result.keys).toEqual(['key1', 'key2', 'key3']);
      expect(result.cursor).toBeUndefined();
      expect(result.truncated).toBe(false);
    });
  });

  describe('readWithMetadata()', () => {
    const customMetadata = { foo: 'bar' };

    beforeEach(async () => {
      await storage.write('key1', 'value1', customMetadata);
    });

    test('returns preset value with metadata', async () => {
      const result = await storage.readWithMetadata('key1');
      const dataAsText = await StorageManager.readableStreamToText(result.data!);
      expect(dataAsText).toBe('value1');
      expect(result.metadata?.customMetadata).toEqual(customMetadata);
      expect(result.metadata?.staticMetadata.createdAt).toEqual(new Date(startTime));
    });

    test('returns undefined for missing key', async () => {
      const result = await storage.read('missing');
      expect(result).toBeUndefined();
    });
  });

  describe('read()', () => {
    beforeEach(async () => {
      await storage.write('key1', 'value1');
    });

    test('returns preset value', async () => {
      const result = await storage.read('key1');
      const dataAsText = await StorageManager.readableStreamToText(result!);
      expect(dataAsText).toBe('value1');
    });

    test('returns undefined for missing key', async () => {
      const result = await storage.read('missing');
      expect(result).toBeUndefined();
    });
  });

  describe('write()', () => {
    test('can write text value', async () => {
      await storage.write('key1', 'value1');
      const result = await storage.read('key1');
      const dataAsText = await StorageManager.readableStreamToText(result!);
      expect(dataAsText).toBe('value1');
    });

    test('can write stream value', async () => {
      const stream = new ReadableStream({
        start: (controller) => {
          controller.enqueue('value1');
          controller.close();
        },
      });
      await storage.write('key1', stream);
      const result = await storage.read('key1');
      const dataAsText = await StorageManager.readableStreamToText(result!);
      expect(dataAsText).toBe('value1');
    });

    test('can write ArrayBuffer value', async () => {
      const buffer = new TextEncoder().encode('value1');
      await storage.write('key1', buffer);
      const result = await storage.read('key1');
      const dataAsBuffer = await StorageManager.readableStreamToBuffer(result!);
      const bufferView = new Uint8Array(dataAsBuffer);
      expect(bufferView).toEqual(new Uint8Array(buffer));
    });

    test('sets expiration TTL when available', async () => {
      storage = new KvStorage(workerEnv.KV_STORE, 1);
      await storage.write('key1', 'value1');
      const result = await storage.read('key1');
      const dataAsText = await StorageManager.readableStreamToText(result!);
      expect(dataAsText).toBe('value1');
    });
  });

  describe('delete()', () => {
    beforeEach(async () => {
      await storage.write('key1', 'value1');
      await storage.write('key2', 'value1');
      await storage.write('key3', 'value1');
    });

    test('can delete single key', async () => {
      await storage.delete('key1');
      const result = await storage.list();
      expect(result.keys).toEqual(['key2', 'key3']);
    });

    test('can delete multiple keys', async () => {
      await storage.delete(['key1', 'key2']);
      const result = await storage.list();
      expect(result.keys).toEqual(['key3']);
    });

    test('can delete all keys', async () => {
      await storage.delete(['key1', 'key2', 'key3']);
      const result = await storage.list();
      expect(result.keys).toEqual([]);
    });
  });

  describe('transformMetadata()', () => {
    test('transforms KV metadata to storage metadata', () => {
      const kvMetadata = {
        createdAtEpochMilliseconds: startTime,
        customMetadata: { foo: 'bar' },
      };
      // @ts-expect-error - private method
      const result = storage.transformMetadata(kvMetadata);
      expect(result).toEqual({
        staticMetadata: { createdAt: new Date(startTime) },
        customMetadata: { foo: 'bar' },
      });
    });

    test('returns undefined if KV metadata is undefined', () => {
      // @ts-expect-error - private method
      const result = storage.transformMetadata(undefined);
      expect(result).toBeUndefined();
    });
  });
});
