import { Env } from '..';
import { StorageInterface } from './interface';
import { KvStorage } from './kv-storage';
import { R2Storage } from './r2-storage';
import { S3Storage } from './s3-storage';

type StorageBackend = 'r2' | 'kv' | 's3';

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

    const selectedStorageBackend = this.getSelectedStorageBackend(env.STORAGE_BACKEND);
    if (selectedStorageBackend) {
      if (selectedStorageBackend === 's3') {
        this.s3Storage = this.createS3StorageIfConfigured(env);
      }
      this.storageToUse = this.getStorageByBackend(selectedStorageBackend);
      return;
    }

    if (this.r2Storage) {
      this.storageToUse = this.r2Storage;
      return;
    }
    if (this.kvStorage) {
      this.storageToUse = this.kvStorage;
      return;
    }

    this.s3Storage = this.createS3StorageIfConfigured(env);
    if (this.s3Storage) {
      this.storageToUse = this.s3Storage;
      return;
    }
    throw new InvalidStorageError('No storage provided');
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

  private createS3StorageIfConfigured(env: Env): StorageInterface | undefined {
    const isAnyS3ValueConfigured =
      env.S3_ENDPOINT !== undefined ||
      env.S3_REGION !== undefined ||
      env.AWS_ACCESS_KEY_ID !== undefined ||
      env.AWS_SECRET_ACCESS_KEY !== undefined;
    if (!isAnyS3ValueConfigured) {
      return undefined;
    }
    return new S3Storage({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    });
  }

  private getSelectedStorageBackend(
    selectedBackend: Env['STORAGE_BACKEND']
  ): StorageBackend | undefined {
    if (!selectedBackend) {
      return undefined;
    }
    const normalizedBackend = selectedBackend.toLowerCase() as Lowercase<typeof selectedBackend>;
    if (!['r2', 'kv', 's3'].includes(normalizedBackend)) {
      throw new InvalidStorageError(
        `Invalid STORAGE_BACKEND value "${selectedBackend}". Supported values are "r2", "kv", and "s3".`
      );
    }
    return normalizedBackend;
  }

  private getStorageByBackend(storageBackend: StorageBackend): StorageInterface {
    if (storageBackend === 'r2') {
      if (!this.r2Storage) {
        throw new InvalidStorageError(
          this.createUnavailableStorageBackendErrorMessage(storageBackend)
        );
      }
      return this.r2Storage;
    }
    if (storageBackend === 'kv') {
      if (!this.kvStorage) {
        throw new InvalidStorageError(
          this.createUnavailableStorageBackendErrorMessage(storageBackend)
        );
      }
      return this.kvStorage;
    }
    if (!this.s3Storage) {
      throw new InvalidStorageError(
        this.createUnavailableStorageBackendErrorMessage(storageBackend)
      );
    }
    return this.s3Storage;
  }

  private createUnavailableStorageBackendErrorMessage(storageBackend: StorageBackend): string {
    const configuredBackends: StorageBackend[] = [];
    if (this.r2Storage) configuredBackends.push('r2');
    if (this.kvStorage) configuredBackends.push('kv');
    if (this.s3Storage) configuredBackends.push('s3');
    if (configuredBackends.length === 0) {
      return `STORAGE_BACKEND is set to "${storageBackend}" but no storage backends are configured.`;
    }
    return `STORAGE_BACKEND is set to "${storageBackend}" but this backend is not configured. Configured backends: ${configuredBackends.join(', ')}.`;
  }
}

export class InvalidStorageError extends Error {
  constructor(message: string) {
    super(message);
  }
}
