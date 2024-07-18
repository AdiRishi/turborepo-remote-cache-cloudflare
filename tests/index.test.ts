import '../src';
import { env, createExecutionContext } from 'cloudflare:test';
import { SELF } from 'cloudflare:test';
import { expect, it, describe, vi, type MockedFunction, beforeEach } from 'vitest';
import { deleteOldCache } from '~/crons/deleteOldCache';
import { Env, workerHandler } from '~/index';
import { app } from '~/routes';

vi.mock('~/crons/deleteOldCache', async (importActual) => {
  const actual = await importActual<typeof import('~/crons/deleteOldCache')>();
  return {
    ...actual,
    deleteOldCache: vi.fn(),
  };
});
const deleteOldCacheMock = deleteOldCache as MockedFunction<typeof deleteOldCache>;

describe('remote-cache worker', () => {
  let workerEnv: Env;
  let ctx: ExecutionContext;

  beforeEach(() => {
    workerEnv = env;
    ctx = createExecutionContext();
  });

  it('should respond to the ping route by simulating the worker', async () => {
    const response = await SELF.fetch('https://iso-util.com/ping');
    expect(response).toBeTruthy();
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe('pong');
  });

  it('should respond to the ping route via invoking the app', async () => {
    const request = new Request('http://localhost/ping');
    const res = await app.fetch(request, workerEnv, ctx);
    expect(await res.text()).toBe('pong');
  });

  it('should respond to the throw-exception route via invoking the app', async () => {
    const request = new Request('http://localhost/throw-exception');
    const res = await app.fetch(request, workerEnv, ctx);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: 'Expected error',
    });
  });

  it('should throw a 500 error when the storage manager is not configured correctly', async () => {
    const badEnv = { ...workerEnv, R2_STORE: undefined, KV_STORE: undefined };
    const res = await workerHandler.fetch(new Request('http://localhost/ping'), badEnv, ctx);
    expect(res.status).toBe(500);
    expect((await res.text()).includes('Storage options not configured correctly')).toBe(true);
  });
});

describe('remote-cache scheduled event', () => {
  let workerEnv: Env;
  let ctx: ExecutionContext;

  beforeEach(() => {
    workerEnv = env;
    ctx = createExecutionContext();
  });

  it('should call deleteOldCache', async () => {
    // @ts-expect-error - missing properties for the scheduled event
    await workerHandler.scheduled({ scheduledTime: Date.now() }, workerEnv, ctx);
    expect(deleteOldCacheMock).toHaveBeenCalled();
  });
});
