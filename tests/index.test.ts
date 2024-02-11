import { expect, it, beforeAll, afterAll, vi, type MockedFunction } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';
import { deleteOldCache } from '~/crons/deleteOldCache';
import { Env, workerHandler } from '~/index';
import { app } from '~/routes';

const describe = setupMiniflareIsolatedStorage();

vi.mock('~/crons/deleteOldCache', async (importActual) => {
  const actual = await importActual<typeof import('~/crons/deleteOldCache')>();
  return {
    ...actual,
    deleteOldCache: vi.fn(),
  };
});
const deleteOldCacheMock = deleteOldCache as MockedFunction<typeof deleteOldCache>;

describe('remote-cache worker', () => {
  let worker: UnstableDevWorker;
  let workerEnv: Env;
  let ctx: ExecutionContext;

  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      ip: '0.0.0.0',
      experimental: { disableExperimentalWarning: true },
    });
    workerEnv = getMiniflareBindings();
    ctx = new ExecutionContext();
  });

  afterAll(async () => {
    await worker.stop();
  });

  it('Worker should be able to boot successfully', () => {
    expect(worker.address).toBeTruthy();
  });

  it('should respond to the ping route by simulating the worker', async () => {
    const response = await worker.fetch('/ping');
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

  beforeAll(() => {
    workerEnv = getMiniflareBindings();
    ctx = new ExecutionContext();
  });

  it('should call deleteOldCache', async () => {
    // @ts-expect-error - missing properties for the scheduled event
    await workerHandler.scheduled({ scheduledTime: Date.now() }, workerEnv, ctx);
    expect(deleteOldCacheMock).toHaveBeenCalled();
  });
});
