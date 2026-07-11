import type { Adapter } from 'files-sdk';

import type { RuntimeEnv } from '../runtime/env';

export interface CustomStorageContext {
  env: RuntimeEnv;
  getEnv: (name: string) => string | undefined;
  retentionHours: number;
}

export type CustomStorageFactory = (
  context: CustomStorageContext,
) => Adapter | undefined | Promise<Adapter | undefined>;

export const defineStorageConfig = (factory: CustomStorageFactory): CustomStorageFactory => factory;
