import { Files, type Adapter } from 'files-sdk';
import { r2 } from 'files-sdk/r2';
import { s3 } from 'files-sdk/s3';

import customStorageFactory from '../../storage.config';
import {
  getBoolean,
  getCacheRetentionHours,
  getExpirationTtl,
  getString,
  requireString,
  RuntimeConfigurationError,
  type RuntimeEnv,
} from '../runtime/env';
import { cloudflareKv } from './cloudflare-kv';

export const STORAGE_PROVIDERS = ['r2', 'kv', 's3', 'custom'] as const;
export type StorageProvider = (typeof STORAGE_PROVIDERS)[number];

export interface StorageServices {
  files: Files;
  provider: StorageProvider;
  retentionHours: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const hasMethods = (value: unknown, methods: string[]): boolean =>
  isRecord(value) && methods.every((method) => typeof value[method] === 'function');

const getR2Binding = (env: RuntimeEnv): R2Bucket | undefined => {
  const binding = env.R2_STORE;
  return hasMethods(binding, ['get', 'put', 'head', 'list', 'delete']) ? binding : undefined;
};

const getKvBinding = (env: RuntimeEnv): KVNamespace | undefined => {
  const binding = env.KV_STORE;
  return hasMethods(binding, ['get', 'getWithMetadata', 'put', 'list', 'delete'])
    ? binding
    : undefined;
};

const isStorageProvider = (value: string): value is StorageProvider =>
  STORAGE_PROVIDERS.some((provider) => provider === value);

export const resolveStorageProvider = (env: RuntimeEnv): StorageProvider => {
  const configured = getString(env, 'STORAGE_PROVIDER')?.toLowerCase();
  if (configured) {
    if (!isStorageProvider(configured)) {
      throw new RuntimeConfigurationError(
        `STORAGE_PROVIDER must be one of: ${STORAGE_PROVIDERS.join(', ')}`,
      );
    }
    return configured;
  }

  // Preserve the legacy selection order: KV wins when both bindings exist.
  if (getKvBinding(env)) return 'kv';
  if (getR2Binding(env)) return 'r2';
  if (getString(env, 'S3_BUCKET')) return 's3';
  if (getString(env, 'R2_BUCKET')) return 'r2';

  throw new RuntimeConfigurationError(
    'No storage provider is configured. Set STORAGE_PROVIDER or configure an R2_STORE/KV_STORE binding.',
  );
};

const createR2Adapter = (env: RuntimeEnv): Adapter => {
  const binding = getR2Binding(env);
  if (binding) {
    return r2({
      binding,
      bucket: getString(env, 'R2_BUCKET'),
    });
  }

  return r2({
    accountId: requireString(env, 'R2_ACCOUNT_ID'),
    accessKeyId: requireString(env, 'R2_ACCESS_KEY_ID'),
    bucket: requireString(env, 'R2_BUCKET'),
    secretAccessKey: requireString(env, 'R2_SECRET_ACCESS_KEY'),
  });
};

const createS3Adapter = (env: RuntimeEnv): Adapter => {
  const accessKeyId = getString(env, 'AWS_ACCESS_KEY_ID');
  const secretAccessKey = getString(env, 'AWS_SECRET_ACCESS_KEY');

  if ((accessKeyId && !secretAccessKey) || (!accessKeyId && secretAccessKey)) {
    throw new RuntimeConfigurationError(
      'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be configured together',
    );
  }

  return s3({
    bucket: requireString(env, 'S3_BUCKET'),
    credentials:
      accessKeyId && secretAccessKey
        ? {
            accessKeyId,
            secretAccessKey,
            sessionToken: getString(env, 'AWS_SESSION_TOKEN'),
          }
        : undefined,
    endpoint: getString(env, 'S3_ENDPOINT'),
    forcePathStyle: getBoolean(env, 'S3_FORCE_PATH_STYLE'),
    region: getString(env, 'AWS_REGION'),
  });
};

const createAdapter = async (
  provider: StorageProvider,
  env: RuntimeEnv,
  retentionHours: number,
): Promise<Adapter> => {
  if (provider === 'r2') return createR2Adapter(env);
  if (provider === 's3') return createS3Adapter(env);
  if (provider === 'kv') {
    const binding = getKvBinding(env);
    if (!binding) {
      throw new RuntimeConfigurationError(
        'STORAGE_PROVIDER=kv requires a Cloudflare KV_STORE binding',
      );
    }
    return cloudflareKv({
      binding,
      expirationTtl: getExpirationTtl(retentionHours),
    });
  }

  const adapter = await customStorageFactory({
    env,
    getEnv: (name) => getString(env, name),
    retentionHours,
  });
  if (!adapter) {
    throw new RuntimeConfigurationError(
      'STORAGE_PROVIDER=custom requires storage.config.ts to return a Files SDK adapter',
    );
  }
  return adapter;
};

export const createStorageServices = async (env: RuntimeEnv): Promise<StorageServices> => {
  const provider = resolveStorageProvider(env);
  const retentionHours = getCacheRetentionHours(env);
  const adapter = await createAdapter(provider, env, retentionHours);
  return {
    files: new Files({
      adapter,
      prefix: getString(env, 'STORAGE_PREFIX'),
    }),
    provider,
    retentionHours,
  };
};
