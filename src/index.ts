import { deleteOldCache } from './crons/deleteOldCache';
import { app } from './routes';
import { StorageManager } from './storage';

export type Env = {
  ENVIRONMENT: 'development' | 'production';
  STORAGE_BACKEND?: 'r2' | 'kv' | 's3';
  R2_STORE?: R2Bucket;
  KV_STORE?: KVNamespace;
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  TURBO_TOKEN: string;
  BUCKET_OBJECT_EXPIRATION_HOURS: number;
  STORAGE_MANAGER: StorageManager;
};

export const workerHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const storageManager = new StorageManager(env);
      env.STORAGE_MANAGER = storageManager;
      return app.fetch(request, env, ctx);
    } catch (e: unknown) {
      return new Response(`Storage options not configured correctly: ${String(e)}`, {
        status: 500,
      });
    }
  },
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    const storageManager = new StorageManager(env);
    env.STORAGE_MANAGER = storageManager;
    await deleteOldCache(env);
  },
};

export default workerHandler;
