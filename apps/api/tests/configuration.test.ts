import { afterEach, expect, test, vi } from 'vitest';

import { authorized } from './support/client';

vi.mock('../src/custom-adapter', () => import('./support/memory-storage'));

afterEach(() => {
  vi.unstubAllEnvs();
});

test('answers a missing TURBO_TOKEN with a generic 500 that does not reveal the configuration', async () => {
  vi.stubEnv('TURBO_TOKEN', '');

  const response = await authorized('/v8/artifacts/status');
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    code: 'internal_server_error',
    message: 'Internal server error',
  });
});
