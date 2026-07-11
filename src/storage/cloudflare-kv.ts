import {
  createStoredFile,
  FilesError,
  type Adapter,
  type Body,
  type BodySource,
  type StoredFileMeta,
  type UploadOptions,
} from 'files-sdk';

export const CLOUDFLARE_KV_MAX_VALUE_SIZE = 25 * 1024 * 1024;

const CLOUDFLARE_KV_MAX_METADATA_SIZE = 1024;
const CLOUDFLARE_KV_MIN_EXPIRATION_TTL = 60;
const DEFAULT_CONTENT_TYPE = 'application/octet-stream';
const TEXT_CONTENT_TYPE = 'text/plain; charset=utf-8';

const textEncoder = new TextEncoder();

export interface CloudflareKvAdapterOptions {
  /** Workers KV binding used for all storage operations. */
  binding: KVNamespace;
  /** Optional native Workers KV expiration TTL, in seconds (minimum 60). */
  expirationTtl?: number;
}

/** Metadata written with every new KV value so listings never need to fetch bodies. */
export interface CloudflareKvMetadata {
  createdAt: number;
  size: number;
  contentType: string;
  metadata?: Record<string, string>;
}

interface ParsedMetadata {
  current: boolean;
  contentType: string;
  createdAt?: number;
  metadata?: Record<string, string>;
  size?: number;
}

type KvWritableValue = string | ArrayBuffer | ArrayBufferView | ReadableStream;

interface PreparedBody {
  contentType: string;
  size: number;
  value: KvWritableValue;
}

export type CloudflareKvAdapter = Adapter<KVNamespace>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringRecord = (value: unknown): Record<string, string> | undefined => {
  if (!isRecord(value)) return undefined;

  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );
  return entries.length === 0 ? undefined : Object.fromEntries(entries);
};

const nonNegativeNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;

const nonNegativeInteger = (value: unknown): number | undefined =>
  Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : undefined;

const parseMetadata = (value: unknown): ParsedMetadata => {
  if (!isRecord(value)) {
    return { current: false, contentType: DEFAULT_CONTENT_TYPE };
  }

  const createdAt = nonNegativeNumber(value.createdAt);
  const size = nonNegativeInteger(value.size);
  if (createdAt !== undefined && size !== undefined && typeof value.contentType === 'string') {
    return {
      current: true,
      contentType: value.contentType,
      createdAt,
      metadata: stringRecord(value.metadata),
      size,
    };
  }

  return {
    current: false,
    contentType: DEFAULT_CONTENT_TYPE,
    createdAt: nonNegativeNumber(value.createdAtEpochMilliseconds),
    metadata: stringRecord(value.customMetadata),
  };
};

const notFoundError = (key: string): FilesError =>
  new FilesError('NotFound', `cloudflare-kv: object not found: ${key}`);

const unsupportedError = (operation: string): FilesError =>
  new FilesError(
    'Provider',
    `cloudflare-kv: ${operation} is not supported by Workers KV`,
    undefined,
    {
      permanent: true,
    },
  );

const valueTooLargeError = (size: number): FilesError =>
  new FilesError(
    'Provider',
    `cloudflare-kv: value is ${size} bytes, exceeding Workers KV's 25 MiB limit`,
    undefined,
    { permanent: true },
  );

const mapKvError = (error: unknown): FilesError => {
  if (error instanceof FilesError) return error;

  const message = error instanceof Error ? error.message : String(error);
  return new FilesError('Provider', `cloudflare-kv: ${message}`, error);
};

const runKv = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    throw mapKvError(error);
  }
};

const throwIfAborted = (signal?: AbortSignal): void => {
  if (!signal?.aborted) return;
  if (signal.reason instanceof FilesError) throw signal.reason;

  const detail =
    signal.reason instanceof Error
      ? `: ${signal.reason.message}`
      : signal.reason === undefined
        ? ''
        : `: ${String(signal.reason)}`;
  throw new FilesError('Provider', `Operation aborted${detail}`, signal.reason, { aborted: true });
};

const assertValueSize = (size: number): void => {
  if (size > CLOUDFLARE_KV_MAX_VALUE_SIZE) throw valueTooLargeError(size);
};

const collectBoundedStream = async (
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): Promise<Uint8Array> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      throwIfAborted(signal);
      const result = await reader.read();
      if (result.done) break;
      if (!(result.value instanceof Uint8Array)) {
        throw new FilesError(
          'Provider',
          'cloudflare-kv: upload streams must yield Uint8Array chunks',
          undefined,
          { permanent: true },
        );
      }

      size += result.value.byteLength;
      assertValueSize(size);
      chunks.push(result.value);
    }
  } catch (error) {
    try {
      await reader.cancel(error);
    } catch {
      // Preserve the actionable upload/abort error when stream cancellation also fails.
    }
    throw error;
  } finally {
    reader.releaseLock();
  }

  if (chunks.length === 0) return new Uint8Array();
  if (chunks.length === 1) return chunks[0];

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

const inferContentType = (body: Body, override?: string): string => {
  if (override !== undefined) return override;
  if (typeof body === 'string') return TEXT_CONTENT_TYPE;
  if (body instanceof Blob && body.type) return body.type;
  return DEFAULT_CONTENT_TYPE;
};

const prepareBody = async (body: Body, options?: UploadOptions): Promise<PreparedBody> => {
  throwIfAborted(options?.signal);
  const contentType = inferContentType(body, options?.contentType);

  if (typeof body === 'string') {
    const size = textEncoder.encode(body).byteLength;
    assertValueSize(size);
    return { contentType, size, value: body };
  }

  if (body instanceof Uint8Array) {
    assertValueSize(body.byteLength);
    return { contentType, size: body.byteLength, value: body };
  }

  if (body instanceof ArrayBuffer) {
    assertValueSize(body.byteLength);
    return { contentType, size: body.byteLength, value: body };
  }

  if (ArrayBuffer.isView(body)) {
    assertValueSize(body.byteLength);
    return { contentType, size: body.byteLength, value: body };
  }

  if (body instanceof Blob) {
    assertValueSize(body.size);
    return { contentType, size: body.size, value: body.stream() };
  }

  const bytes = await collectBoundedStream(body, options?.signal);
  return { contentType, size: bytes.byteLength, value: bytes };
};

const buildMetadata = (
  size: number,
  contentType: string,
  metadata?: Record<string, string>,
): CloudflareKvMetadata => {
  const envelope: CloudflareKvMetadata = {
    contentType,
    createdAt: Date.now(),
    size,
    ...(metadata && Object.keys(metadata).length > 0 ? { metadata: { ...metadata } } : {}),
  };

  let serialized: string;
  try {
    serialized = JSON.stringify(envelope);
  } catch (error) {
    throw new FilesError('Provider', 'cloudflare-kv: metadata must be JSON serializable', error, {
      permanent: true,
    });
  }

  const metadataSize = textEncoder.encode(serialized).byteLength;
  if (metadataSize > CLOUDFLARE_KV_MAX_METADATA_SIZE) {
    throw new FilesError(
      'Provider',
      `cloudflare-kv: serialized metadata is ${metadataSize} bytes, exceeding Workers KV's 1024-byte limit`,
      undefined,
      { permanent: true },
    );
  }

  return envelope;
};

const storedFileMeta = (key: string, metadata: ParsedMetadata, size: number): StoredFileMeta => ({
  key,
  size,
  type: metadata.contentType,
  ...(metadata.createdAt !== undefined ? { lastModified: metadata.createdAt } : {}),
  ...(metadata.metadata ? { metadata: metadata.metadata } : {}),
});

const readBytes = async (binding: KVNamespace, key: string): Promise<Uint8Array> => {
  const value = await runKv(() => binding.get(key, 'arrayBuffer'));
  if (value === null) throw notFoundError(key);
  return new Uint8Array(value);
};

const lazyBody = (binding: KVNamespace, key: string): BodySource => ({
  factory: () => readBytes(binding, key),
  kind: 'lazy',
});

const validateExpirationTtl = (expirationTtl?: number): void => {
  if (expirationTtl === undefined) return;
  if (Number.isInteger(expirationTtl) && expirationTtl >= CLOUDFLARE_KV_MIN_EXPIRATION_TTL) {
    return;
  }

  throw new FilesError(
    'Provider',
    'cloudflare-kv: expirationTtl must be an integer of at least 60 seconds',
    undefined,
    { permanent: true },
  );
};

/** Create a Files SDK adapter backed by a native Cloudflare Workers KV binding. */
export const cloudflareKv = ({
  binding,
  expirationTtl,
}: CloudflareKvAdapterOptions): CloudflareKvAdapter => {
  validateExpirationTtl(expirationTtl);

  const write = async (
    key: string,
    value: KvWritableValue,
    metadata: CloudflareKvMetadata,
  ): Promise<void> =>
    runKv(() =>
      binding.put(key, value, {
        metadata,
        ...(expirationTtl !== undefined ? { expirationTtl } : {}),
      }),
    );

  return {
    async copy(from, to, options) {
      throwIfAborted(options?.signal);
      if (from === to) return;

      const source = await runKv(() => binding.getWithMetadata(from, 'arrayBuffer'));
      if (source.value === null) throw notFoundError(from);

      const parsed = parseMetadata(source.metadata);
      const bytes = new Uint8Array(source.value);
      const metadata = buildMetadata(bytes.byteLength, parsed.contentType, parsed.metadata);
      throwIfAborted(options?.signal);
      await write(to, bytes, metadata);
    },
    async delete(key, options) {
      throwIfAborted(options?.signal);
      await runKv(() => binding.delete(key));
    },
    async download(key, options) {
      if (options?.range) throw unsupportedError('range downloads');
      throwIfAborted(options?.signal);

      const result = await runKv(() => binding.getWithMetadata(key, { type: 'stream' }));
      if (result.value === null) throw notFoundError(key);

      const stream = result.value;
      const metadata = parseMetadata(result.metadata);
      if (!metadata.current || metadata.size === undefined) {
        // The pre-Files-SDK envelope did not record size. Buffer only this
        // single-key compatibility path so the returned StoredFile stays exact.
        const bytes = await collectBoundedStream(stream, options?.signal);
        return createStoredFile(storedFileMeta(key, metadata, bytes.byteLength), {
          data: bytes,
          kind: 'buffer',
        });
      }

      return createStoredFile(storedFileMeta(key, metadata, metadata.size), {
        factory: () => stream,
        kind: 'stream',
      });
    },
    async exists(key, options) {
      throwIfAborted(options?.signal);
      const stream = await runKv(() => binding.get(key, 'stream'));
      if (stream === null) return false;

      // Workers KV has no metadata-only HEAD primitive. Opening and immediately
      // cancelling a stream avoids buffering the value and, unlike list(), does
      // not introduce a separate eventually-consistent existence check.
      await runKv(() => stream.cancel());
      return true;
    },
    async head(key, options) {
      throwIfAborted(options?.signal);
      const result = await runKv(() => binding.getWithMetadata(key, { type: 'stream' }));
      if (result.value === null) throw notFoundError(key);

      const stream = result.value;
      const metadata = parseMetadata(result.metadata);
      if (!metadata.current || metadata.size === undefined) {
        // Legacy KV metadata has no size; a one-off read is required for an
        // accurate head() result. New entries remain metadata-only here.
        const bytes = await collectBoundedStream(stream, options?.signal);
        return createStoredFile(storedFileMeta(key, metadata, bytes.byteLength), {
          data: bytes,
          kind: 'buffer',
        });
      }

      await runKv(() => stream.cancel());
      return createStoredFile(storedFileMeta(key, metadata, metadata.size), lazyBody(binding, key));
    },
    async list(options) {
      if (options?.delimiter !== undefined) {
        throw unsupportedError('directory-style listing (delimiter)');
      }
      throwIfAborted(options?.signal);

      const result = await runKv(() =>
        binding.list({
          ...(options?.prefix !== undefined ? { prefix: options.prefix } : {}),
          ...(options?.cursor !== undefined ? { cursor: options.cursor } : {}),
          ...(options?.limit !== undefined ? { limit: options.limit } : {}),
        }),
      );

      const items = result.keys.map((listed) => {
        const metadata = parseMetadata(listed.metadata);
        // Legacy entries cannot expose size from KV's list metadata. Returning
        // 0 avoids an N+1 body scan (and the Workers 1,000-operation ceiling);
        // download() and head() still return their exact size.
        const size = metadata.current && metadata.size !== undefined ? metadata.size : 0;
        return createStoredFile(
          storedFileMeta(listed.name, metadata, size),
          lazyBody(binding, listed.name),
        );
      });

      return {
        items,
        ...(!result.list_complete ? { cursor: result.cursor } : {}),
      };
    },
    name: 'cloudflare-kv',
    raw: binding,
    reportsUploadProgress: false,
    signedUrl: { supported: false },
    async signedUploadUrl() {
      throw unsupportedError('signedUploadUrl()');
    },
    supportsCacheControl: false,
    supportsDelimiter: false,
    supportsMetadata: true,
    supportsRange: false,
    supportsServerSideCopy: false,
    async upload(key, body, options) {
      if (options?.cacheControl !== undefined) {
        throw unsupportedError('cacheControl');
      }

      const prepared = await prepareBody(body, options);
      const metadata = buildMetadata(prepared.size, prepared.contentType, options?.metadata);
      throwIfAborted(options?.signal);
      await write(key, prepared.value, metadata);

      return {
        contentType: prepared.contentType,
        key,
        lastModified: metadata.createdAt,
        size: prepared.size,
      };
    },
    async url() {
      throw unsupportedError('url()');
    },
  };
};
