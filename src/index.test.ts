import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';
import { expect, it, beforeAll, afterAll } from 'vitest';
import { app } from './routes';
import { Env } from '.';

const describe = setupMiniflareIsolatedStorage();

describe('remote-cache worker', () => {
  let worker: UnstableDevWorker;
  let workerEnv: Env;
  let ctx: ExecutionContext;

  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
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
});
