import { describe, expect, test, vi } from 'vitest';

import { authorized, randomHash, readError, send } from '../support/client';

vi.mock('../../src/custom-adapter', () => import('../support/memory-storage'));

const CREDENTIALS = [
  ['no Authorization header', {}],
  ['a different token', { authorization: 'Bearer wrong-token' }],
  ['a token prefix', { authorization: 'Bearer test' }],
  ['another scheme', { authorization: 'Basic dGVzdC10b2tlbg==' }],
] as const;

const PROTECTED_PATHS = ['/v8/artifacts/status', `/v8/artifacts/${randomHash()}`, '/internal/x'];

describe('authentication', () => {
  test.each(
    CREDENTIALS.flatMap(([credentials, headers]) =>
      PROTECTED_PATHS.map((path) => ({ credentials, headers, path })),
    ),
  )('rejects $credentials on $path with a spec 401', async ({ headers, path }) => {
    const response = await send(path, { headers });
    expect(response.status).toBe(401);
    expect(await readError(response)).toEqual({
      code: 'unauthorized',
      message: 'Missing or invalid bearer token',
    });
  });

  test('reports remote caching as enabled to an authorized client', async () => {
    const response = await authorized('/v8/artifacts/status');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'enabled' });
  });
});

describe('CORS', () => {
  test('answers the turbo preflight, which has no Origin, without credentials', async () => {
    const response = await send(`/v8/artifacts/${randomHash()}`, {
      method: 'OPTIONS',
      headers: {
        'access-control-request-method': 'PUT',
        'access-control-request-headers':
          'Authorization, Content-Type, User-Agent, x-artifact-duration, x-artifact-tag, x-artifact-sha, x-artifact-dirty-hash',
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.has('location')).toBe(false);
    const allowed = String(response.headers.get('access-control-allow-headers'))
      .split(',')
      .map((header) => header.trim().toLowerCase());
    expect(allowed).toEqual(
      expect.arrayContaining([
        'authorization',
        'content-type',
        'user-agent',
        'x-artifact-duration',
        'x-artifact-tag',
        'x-artifact-sha',
        'x-artifact-dirty-hash',
      ]),
    );
    expect(response.headers.get('access-control-allow-methods')).toContain('PUT');
  });

  test('exposes the artifact headers to browsers, on errors too', async () => {
    const response = await authorized(`/v8/artifacts/${randomHash()}`, {
      headers: { origin: 'https://example.com' },
    });
    expect(response.status).toBe(404);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-expose-headers')).toContain('x-artifact-tag');
  });
});

describe('routing', () => {
  test.each(['/v8/unknown', '/v8/artifacts/abc/extra', '/internal/count-objects'])(
    'answers the unknown API path %s with a JSON 404',
    async (path) => {
      const response = await authorized(path);
      expect(response.status).toBe(404);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect((await readError(response)).code).toBe('not_found');
    },
  );

  test('answers an unsupported method on an artifact with a JSON 404', async () => {
    const response = await authorized(`/v8/artifacts/${randomHash()}`, { method: 'DELETE' });
    expect(response.status).toBe(404);
    expect((await readError(response)).code).toBe('not_found');
  });

  test('redirects the root to the documentation', async () => {
    const response = await send('/', { redirect: 'manual' });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://adirishi.github.io/turborepo-remote-cache-cloudflare',
    );
  });

  test('serves the health check without authentication', async () => {
    const response = await send('/ping');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('pong');
  });
});
