import { describe, expect, test, vi } from 'vitest';

import { authorized, randomHash, readError, send, uploadArtifact } from '../support/client';

vi.mock('../../src/custom-adapter', () => import('../support/memory-storage'));

const CREDENTIALS = [
  ['no Authorization header', {}],
  ['a different token', { authorization: 'Bearer wrong-token' }],
  ['a token prefix', { authorization: 'Bearer test' }],
  ['another scheme', { authorization: 'Basic dGVzdC10b2tlbg==' }],
] as const;

const PROTECTED_PATHS = ['/v8/artifacts/status', `/v8/artifacts/${randomHash()}`, '/internal/x'];

const jsonPost = (body: unknown) => ({
  method: 'POST',
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
});

const WRITES = [
  {
    request: 'an artifact upload',
    path: `/v8/artifacts/${randomHash()}`,
    init: { method: 'PUT', body: new Uint8Array(8), headers: { 'content-length': '8' } },
  },
  {
    request: 'an artifact existence check',
    path: `/v8/artifacts/${randomHash()}`,
    init: { method: 'HEAD' },
  },
  {
    request: 'an artifact query',
    path: '/v8/artifacts',
    init: jsonPost({ hashes: [randomHash()] }),
  },
  { request: 'a cache events report', path: '/v8/artifacts/events', init: jsonPost([]) },
  {
    request: 'an expiry run',
    path: '/internal/delete-expired-objects',
    init: jsonPost({ expireInHours: 1_000_000 }),
  },
];

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

  test.each(WRITES)('rejects $request without a valid token', async ({ path, init }) => {
    const missing = await send(path, init);
    expect(missing.status).toBe(401);

    const wrong = await send(path, {
      ...init,
      headers: { ...init.headers, authorization: 'Bearer wrong-token' },
    });
    expect(wrong.status).toBe(401);
  });

  test('stores nothing from an upload it rejects', async () => {
    const hash = randomHash();
    const rejected = await send(`/v8/artifacts/${hash}`, {
      method: 'PUT',
      body: new Uint8Array(8),
      headers: { 'content-length': '8' },
    });
    expect(rejected.status).toBe(401);

    const lookup = await authorized(`/v8/artifacts/${hash}`);
    expect(lookup.status).toBe(404);
  });

  test('deletes nothing in an expiry run it rejects', async () => {
    const hash = randomHash();
    const upload = await uploadArtifact({ hash, body: new Uint8Array(8) });
    expect(upload.status).toBe(202);

    // Expiring everything is safe here only because the request carries no token.
    const rejected = await send('/internal/delete-expired-objects', jsonPost({ expireInHours: 0 }));
    expect(rejected.status).toBe(401);

    const download = await authorized(`/v8/artifacts/${hash}`);
    expect(download.status).toBe(200);
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

  test('answers an unsupported method on an artifact with a JSON 405 that lists the allowed methods', async () => {
    const response = await authorized(`/v8/artifacts/${randomHash()}`, { method: 'DELETE' });
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, HEAD, PUT');
    expect((await readError(response)).code).toBe('method_not_allowed');
  });

  test.each(['/V8/artifacts/status', '/%76%38/artifacts/status'])(
    'does not serve the protected status route at %s without a token',
    async (path) => {
      const response = await send(path);
      // The status depends on whether the transport decodes the path, and the real Worker can
      // answer an unmatched path from the dashboard's static assets, so only the body is fixed.
      expect(await response.text()).not.toContain('"enabled"');
    },
  );

  test('serves the health check without authentication', async () => {
    const response = await send('/ping');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('pong');
  });
});
