import { env } from 'cloudflare:workers';
import { Files } from 'files-sdk';
import { describe, expect, it } from 'vitest';

import { kv } from '../src/index';

const KV_VALUE_LIMIT = 25 * 1024 * 1024;

const createFiles = (expirationTtl?: number) =>
  new Files({ adapter: kv({ binding: env.KV, expirationTtl }) });

const uniqueKey = () => `test/${crypto.randomUUID()}`;

const patternBytes = (length: number) => Uint8Array.from({ length }, (_, index) => index % 256);

const streamOf = (chunks: Uint8Array[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });

describe('kv adapter', () => {
  it('stores a stream body byte for byte and streams it back', async () => {
    const files = createFiles();
    const key = uniqueKey();
    const expected = patternBytes(70_000);

    await files.upload(key, streamOf([expected.subarray(0, 1000), expected.subarray(1000)]));
    const downloaded = await files.download(key, { as: 'stream' });

    expect(downloaded.size).toBe(expected.byteLength);
    expect(new Uint8Array(await new Response(downloaded.stream()).arrayBuffer())).toEqual(expected);
  });

  it('returns the stored file info from head, list, and download', async () => {
    const files = createFiles();
    const prefix = `${uniqueKey()}/`;
    const key = `${prefix}file`;
    await files.upload(key, 'abc', {
      contentType: 'application/x-artifact',
      metadata: { duration: '120', tag: 'sig' },
    });

    const head = await files.head(key);
    const { items } = await files.list({ prefix });

    expect(head).toMatchObject({
      contentType: 'application/x-artifact',
      key,
      metadata: { duration: '120', tag: 'sig' },
      size: 3,
    });
    expect(head.lastModified).toEqual(expect.any(Number));
    expect(items).toEqual([head]);
    expect(await files.download(key)).toMatchObject(head);
  });

  it('takes the content type from the upload, then from a string or Blob body', async () => {
    const files = createFiles();
    const prefix = `${uniqueKey()}/`;
    await files.upload(`${prefix}given`, 'x', { contentType: 'application/x-artifact' });
    await files.upload(`${prefix}string`, 'x');
    await files.upload(`${prefix}typed-blob`, new Blob(['{}'], { type: 'application/json' }));
    await files.upload(`${prefix}untyped-blob`, new Blob([patternBytes(3)]));
    await files.upload(`${prefix}bytes`, patternBytes(4));

    const { items } = await files.list({ prefix });
    expect(
      items.map(({ key, contentType, size }) => [key.slice(prefix.length), contentType, size]),
    ).toEqual([
      ['bytes', 'application/octet-stream', 4],
      ['given', 'application/x-artifact', 1],
      ['string', 'text/plain; charset=utf-8', 1],
      ['typed-blob', 'application/json', 2],
      ['untyped-blob', 'application/octet-stream', 3],
    ]);
    const blob = await files.download(`${prefix}untyped-blob`);
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(patternBytes(3));
  });

  it('copies a file with its bytes, content type, and metadata', async () => {
    const files = createFiles();
    const from = uniqueKey();
    const to = uniqueKey();
    await files.upload(from, 'abc', { contentType: 'text/csv', metadata: { owner: 'finance' } });

    await files.copy(from, to);

    expect(await files.head(to)).toMatchObject({
      contentType: 'text/csv',
      metadata: { owner: 'finance' },
      size: 3,
    });
    expect(await (await files.download(to)).text()).toBe('abc');
    expect(await files.exists(from)).toBe(true);
  });

  it('rejects url and signedUploadUrl as Unsupported', async () => {
    const files = createFiles();
    const key = uniqueKey();
    await files.upload(key, 'x');

    await expect(files.url(key)).rejects.toMatchObject({ code: 'Unsupported' });
    await expect(files.signedUploadUrl(key, { expiresIn: 60 })).rejects.toMatchObject({
      code: 'Unsupported',
    });
  });

  it('reports missing keys as NotFound and deletes idempotently', async () => {
    const files = createFiles();
    const key = uniqueKey();

    await expect(files.head(key)).rejects.toMatchObject({ code: 'NotFound' });
    await expect(files.download(key)).rejects.toMatchObject({ code: 'NotFound' });

    await files.upload(key, 'x');
    await files.delete(key);
    await files.delete(key);
    expect(await files.exists(key)).toBe(false);
  });

  it('pages through a prefix with a cursor', async () => {
    const files = createFiles();
    const prefix = `${uniqueKey()}/`;
    const keys = ['a', 'b', 'c'].map((name) => `${prefix}${name}`);
    await Promise.all(keys.map((key) => files.upload(key, key)));
    await files.upload(`${uniqueKey()}/outside`, 'x');

    const first = await files.list({ limit: 2, prefix });
    const second = await files.list({ cursor: first.cursor, limit: 2, prefix });

    expect(second.cursor).toBeUndefined();
    expect([...first.items, ...second.items].map(({ key }) => key)).toEqual(keys);
  });

  it('rejects values over 25 MiB and metadata over 1024 bytes without writing', async () => {
    const files = createFiles();
    const tooLarge = uniqueKey();
    const tooMuchMetadata = uniqueKey();

    await expect(
      files.upload(tooLarge, streamOf([new Uint8Array(KV_VALUE_LIMIT), new Uint8Array(1)])),
    ).rejects.toMatchObject({ code: 'Invalid' });
    await expect(
      files.upload(tooMuchMetadata, 'x', { metadata: { pad: 'é'.repeat(600) } }),
    ).rejects.toMatchObject({ code: 'Invalid' });

    expect(await files.exists(tooLarge)).toBe(false);
    expect(await files.exists(tooMuchMetadata)).toBe(false);
  });

  it('rejects every operation on a key over 512 bytes', async () => {
    const files = createFiles();
    const key = `test/${'é'.repeat(254)}`;

    await expect(files.upload(key, 'x')).rejects.toMatchObject({ code: 'Invalid' });
    await expect(files.head(key)).rejects.toMatchObject({ code: 'Invalid' });
    await expect(files.download(key)).rejects.toMatchObject({ code: 'Invalid' });
  });

  it.each([0, 59, 90.5])('rejects an expirationTtl of %s seconds', (expirationTtl) => {
    expect(() => kv({ binding: env.KV, expirationTtl })).toThrow(
      expect.objectContaining({ code: 'Invalid' }),
    );
  });

  it('sets the KV expiration from expirationTtl', async () => {
    const files = createFiles(3600);
    const key = uniqueKey();
    const nowSeconds = Math.floor(Date.now() / 1000);

    await files.upload(key, 'x');

    const { keys } = await env.KV.list({ prefix: key });
    expect(keys[0]?.expiration).toBeGreaterThanOrEqual(nowSeconds + 3600);
    expect(keys[0]?.expiration).toBeLessThanOrEqual(nowSeconds + 3600 + 5);
  });

  it.each([
    ['no metadata', undefined],
    ['metadata in another shape', { createdAtEpochMilliseconds: 1, customMetadata: {} }],
    [
      'user metadata that is not all strings',
      { contentType: 'text/plain', lastModified: 1, metadata: { retries: 3 }, size: 12 },
    ],
  ])('serves, copies, and deletes an entry with %s', async (_case, metadata) => {
    const files = createFiles();
    const prefix = `${uniqueKey()}/`;
    const key = `${prefix}foreign`;
    await env.KV.put(key, 'other writer', { metadata });

    const foreign = { contentType: 'application/octet-stream', key, size: 12 };
    expect(await files.head(key)).toEqual(foreign);
    const downloaded = await files.download(key, { as: 'stream' });
    expect(downloaded).toMatchObject(foreign);
    expect(await new Response(downloaded.stream()).text()).toBe('other writer');
    expect((await files.list({ prefix })).items).toEqual([{ ...foreign, size: 0 }]);

    await files.copy(key, `${prefix}copy`);
    expect((await files.list({ prefix: `${prefix}copy` })).items).toMatchObject([{ size: 12 }]);

    await files.delete(key);
    expect(await env.KV.get(key)).toBeNull();
  });
});
