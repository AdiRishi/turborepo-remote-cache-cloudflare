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

  it('sets the KV expiration from expirationTtl', async () => {
    const files = createFiles(3600);
    const key = uniqueKey();
    const nowSeconds = Math.floor(Date.now() / 1000);

    await files.upload(key, 'x');

    const { keys } = await env.KV.list({ prefix: key });
    expect(keys[0]?.expiration).toBeGreaterThanOrEqual(nowSeconds + 3600);
    expect(keys[0]?.expiration).toBeLessThanOrEqual(nowSeconds + 3600 + 5);
  });

  it('serves and deletes entries written without adapter metadata', async () => {
    const files = createFiles();
    const key = uniqueKey();
    await env.KV.put(key, 'legacy bytes', {
      metadata: { createdAtEpochMilliseconds: 1, customMetadata: {} },
    });

    const downloaded = await files.download(key);
    expect(downloaded.size).toBe('legacy bytes'.length);
    expect(await downloaded.text()).toBe('legacy bytes');

    await files.delete(key);
    expect(await env.KV.get(key)).toBeNull();
  });
});
