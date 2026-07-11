import type { AppBindings, WaitUntil } from './app-env';

import { app } from '../routes';
import { createStorageServices } from '../storage/files-storage';
import { requireString, type RuntimeEnv } from './env';

const detachedWaitUntil: WaitUntil = (promise) => {
  void promise.catch((error: unknown) => {
    console.error(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        message: 'Background operation failed',
      }),
    );
  });
};

export const createAppBindings = async (
  runtimeEnv: RuntimeEnv,
  waitUntil: WaitUntil = detachedWaitUntil,
): Promise<AppBindings> => {
  const storage = await createStorageServices(runtimeEnv);
  return {
    ...runtimeEnv,
    CACHE_RETENTION_HOURS: storage.retentionHours,
    FILES: storage.files,
    STORAGE_PROVIDER_RESOLVED: storage.provider,
    TURBO_TOKEN: requireString(runtimeEnv, 'TURBO_TOKEN'),
    WAIT_UNTIL: waitUntil,
  };
};

export const handleRequest = async (
  request: Request,
  runtimeEnv: RuntimeEnv,
  waitUntil?: WaitUntil,
): Promise<Response> => {
  let bindings: AppBindings;
  try {
    bindings = await createAppBindings(runtimeEnv, waitUntil);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({
        error: message,
        message: 'Runtime configuration failed',
        path: new URL(request.url).pathname,
      }),
    );
    return new Response(`Storage options not configured correctly: ${message}`, {
      status: 500,
    });
  }

  return app.fetch(request, bindings);
};
