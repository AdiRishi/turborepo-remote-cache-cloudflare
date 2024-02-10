import { Env } from '..';
import { StorageInterface } from './interface';
import { R2Storage } from './r2-storage';

export class StorageManager {
  private r2Storage?: StorageInterface;
  private kvStorage?: StorageInterface;

  storageToUse: StorageInterface;

  constructor(env: Env) {
    if (env.R2_STORE) {
      this.r2Storage = new R2Storage(env.R2_STORE);
    }
    if (!env.R2_STORE) {
      throw new InvalidStorageError('No storage provided');
    }

    this.storageToUse = this.r2Storage!;
  }

  public getActiveStorage(): StorageInterface {
    return this.storageToUse;
  }

  public async readableStreamToText(stream: ReadableStream): Promise<string> {
    // Seems like a hacky but simple way to convert a ReadableStream to a string
    return await new Response(stream).text();
  }
}

export class InvalidStorageError extends Error {
  constructor(message: string) {
    super(message);
  }
}
