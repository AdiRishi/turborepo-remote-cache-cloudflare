import type { Body } from 'files-sdk';

import { env } from 'cloudflare:workers';
import { Files } from 'files-sdk';
import { describe, expect, it } from 'vitest';

import { kv } from '../src/index';

const MiB = 1024 * 1024;
const KV_VALUE_LIMIT = 25 * MiB;

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

const readAll = async (stream: ReadableStream<Uint8Array>) =>
  new Uint8Array(await new Response(stream).arrayBuffer());

const meteredStream = (totalBytes: number) => {
  const meter = { cancelled: false, pulledBytes: 0 };
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      meter.cancelled = true;
    },
    pull(controller) {
      if (meter.pulledBytes === totalBytes) {
        controller.close();
        return;
      }
      meter.pulledBytes += MiB;
      controller.enqueue(new Uint8Array(MiB));
    },
  });
  return { meter, stream };
};

const expirationOf = async (key: string) => {
  const { keys } = await env.KV.list({ prefix: key });
  return keys.find(({ name }) => name === key)?.expiration;
};

const invalid = { code: 'Invalid' } as const;

describe('upload and download', () => {
  it('stores a multi-chunk stream body byte for byte', async () => {
    const files = createFiles();
    const key = uniqueKey();
    const expected = patternBytes(3000);

    const uploaded = await files.upload(
      key,
      streamOf([expected.subarray(0, 1000), expected.subarray(1000)]),
    );
    const downloaded = await files.download(key);

    expect(uploaded.size).toBe(3000);
    expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(expected);
  });

  it.each<[string, Body, Uint8Array]>([
    ['ArrayBuffer', patternBytes(512).buffer, patternBytes(512)],
    [
      'Uint8Array view',
      new Uint8Array([9, 9, 1, 2, 3, 9]).subarray(2, 5),
      new Uint8Array([1, 2, 3]),
    ],
    ['DataView', new DataView(new Uint8Array([7, 4, 5, 7]).buffer, 1, 2), new Uint8Array([4, 5])],
    ['string', 'héllo', new TextEncoder().encode('héllo')],
    ['Blob', new Blob([patternBytes(300)]), patternBytes(300)],
  ])('stores a %s body byte for byte', async (_, body, expected) => {
    const files = createFiles();
    const key = uniqueKey();

    const uploaded = await files.upload(key, body);
    const downloaded = await files.download(key);

    expect(uploaded.size).toBe(expected.byteLength);
    expect(downloaded.size).toBe(expected.byteLength);
    expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(expected);
  });

  it('streams the stored bytes for a stream download', async () => {
    const files = createFiles();
    const key = uniqueKey();
    const expected = patternBytes(70_000);
    await files.upload(key, expected);

    const downloaded = await files.download(key, { as: 'stream' });

    expect(await readAll(downloaded.stream())).toEqual(expected);
  });

  it.each<[string, Body, string | undefined, string]>([
    ['a string body', 'text', undefined, 'text/plain; charset=utf-8'],
    [
      'a typed Blob body',
      new Blob(['{}'], { type: 'application/json' }),
      undefined,
      'application/json',
    ],
    ['a bytes body', new Uint8Array([1]), undefined, 'application/octet-stream'],
    ['an explicit contentType', 'text', 'application/x-custom', 'application/x-custom'],
  ])('stores the content type of %s', async (_, body, contentType, expected) => {
    const files = createFiles();
    const key = uniqueKey();

    await files.upload(key, body, { contentType });

    expect((await files.head(key)).contentType).toBe(expected);
  });
});

describe('metadata', () => {
  it('returns the stored file info from head, list, and download', async () => {
    const files = createFiles();
    const prefix = `${uniqueKey()}/`;
    const key = `${prefix}file`;
    const before = Date.now();
    await files.upload(key, 'abc', {
      contentType: 'application/x-artifact',
      metadata: { duration: '120', tag: 'sig' },
    });
    const after = Date.now();

    const head = await files.head(key);
    const { items } = await files.list({ prefix });
    const downloaded = await files.download(key);

    const { lastModified, ...rest } = head;
    expect(rest).toEqual({
      contentType: 'application/x-artifact',
      key,
      metadata: { duration: '120', tag: 'sig' },
      size: 3,
    });
    expect(lastModified).toBeGreaterThanOrEqual(before);
    expect(lastModified).toBeLessThanOrEqual(after);
    expect(items).toEqual([head]);
    expect(downloaded).toMatchObject(head);
  });

  it('answers head and list from KV metadata without reading the value', async () => {
    const files = createFiles();
    const prefix = `${uniqueKey()}/`;
    const key = `${prefix}file`;
    const envelope = { contentType: 'text/x-envelope', lastModified: 1_700_000_000_000, size: 3 };
    await env.KV.put(key, 'a value that is not 3 bytes long', { metadata: envelope });

    const head = await files.head(key);
    const { items } = await files.list({ prefix });

    expect(head).toEqual({ key, ...envelope });
    expect(items).toEqual([{ key, ...envelope }]);
  });
});

describe('missing keys', () => {
  it('rejects download and head with NotFound', async () => {
    const files = createFiles();
    const key = uniqueKey();

    await expect(files.download(key)).rejects.toMatchObject({ code: 'NotFound' });
    await expect(files.download(key, { as: 'stream' })).rejects.toMatchObject({ code: 'NotFound' });
    await expect(files.head(key)).rejects.toMatchObject({ code: 'NotFound' });
  });

  it('sees a key in head and exists right after it is written', async () => {
    const files = createFiles();
    const key = uniqueKey();

    expect(await files.exists(key)).toBe(false);
    await files.upload(key, 'x');

    expect(await files.exists(key)).toBe(true);
    expect((await files.head(key)).size).toBe(1);
  });

  it('deletes a key, and treats deleting a missing key as a no-op', async () => {
    const files = createFiles();
    const key = uniqueKey();
    await files.upload(key, 'x');

    await files.delete(key);
    await files.delete(key);

    expect(await files.exists(key)).toBe(false);
  });
});

describe('copy', () => {
  it('copies the bytes, content type, and metadata to a new key', async () => {
    const files = createFiles();
    const from = uniqueKey();
    const to = uniqueKey();
    const bytes = patternBytes(1000);
    await files.upload(from, bytes, { contentType: 'application/x-a', metadata: { a: '1' } });

    await files.copy(from, to);

    const copied = await files.download(to);
    expect(new Uint8Array(await copied.arrayBuffer())).toEqual(bytes);
    expect(copied).toMatchObject({
      contentType: 'application/x-a',
      metadata: { a: '1' },
      size: 1000,
    });
    expect(await files.exists(from)).toBe(true);
  });

  it('rejects a missing source with NotFound', async () => {
    await expect(createFiles().copy(uniqueKey(), uniqueKey())).rejects.toMatchObject({
      code: 'NotFound',
    });
  });
});

describe('list', () => {
  it('pages through a prefix with a cursor that disappears on the last page', async () => {
    const files = createFiles();
    const prefix = `${uniqueKey()}/`;
    const keys = ['a', 'b', 'c', 'd', 'e'].map((name) => `${prefix}${name}`);
    await Promise.all(keys.map((key) => files.upload(key, key)));

    const first = await files.list({ limit: 2, prefix });
    const second = await files.list({ cursor: first.cursor, limit: 2, prefix });
    const third = await files.list({ cursor: second.cursor, limit: 2, prefix });

    expect(first.cursor).toEqual(expect.any(String));
    expect(second.cursor).toEqual(expect.any(String));
    expect(third.cursor).toBeUndefined();
    expect([...first.items, ...second.items, ...third.items].map(({ key }) => key)).toEqual(keys);
  });

  it('returns only keys under the prefix', async () => {
    const files = createFiles();
    const root = uniqueKey();
    await files.upload(`${root}/inside/1`, 'x');
    await files.upload(`${root}/inside/2`, 'x');
    await files.upload(`${root}/outside`, 'x');

    const { items, cursor } = await files.list({ prefix: `${root}/inside/` });

    expect(items.map(({ key }) => key)).toEqual([`${root}/inside/1`, `${root}/inside/2`]);
    expect(cursor).toBeUndefined();
  });

  it('caps a limit above the KV maximum of 1000 instead of failing', async () => {
    const files = createFiles();
    const prefix = `${uniqueKey()}/`;
    await files.upload(`${prefix}only`, 'x');

    const { items } = await files.list({ limit: 5000, prefix });

    expect(items.map(({ key }) => key)).toEqual([`${prefix}only`]);
  });
});

describe('KV limits', () => {
  it('accepts a key of exactly 512 bytes', async () => {
    const files = createFiles();
    const key = uniqueKey().padEnd(512, 'k');

    await files.upload(key, 'x');

    expect((await files.head(key)).size).toBe(1);
  });

  const oversizedKey = 'é'.repeat(300);

  it.each<[string, (files: Files) => Promise<unknown>]>([
    ['upload', (files) => files.upload(oversizedKey, 'x')],
    ['download', (files) => files.download(oversizedKey)],
    ['head', (files) => files.head(oversizedKey)],
    ['exists', (files) => files.exists(oversizedKey)],
    ['delete', (files) => files.delete(oversizedKey)],
    ['copy to', (files) => files.copy(uniqueKey(), oversizedKey)],
  ])('rejects %s of a key over 512 UTF-8 bytes with Invalid', async (_, call) => {
    await expect(call(createFiles())).rejects.toMatchObject(invalid);
  });

  it('accepts a value of exactly 25 MiB', async () => {
    const files = createFiles();
    const key = uniqueKey();

    await files.upload(key, new Uint8Array(KV_VALUE_LIMIT));

    expect((await files.head(key)).size).toBe(KV_VALUE_LIMIT);
  });

  it.each<[string, () => Body]>([
    ['bytes', () => new Uint8Array(KV_VALUE_LIMIT + 1)],
    ['Blob', () => new Blob([new Uint8Array(KV_VALUE_LIMIT + 1)])],
    ['stream', () => streamOf([new Uint8Array(KV_VALUE_LIMIT), new Uint8Array(1)])],
  ])('rejects a %s body over 25 MiB with Invalid and writes nothing', async (_, body) => {
    const files = createFiles();
    const key = uniqueKey();

    await expect(files.upload(key, body())).rejects.toMatchObject(invalid);

    expect(await files.exists(key)).toBe(false);
  });

  it('stops reading a stream body as soon as it passes 25 MiB', async () => {
    const files = createFiles();
    const key = uniqueKey();
    const { meter, stream } = meteredStream(4 * KV_VALUE_LIMIT);

    await expect(files.upload(key, stream)).rejects.toMatchObject(invalid);

    expect(meter.cancelled).toBe(true);
    expect(meter.pulledBytes).toBeLessThanOrEqual(KV_VALUE_LIMIT + 2 * MiB);
  });

  it('accepts metadata that serializes to exactly 1024 bytes', async () => {
    const files = createFiles();
    const probe = uniqueKey();
    await files.upload(probe, 'x', { metadata: { pad: '' } });
    const { metadata: stored } = await env.KV.getWithMetadata(probe);
    const overhead = new TextEncoder().encode(JSON.stringify(stored)).byteLength;
    const key = uniqueKey();
    const pad = 'a'.repeat(1024 - overhead);

    await files.upload(key, 'x', { metadata: { pad } });

    expect((await files.head(key)).metadata).toEqual({ pad });
  });

  it('rejects metadata over 1024 bytes with Invalid, counting bytes rather than characters', async () => {
    const files = createFiles();
    const key = uniqueKey();

    await expect(
      files.upload(key, 'x', { metadata: { pad: 'é'.repeat(600) } }),
    ).rejects.toMatchObject(invalid);

    expect(await files.exists(key)).toBe(false);
  });
});

describe('expirationTtl', () => {
  it('sets the KV expiration on uploads and copies', async () => {
    const files = createFiles(3600);
    const from = uniqueKey();
    const to = uniqueKey();
    const nowSeconds = Date.now() / 1000;

    await files.upload(from, 'x');
    await files.copy(from, to);

    for (const key of [from, to]) {
      const expiration = await expirationOf(key);
      expect(expiration).toBeGreaterThanOrEqual(Math.floor(nowSeconds) + 3600);
      expect(expiration).toBeLessThanOrEqual(Math.ceil(nowSeconds) + 3600 + 5);
    }
  });

  it('writes keys without an expiration by default', async () => {
    const files = createFiles();
    const key = uniqueKey();

    await files.upload(key, 'x');

    expect(await expirationOf(key)).toBeUndefined();
  });

  it.each([0, 59, 60.5, -60, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an expirationTtl of %s with Invalid',
    (expirationTtl) => {
      expect(() => kv({ binding: env.KV, expirationTtl })).toThrow(
        expect.objectContaining(invalid),
      );
    },
  );
});

describe('foreign entries', () => {
  const foreignBytes = 'foreign bytes';
  const foreignFile = { contentType: 'application/octet-stream', size: foreignBytes.length };

  const putOptions: [string, Parameters<KVNamespace['put']>[2]][] = [
    ['no metadata', undefined],
    ['other metadata', { metadata: { createdAtEpochMilliseconds: 1, customMetadata: { a: 'b' } } }],
    ['a malformed envelope', { metadata: { contentType: 'x', lastModified: 1, size: '3' } }],
    [
      'non-string user metadata',
      { metadata: { contentType: 'x', lastModified: 1, metadata: { a: 1 }, size: 3 } },
    ],
  ];

  it.each(putOptions)(
    'reports the real size of an entry with %s from head and download',
    async (_, options) => {
      const files = createFiles();
      const key = uniqueKey();
      await env.KV.put(key, foreignBytes, options);

      const head = await files.head(key);
      const buffered = await files.download(key);
      const streamed = await files.download(key, { as: 'stream' });

      expect(head).toEqual({ key, ...foreignFile });
      expect(buffered).toMatchObject({ key, ...foreignFile });
      expect(await buffered.text()).toBe(foreignBytes);
      expect(streamed).toMatchObject({ key, ...foreignFile });
      expect(new TextDecoder().decode(await readAll(streamed.stream()))).toBe(foreignBytes);
    },
  );

  it.each(putOptions)('lists an entry with %s with size 0', async (_, options) => {
    const files = createFiles();
    const prefix = `${uniqueKey()}/`;
    const key = `${prefix}foreign`;
    await env.KV.put(key, foreignBytes, options);

    const { items } = await files.list({ prefix });

    expect(items).toEqual([{ contentType: 'application/octet-stream', key, size: 0 }]);
  });

  it('deletes a foreign entry', async () => {
    const files = createFiles();
    const key = uniqueKey();
    await env.KV.put(key, foreignBytes, { metadata: { createdAtEpochMilliseconds: 1 } });

    await files.delete(key);

    expect(await env.KV.get(key)).toBeNull();
  });

  it('copies a foreign entry into an adapter entry that lists with its real size', async () => {
    const files = createFiles();
    const from = uniqueKey();
    const to = uniqueKey();
    await env.KV.put(from, foreignBytes);

    await files.copy(from, to);

    const { items } = await files.list({ prefix: to });
    expect(items).toMatchObject([{ key: to, ...foreignFile }]);
  });
});

describe('unsupported operations', () => {
  it.each<[string, (files: Files) => Promise<unknown>]>([
    ['url', (files) => files.url('key')],
    ['signedUploadUrl', (files) => files.signedUploadUrl('key', { expiresIn: 60 })],
    ['a range download', (files) => files.download('key', { range: { start: 0 } })],
    ['a delimiter listing', (files) => files.list({ delimiter: '/' })],
    ['cacheControl', (files) => files.upload('key', 'x', { cacheControl: 'no-store' })],
  ])('rejects %s with Unsupported', async (_, call) => {
    await expect(call(createFiles())).rejects.toMatchObject({ code: 'Unsupported' });
  });
});
