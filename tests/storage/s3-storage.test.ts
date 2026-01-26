import { beforeEach, afterEach, describe, test, expect, vi } from 'vitest';
import { StorageManager } from '~/storage';
import { S3Storage, S3Client } from '~/storage/s3-storage';

/**
 * Creates a mock S3 client backed by an in-memory Map
 */
function createMockS3Client(): S3Client & {
  _store: Map<string, { data: ArrayBuffer; headers: Record<string, string>; lastModified: Date }>;
} {
  const store = new Map<
    string,
    { data: ArrayBuffer; headers: Record<string, string>; lastModified: Date }
  >();

  return {
    _store: store,

    async putAnyObject(
      key: string,
      data: string | ArrayBuffer | ReadableStream,
      _contentType?: string,
      _ssecHeaders?: Record<string, string>,
      additionalHeaders?: Record<string, string>
    ) {
      let buffer: ArrayBuffer;
      if (typeof data === 'string') {
        buffer = new TextEncoder().encode(data).buffer;
      } else if (data instanceof ArrayBuffer) {
        buffer = data;
      } else {
        // ReadableStream
        const response = new Response(data);
        buffer = await response.arrayBuffer();
      }

      store.set(key, {
        data: buffer,
        headers: additionalHeaders ?? {},
        lastModified: new Date(),
      });

      return new Response(null, { status: 200 });
    },

    getObjectResponse(key: string) {
      const item = store.get(key);
      if (!item) {
        return Promise.resolve(null);
      }

      const headers = new Headers();
      for (const [k, v] of Object.entries(item.headers)) {
        headers.set(k, v);
      }

      return Promise.resolve(
        new Response(item.data, {
          status: 200,
          headers,
        })
      );
    },

    listObjectsPaged(
      _delimiter?: string,
      prefix?: string,
      maxKeys?: number,
      _continuationToken?: string
    ) {
      let keys = Array.from(store.keys());

      if (prefix) {
        keys = keys.filter((k) => k.startsWith(prefix));
      }

      // Sort for consistent ordering
      keys.sort();

      // Apply limit
      const limit = maxKeys ?? keys.length;
      const truncated = keys.length > limit;
      const resultKeys = keys.slice(0, limit);

      return Promise.resolve({
        objects: resultKeys.map((k) => ({
          Key: k,
          LastModified: store.get(k)!.lastModified,
        })),
        nextContinuationToken: truncated ? 'next-token' : undefined,
      });
    },

    deleteObject(key: string) {
      const existed = store.has(key);
      store.delete(key);
      return Promise.resolve(existed);
    },

    deleteObjects(keys: string[]) {
      return Promise.resolve(
        keys.map((key) => {
          const existed = store.has(key);
          store.delete(key);
          return existed;
        })
      );
    },
  };
}

describe('s3-storage', () => {
  let mockClient: ReturnType<typeof createMockS3Client>;
  let storage: S3Storage;
  let startTime: number;

  beforeEach(() => {
    mockClient = createMockS3Client();
    storage = new S3Storage(mockClient);
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
      await storage.write('key2', 'value2', customMetadata);
      await storage.write('key3', 'value3', customMetadata);
    });

    test('returns preset keys with metadata', async () => {
      const result = await storage.listWithMetadata();
      expect(result.keys.map((k) => k.key)).toEqual(['key1', 'key2', 'key3']);
      expect(result.keys.every((k) => k.metadata?.staticMetadata.createdAt instanceof Date)).toBe(
        true
      );
      expect(result.cursor).toBeUndefined();
      expect(result.truncated).toBe(false);
    });

    test('returns empty list when no objects', async () => {
      mockClient._store.clear();
      const result = await storage.listWithMetadata();
      expect(result.keys).toEqual([]);
      expect(result.truncated).toBe(false);
    });
  });

  describe('list()', () => {
    beforeEach(async () => {
      await storage.write('key1', 'value1');
      await storage.write('key2', 'value2');
      await storage.write('key3', 'value3');
    });

    test('returns preset keys', async () => {
      const result = await storage.list();
      expect(result.keys).toEqual(['key1', 'key2', 'key3']);
      expect(result.cursor).toBeUndefined();
      expect(result.truncated).toBe(false);
    });

    test('returns empty list when no objects', async () => {
      mockClient._store.clear();
      const result = await storage.list();
      expect(result.keys).toEqual([]);
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
      expect(result.metadata?.staticMetadata.createdAt instanceof Date).toBe(true);
    });

    test('returns undefined for missing key', async () => {
      const result = await storage.readWithMetadata('missing');
      expect(result.data).toBeUndefined();
      expect(result.metadata).toBeUndefined();
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
      const stream = StorageManager.textToReadableStream('value1');
      await storage.write('key1', stream);
      const result = await storage.read('key1');
      const dataAsText = await StorageManager.readableStreamToText(result!);
      expect(dataAsText).toBe('value1');
    });

    test('can write ArrayBuffer value', async () => {
      const buffer = new TextEncoder().encode('value1').buffer;
      await storage.write('key1', buffer);
      const result = await storage.read('key1');
      const dataAsBuffer = (await StorageManager.readableStreamToBuffer(result!)) as ArrayBuffer;
      const bufferView = new Uint8Array(dataAsBuffer);
      expect(bufferView).toEqual(new Uint8Array(buffer));
    });

    test('stores custom metadata', async () => {
      const customMetadata = { team: 'frontend', version: '1.0' };
      await storage.write('key1', 'value1', customMetadata);
      const result = await storage.readWithMetadata('key1');
      expect(result.metadata?.customMetadata).toEqual(customMetadata);
    });
  });

  describe('delete()', () => {
    beforeEach(async () => {
      await storage.write('key1', 'value1');
      await storage.write('key2', 'value2');
      await storage.write('key3', 'value3');
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

    test('handles empty array delete', async () => {
      await storage.delete([]);
      const result = await storage.list();
      expect(result.keys).toEqual(['key1', 'key2', 'key3']);
    });
  });

  describe('extractMetadataFromHeaders()', () => {
    test('extracts metadata from headers correctly', async () => {
      const customMetadata = { foo: 'bar' };
      await storage.write('key1', 'value1', customMetadata);
      const result = await storage.readWithMetadata('key1');
      expect(result.metadata).toEqual({
        staticMetadata: { createdAt: new Date(startTime) },
        customMetadata: { foo: 'bar' },
      });
    });

    test('handles missing custom metadata', async () => {
      await storage.write('key1', 'value1');
      const result = await storage.readWithMetadata('key1');
      expect(result.metadata?.customMetadata).toEqual({});
    });
  });
});
