import { app } from './routes';

export type Env = {
  ENVIRONMENT: 'development' | 'production';
  R2_STORE: R2Bucket;
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },
};
