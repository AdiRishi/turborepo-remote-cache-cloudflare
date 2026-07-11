import { reset } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { Files, FilesError, type Body } from 'files-sdk';
import { beforeEach, describe, expect, test } from 'vitest';

import {
  CLOUDFLARE_KV_MAX_VALUE_SIZE,
  cloudflareKv,
  type CloudflareKvAdapter,
  type CloudflareKvMetadata,
} from '~/storage/cloudflare-kv';

const textEncoder = new TextEncoder();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isKvNamespace = (value: unknown): value is KVNamespace =>
  isRecord(value) &&
  ['delete', 'get', 'getWithMetadata', 'list', 'put'].every(
    (method) => typeof value[method] === 'function',
  );

const getKvNamespace = (): KVNamespace => {
  const binding: unknown = Reflect.get(env, 'KV_STORE');
  if (!isKvNamespace(binding)) throw new Error('Expected KV_STORE to be configured');
  return binding;
};

const expectFilesError = async (
  promise: Promise<unknown>,
  code: 'NotFound' | 'Provider',
  permanent?: boolean,
): Promise<void> => {
  await expect(promise).rejects.toBeInstanceOf(FilesError);
  await expect(promise).rejects.toMatchObject({
    code,
    ...(permanent === undefined ? {} : { permanent }),
  });
};

interface BodyCase {
  body: () => Body;
  expected: Uint8Array;
  expectedType: string;
  name: string;
}

const bodyCases: BodyCase[] = [
  {
    body: () => 'héllo',
    expected: textEncoder.encode('héllo'),
    expectedType: 'text/plain; charset=utf-8',
    name: 'string',
  },
  {
    body: () => Uint8Array.of(1, 2, 3),
    expected: Uint8Array.of(1, 2, 3),
    expectedType: 'application/octet-stream',
    name: 'Uint8Array',
  },
  {
    body: () => Uint8Array.of(4, 5, 6).buffer,
    expected: Uint8Array.of(4, 5, 6),
    expectedType: 'application/octet-stream',
    name: 'ArrayBuffer',
  },
  {
    body: () => new DataView(Uint8Array.of(7, 8, 9).buffer),
    expected: Uint8Array.of(7, 8, 9),
    expectedType: 'application/octet-stream',
    name: 'ArrayBufferView',
  },
  {
    body: () => new Blob(['blob'], { type: 'text/blob' }),
    expected: textEncoder.encode('blob'),
    expectedType: 'text/blob',
    name: 'Blob',
  },
  {
    body: () => new File(['file'], 'artifact.bin', { type: 'text/file' }),
    expected: textEncoder.encode('file'),
    expectedType: 'text/file',
    name: 'File',
  },
  {
    body: () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(Uint8Array.of(10, 11));
          controller.enqueue(Uint8Array.of(12));
          controller.close();
        },
      }),
    expected: Uint8Array.of(10, 11, 12),
    expectedType: 'application/octet-stream',
    name: 'ReadableStream',
  },
];

describe('cloudflareKv()', () => {
  let adapter: CloudflareKvAdapter;
  let binding: KVNamespace;
  let files: Files<CloudflareKvAdapter>;
  let testKeyPrefix: string;

  const testKey = (name: string): string => `${testKeyPrefix}/${name}`;

  beforeEach(async () => {
    await reset();
    testKeyPrefix = crypto.randomUUID();
    binding = getKvNamespace();
    adapter = cloudflareKv({ binding });
    files = new Files({ adapter });
  });

  test('advertises only the capabilities Workers KV actually supports', () => {
    expect(adapter.name).toBe('cloudflare-kv');
    expect(adapter.raw).toBe(binding);
    expect(files.capabilities).toEqual({
      cacheControl: false,
      delimiter: false,
      metadata: true,
      multipart: false,
      rangeRead: false,
      serverSideCopy: false,
      signedUrl: { supported: false },
      uploadProgress: false,
    });
  });

  test.each(bodyCases)('uploads and downloads a $name body', async (bodyCase) => {
    const key = testKey(`body-${bodyCase.name}`);
    const upload = await files.upload(key, bodyCase.body());

    expect(upload).toMatchObject({
      contentType: bodyCase.expectedType,
      key,
      size: bodyCase.expected.byteLength,
    });

    const downloaded = await files.download(key);
    expect(downloaded.type).toBe(bodyCase.expectedType);
    expect(downloaded.size).toBe(bodyCase.expected.byteLength);
    expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(bodyCase.expected);
  });

  test('persists metadata needed by download, head, and metadata-only listings', async () => {
    const key = testKey('artifact');
    const startedAt = Date.now();
    await files.upload(key, 'payload', {
      contentType: 'application/x-tar',
      metadata: { 'x-artifact-tag': 'signed-tag' },
    });

    const rawList = await binding.list<CloudflareKvMetadata>({ prefix: key });
    expect(rawList.keys[0]?.metadata).toMatchObject({
      contentType: 'application/x-tar',
      metadata: { 'x-artifact-tag': 'signed-tag' },
      size: 7,
    });
    expect(rawList.keys[0]?.metadata?.createdAt).toBeGreaterThanOrEqual(startedAt);

    const head = await files.head(key);
    expect(head).toMatchObject({
      key,
      metadata: { 'x-artifact-tag': 'signed-tag' },
      size: 7,
      type: 'application/x-tar',
    });
    expect(await head.text()).toBe('payload');

    const listed = await files.list({ prefix: key });
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]).toMatchObject({
      key,
      metadata: { 'x-artifact-tag': 'signed-tag' },
      size: 7,
      type: 'application/x-tar',
    });
  });

  test('supports prefix listing and KV cursor pagination', async () => {
    const artifactPrefix = testKey('artifact-');
    const artifactA = `${artifactPrefix}a`;
    const artifactB = `${artifactPrefix}b`;
    await files.upload(artifactA, 'a');
    await files.upload(artifactB, 'b');
    await files.upload(testKey('other'), 'c');

    const first = await files.list({ limit: 1, prefix: artifactPrefix });
    expect(first.items.map((item) => item.key)).toEqual([artifactA]);
    expect(first.cursor).toEqual(expect.any(String));

    const second = await files.list({
      cursor: first.cursor,
      limit: 1,
      prefix: artifactPrefix,
    });
    expect(second.items.map((item) => item.key)).toEqual([artifactB]);
  });

  test('checks existence without confusing a longer prefixed key for an exact key', async () => {
    const key = testKey('artifact');
    const childKey = `${key}-child`;
    await files.upload(childKey, 'payload');

    expect(await files.exists(key)).toBe(false);
    expect(await files.exists(childKey)).toBe(true);
  });

  test('copies bytes and metadata, then deletes objects', async () => {
    const sourceKey = testKey('source');
    const copyKey = testKey('copy');
    await files.upload(sourceKey, 'payload', {
      contentType: 'application/x-tar',
      metadata: { 'x-artifact-tag': 'tag' },
    });

    await files.copy(sourceKey, copyKey);
    const copied = await files.download(copyKey);
    expect(await copied.text()).toBe('payload');
    expect(copied).toMatchObject({
      metadata: { 'x-artifact-tag': 'tag' },
      size: 7,
      type: 'application/x-tar',
    });

    await files.delete(sourceKey);
    expect(await files.exists(sourceKey)).toBe(false);
    expect(await files.exists(copyKey)).toBe(true);
  });

  test('keeps legacy KV objects readable with an explicit listing-size fallback', async () => {
    const key = testKey('legacy');
    const createdAtEpochMilliseconds = Date.now() - 1000;
    await binding.put(key, 'legacy-body', {
      metadata: {
        createdAtEpochMilliseconds,
        customMetadata: { 'x-artifact-tag': 'legacy-tag' },
      },
    });

    const listed = await files.list({ prefix: key });
    expect(listed.items[0]).toMatchObject({
      key,
      lastModified: createdAtEpochMilliseconds,
      metadata: { 'x-artifact-tag': 'legacy-tag' },
      // Legacy metadata never recorded size. list() intentionally avoids an
      // N+1 body read; the single-key APIs below still report the exact size.
      size: 0,
      type: 'application/octet-stream',
    });

    const head = await files.head(key);
    expect(head.size).toBe(11);
    expect(await head.text()).toBe('legacy-body');

    const downloaded = await files.download(key);
    expect(downloaded.size).toBe(11);
    expect(downloaded.metadata).toEqual({ 'x-artifact-tag': 'legacy-tag' });
    expect(await downloaded.text()).toBe('legacy-body');
  });

  test('applies a native expiration TTL', async () => {
    const key = testKey('expiring');
    const now = Math.floor(Date.now() / 1000);
    files = new Files({ adapter: cloudflareKv({ binding, expirationTtl: 60 }) });

    await files.upload(key, 'payload');

    const rawList = await binding.list({ prefix: key });
    expect(rawList.keys[0]?.expiration).toBeGreaterThanOrEqual(now + 59);
    expect(rawList.keys[0]?.expiration).toBeLessThanOrEqual(now + 61);
  });

  test('rejects invalid expiration TTL configuration', () => {
    expect(() => cloudflareKv({ binding, expirationTtl: 59 })).toThrowError(
      expect.objectContaining({ code: 'Provider', permanent: true }),
    );
  });

  test('rejects an unknown-length stream above the KV value limit before writing', async () => {
    const key = testKey('oversized');
    const oversized = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(CLOUDFLARE_KV_MAX_VALUE_SIZE + 1));
        controller.close();
      },
    });

    await expectFilesError(files.upload(key, oversized), 'Provider', true);
    expect(await files.exists(key)).toBe(false);
  });

  test('rejects metadata above the KV metadata limit before writing', async () => {
    const key = testKey('oversized-metadata');
    await expectFilesError(
      files.upload(key, 'body', { metadata: { value: 'x'.repeat(1024) } }),
      'Provider',
      true,
    );
    expect(await files.exists(key)).toBe(false);
  });

  test('uses FilesError for missing objects and unsupported URL operations', async () => {
    const missingKey = testKey('missing');
    await expectFilesError(files.download(missingKey), 'NotFound');
    await expectFilesError(files.head(missingKey), 'NotFound');
    await expectFilesError(files.copy(missingKey, testKey('copy')), 'NotFound');
    await expectFilesError(files.url(missingKey), 'Provider', true);
    await expectFilesError(files.signedUploadUrl(missingKey, { expiresIn: 60 }), 'Provider', true);
  });
});
