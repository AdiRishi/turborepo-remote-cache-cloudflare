import { describe, expect, test } from 'vitest';

import type { Activity } from '../contract';

import { cachedShare, hitRate, savedPerRun, serverHitRate, tasks } from '../src/lib/stats';

const activity = (overrides: Partial<Activity>): Activity => ({
  localHits: 0,
  localMisses: 0,
  remoteHits: 0,
  remoteMisses: 0,
  localTimeSavedMs: 0,
  remoteTimeSavedMs: 0,
  runs: 0,
  ciRuns: 0,
  agentRuns: 0,
  uploads: 0,
  uploadedBytes: 0,
  runTimeMs: 0,
  downloads: 0,
  downloadedBytes: 0,
  ...overrides,
});

const mixedLookups = activity({ localHits: 3, localMisses: 7, remoteHits: 2, remoteMisses: 5 });

describe('tasks', () => {
  test('counts each local miss once, through the remote hit or miss that follows it', () => {
    expect(tasks(mixedLookups)).toBe(10);
  });
});

describe('hitRate', () => {
  test('is the share of tasks that a local or remote cache answered', () => {
    expect(hitRate(mixedLookups)).toBe(0.5);
  });

  test('is null when no task looked up the cache', () => {
    expect(hitRate(activity({}))).toBeNull();
  });
});

describe('serverHitRate', () => {
  test('is the share of remote lookups that found the artifact', () => {
    expect(serverHitRate(activity({ remoteHits: 2, remoteMisses: 6 }))).toBe(0.25);
  });

  test('is null when every lookup was answered locally', () => {
    expect(serverHitRate(activity({ localHits: 4 }))).toBeNull();
  });
});

describe('savedPerRun', () => {
  test('divides local and remote time saved across runs', () => {
    expect(
      savedPerRun(activity({ localTimeSavedMs: 3000, remoteTimeSavedMs: 1000, runs: 4 })),
    ).toBe(1000);
  });

  test('is null when no run was reported', () => {
    expect(savedPerRun(activity({ localTimeSavedMs: 3000 }))).toBeNull();
  });
});

describe('cachedShare', () => {
  test('is the share of all task time that caches replayed', () => {
    expect(
      cachedShare(activity({ localTimeSavedMs: 2000, remoteTimeSavedMs: 1000, runTimeMs: 1000 })),
    ).toBe(0.75);
  });

  test('is null when tasks missed but reported no run time', () => {
    expect(cachedShare(activity({ remoteTimeSavedMs: 500, remoteMisses: 2 }))).toBeNull();
  });

  test('is the whole when every task was replayed', () => {
    expect(cachedShare(activity({ localTimeSavedMs: 500 }))).toBe(1);
  });

  test('is null when there is no task time at all', () => {
    expect(cachedShare(activity({}))).toBeNull();
  });
});
