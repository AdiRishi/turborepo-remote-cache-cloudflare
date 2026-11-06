import type { Activity, ActivityPoint, Stats } from '@turborepo-remote-cache/dashboard/contract';

import type { Task } from './terminal';

import { activity, add, HOUR, sum } from './demo-stats';

const DAY = 24 * HOUR;

// The reader's clock and local hours, so this morning's runs land in the hour they read it. Any 24 hourly
// buckets hold each hour of the day once, so the totals are the same whenever that is.
const NOW = Date.now();
const TO = Math.floor(NOW / HOUR) * HOUR + HOUR;

// A small team's working day, by local hour. The CI runner's replay adds to the newest bar.
const RUNS_BY_HOUR: Partial<Record<number, number>> = { 10: 1, 11: 2, 13: 1, 14: 2, 15: 1, 16: 2 };

const baseline: ActivityPoint[] = Array.from({ length: 24 }, (_, index) => {
  const start = TO - (24 - index) * HOUR;
  return Object.assign(activity(RUNS_BY_HOUR[new Date(start).getHours()] ?? 0), { start });
});

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
): Pick<Stats, 'range' | 'series' | 'totals' | 'allTime'> => {
  const series = baseline.map((point, index) =>
    index === baseline.length - 1
      ? Object.assign(
          events.reduce((total, event) => add(total, event), point),
          { start: point.start },
        )
      : point,
  );
  const current = sum(series);
  return {
    range: { name: '24h', from: TO - DAY, to: TO, bucketMs: HOUR },
    series,
    // The day before was quieter, and the server answered fewer of its lookups, so the deltas point up.
    totals: { current, previous: activity(8, 0.26) },
    allTime: {
      timeSavedMs: 110 * HOUR + current.localTimeSavedMs + current.remoteTimeSavedMs,
      since: Date.UTC(2026, 3, 3),
    },
  };
};
