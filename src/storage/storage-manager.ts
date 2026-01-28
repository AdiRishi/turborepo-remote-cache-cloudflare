import { Env } from '..';
import { StorageInterface } from './interface';
import { KvStorage } from './kv-storage';
import { R2Storage } from './r2-storage';
import { S3Storage } from './s3-storage';
import { S3mini } from 's3mini';

export class StorageManager {
  private activeStorage: StorageInterface;

  constructor(env: Env) {
    // Priority: KV > R2 > S3
    const storage = this.initializeStorage(env);
    if (!storage) {
      throw new InvalidStorageError('No storage provided');
    }
    this.activeStorage = storage;
  }

  private initializeStorage(env: Env): StorageInterface | undefined {
    if (env.KV_STORE) {
      return new KvStorage(env.KV_STORE, env.BUCKET_OBJECT_EXPIRATION_HOURS);
    }
    if (env.R2_STORE) {
      return new R2Storage(env.R2_STORE);
    }
    if (env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY && env.S3_ENDPOINT) {
      const s3Client = new S3mini({
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION ?? 'auto',
      });
      return new S3Storage(s3Client);
    }
    return undefined;
  }

  public getActiveStorage(): StorageInterface {
    return this.activeStorage;
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
