import { Env } from '..';
import { StorageInterface } from './interface';
import { KvStorage } from './kv-storage';
import { R2Storage } from './r2-storage';

export class StorageManager {
  private r2Storage?: StorageInterface;
  private kvStorage?: StorageInterface;

  private storageToUse: StorageInterface;

  constructor(env: Env) {
    if (env.R2_STORE) {
      this.r2Storage = new R2Storage(env.R2_STORE);
    }
    if (env.KV_STORE) {
      this.kvStorage = new KvStorage(env.KV_STORE, env.BUCKET_OBJECT_EXPIRATION_HOURS);
    }
    if (!this.r2Storage && !this.kvStorage) {
      throw new InvalidStorageError('No storage provided');
    }

    if (this.kvStorage) {
      this.storageToUse = this.kvStorage;
    } else {
      this.storageToUse = this.r2Storage!;
    }
  }

  public getActiveStorage(): StorageInterface {
    return this.storageToUse;
  }

  public static async readableStreamToText(stream: ReadableStream): Promise<string> {
    return await new Response(stream).text();
  }
  public static async readableStreamToBuffer(stream: ReadableStream): Promise<ArrayBuffer> {
    return await new Response(stream).arrayBuffer();
  }
}

export class InvalidStorageError extends Error {
  constructor(message: string) {
    super(message);
  }
}
