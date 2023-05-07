import { MockedFunction, afterEach, expect, test, vi } from 'vitest';
import { app } from '.';
import { Env } from '../';
import { deleteOldCache } from '../crons/deleteOldCache';

vi.mock('../crons/deleteOldCache', async (importActual) => {
  const actual = await importActual<typeof import('../crons/deleteOldCache')>();
  return {
    ...actual,
    deleteOldCache: vi.fn(),
  };
});
const deleteOldCacheMock = deleteOldCache as MockedFunction<typeof deleteOldCache>;

const describe = setupMiniflareIsolatedStorage();

describe('Command central /delete-old-cache route', () => {
  const workerEnv = getMiniflareBindings<Env>();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should invoke the deleteOldCache method', async () => {
    const request = new Request('http://localhost/commandCentral/delete-expired-objects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${workerEnv.TURBO_TOKEN}`,
      },
    });
    const response = await app.fetch(request, workerEnv);
    expect(response.status).toBe(200);
    expect(deleteOldCacheMock).toHaveBeenCalledOnce();
  });

  test('should return 401 if no auth token is provided', async () => {
    const request = new Request('http://localhost/commandCentral/delete-expired-objects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const response = await app.fetch(request, workerEnv);
    expect(response.status).toBe(401);
    expect(deleteOldCacheMock).not.toHaveBeenCalled();
  });

  test('should invoke the deleteOldCache method if auth is not required', async () => {
    const request = new Request('http://localhost/commandCentral/delete-expired-objects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const response = await app.fetch(request, {
      ...workerEnv,
      REQUIRE_AUTH: false,
    });
    expect(response.status).toBe(200);
    expect(deleteOldCacheMock).toHaveBeenCalledOnce();
  });
});
