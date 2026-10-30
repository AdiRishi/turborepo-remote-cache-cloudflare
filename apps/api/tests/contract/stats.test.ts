import type { Stats, StatsResponse } from '@turborepo-remote-cache/dashboard/contract';

import { describe, expect, test, vi } from 'vitest';

import { authorized, randomHash, send, uploadArtifact } from '../support/client';

vi.mock('../../src/custom-adapter', () => import('../support/memory-storage'));

const TURBO_USER_AGENT = 'turbo 2.11.9 1.98.0-nightly macos aarch64';

const randomTeam = () => `team_stats_${randomHash().slice(0, 12)}`;

const readStats = async (range = '30d'): Promise<Stats> => {
  const response = await send(`/stats?range=${range}`);
  expect(response.status).toBe(200);
  const body: StatsResponse = await response.json();
  if (!body.enabled) {
    throw new Error('Stats are disabled');
  }
  return body;
};

const teamActivity = async (team: string) =>
  (await readStats()).teams.find((row) => row.team === team);

const shareNamed = (name: string): unknown =>
  expect.arrayContaining([expect.objectContaining({ name })]);

const postEvents = (team: string, events: object[], headers: Record<string, string> = {}) =>
  authorized(`/v8/artifacts/events?teamId=${team}`, {
    method: 'POST',
    body: JSON.stringify(events),
    headers: { 'content-type': 'application/json', ...headers },
  });

describe('GET /stats', () => {
  test('rejects an unknown range', async () => {
    const response = await send('/stats?range=1y');
    expect(response.status).toBe(400);
  });

  test('buckets the 24-hour range by hour and the longer ranges by UTC day', async () => {
    const hourly = await readStats('24h');
    expect(hourly.series).toHaveLength(24);
    expect(hourly.range.bucketMs).toBe(3_600_000);

    const daily = await readStats('7d');
    expect(daily.series).toHaveLength(7);
    expect(daily.series.every(({ start }) => start % 86_400_000 === 0)).toBe(true);
    expect(daily.range.to).toBeGreaterThan(Date.now());
  });
});

describe('cache events', () => {
  test('counts hits and misses, the time hits saved, and each run once', async () => {
    const team = randomTeam();
    const session = crypto.randomUUID();
    const response = await postEvents(team, [
      { sessionId: session, source: 'LOCAL', event: 'MISS', hash: randomHash(), duration: 0 },
      { sessionId: session, source: 'REMOTE', event: 'HIT', hash: randomHash(), duration: 1200 },
      { sessionId: session, source: 'LOCAL', event: 'HIT', hash: randomHash(), duration: 300 },
      { sessionId: session, source: 'REMOTE', event: 'MISS', hash: randomHash(), duration: 0 },
    ]);
    expect(response.status).toBe(200);
    await postEvents(team, [
      { sessionId: session, source: 'REMOTE', event: 'HIT', hash: randomHash(), duration: 500 },
    ]);

    // Stats are written after the response, so poll until the team's numbers arrive.
    await expect
      .poll(() => teamActivity(team))
      .toMatchObject({
        localHits: 1,
        localMisses: 1,
        remoteHits: 2,
        remoteMisses: 1,
        localTimeSavedMs: 300,
        remoteTimeSavedMs: 1700,
        runs: 1,
        ciRuns: 0,
      });
  });

  test('splits runs by CI provider and AI coding agent', async () => {
    const team = randomTeam();
    const event = { source: 'REMOTE', event: 'MISS', hash: randomHash(), duration: 0 };
    await postEvents(team, [{ ...event, sessionId: crypto.randomUUID() }], {
      'x-artifact-client-ci': 'GITHUB_ACTIONS',
    });
    await postEvents(team, [{ ...event, sessionId: crypto.randomUUID() }], {
      'x-ai-agent': 'claude-code_2-1-312_agent',
    });

    await expect.poll(() => teamActivity(team)).toMatchObject({ runs: 2, ciRuns: 1, agentRuns: 1 });
    const { clients } = await readStats();
    expect(clients.ci).toEqual(shareNamed('GITHUB_ACTIONS'));
    expect(clients.agents).toEqual(shareNamed('claude-code'));
  });
});

describe('artifact transfers', () => {
  test('counts uploaded and downloaded bytes, and the turbo client that moved them', async () => {
    const team = randomTeam();
    const hash = randomHash();
    await uploadArtifact({
      hash,
      body: new Uint8Array(40),
      search: `?teamId=${team}`,
      headers: { 'user-agent': TURBO_USER_AGENT },
    });
    const download = await authorized(`/v8/artifacts/${hash}?teamId=${team}`, {
      headers: { 'user-agent': TURBO_USER_AGENT },
    });
    expect(download.status).toBe(200);
    await authorized(`/v8/artifacts/${randomHash()}?teamId=${team}`);

    await expect
      .poll(() => teamActivity(team))
      .toMatchObject({
        uploads: 1,
        uploadedBytes: 40,
        downloads: 1,
        downloadedBytes: 40,
      });
    const { clients } = await readStats();
    expect(clients.versions).toEqual(shareNamed('2.11.9'));
    expect(clients.platforms).toEqual(shareNamed('macos aarch64'));
  });
});

describe('storage snapshots', () => {
  test('expiry records what each team has stored', async () => {
    const team = randomTeam();
    await uploadArtifact({
      hash: randomHash(),
      body: new Uint8Array(7),
      search: `?teamId=${team}`,
    });
    await uploadArtifact({
      hash: randomHash(),
      body: new Uint8Array(5),
      search: `?teamId=${team}`,
    });

    const expiry = await authorized('/internal/delete-expired-objects', {
      method: 'POST',
      body: '{}',
    });
    expect(expiry.status).toBe(200);

    const stats = await readStats();
    expect(stats.teams.find((row) => row.team === team)).toMatchObject({
      storedArtifacts: 2,
      storedBytes: 12,
    });
    expect(stats.storage.latest?.ages[0]?.artifacts).toBeGreaterThanOrEqual(2);
    expect(stats.storage.history.at(-1)?.takenAt).toBe(stats.storage.latest?.takenAt);
  });
});
