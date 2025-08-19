import { Env } from '..';
import { StorageInterface } from './interface';
import { KvStorage } from './kv-storage';
import { R2Storage } from './r2-storage';
import { S3Storage } from './s3-storage';

export class StorageManager {
  private r2Storage?: StorageInterface;
  private kvStorage?: StorageInterface;
  private s3Storage?: StorageInterface;

  private storageToUse: StorageInterface;

  constructor(env: Env) {
    if (env.R2_STORE) {
      this.r2Storage = new R2Storage(env.R2_STORE);
    }
    if (env.KV_STORE) {
      this.kvStorage = new KvStorage(env.KV_STORE, env.BUCKET_OBJECT_EXPIRATION_HOURS);
    }
    if (
      env.AWS_ACCESS_KEY_ID &&
      env.AWS_SECRET_ACCESS_KEY &&
      env.AWS_REGION &&
      env.S3_BUCKET
    ) {
      this.s3Storage = new S3Storage({
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        region: env.AWS_REGION,
        bucket: env.S3_BUCKET,
        endpoint: env.S3_ENDPOINT,
        maxRetries: 3,
      });
    }
    if (!this.r2Storage && !this.kvStorage && !this.s3Storage) {
      throw new InvalidStorageError('No storage provided');
    }

    if (this.kvStorage) {
      this.storageToUse = this.kvStorage;
    } else if (this.r2Storage) {
      this.storageToUse = this.r2Storage;
    } else {
      this.storageToUse = this.s3Storage!;
    }
  }

  public getActiveStorage(): StorageInterface {
    return this.storageToUse;
  }

  public static async readableStreamToText(stream: ReadableStream): Promise<string> {
    return await new Response(stream).text();
  }
  public static async readableStreamToBuffer(
    stream: ReadableStream
  ): Promise<ArrayBuffer | ArrayBufferView> {
    return await new Response(stream).arrayBuffer();
  }
  public static textToReadableStream(text: string): ReadableStream {
    return new Response(text).body!;
  }
}

export class InvalidStorageError extends Error {
  constructor(message: string) {
    super(message);
  }
}
