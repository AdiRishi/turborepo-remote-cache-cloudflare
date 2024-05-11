import {
  ListFilterOptions,
  ListResult,
  ListResultWithMetadata,
  Metadata,
  StorageInterface,
  WritableValue,
} from './interface';

export class KvStorage implements StorageInterface {
  private KV_STORE: KVNamespace;
  private EXPIRATION_IN_SECONDS?: number;

  constructor(kvNamespace: KVNamespace, expirationInHours?: number) {
    this.KV_STORE = kvNamespace;
    this.EXPIRATION_IN_SECONDS = expirationInHours ? expirationInHours * 60 * 60 : undefined;
  }

  async listWithMetadata(options?: ListFilterOptions): Promise<ListResultWithMetadata> {
    const result = await this.KV_STORE.list<KvMetadata>(options);
    return {
      keys: result.keys.map((key) => ({
        key: key.name,
        metadata: this.transformMetadata(key.metadata),
      })),
      cursor: result.list_complete ? undefined : result.cursor,
      truncated: result.list_complete !== true,
    };
  }

  async list(options?: ListFilterOptions): Promise<ListResult> {
    const result = await this.KV_STORE.list(options);
    return {
      keys: result.keys.map((key) => key.name),
      cursor: result.list_complete ? undefined : result.cursor,
      truncated: result.list_complete !== true,
    };
  }

  async readWithMetadata(
    key: string
  ): Promise<{ data: ReadableStream | undefined; metadata: Metadata | undefined }> {
    const value = await this.KV_STORE.getWithMetadata<KvMetadata>(key, { type: 'stream' });
    return {
      data: value.value ?? undefined,
      metadata: this.transformMetadata(value.metadata),
    };
  }

  async read(key: string): Promise<ReadableStream | undefined> {
    const result = await this.KV_STORE.get(key, { type: 'stream' });
    return result ?? undefined;
  }

  async write(key: string, data: WritableValue, metadata?: Record<string, string>): Promise<void> {
    await this.KV_STORE.put(key, data, {
      metadata: {
        createdAtEpochMilliseconds: Date.now(),
        customMetadata: metadata,
      },
      expirationTtl: this.EXPIRATION_IN_SECONDS,
    });
  }

  async delete(key: string | string[]): Promise<void> {
    if (Array.isArray(key)) {
      await Promise.allSettled(key.map((k) => this.KV_STORE.delete(k)));
    } else {
      await this.KV_STORE.delete(key);
    }
  }

  private transformMetadata(kvMetadata: KvMetadata | null | undefined): Metadata | undefined {
    if (!kvMetadata) return undefined;
    return {
      staticMetadata: {
        createdAt: new Date(kvMetadata.createdAtEpochMilliseconds),
      },
      customMetadata: kvMetadata.customMetadata ?? {},
    };
  }
}

export type KvMetadata = {
  createdAtEpochMilliseconds: number;
  customMetadata: Record<string, string>;
};
