import type { Stats, StatsResponse } from '@turborepo-remote-cache/dashboard/contract';

import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, onTestFinished, test } from 'vitest';

import type { TaskCache } from './support/workspace';

import { startRecordingProxy } from './support/recording-proxy';
import { createWorkspace, PACKAGES, SERVER_URL, TURBO_VERSION } from './support/workspace';

let workspace: Awaited<ReturnType<typeof createWorkspace>>;

beforeAll(async () => {
  workspace = await createWorkspace();
});

afterAll(() => workspace.remove());

// The Worker's store outlives a test run, so every test starts from a team nothing has written to.
const randomTeam = () => `team_e2e_${crypto.randomUUID().slice(0, 8)}`;

const forEachPackage = <T>(value: T) => Object.fromEntries(PACKAGES.map((pkg) => [pkg, value]));

const cacheSources = (tasks: Record<string, TaskCache>) =>
  Object.fromEntries(Object.entries(tasks).map(([pkg, cache]) => [pkg, cache.source ?? 'MISS']));

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

const provenance = (tasks: Record<string, TaskCache>) =>
  Object.fromEntries(
    Object.entries(tasks).map(([pkg, { timeSaved, sha, dirtyHash }]) => [
      pkg,
      { timeSaved, sha, dirtyHash },
    ]),
  );

const readStats = async (): Promise<Stats> => {
  const body: StatsResponse = await (await fetch(new URL('/stats?range=24h', SERVER_URL))).json();
  if (!body.enabled) {
    throw new Error('Stats are disabled');
  }
  return body;
};

describe('restoring from the remote cache', () => {
  test.each([
    ['plain requests', {}],
    ['CORS preflight requests', { TURBO_PREFLIGHT: 'true' }],
  ])('a fresh clone restores every task and replays its logs over %s', async (_mode, env) => {
    const team = randomTeam();
    const producer = await workspace.clone('producer', { team, env });
    const consumer = await workspace.clone('consumer', { team, env });

    expect(cacheSources((await producer.build()).tasks)).toEqual(forEachPackage('MISS'));
    const restore = await consumer.build();

    expect(cacheSources(restore.tasks)).toEqual(forEachPackage('REMOTE'));
    expect(await consumer.builtBy()).toEqual(forEachPackage('producer'));
    expect(restore.output).toContain('built app on producer');
  });

  test('a change rebuilds only the packages it affects, and the next clone restores work from both machines', async () => {
    const team = randomTeam();
    const first = await workspace.clone('first', { team });
    const second = await workspace.clone('second', { team });
    const third = await workspace.clone('third', { team });
    await first.build();

    await second.write('packages/lib-03/src/index.txt', 'changed\n');
    await third.write('packages/lib-03/src/index.txt', 'changed\n');
    const rebuild = await second.build();
    expect(cacheSources(rebuild.tasks)).toEqual({
      ...forEachPackage('REMOTE'),
      'lib-03': 'MISS',
      app: 'MISS',
    });

    await third.build();
    expect(await third.builtBy()).toEqual({
      ...forEachPackage('first'),
      'lib-03': 'second',
      app: 'second',
    });
  });

  test('a clone in another team restores nothing', async () => {
    const producer = await workspace.clone('producer', { team: randomTeam() });
    const outsider = await workspace.clone('outsider', { team: randomTeam() });
    await producer.build();

    expect(cacheSources((await outsider.build()).tasks)).toEqual(forEachPackage('MISS'));
  });

  test('restores a 48 MiB incompressible artifact byte for byte', async () => {
    const team = randomTeam();
    const env = { E2E_PAYLOAD_BYTES: String(48 * 1024 * 1024) };
    const producer = await workspace.clone('producer', { team, env });
    const consumer = await workspace.clone('consumer', { team, env });
    const payload = 'packages/lib-01/dist/payload.bin';

    await producer.build(['--filter=lib-01']);
    const restore = await consumer.build(['--filter=lib-01']);

    expect(cacheSources(restore.tasks)).toEqual({ 'lib-01': 'REMOTE' });
    expect(sha256(await consumer.read(payload))).toBe(sha256(await producer.read(payload)));
  });
});

describe('cache metadata', () => {
  test('remote hits report the duration, commit and working-tree hash that the producer recorded', async () => {
    const team = randomTeam();
    const proxy = await startRecordingProxy(SERVER_URL);
    onTestFinished(() => proxy.close());
    const producer = await workspace.clone('producer', { team });
    const consumer = await workspace.clone('consumer', { team, env: { TURBO_API: proxy.url } });
    // An uncommitted change makes turbo record a dirty hash beside the commit.
    await producer.write('packages/lib-01/src/index.txt', 'uncommitted\n');
    await consumer.write('packages/lib-01/src/index.txt', 'uncommitted\n');

    await producer.build();
    const recorded = provenance(await producer.dryRun());
    expect(recorded['lib-01']?.sha).toMatch(/^[\da-f]{40}$/u);
    expect(recorded['lib-01']?.dirtyHash).toMatch(/^[\da-f]{64}$/u);

    expect(provenance(await consumer.dryRun())).toEqual(recorded);
    // turbo silently falls back to one HEAD per task when the batch query fails or can't be parsed.
    expect(proxy.requests).toContain('POST /v8/artifacts');
    expect(proxy.requests.filter((line) => line.startsWith('HEAD '))).toEqual([]);

    expect(provenance((await consumer.build()).tasks)).toEqual(recorded);
  });
});

describe('usage stats', () => {
  test('the dashboard counts what a turbo session uploaded, downloaded and saved', async () => {
    const team = randomTeam();
    const producer = await workspace.clone('producer', { team });
    const consumer = await workspace.clone('consumer', { team });

    await producer.build();
    const restore = await consumer.build();
    const timeSaved = Object.values(restore.tasks).reduce((sum, cache) => sum + cache.timeSaved, 0);

    // The server writes stats after it responds, so poll until the session's numbers arrive.
    const activity = async () => (await readStats()).teams.find((row) => row.team === team);
    await expect.poll(activity, { timeout: 5000 }).toMatchObject({
      runs: 2,
      uploads: PACKAGES.length,
      downloads: PACKAGES.length,
      remoteMisses: PACKAGES.length,
      remoteHits: PACKAGES.length,
      runTimeMs: timeSaved,
      remoteTimeSavedMs: timeSaved,
    });
    const row = await activity();
    expect(row?.uploadedBytes).toBeGreaterThan(0);
    expect(row?.downloadedBytes).toBe(row?.uploadedBytes);
    expect((await readStats()).clients.versions).toContainEqual(
      expect.objectContaining({ name: TURBO_VERSION }),
    );
  });
});

describe('misconfiguration', () => {
  test('a wrong token leaves the build working and tells the user the token failed', async () => {
    const machine = await workspace.clone('misconfigured', {
      team: randomTeam(),
      env: { TURBO_TOKEN: 'wrong-token' },
    });

    const run = await machine.build();

    expect(run.output).toContain('Remote caching unavailable (Authentication failed');
    expect(await machine.builtBy()).toEqual(forEachPackage('misconfigured'));
  });
});
