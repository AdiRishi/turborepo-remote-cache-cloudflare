import type { StatsResponse } from '@turborepo-remote-cache/dashboard/contract';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { authorized, randomHash, send, uploadArtifact } from './support/client';

vi.mock('../src/custom-adapter', () => import('./support/memory-storage'));

const database = vi.hoisted(() => ({ state: 'up' as 'missing' | 'down' | 'up' }));

// A real SQLite database that can lose its binding, as when STATS_DB is not bound, or fail every
// query, as during a D1 outage.
vi.mock('nitro/database', async () => {
  const { createDatabase } = await import('db0');
  const { default: sqlite } = await import('db0/connectors/node-sqlite');
  const db = createDatabase(sqlite({ name: ':memory:' }));
  return {
    useDatabase: () => ({
      getInstance: () =>
        database.state === 'missing'
          ? Promise.reject(new Error('[db0] [d1] binding `STATS_DB` not found'))
          : db.getInstance(),
      sql: (...query: Parameters<typeof db.sql>) =>
        database.state === 'down'
          ? Promise.reject(new Error('D1_ERROR: Network connection lost.'))
          : db.sql(...query),
    }),
  };
});

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  database.state = 'up';
});

const useTheCache = async (team: string) => {
  const hash = randomHash();
  const upload = await uploadArtifact({ hash, body: new Uint8Array(3), search: `?teamId=${team}` });
  expect(upload.status).toBe(202);
  expect((await authorized(`/v8/artifacts/${hash}?teamId=${team}`)).status).toBe(200);
  const events = await authorized(`/v8/artifacts/events?teamId=${team}`, {
    method: 'POST',
    body: JSON.stringify([
      { sessionId: crypto.randomUUID(), source: 'REMOTE', event: 'HIT', hash },
    ]),
  });
  expect(events.status).toBe(200);
  const expiry = await authorized('/internal/delete-expired-objects', {
    method: 'POST',
    body: '{}',
  });
  expect(expiry.status).toBe(200);
};

const teamStats = async (team: string) => {
  const body: StatsResponse = await (await send('/stats')).json();
  return body.enabled ? body.teams.find((row) => row.team === team) : undefined;
};

describe('the stats database', () => {
  test('is optional: the cache works without one, and stats report as disabled', async () => {
    database.state = 'missing';

    await useTheCache('team_without_stats');

    const stats = await send('/stats');
    expect(stats.status).toBe(200);
    expect(await stats.json()).toEqual({ enabled: false });
  });

  test('can fail without failing the cache, and records stats again once it recovers', async () => {
    database.state = 'down';

    await useTheCache('team_during_outage');
    expect((await send('/stats')).status).toBe(500);
    await expect
      .poll(() => console.error)
      .toHaveBeenCalledWith(
        '[stats]',
        expect.objectContaining({ message: 'D1_ERROR: Network connection lost.' }),
      );

    database.state = 'up';
    await useTheCache('team_after_outage');

    await expect
      .poll(() => teamStats('team_after_outage'))
      .toMatchObject({
        uploads: 1,
        downloads: 1,
        remoteHits: 1,
        storedArtifacts: 1,
      });
  });
});
