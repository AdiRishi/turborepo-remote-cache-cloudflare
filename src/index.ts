import { deleteOldCache } from './crons/deleteOldCache';
import { app } from './routes';
import { StorageManager } from './storage';
import { S3Client } from './storage/s3-storage';
import { S3mini } from 's3mini';

export type Env = {
  ENVIRONMENT: 'development' | 'production';
  R2_STORE?: R2Bucket;
  KV_STORE?: KVNamespace;
  TURBO_TOKEN: string;
  BUCKET_OBJECT_EXPIRATION_HOURS: number;
  STORAGE_MANAGER: StorageManager;
  // S3 configuration
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_ENDPOINT?: string;
  S3_REGION?: string;
};

function createS3Client(env: Env): S3Client | undefined {
  if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY || !env.S3_ENDPOINT) {
    return undefined;
  }
  return new S3mini({
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION ?? 'auto',
  });
}

export const workerHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const s3Client = createS3Client(env);
      const storageManager = new StorageManager(env, s3Client);
      env.STORAGE_MANAGER = storageManager;
      return app.fetch(request, env, ctx);
    } catch (e: unknown) {
      return new Response(`Storage options not configured correctly: ${String(e)}`, {
        status: 500,
      });
    }
  },
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    const s3Client = createS3Client(env);
    const storageManager = new StorageManager(env, s3Client);
    env.STORAGE_MANAGER = storageManager;
    await deleteOldCache(env);
  },
};

export default workerHandler;
