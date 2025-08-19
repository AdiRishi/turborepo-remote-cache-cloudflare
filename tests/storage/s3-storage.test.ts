import { beforeEach, afterEach, describe, test, expect, vi } from 'vitest';
import { StorageManager } from '~/storage';
import { S3Storage } from '~/storage/s3-storage';

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

// Mock aws4fetch
const mockFetch = vi.fn();
vi.mock('aws4fetch', () => ({
  AwsClient: vi.fn().mockImplementation(() => ({
    fetch: mockFetch,
  })),
}));

// Mock the S3Storage class to use our mock fetch
vi.mock('~/storage/s3-storage', async () => {
  const actual = await vi.importActual('~/storage/s3-storage');
  return {
    ...actual,
    S3Storage: class MockS3Storage extends (actual as { S3Storage: typeof S3Storage }).S3Storage {
      constructor(
        accessKeyId: string,
        secretAccessKey: string,
        bucketName: string,
        region = 'us-east-1'
      ) {
        super(accessKeyId, secretAccessKey, bucketName, region);
        // Override the s3Client to use our mock
        (this as { s3Client: { fetch: typeof mockFetch } }).s3Client = {
          fetch: mockFetch,
        };
      }
    },
  };
});

describe('s3-storage', () => {
  let storage: S3Storage;
  let startTime: number;

  beforeEach(() => {
    storage = new S3Storage('test-access-key', 'test-secret-key', 'test-bucket', 'us-east-1');
    startTime = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(startTime);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('listWithMetadata()', () => {
    const mockListResponse = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>test-bucket</Name>
  <Prefix></Prefix>
  <KeyCount>3</KeyCount>
  <MaxKeys>1000</MaxKeys>
  <IsTruncated>false</IsTruncated>
  <Contents>
    <Key>key1</Key>
    <LastModified>2024-01-01T00:00:00.000Z</LastModified>
    <ETag>"d41d8cd98f00b204e9800998ecf8427e"</ETag>
    <Size>6</Size>
  </Contents>
  <Contents>
    <Key>key2</Key>
    <LastModified>2024-01-01T00:00:00.000Z</LastModified>
    <ETag>"d41d8cd98f00b204e9800998ecf8427e"</ETag>
    <Size>6</Size>
  </Contents>
  <Contents>
    <Key>key3</Key>
    <LastModified>2024-01-01T00:00:00.000Z</LastModified>
    <ETag>"d41d8cd98f00b204e9800998ecf8427e"</ETag>
    <Size>6</Size>
  </Contents>
</ListBucketResult>`;

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockListResponse),
      });
    });

    test('returns keys with metadata', async () => {
      const result = await storage.listWithMetadata();
      expect(result.keys.map((k) => k.key)).toEqual(['key1', 'key2', 'key3']);
      expect(result.keys.every((k) => k.metadata?.staticMetadata.createdAt instanceof Date)).toBe(
        true
      );
      expect(result.cursor).toBeUndefined();
      expect(result.truncated).toBe(false);
    });

    test('handles truncated results', async () => {
      const truncatedResponse = mockListResponse.replace(
        '<IsTruncated>false</IsTruncated>',
        '<IsTruncated>true</IsTruncated><NextContinuationToken>next-token</NextContinuationToken>'
      );
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(truncatedResponse),
      });

      const result = await storage.listWithMetadata();
      expect(result.truncated).toBe(true);
      expect(result.cursor).toBe('next-token');
    });

    test('throws error on failed request', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(storage.listWithMetadata()).rejects.toThrow('S3 list failed: 403 Forbidden');
    });
  });

  describe('list()', () => {
    const mockListResponse = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>test-bucket</Name>
  <Prefix></Prefix>
  <KeyCount>2</KeyCount>
  <MaxKeys>1000</MaxKeys>
  <IsTruncated>false</IsTruncated>
  <Contents>
    <Key>key1</Key>
    <LastModified>2024-01-01T00:00:00.000Z</LastModified>
    <ETag>"d41d8cd98f00b204e9800998ecf8427e"</ETag>
    <Size>6</Size>
  </Contents>
  <Contents>
    <Key>key2</Key>
    <LastModified>2024-01-01T00:00:00.000Z</LastModified>
    <ETag>"d41d8cd98f00b204e9800998ecf8427e"</ETag>
    <Size>6</Size>
  </Contents>
</ListBucketResult>`;

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockListResponse),
      });
    });

    test('returns keys only', async () => {
      const result = await storage.list();
      expect(result.keys).toEqual(['key1', 'key2']);
      expect(result.cursor).toBeUndefined();
      expect(result.truncated).toBe(false);
    });
  });

  describe('readWithMetadata()', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('test-value'));
            controller.close();
          },
        }),
        headers: new Headers({
          'last-modified': 'Wed, 01 Jan 2024 00:00:00 GMT',
          'x-amz-meta-foo': 'bar',
        }),
      });
    });

    test('returns value with metadata', async () => {
      const result = await storage.readWithMetadata('key1');
      const dataAsText = await StorageManager.readableStreamToText(result.data!);
      expect(dataAsText).toBe('test-value');
      expect(result.metadata?.customMetadata).toEqual({ foo: 'bar' });
      expect(result.metadata?.staticMetadata.createdAt instanceof Date).toBe(true);
    });

    test('returns undefined for missing key', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await storage.readWithMetadata('missing');
      expect(result.data).toBeUndefined();
      expect(result.metadata).toBeUndefined();
    });

    test('throws error on failed request', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(storage.readWithMetadata('key1')).rejects.toThrow(
        'S3 read failed: 500 Internal Server Error'
      );
    });
  });

  describe('read()', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('test-value'));
            controller.close();
          },
        }),
        headers: new Headers({
          'last-modified': 'Wed, 01 Jan 2024 00:00:00 GMT',
        }),
      });
    });

    test('returns value', async () => {
      const result = await storage.read('key1');
      const dataAsText = await StorageManager.readableStreamToText(result!);
      expect(dataAsText).toBe('test-value');
    });

    test('returns undefined for missing key', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await storage.read('missing');
      expect(result).toBeUndefined();
    });
  });

  describe('write()', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
      });
    });

    test('writes data successfully', async () => {
      await expect(storage.write('key1', 'test-value')).resolves.not.toThrow();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-bucket.s3.us-east-1.amazonaws.com/key1',
        expect.objectContaining({
          method: 'PUT',
          body: 'test-value',
        } as RequestInit)
      );
    });

    test('writes data with metadata', async () => {
      const metadata = { foo: 'bar', baz: 'qux' };
      await storage.write('key1', 'test-value', metadata);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-bucket.s3.us-east-1.amazonaws.com/key1',
        expect.objectContaining({
          method: 'PUT',
          body: 'test-value',
          headers: expect.objectContaining({
            'x-amz-meta-foo': 'bar',
            'x-amz-meta-baz': 'qux',
          } as Record<string, string>),
        } as RequestInit)
      );
    });

    test('throws error on failed request', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(storage.write('key1', 'test-value')).rejects.toThrow(
        'S3 write failed: 403 Forbidden'
      );
    });
  });

  describe('delete()', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
      });
    });

    test('deletes single key', async () => {
      await expect(storage.delete('key1')).resolves.not.toThrow();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-bucket.s3.us-east-1.amazonaws.com/key1',
        expect.objectContaining({
          method: 'DELETE',
        } as RequestInit)
      );
    });

    test('deletes multiple keys', async () => {
      const deleteXml = `<?xml version="1.0" encoding="UTF-8"?>
<Delete>
  <Object><Key>key1</Key></Object>
  <Object><Key>key2</Key></Object>
</Delete>`;

      await storage.delete(['key1', 'key2']);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-bucket.s3.us-east-1.amazonaws.com/?delete',
        expect.objectContaining({
          method: 'POST',
          body: deleteXml,
          headers: expect.objectContaining({
            'Content-Type': 'application/xml',
          } as Record<string, string>),
        } as RequestInit)
      );
    });

    test('handles 404 for single delete gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(storage.delete('missing')).resolves.not.toThrow();
    });

    test('throws error on failed multi-delete', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(storage.delete(['key1', 'key2'])).rejects.toThrow(
        'S3 multi-delete failed: 403 Forbidden'
      );
    });
  });
});
