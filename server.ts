import { handleRequest } from '~/runtime/handler';
import { resolveRequestRuntime } from '~/runtime/nitro';

export default {
  fetch(request: Request): Promise<Response> {
    const { runtimeEnv, waitUntil } = resolveRequestRuntime(request);
    return handleRequest(request, runtimeEnv, waitUntil);
  },
};
