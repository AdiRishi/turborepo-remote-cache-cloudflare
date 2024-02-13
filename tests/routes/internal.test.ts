import { MockedFunction, afterEach, beforeEach, expect, test, vi } from 'vitest';
import { deleteOldCache } from '~/crons/deleteOldCache';
import { Env, workerHandler } from '~/index';

vi.mock('~/crons/deleteOldCache', async (importActual) => {
  const actual = await importActual<typeof import('~/crons/deleteOldCache')>();
  return {
    ...actual,
    deleteOldCache: vi.fn(),
  };
});
const deleteOldCacheMock = deleteOldCache as MockedFunction<typeof deleteOldCache>;

const describe = setupMiniflareIsolatedStorage();

describe('/internal Routes', () => {
  let workerEnv: Env;
  let ctx: ExecutionContext;
  const app = workerHandler;

  describe('/internal/delete-old-cache route', () => {
    beforeEach(() => {
      workerEnv = getMiniflareBindings();
      ctx = new ExecutionContext();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('should invoke the deleteOldCache method', async () => {
      const request = new Request('http://localhost/internal/delete-expired-objects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${workerEnv.TURBO_TOKEN}`,
        },
        body: JSON.stringify({}),
      });
      const response = await app.fetch(request, workerEnv, ctx);
      expect(response.status).toBe(200);
      expect(deleteOldCacheMock).toHaveBeenCalledOnce();
    });

    test('should pass through custom expiration hours to deleteOldCache', async () => {
      const request = new Request('http://localhost/internal/delete-expired-objects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${workerEnv.TURBO_TOKEN}`,
        },
        body: JSON.stringify({ expireInHours: 100 }),
      });
      const response = await app.fetch(request, workerEnv, ctx);
      expect(response.status).toBe(200);
      expect(deleteOldCacheMock).toHaveBeenCalledWith({
        ...workerEnv,
        BUCKET_OBJECT_EXPIRATION_HOURS: 100,
      });
    });

    test('should return 401 if no auth token is provided', async () => {
      const request = new Request('http://localhost/internal/delete-expired-objects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const response = await app.fetch(request, workerEnv, ctx);
      expect(response.status).toBe(401);
      expect(deleteOldCacheMock).not.toHaveBeenCalled();
    });
  });

  describe('/internal/populate-random-objects route', () => {
    beforeEach(() => {
      workerEnv = getMiniflareBindings();
      ctx = new ExecutionContext();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('should successfully add random objects to R2', async () => {
      const request = new Request('http://localhost/internal/populate-random-objects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${workerEnv.TURBO_TOKEN}`,
        },
        body: JSON.stringify({ count: 10 }),
      });
      const response = await app.fetch(request, workerEnv, ctx);
      expect(response.status).toBe(200);

      const list = await workerEnv.STORAGE_MANAGER.getActiveStorage().list();
      expect(list.keys.length).toBe(10);
    });

    test('should return 401 if no auth token is provided', async () => {
      const request = new Request('http://localhost/internal/populate-random-objects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ count: 10 }),
      });
      const response = await app.fetch(request, workerEnv, ctx);
      expect(response.status).toBe(401);
      const list = await workerEnv.STORAGE_MANAGER.getActiveStorage().list();
      expect(list.keys.length).toBe(0);
    });
  });

  describe('/internal/count-objects route', () => {
    beforeEach(() => {
      workerEnv = getMiniflareBindings();
      ctx = new ExecutionContext();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('should return the number of objects in R2 when bucket is empty', async () => {
      const request = new Request('http://localhost/internal/count-objects', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${workerEnv.TURBO_TOKEN}`,
        },
      });
      const response = await app.fetch(request, workerEnv, ctx);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ count: 0 });
    });

    test('should return the number of objects in R2 when bucket is not empty', async () => {
      await workerEnv.STORAGE_MANAGER.getActiveStorage().write('key', 'value');
      const request = new Request('http://localhost/internal/count-objects', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${workerEnv.TURBO_TOKEN}`,
        },
      });
      const response = await app.fetch(request, workerEnv, ctx);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ count: 1 });
    });

    test('should return 401 if no auth token is provided', async () => {
      const request = new Request('http://localhost/internal/count-objects', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const response = await app.fetch(request, workerEnv, ctx);
      expect(response.status).toBe(401);
    });
  });
});
