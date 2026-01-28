import { deleteOldCache } from './crons/deleteOldCache';
import { app } from './routes';
import { StorageManager } from './storage';

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

export const workerHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      env.STORAGE_MANAGER = new StorageManager(env);
      return app.fetch(request, env, ctx);
    } catch (e: unknown) {
      return new Response(`Storage options not configured correctly: ${String(e)}`, {
        status: 500,
      });
    }
  },
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    env.STORAGE_MANAGER = new StorageManager(env);
    await deleteOldCache(env);
  },
};

export default workerHandler;
