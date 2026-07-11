import { beforeEach, describe, expect, test, vi } from 'vitest';

import { deleteOldCache } from '~/crons/deleteOldCache';
import { app } from '~/routes';

import { createTestAppContext, withAuthorization, type TestAppContext } from '../helpers/app';

vi.mock('~/crons/deleteOldCache', async (importActual) => {
  const actual = await importActual<typeof import('~/crons/deleteOldCache')>();
  return {
    ...actual,
    deleteOldCache: vi.fn<typeof actual.deleteOldCache>(),
  };
});

const deleteOldCacheMock = vi.mocked(deleteOldCache);

const internalRequest = (path: string, init: RequestInit = {}, authorized = true): Request =>
  new Request(`http://localhost/internal/${path}`, {
    ...init,
    headers: authorized ? withAuthorization(init.headers) : new Headers(init.headers),
  });

describe('/internal routes', () => {
  let context: TestAppContext;

  beforeEach(() => {
    context = createTestAppContext();
    deleteOldCacheMock.mockReset().mockResolvedValue({ deleted: 0, skipped: 0 });
  });

  describe('POST /internal/delete-expired-objects', () => {
    test('runs retention with the configured default window', async () => {
      const response = await app.fetch(
        internalRequest('delete-expired-objects', {
          body: JSON.stringify({}),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        }),
        context.bindings,
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(deleteOldCacheMock).toHaveBeenCalledWith(context.files, 720);
    });

    test('passes an explicit retention window through to the cleanup service', async () => {
      const response = await app.fetch(
        internalRequest('delete-expired-objects', {
          body: JSON.stringify({ expireInHours: 100 }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        }),
        context.bindings,
      );

      expect(response.status).toBe(200);
      expect(deleteOldCacheMock).toHaveBeenCalledWith(context.files, 100);
    });

    test('rejects a negative retention window without running cleanup', async () => {
      const response = await app.fetch(
        internalRequest('delete-expired-objects', {
          body: JSON.stringify({ expireInHours: -1 }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        }),
        context.bindings,
      );

      expect(response.status).toBe(400);
      expect(deleteOldCacheMock).not.toHaveBeenCalled();
    });

    test('does not run cleanup without authentication', async () => {
      const response = await app.fetch(
        internalRequest(
          'delete-expired-objects',
          {
            body: JSON.stringify({}),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
          },
          false,
        ),
        context.bindings,
      );

      expect(response.status).toBe(401);
      expect(deleteOldCacheMock).not.toHaveBeenCalled();
    });
  });

  describe('POST /internal/populate-random-objects', () => {
    test('adds the requested number of objects through Files SDK', async () => {
      const response = await app.fetch(
        internalRequest('populate-random-objects', {
          body: JSON.stringify({ count: 10 }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        }),
        context.bindings,
      );

      expect(response.status).toBe(200);
      expect((await context.files.list()).items).toHaveLength(10);
    });

    test('does not write anything without authentication', async () => {
      const response = await app.fetch(
        internalRequest(
          'populate-random-objects',
          {
            body: JSON.stringify({ count: 10 }),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
          },
          false,
        ),
        context.bindings,
      );

      expect(response.status).toBe(401);
      expect((await context.files.list()).items).toHaveLength(0);
    });
  });

  describe('GET /internal/count-objects', () => {
    test('returns zero when storage is empty', async () => {
      const response = await app.fetch(internalRequest('count-objects'), context.bindings);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ count: 0 });
    });

    test('counts objects across Files SDK storage', async () => {
      await context.files.upload('key', 'value');

      const response = await app.fetch(internalRequest('count-objects'), context.bindings);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ count: 1 });
    });

    test('rejects unauthenticated requests', async () => {
      const response = await app.fetch(
        internalRequest('count-objects', {}, false),
        context.bindings,
      );

      expect(response.status).toBe(401);
    });
  });
});
