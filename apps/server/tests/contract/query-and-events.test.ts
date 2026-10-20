import { describe, expect, test, vi } from 'vitest';

import { authorized, randomHash, readError, uploadArtifact } from '../support/client';

vi.mock('../../server/custom-adapter', () => import('../support/memory-storage'));

const postJson = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  authorized(path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
  });

describe('POST /v8/artifacts', () => {
  test('describes hits and returns null for misses and malformed hashes', async () => {
    const hit = randomHash();
    const bare = randomHash();
    const missing = randomHash();
    await uploadArtifact({
      hash: hit,
      body: new Uint8Array(10),
      headers: {
        'x-artifact-duration': '250',
        'x-artifact-tag': 'tag',
        'x-artifact-sha': 'sha',
        'x-artifact-dirty-hash': 'dirty',
      },
    });
    await uploadArtifact({ hash: bare, body: new Uint8Array(3) });

    const response = await postJson('/v8/artifacts', { hashes: [hit, bare, missing, '../x'] });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      [hit]: { size: 10, taskDurationMs: 250, tag: 'tag', sha: 'sha', dirtyHash: 'dirty' },
      [bare]: { size: 3, taskDurationMs: 0 },
      [missing]: null,
      '../x': null,
    });
  });

  test('looks artifacts up in the requested team', async () => {
    const hash = randomHash();
    await uploadArtifact({ hash, body: new Uint8Array(1), search: '?teamId=team_query' });

    const other = await postJson('/v8/artifacts?teamId=team_other', { hashes: [hash] });
    expect(await other.json()).toEqual({ [hash]: null });
    const own = await postJson('/v8/artifacts?teamId=team_query', { hashes: [hash] });
    expect(await own.json()).toEqual({ [hash]: { size: 1, taskDurationMs: 0 } });
  });

  test('rejects a body without a hashes array', async () => {
    const response = await postJson('/v8/artifacts', { hash: 'abc' });
    expect(response.status).toBe(400);
  });
});

const cacheEvent = (index: number) => ({
  sessionId: crypto.randomUUID(),
  source: index % 2 === 0 ? 'LOCAL' : 'REMOTE',
  event: index % 3 === 0 ? 'MISS' : 'HIT',
  hash: randomHash(),
  duration: index,
});

describe('POST /v8/artifacts/events', () => {
  test('accepts a full client buffer of 100 events with an empty 200', async () => {
    const response = await postJson(
      '/v8/artifacts/events',
      Array.from({ length: 100 }, (_, index) => cacheEvent(index)),
      { 'x-artifact-client-ci': 'github-actions' },
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
  });

  test('accepts events without a sessionId, as the turbo client may send', async () => {
    const response = await postJson('/v8/artifacts/events', [
      { source: 'REMOTE', event: 'MISS', hash: randomHash() },
    ]);
    expect(response.status).toBe(200);
  });

  test.each([
    ['an unknown source', [{ ...cacheEvent(1), source: 'CLOUD' }]],
    ['a negative duration', [{ ...cacheEvent(1), duration: -1 }]],
    ['a body that is not an array', cacheEvent(1)],
  ])('rejects %s with 400', async (_case, body) => {
    const response = await postJson('/v8/artifacts/events', body);
    expect(response.status).toBe(400);
  });

  test('rejects a body that is not JSON', async () => {
    const response = await authorized('/v8/artifacts/events', { method: 'POST', body: '{' });
    expect(response.status).toBe(400);
    expect(await readError(response)).toEqual({
      code: 'bad_request',
      message: 'The request body is not valid JSON',
    });
  });
});
