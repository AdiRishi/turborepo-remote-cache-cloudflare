import { describe, expect, test, vi } from 'vitest';

import {
  authorized,
  randomHash,
  readError,
  readUploadUrl,
  uploadArtifact,
} from '../support/client';

vi.mock('../../server/custom-adapter', () => import('../support/memory-storage'));

const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));

const METADATA = {
  'x-artifact-duration': '1234',
  'x-artifact-sha': 'c0ffee',
  'x-artifact-dirty-hash': 'd1r7y',
};

describe('artifact upload and download', () => {
  test('returns the uploaded bytes unchanged with an exact Content-Length', async () => {
    const hash = randomHash();
    const body = randomBytes(64 * 1024);

    const upload = await uploadArtifact({ hash, body });
    expect(upload.status).toBe(202);
    expect((await readUploadUrl(upload)).pathname).toBe(`/v8/artifacts/${hash}`);

    const download = await authorized(`/v8/artifacts/${hash}`);
    expect(download.status).toBe(200);
    expect(download.headers.get('content-type')).toBe('application/octet-stream');
    expect(download.headers.get('content-length')).toBe(String(body.byteLength));
    expect(new Uint8Array(await download.arrayBuffer())).toEqual(body);
  });

  test('stores an empty artifact', async () => {
    const hash = randomHash();
    await uploadArtifact({ hash, body: new Uint8Array() });

    const download = await authorized(`/v8/artifacts/${hash}`);
    expect(download.status).toBe(200);
    expect(download.headers.get('content-length')).toBe('0');
    expect((await download.arrayBuffer()).byteLength).toBe(0);
  });

  test('GET returns the stored tag, duration, sha and dirty hash', async () => {
    const hash = randomHash();
    const tag = 'a'.repeat(600);
    await uploadArtifact({
      hash,
      body: randomBytes(16),
      headers: { 'x-artifact-tag': tag, ...METADATA },
    });

    const response = await authorized(`/v8/artifacts/${hash}`);
    expect(response.headers.get('x-artifact-tag')).toBe(tag);
    expect(Object.fromEntries(response.headers)).toMatchObject(METADATA);
  });

  test('HEAD returns the stored size, duration, sha and dirty hash without a body', async () => {
    const hash = randomHash();
    await uploadArtifact({ hash, body: randomBytes(32), headers: METADATA });

    const response = await authorized(`/v8/artifacts/${hash}`, { method: 'HEAD' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe('32');
    expect(Object.fromEntries(response.headers)).toMatchObject(METADATA);
    expect(await response.text()).toBe('');
  });

  test('returns a duration beyond the float-safe range digit for digit', async () => {
    const hash = randomHash();
    const duration = '87903119228389000000000000000000';
    await uploadArtifact({
      hash,
      body: randomBytes(1),
      headers: { 'x-artifact-duration': duration },
    });

    const response = await authorized(`/v8/artifacts/${hash}`, { method: 'HEAD' });
    expect(response.headers.get('x-artifact-duration')).toBe(duration);
  });

  test('omits metadata headers the upload did not send', async () => {
    const hash = randomHash();
    await uploadArtifact({ hash, body: randomBytes(8) });

    const response = await authorized(`/v8/artifacts/${hash}`);
    expect([...response.headers.keys()].filter((name) => name.startsWith('x-artifact-'))).toEqual(
      [],
    );
  });

  test('replaces an artifact uploaded again under the same hash', async () => {
    const hash = randomHash();
    await uploadArtifact({ hash, body: randomBytes(8), headers: { 'x-artifact-tag': 'first' } });
    const second = randomBytes(12);
    await uploadArtifact({ hash, body: second, headers: { 'x-artifact-tag': 'second' } });

    const response = await authorized(`/v8/artifacts/${hash}`);
    expect(response.headers.get('x-artifact-tag')).toBe('second');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(second);
  });

  test('GET of a missing artifact returns a spec 404', async () => {
    const response = await authorized(`/v8/artifacts/${randomHash()}`);
    expect(response.status).toBe(404);
    expect(await readError(response)).toEqual({ code: 'not_found', message: 'Artifact not found' });
  });

  test('HEAD of a missing artifact returns 404', async () => {
    const response = await authorized(`/v8/artifacts/${randomHash()}`, { method: 'HEAD' });
    expect(response.status).toBe(404);
  });
});

describe('teams', () => {
  test('scopes artifacts to the teamId query parameter', async () => {
    const hash = randomHash();
    await uploadArtifact({ hash, body: randomBytes(8), search: '?teamId=team_a' });

    expect((await authorized(`/v8/artifacts/${hash}?teamId=team_a`)).status).toBe(200);
    expect((await authorized(`/v8/artifacts/${hash}?teamId=team_b`)).status).toBe(404);
    expect((await authorized(`/v8/artifacts/${hash}`)).status).toBe(404);
  });

  test('treats slug as the team when teamId is absent', async () => {
    const hash = randomHash();
    await uploadArtifact({ hash, body: randomBytes(8), search: '?slug=acme' });

    expect((await authorized(`/v8/artifacts/${hash}?teamId=acme`)).status).toBe(200);
  });

  test('rejects a team containing control characters', async () => {
    const response = await authorized(`/v8/artifacts/${randomHash()}?teamId=team%1Bescape`);
    expect(response.status).toBe(400);
  });

  test('uses one default team when no team is given', async () => {
    const hash = randomHash();
    const upload = await uploadArtifact({ hash, body: randomBytes(8) });

    expect((await readUploadUrl(upload)).searchParams.get('teamId')).toBe('team_default_team');
    expect((await authorized(`/v8/artifacts/${hash}?teamId=team_default_team`)).status).toBe(200);
  });
});

describe('upload validation', () => {
  test.each([
    ['a tag longer than 600 characters', { 'x-artifact-tag': 'a'.repeat(601) }],
    ['a non-integer duration', { 'x-artifact-duration': '1.5' }],
    ['a negative duration', { 'x-artifact-duration': '-1' }],
    ['a CI name longer than 50 characters', { 'x-artifact-client-ci': 'c'.repeat(51) }],
    ['an interactive flag other than 0 or 1', { 'x-artifact-client-interactive': '2' }],
  ])('rejects %s with a spec 400', async (_case, headers) => {
    const response = await uploadArtifact({ hash: randomHash(), body: randomBytes(8), headers });
    expect(response.status).toBe(400);
    expect((await readError(response)).code).toBe('bad_request');
  });

  test('rejects an upload to a hash that is not hexadecimal', async () => {
    const response = await uploadArtifact({ hash: 'not-a-hash', body: randomBytes(1) });
    expect(response.status).toBe(400);
  });

  test('rejects a download of a hash that is not hexadecimal', async () => {
    const response = await authorized('/v8/artifacts/not-a-hash');
    expect(response.status).toBe(400);
  });
});
