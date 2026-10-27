import { runTask } from 'nitro/task';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { authorized, randomHash } from './support/client';
import { adapter, storage } from './support/memory-storage';

vi.mock('../src/custom-adapter', () => import('./support/memory-storage'));

const HOUR = 3_600_000;
const START = new Date('2026-01-01T00:00:00Z').getTime();

const store = (key: string) => storage.upload(key, new Uint8Array(1));

const storedKeys = () => [...adapter.raw.keys()].toSorted();

const deleteExpired = async (body: object = {}) => {
  const response = await authorized('/internal/delete-expired-objects', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  expect(response.status).toBe(200);
  return response.json();
};

beforeEach(() => {
  adapter.raw.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('POST /internal/delete-expired-objects', () => {
  test('deletes artifacts older than BUCKET_OBJECT_EXPIRATION_HOURS, 720 by default', async () => {
    await store('team_a/old');
    vi.setSystemTime(START + 700 * HOUR);
    await store('team_a/recent');
    vi.setSystemTime(START + 721 * HOUR);

    expect(await deleteExpired()).toEqual({ deleted: 1 });
    expect(storedKeys()).toEqual(['team_a/recent']);
  });

  test('uses expireInHours from the request instead of the configured age', async () => {
    await store('team_a/two-hours');
    vi.setSystemTime(START + 90 * 60_000);
    await store('team_a/thirty-minutes');
    vi.setSystemTime(START + 2 * HOUR);

    expect(await deleteExpired({ expireInHours: 1 })).toEqual({ deleted: 1 });
    expect(storedKeys()).toEqual(['team_a/thirty-minutes']);
  });

  test('deletes across every page of a large store', async () => {
    await Promise.all(Array.from({ length: 2500 }, () => store(`team_a/${randomHash()}`)));
    vi.setSystemTime(START + 721 * HOUR);

    expect(await deleteExpired()).toEqual({ deleted: 2500 });
    expect(storedKeys()).toEqual([]);
  });

  test('rejects a negative age', async () => {
    const response = await authorized('/internal/delete-expired-objects', {
      method: 'POST',
      body: JSON.stringify({ expireInHours: -1 }),
    });
    expect(response.status).toBe(400);
  });
});

describe('cache:delete-expired task', () => {
  test('deletes expired artifacts when the scheduler runs it', async () => {
    await store('team_a/old');
    vi.setSystemTime(START + 721 * HOUR);
    await store('team_a/new');

    expect(
      await runTask('cache:delete-expired', { payload: { scheduledTime: Date.now() } }),
    ).toEqual({
      result: { deleted: 1 },
    });
    expect(storedKeys()).toEqual(['team_a/new']);
  });
});
