import type { KVNamespace } from '@cloudflare/workers-types';
import type {
  Adapter,
  Body,
  DownloadOptions,
  FileInfo,
  ListOptions,
  ListResult,
  StoredFile,
} from 'files-sdk';

import { createStoredFile, FilesError } from 'files-sdk';

export interface KvAdapterOptions {
  /** Workers KV namespace binding. Reads and writes go through it. */
  binding: KVNamespace;
  /**
   * Seconds after each write when KV expires the key. Applies to every
   * `upload` and `copy`. Must be an integer of at least 60, the KV minimum.
   * Omit it to keep keys until they are deleted.
   */
  expirationTtl?: number;
}

const MAX_KEY_BYTES = 512;
const MAX_VALUE_BYTES = 25 * 1024 * 1024;
const MAX_METADATA_BYTES = 1024;
const MAX_LIST_LIMIT = 1000;
const MIN_EXPIRATION_TTL = 60;
const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

/** What the adapter stores as KV metadata, so `head` and `list` can answer without reading values. */
type Envelope = Pick<Required<FileInfo>, 'size' | 'contentType' | 'lastModified'> &
  Pick<FileInfo, 'metadata'>;

const textEncoder = new TextEncoder();

const isStringRecord = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((entry) => typeof entry === 'string');

const parseEnvelope = (value: unknown): Envelope | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { size, contentType, lastModified, metadata }: Partial<Record<keyof Envelope, unknown>> =
    value;
  if (
    typeof size !== 'number' ||
    typeof contentType !== 'string' ||
    typeof lastModified !== 'number'
  ) {
    return undefined;
  }
  if (metadata === undefined) {
    return { contentType, lastModified, size };
  }
  return isStringRecord(metadata) ? { contentType, lastModified, metadata, size } : undefined;
};

// An entry without an envelope was written by other code. Only its value gives
// its size, and `list` cannot read values, so it passes 0.
const fileInfo = (key: string, envelope: Envelope | undefined, valueSize: number): FileInfo => ({
  key,
  ...(envelope ?? { contentType: DEFAULT_CONTENT_TYPE, size: valueSize }),
});

const createEnvelope = (
  value: ArrayBuffer | ArrayBufferView,
  contentType: string,
  metadata: Record<string, string> | undefined,
): Envelope => {
  const envelope: Envelope = {
    contentType,
    lastModified: Date.now(),
    size: value.byteLength,
    ...(metadata && { metadata }),
  };
  const bytes = textEncoder.encode(JSON.stringify(envelope)).byteLength;
  if (bytes > MAX_METADATA_BYTES) {
    throw new FilesError(
      'Invalid',
      `kv: metadata serializes to ${bytes} bytes, over the Workers KV limit of ${MAX_METADATA_BYTES}. The adapter's size, contentType, and lastModified fields count toward it.`,
    );
  }
  return envelope;
};

const notFound = (key: string): FilesError => new FilesError('NotFound', `kv: not found: ${key}`);

const unsupported = (operation: string): Promise<never> =>
  Promise.reject(
    new FilesError('Unsupported', `kv: ${operation}() is not supported, Workers KV has no URLs`),
  );

const assertExpirationTtl = (expirationTtl: number | undefined): void => {
  if (
    expirationTtl !== undefined &&
    !(Number.isSafeInteger(expirationTtl) && expirationTtl >= MIN_EXPIRATION_TTL)
  ) {
    throw new FilesError(
      'Invalid',
      `kv: expirationTtl must be an integer of at least ${MIN_EXPIRATION_TTL} seconds; got ${expirationTtl}`,
    );
  }
};

const assertKeySize = (key: string): void => {
  const bytes = textEncoder.encode(key).byteLength;
  if (bytes > MAX_KEY_BYTES) {
    throw new FilesError(
      'Invalid',
      `kv: key is ${bytes} bytes, over the Workers KV limit of ${MAX_KEY_BYTES}`,
    );
  }
};

const assertValueSize = (size: number): void => {
  if (size > MAX_VALUE_BYTES) {
    throw new FilesError(
      'Invalid',
      `kv: value exceeds the Workers KV limit of ${MAX_VALUE_BYTES} bytes (25 MiB)`,
    );
  }
};

const readStream = async (stream: ReadableStream<Uint8Array>): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.byteLength;
    assertValueSize(size);
    chunks.push(chunk);
  }
  const value = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    value.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return value;
};

const toValue = async (body: Body): Promise<ArrayBuffer | ArrayBufferView> => {
  if (body instanceof ReadableStream) {
    return readStream(body);
  }
  if (body instanceof Blob) {
    assertValueSize(body.size);
    return new Uint8Array(await body.arrayBuffer());
  }
  const value = typeof body === 'string' ? textEncoder.encode(body) : body;
  assertValueSize(value.byteLength);
  return value;
};

const contentTypeOf = (body: Body): string => {
  if (typeof body === 'string') {
    return 'text/plain; charset=utf-8';
  }
  if (body instanceof Blob && body.type) {
    return body.type;
  }
  return DEFAULT_CONTENT_TYPE;
};

const read = async (binding: KVNamespace, key: string) => {
  assertKeySize(key);
  const { value, metadata } = await binding.getWithMetadata(key, 'stream');
  if (value === null) {
    throw notFound(key);
  }
  return { envelope: parseEnvelope(metadata), value };
};

const readBytes = async (stream: ReadableStream): Promise<Uint8Array> =>
  new Uint8Array(await new Response(stream).arrayBuffer());

const head = async (binding: KVNamespace, key: string): Promise<FileInfo> => {
  const { envelope, value } = await read(binding, key);
  if (envelope) {
    await value.cancel();
    return { key, ...envelope };
  }
  return fileInfo(key, undefined, (await readBytes(value)).byteLength);
};

const exists = async (binding: KVNamespace, key: string): Promise<boolean> => {
  assertKeySize(key);
  const value = await binding.get(key, 'stream');
  await value?.cancel();
  return value !== null;
};

const download = async (
  binding: KVNamespace,
  key: string,
  as: DownloadOptions['as'],
): Promise<StoredFile> => {
  const { envelope, value } = await read(binding, key);
  if (envelope && as === 'stream') {
    return createStoredFile({ key, ...envelope }, { factory: () => value, kind: 'stream' });
  }
  const data = await readBytes(value);
  return createStoredFile(fileInfo(key, envelope, data.byteLength), { data, kind: 'buffer' });
};

const list = async (binding: KVNamespace, opts: ListOptions | undefined): Promise<ListResult> => {
  const result = await binding.list({
    cursor: opts?.cursor,
    limit: Math.min(opts?.limit ?? MAX_LIST_LIMIT, MAX_LIST_LIMIT),
    prefix: opts?.prefix,
  });
  return {
    items: result.keys.map(({ name, metadata }) => fileInfo(name, parseEnvelope(metadata), 0)),
    ...(!result.list_complete && { cursor: result.cursor }),
  };
};

/**
 * Files SDK adapter for a Cloudflare Workers KV namespace. Each file is one KV
 * entry: the bytes are the value, and the file's size, content type,
 * last-modified time, and user metadata are the KV metadata.
 */
export const kv = ({ binding, expirationTtl }: KvAdapterOptions): Adapter<KVNamespace> => {
  assertExpirationTtl(expirationTtl);

  const write = async (
    key: string,
    value: ArrayBuffer | ArrayBufferView,
    contentType: string,
    metadata: Record<string, string> | undefined,
  ): Promise<FileInfo> => {
    const envelope = createEnvelope(value, contentType, metadata);
    await binding.put(key, value, { expirationTtl, metadata: envelope });
    return { key, ...envelope };
  };

  return {
    capabilities: {
      metadata: true,
      serverSideCopy: false,
    },
    async copy(from, to) {
      assertKeySize(to);
      const source = await download(binding, from, 'blob');
      await write(to, await source.arrayBuffer(), source.contentType, source.metadata);
    },
    async delete(key) {
      assertKeySize(key);
      await binding.delete(key);
    },
    download: (key, opts) => download(binding, key, opts?.as),
    exists: (key) => exists(binding, key),
    head: (key) => head(binding, key),
    list: (opts) => list(binding, opts),
    name: 'kv',
    raw: binding,
    signedUploadUrl: () => unsupported('signedUploadUrl'),
    async upload(key, body, opts) {
      assertKeySize(key);
      const value = await toValue(body);
      return write(key, value, opts?.contentType ?? contentTypeOf(body), opts?.metadata);
    },
    url: () => unsupported('url'),
  };
};
