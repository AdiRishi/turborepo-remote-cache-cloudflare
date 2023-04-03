import { app } from './routes';

export type Env = {
  ENVIRONMENT: 'development' | 'production';
  R2_STORE: R2Bucket;
  REQUIRE_AUTH: boolean;
  AUTH_SECRET: string;
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },
};
