import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';
import { expect, it, beforeAll, afterAll } from 'vitest';
import { app } from './routes';

const describe = setupMiniflareIsolatedStorage();

describe('rest-api worker', () => {
  let worker: UnstableDevWorker;

  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
    });
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
    const res = await app.request('/ping');
    expect(await res.text()).toBe('pong');
  });
});
