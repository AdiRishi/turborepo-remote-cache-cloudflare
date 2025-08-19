import { beforeEach, afterEach, describe, test, expect, vi } from 'vitest';
import { S3Storage } from '~/storage/s3-storage';
import { StorageManager } from '~/storage';

// Simple in-memory mock for S3 REST API subset we use
class InMemoryS3 {
  private store = new Map<string, { body: Uint8Array; meta: Record<string, string>; lastModified: Date }>();

  async handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const key = url.pathname.replace(/^\/+[^/]+\//, ''); // strip "/bucket/" prefix
    if (req.method === 'PUT') {
      const body = new Uint8Array(await req.arrayBuffer());
      const meta: Record<string, string> = {};
      req.headers.forEach((v, k) => {
        if (k.toLowerCase().startsWith('x-amz-meta-')) meta[k.toLowerCase()] = v;
      });
      this.store.set(key, { body, meta, lastModified: new Date() });
      return new Response('', { status: 200 });
    }
    if (req.method === 'GET') {
      const obj = this.store.get(key);
      if (!obj) return new Response('Not Found', { status: 404 });
      const headers = new Headers({ 'Content-Type': 'application/octet-stream' });
      headers.set('Last-Modified', obj.lastModified.toUTCString());
      for (const [k, v] of Object.entries(obj.meta)) headers.set(k, v);
      return new Response(obj.body, { status: 200, headers });
    }
    if (req.method === 'HEAD') {
      const obj = this.store.get(key);
      if (!obj) return new Response('Not Found', { status: 404 });
      const headers = new Headers();
      headers.set('Last-Modified', obj.lastModified.toUTCString());
      for (const [k, v] of Object.entries(obj.meta)) headers.set(k, v);
      return new Response('', { status: 200, headers });
    }
    if (req.method === 'DELETE') {
      this.store.delete(key);
      return new Response('', { status: 204 });
    }
    if (req.method === 'GET' && url.searchParams.get('list-type') === '2') {
      // not reached due to earlier branches; list handled below
    }
    if (req.method === 'GET') {
      return new Response('Not Implemented', { status: 501 });
    }
    return new Response('Method Not Allowed', { status: 405 });
  }

  async handleList(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.searchParams.get('list-type') !== '2') return new Response('Bad Request', { status: 400 });
    const prefix = url.searchParams.get('prefix') ?? '';
    const maxKeys = Number(url.searchParams.get('max-keys') ?? '1000');
    const allKeys = Array.from(this.store.keys()).filter((k) => k.startsWith(prefix)).sort();
    const token = url.searchParams.get('continuation-token');
    const startIndex = token ? parseInt(token, 10) : 0;
    const page = allKeys.slice(startIndex, startIndex + maxKeys);
    const isTruncated = startIndex + maxKeys < allKeys.length;
    const nextToken = isTruncated ? String(startIndex + maxKeys) : undefined;
    const contentsXml = page
      .map((k) => {
        const obj = this.store.get(k)!;
        return `<Contents><Key>${k}</Key><LastModified>${obj.lastModified.toISOString()}</LastModified></Contents>`;
      })
      .join('');
    const xml = `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult><IsTruncated>${
      isTruncated ? 'true' : 'false'
    }</IsTruncated>${nextToken ? `<NextContinuationToken>${nextToken}</NextContinuationToken>` : ''}${contentsXml}</ListBucketResult>`;
    return new Response(xml, { status: 200, headers: { 'Content-Type': 'application/xml' } });
  }
}

describe('s3-storage', () => {
  let s3: InMemoryS3;
  let storage: S3Storage;

  beforeEach(() => {
    s3 = new InMemoryS3();
    vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = new Request(input, init);
      const url = new URL(req.url);
      if (req.method === 'GET' && url.searchParams.get('list-type') === '2') {
        return s3.handleList(req);
      }
      return s3.handle(req);
    });
    storage = new S3Storage({
      accessKeyId: 'test',
      secretAccessKey: 'test',
      region: 'us-east-1',
      bucket: 'bucket',
      endpoint: 'https://mock-s3.local',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('write/read text value', async () => {
    await storage.write('key1', 'value1', { artifactTag: 'tag1' });
    const result = await storage.read('key1');
    const text = await StorageManager.readableStreamToText(result!);
    expect(text).toBe('value1');
  });

  test('readWithMetadata returns metadata', async () => {
    await storage.write('key1', 'value1', { artifactTag: 'tag1' });
    const result = await storage.readWithMetadata('key1');
    expect(result.metadata?.customMetadata.artifactTag).toBe('tag1');
    expect(result.metadata?.staticMetadata.createdAt instanceof Date).toBe(true);
  });

  test('list and listWithMetadata', async () => {
    await storage.write('a/key1', 'v');
    await storage.write('a/key2', 'v');
    await storage.write('b/key3', 'v');
    const list = await storage.list({ prefix: 'a/' });
    expect(list.keys).toEqual(['a/key1', 'a/key2']);
    const listMeta = await storage.listWithMetadata({ prefix: 'a/' });
    expect(listMeta.keys.map((k) => k.key)).toEqual(['a/key1', 'a/key2']);
    expect(listMeta.keys[0].metadata?.staticMetadata.createdAt instanceof Date).toBe(true);
  });

  test('delete single and multiple', async () => {
    await storage.write('key1', 'v');
    await storage.write('key2', 'v');
    await storage.delete('key1');
    const l1 = await storage.list();
    expect(l1.keys).toEqual(['key2']);
    await storage.delete(['key2']);
    const l2 = await storage.list();
    expect(l2.keys).toEqual([]);
  });
});

