import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Env } from '~/index';

import { deleteOldCache } from '~/crons/deleteOldCache';
import worker, { workerHandler } from '~/index';
import { app } from '~/routes';

import { createTestAppContext } from './helpers/app';

vi.mock('~/crons/deleteOldCache', async (importActual) => {
  const actual = await importActual<typeof import('~/crons/deleteOldCache')>();
  return {
    ...actual,
    deleteOldCache: vi.fn<typeof actual.deleteOldCache>(),
  };
});

const deleteOldCacheMock = vi.mocked(deleteOldCache);
const workerEnv: Env = {
  CACHE_RETENTION_HOURS: env.CACHE_RETENTION_HOURS,
  R2_STORE: env.R2_STORE,
  STORAGE_PROVIDER: env.STORAGE_PROVIDER,
  TURBO_TOKEN: env.TURBO_TOKEN,
};

class TestScheduledEvent extends Event {
  readonly cron = '0 3 * * *';
  readonly scheduledTime = Date.now();

  constructor() {
    super('scheduled');
  }

  noRetry(): void {}

  waitUntil(_promise: Promise<unknown>): void {}
}

describe('remote-cache worker', () => {
  beforeEach(() => {
    deleteOldCacheMock.mockReset().mockResolvedValue({ deleted: 0, skipped: 0 });
  });

  it('responds to ping through the compatibility worker handler', async () => {
    const response = await workerHandler.fetch(
      new Request('https://turborepo-remote-cache.com/ping'),
      workerEnv,
      createExecutionContext(),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('pong');
  });

  it('responds through the generated Cloudflare environment boundary', async () => {
    const response = await worker.fetch(
      new Request('https://turborepo-remote-cache.com/ping'),
      env,
      createExecutionContext(),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('pong');
  });

  it('responds to ping through the Hono app', async () => {
    const { bindings } = createTestAppContext();
    const response = await app.fetch(new Request('http://localhost/ping'), bindings);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('pong');
  });

  it('maps an unhandled route exception to a JSON 500 response', async () => {
    const { bindings } = createTestAppContext();
    const response = await app.fetch(new Request('http://localhost/throw-exception'), bindings);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Expected error' });
  });

  it('returns a useful 500 when no storage provider is configured', async () => {
    const badEnv: Env = {
      TURBO_TOKEN: 'test-token',
    };
    const response = await workerHandler.fetch(
      new Request('http://localhost/ping'),
      badEnv,
      createExecutionContext(),
    );

    expect(response.status).toBe(500);
    expect(await response.text()).toContain('Storage options not configured correctly');
  });
});

describe('remote-cache scheduled event', () => {
  beforeEach(() => {
    deleteOldCacheMock.mockReset().mockResolvedValue({ deleted: 0, skipped: 0 });
  });

  it('runs retention with the configured storage and default retention window', async () => {
    const ctx = createExecutionContext();

    workerHandler.scheduled(new TestScheduledEvent(), workerEnv, ctx);
    await waitOnExecutionContext(ctx);

    expect(deleteOldCacheMock).toHaveBeenCalledOnce();
    expect(deleteOldCacheMock).toHaveBeenCalledWith(expect.anything(), 720);
  });

  it('logs and rethrows retention failures', async () => {
    const error = new Error('retention failed');
    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    deleteOldCacheMock.mockRejectedValueOnce(error);

    try {
      const ctx = createExecutionContext();
      workerHandler.scheduled(new TestScheduledEvent(), workerEnv, ctx);

      await expect(waitOnExecutionContext(ctx)).rejects.toBe(error);
      expect(consoleErrorMock).toHaveBeenCalledWith(
        JSON.stringify({
          message: 'Failed to delete expired cache entries',
          error: 'retention failed',
        }),
      );
    } finally {
      consoleErrorMock.mockRestore();
    }
  });
});
