import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { StorageManager } from '~/storage';
import { S3Storage } from '~/storage/s3-storage';

describe('s3-storage', () => {
  let storage: S3Storage;
  const startTime = new Date('2026-01-20T00:00:00.000Z');

  const mockS3Client = {
    listObjectsPaged: vi.fn(),
    getObjectResponse: vi.fn(),
    putObject: vi.fn(),
    deleteObject: vi.fn(),
    deleteObjects: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new S3Storage(
      {
        endpoint: 'https://example.s3.amazonaws.com/my-bucket',
        region: 'us-east-1',
        accessKeyId: 'access-key-id',
        secretAccessKey: 'secret-access-key',
      },
      mockS3Client
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    test('throws when S3_ENDPOINT is missing', () => {
      expect(
        () =>
          new S3Storage({
            accessKeyId: 'access-key-id',
            secretAccessKey: 'secret-access-key',
          })
      ).toThrowError('missing S3_ENDPOINT');
    });

    test('throws when AWS_ACCESS_KEY_ID is missing', () => {
      expect(
        () =>
          new S3Storage({
            endpoint: 'https://example.s3.amazonaws.com/my-bucket',
            secretAccessKey: 'secret-access-key',
          })
      ).toThrowError('missing AWS_ACCESS_KEY_ID');
    });

    test('throws when AWS_SECRET_ACCESS_KEY is missing', () => {
      expect(
        () =>
          new S3Storage({
            endpoint: 'https://example.s3.amazonaws.com/my-bucket',
            accessKeyId: 'access-key-id',
          })
      ).toThrowError('missing AWS_SECRET_ACCESS_KEY');
    });

    test('throws when S3_ENDPOINT is invalid', () => {
      expect(
        () =>
          new S3Storage({
            endpoint: 'not-a-valid-url',
            accessKeyId: 'access-key-id',
            secretAccessKey: 'secret-access-key',
          })
      ).toThrowError('invalid S3_ENDPOINT');
    });
  });

  describe('listWithMetadata()', () => {
    test('returns keys with createdAt metadata', async () => {
      mockS3Client.listObjectsPaged.mockResolvedValue({
        objects: [{ Key: 'key1', LastModified: startTime }],
        nextContinuationToken: 'next-cursor',
      });

      const result = await storage.listWithMetadata({
        limit: 1,
        cursor: 'cursor-1',
        prefix: 'team-1/',
      });

      expect(mockS3Client.listObjectsPaged).toHaveBeenCalledWith(
        '__turbo_remote_cache_noop_delimiter__',
        'team-1/',
        1,
        'cursor-1'
      );
      expect(result).toEqual({
        keys: [
          {
            key: 'key1',
            metadata: {
              staticMetadata: {
                createdAt: startTime,
              },
              customMetadata: {},
            },
          },
        ],
        cursor: 'next-cursor',
        truncated: true,
      });
    });

    test('returns empty list for empty bucket response', async () => {
      mockS3Client.listObjectsPaged.mockResolvedValue({
        objects: null,
      });

      const result = await storage.listWithMetadata();
      expect(result).toEqual({ keys: [], cursor: undefined, truncated: false });
    });
  });

  describe('list()', () => {
    test('returns keys', async () => {
      mockS3Client.listObjectsPaged.mockResolvedValue({
        objects: [
          { Key: 'key1', LastModified: startTime },
          { Key: 'key2', LastModified: startTime },
        ],
      });

      const result = await storage.list();
      expect(result).toEqual({
        keys: ['key1', 'key2'],
        cursor: undefined,
        truncated: false,
      });
    });
  });

  describe('readWithMetadata()', () => {
    test('reads object and metadata from turbo custom metadata header', async () => {
      const headers = new Headers({
        'last-modified': startTime.toUTCString(),
        'x-amz-meta-turbo-custom-metadata': JSON.stringify({ artifactTag: 'v1.0.0' }),
      });
      mockS3Client.getObjectResponse.mockResolvedValue(new Response('value1', { headers }));

      const result = await storage.readWithMetadata('key1');
      const body = await StorageManager.readableStreamToText(result.data!);

      expect(body).toBe('value1');
      expect(result.metadata).toEqual({
        staticMetadata: { createdAt: new Date(startTime.toUTCString()) },
        customMetadata: { artifactTag: 'v1.0.0' },
      });
    });

    test('falls back to generic x-amz-meta-* headers when turbo metadata is invalid', async () => {
      const headers = new Headers({
        'last-modified': startTime.toUTCString(),
        'x-amz-meta-turbo-custom-metadata': '{',
        'x-amz-meta-artifacttag': 'v2.0.0',
        'x-amz-meta-build-id': '123',
      });
      mockS3Client.getObjectResponse.mockResolvedValue(new Response('value1', { headers }));

      const result = await storage.readWithMetadata('key1');
      expect(result.metadata?.customMetadata).toEqual({
        artifacttag: 'v2.0.0',
        'build-id': '123',
      });
    });

    test('returns undefined values when object does not exist', async () => {
      mockS3Client.getObjectResponse.mockResolvedValue(null);
      const result = await storage.readWithMetadata('missing');
      expect(result).toEqual({
        data: undefined,
        metadata: undefined,
      });
    });
  });

  describe('read()', () => {
    test('returns undefined when object does not exist', async () => {
      mockS3Client.getObjectResponse.mockResolvedValue(null);
      const result = await storage.read('missing');
      expect(result).toBeUndefined();
    });
  });

  describe('write()', () => {
    test('writes metadata to reserved x-amz header', async () => {
      mockS3Client.putObject.mockResolvedValue(new Response('', { status: 200 }));
      await storage.write('key1', 'value1', { artifactTag: 'v1.0.0' });

      expect(mockS3Client.putObject).toHaveBeenCalledWith(
        'key1',
        'value1',
        'application/octet-stream',
        undefined,
        {
          'x-amz-meta-turbo-custom-metadata': JSON.stringify({ artifactTag: 'v1.0.0' }),
        }
      );
    });
  });

  describe('delete()', () => {
    test('deletes one key with deleteObject', async () => {
      mockS3Client.deleteObject.mockResolvedValue(true);
      await storage.delete('key1');
      expect(mockS3Client.deleteObject).toHaveBeenCalledWith('key1');
      expect(mockS3Client.deleteObjects).not.toHaveBeenCalled();
    });

    test('deletes multiple keys with deleteObjects', async () => {
      mockS3Client.deleteObjects.mockResolvedValue([true, true]);
      await storage.delete(['key1', 'key2']);
      expect(mockS3Client.deleteObjects).toHaveBeenCalledWith(['key1', 'key2']);
      expect(mockS3Client.deleteObject).not.toHaveBeenCalled();
    });
  });
});
