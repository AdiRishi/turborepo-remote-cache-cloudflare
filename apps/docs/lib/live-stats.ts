import type { Activity, ActivityPoint, Stats } from '@turborepo-remote-cache/dashboard/contract';

import type { Task } from './terminal';

import { activity, add, HOUR, sum } from './demo-stats';

const DAY = 24 * HOUR;

// The reader's clock and local hours, so this morning's runs land in the hour they read it. Any 24 hourly
// buckets hold each hour of the day once, so the totals are the same whenever that is.
const TO = Math.floor(Date.now() / HOUR) * HOUR + HOUR;

// A small team's working day, by local hour.
const RUNS_BY_HOUR: Partial<Record<number, number>> = { 10: 1, 11: 2, 13: 1, 14: 2, 15: 1, 16: 2 };

const bucket = (start: number): ActivityPoint => ({
  ...activity(RUNS_BY_HOUR[new Date(start).getHours()] ?? 0),
  start,
});

const earlier = Array.from({ length: 23 }, (_, index) => bucket(TO - (24 - index) * HOUR));
const newest = bucket(TO - HOUR);

/** What the server saved before the last 24 hours, since it started on Apr 3, 2026. */
export const SAVED_BEFORE_MS = 110 * HOUR;

/** A task that missed both caches, ran, and uploaded its outputs. */
export const upload = (task: Task): Activity => ({
  ...activity(0),
  localMisses: 1,
  remoteMisses: 1,
  uploads: 1,
  uploadedBytes: task.bytes,
  runTimeMs: task.seconds * 1000,
});

/** A task that missed the local cache and replayed the artifact this server sent. */
export const hit = (task: Task): Activity => ({
  ...activity(0),
  localMisses: 1,
  remoteHits: 1,
  downloads: 1,
  downloadedBytes: task.bytes,
  remoteTimeSavedMs: task.seconds * 1000,
});

/** A `turbo run` that finished, from CI or from someone's machine. */
export const finished = ({ ci }: { ci: boolean }): Activity => ({
  ...activity(0),
  runs: 1,
  ciRuns: ci ? 1 : 0,
});

/** The dashboard's stats for the last 24 hours, once this morning's `events` have reached the server. */
export const liveStats = (
  events: readonly Activity[],
): Pick<Stats, 'range' | 'series' | 'totals'> => {
  const series = [
    ...earlier,
    { ...events.reduce((total, event) => add(total, event), newest), start: newest.start },
  ];
  return {
    range: { name: '24h', from: TO - DAY, to: TO, bucketMs: HOUR },
    series,
    // The day before was quieter, and the server answered fewer of its lookups, so the deltas point up.
    totals: { current: sum(series), previous: activity(8, 0.26) },
  };
};
