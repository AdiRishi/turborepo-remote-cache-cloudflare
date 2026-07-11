import type { Files } from 'files-sdk';

import type { StorageProvider } from '../storage/files-storage';
import type { RuntimeEnv } from './env';

export type WaitUntil = (promise: Promise<unknown>) => void;

export interface AppBindings extends RuntimeEnv {
  CACHE_RETENTION_HOURS: number;
  FILES: Files;
  STORAGE_PROVIDER_RESOLVED: StorageProvider;
  TURBO_TOKEN: string;
  WAIT_UNTIL: WaitUntil;
}
