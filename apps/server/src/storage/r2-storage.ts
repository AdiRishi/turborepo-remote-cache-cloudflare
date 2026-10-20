import { StorageInterface, ListFilterOptions, Metadata, WritableValue } from './interface';

export class R2Storage implements StorageInterface {
  private R2_STORE: R2Bucket;

  constructor(r2Bucket: R2Bucket) {
    this.R2_STORE = r2Bucket;
  }

  async listWithMetadata(options?: ListFilterOptions) {
    const listResult = await this.R2_STORE.list({
      limit: options?.limit,
      cursor: options?.cursor,
      prefix: options?.prefix,
      include: ['customMetadata'],
    });

    return {
      keys: listResult.objects.map((object) => ({
        key: object.key,
        metadata: this.transformMetadata(object),
      })),
      cursor: listResult.truncated ? listResult.cursor : undefined,
      truncated: listResult.truncated,
    };
  }
  async list(options?: ListFilterOptions) {
    const listResult = await this.R2_STORE.list({
      limit: options?.limit,
      cursor: options?.cursor,
      prefix: options?.prefix,
    });

    return {
      keys: listResult.objects.map((object) => object.key),
      cursor: listResult.truncated ? listResult.cursor : undefined,
      truncated: listResult.truncated,
    };
  }
  async readWithMetadata(key: string) {
    const r2Object = await this.R2_STORE.get(key);
    if (!r2Object) return { data: undefined, metadata: undefined };
    return { data: r2Object?.body, metadata: this.transformMetadata(r2Object) };
  }
  async read(key: string) {
    const r2Object = await this.R2_STORE.get(key);
    return r2Object?.body;
  }
  async write(key: string, data: WritableValue, metadata?: Record<string, string>) {
    await this.R2_STORE.put(key, data, {
      customMetadata: {
        ...metadata,
      },
    });
  }
  async delete(key: string | string[]) {
    await this.R2_STORE.delete(key);
  }

  private transformMetadata(r2Object: R2Object): Metadata {
    return {
      staticMetadata: {
        createdAt: r2Object.uploaded,
      },
      customMetadata: r2Object.customMetadata ?? {},
    };
  }
}
