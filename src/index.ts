import type { RuntimeEnv } from './runtime/env';

import { handleRequest } from './runtime/handler';
import { runDeleteExpired } from './runtime/retention';

export type Env = RuntimeEnv;
export { handleRequest, runDeleteExpired };

// Kept as a source-level compatibility entrypoint for existing integrations
// and Worker-pool tests. Production deployment is built through Nitro.
export const workerHandler = {
  fetch(request: Request, env: RuntimeEnv, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env, (promise) => ctx.waitUntil(promise));
  },
  scheduled(
    _event: ScheduledController | ScheduledEvent,
    env: RuntimeEnv,
    ctx: ExecutionContext,
  ): void {
    ctx.waitUntil(runDeleteExpired(env));
  },
};

export default {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    return workerHandler.fetch(request, { ...env }, ctx);
  },
  scheduled(event: ScheduledController, env: Cloudflare.Env, ctx: ExecutionContext) {
    return workerHandler.scheduled(event, { ...env }, ctx);
  },
} satisfies ExportedHandler<Cloudflare.Env>;
