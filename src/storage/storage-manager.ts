import { Env } from '..';
import { StorageInterface } from './interface';
import { R2Storage } from './r2-storage';

export class StorageManager {
  r2Storage?: StorageInterface;
  kvStorage?: StorageInterface;

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

  getActiveStorage(): StorageInterface {
    return this.storageToUse;
  }
}

export class InvalidStorageError extends Error {
  constructor(message: string) {
    super(message);
  }
}
