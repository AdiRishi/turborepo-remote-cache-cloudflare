import { deleteOldCache } from './crons/deleteOldCache';
import { app } from './routes';

export type Env = {
  ENVIRONMENT: 'development' | 'production';
  R2_STORE: R2Bucket;
  REQUIRE_AUTH: boolean;
  TURBO_TOKEN: string;
  BUCKET_OBJECT_EXPIRATION_HOURS: number;
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    await deleteOldCache(env);
  },
};
