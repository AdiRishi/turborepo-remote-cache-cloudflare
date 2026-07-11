import type { ServerRequest, TaskContext } from 'nitro/types';

import { getProcessEnv, type RuntimeEnv } from './env';

export type WaitUntil = (promise: Promise<unknown>) => void;

type CloudflareTaskContext = TaskContext & {
  cloudflare: {
    env: RuntimeEnv;
  };
};

const isObject = (value: unknown): value is object => typeof value === 'object' && value !== null;

const isRuntimeEnv = (value: unknown): value is RuntimeEnv => isObject(value);

const hasCloudflareTaskContext = (context: TaskContext): context is CloudflareTaskContext => {
  if (!('cloudflare' in context) || !isObject(context.cloudflare)) return false;
  return 'env' in context.cloudflare && isRuntimeEnv(context.cloudflare.env);
};

export const resolveRequestRuntime = (
  request: Request,
): { runtimeEnv: RuntimeEnv; waitUntil?: WaitUntil } => {
  const serverRequest = request as ServerRequest;
  const cloudflare = serverRequest.runtime?.cloudflare;
  const runtimeEnv = isRuntimeEnv(cloudflare?.env) ? cloudflare.env : getProcessEnv();

  if (cloudflare?.context) {
    return {
      runtimeEnv,
      waitUntil: (promise) => cloudflare.context.waitUntil(promise),
    };
  }

  if (serverRequest.waitUntil) {
    return {
      runtimeEnv,
      waitUntil: (promise) => {
        void serverRequest.waitUntil?.(promise);
      },
    };
  }

  return { runtimeEnv };
};

export const resolveTaskRuntimeEnv = (context: TaskContext): RuntimeEnv =>
  hasCloudflareTaskContext(context) ? context.cloudflare.env : getProcessEnv();
