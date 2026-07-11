export interface RuntimeEnv {
  [name: string]: unknown;
  AWS_ACCESS_KEY_ID?: string;
  AWS_REGION?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_SESSION_TOKEN?: string;
  BUCKET_OBJECT_EXPIRATION_HOURS?: number | string;
  CACHE_RETENTION_HOURS?: number | string;
  KV_STORE?: KVNamespace;
  R2_ACCESS_KEY_ID?: string;
  R2_ACCOUNT_ID?: string;
  R2_BUCKET?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_STORE?: R2Bucket;
  S3_BUCKET?: string;
  S3_ENDPOINT?: string;
  S3_FORCE_PATH_STYLE?: boolean | string;
  STORAGE_PREFIX?: string;
  STORAGE_PROVIDER?: string;
  TURBO_TOKEN?: string;
}

export const DEFAULT_CACHE_RETENTION_HOURS = 720;

export class RuntimeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuntimeConfigurationError';
  }
}

export const getString = (env: RuntimeEnv, name: string): string | undefined => {
  const value = env[name];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export const requireString = (env: RuntimeEnv, name: string): string => {
  const value = getString(env, name);
  if (!value) {
    throw new RuntimeConfigurationError(`${name} must be configured`);
  }
  return value;
};

export const getBoolean = (env: RuntimeEnv, name: string): boolean | undefined => {
  const value = env[name];
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  throw new RuntimeConfigurationError(`${name} must be either true or false`);
};

export const getCacheRetentionHours = (env: RuntimeEnv): number => {
  const value = env.CACHE_RETENTION_HOURS ?? env.BUCKET_OBJECT_EXPIRATION_HOURS;
  if (value === undefined || value === '') return DEFAULT_CACHE_RETENTION_HOURS;

  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0) {
    throw new RuntimeConfigurationError('CACHE_RETENTION_HOURS must be a non-negative number');
  }
  return hours;
};

export const getExpirationTtl = (retentionHours: number): number | undefined => {
  if (retentionHours === 0) return undefined;
  return Math.max(60, Math.floor(retentionHours * 60 * 60));
};

export const getProcessEnv = (): RuntimeEnv => ({ ...process.env });
