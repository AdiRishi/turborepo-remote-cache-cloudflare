import type { Activity, Stats, StatsRange } from '@turborepo-remote-cache/dashboard/contract';

import type { Tally } from './inventory';
import type { Database } from './stats';

import {
  activityBy,
  allTimeSaved,
  byBucket,
  byTeam,
  clientShares,
  DAY,
  emptyActivity,
  runsPerDay,
  sumActivity,
} from './stats-queries';
import { latestSnapshot, storageHistory } from './storage-snapshots';

const HOUR = 3_600_000;
const CALENDAR_DAYS = 53 * 7;

const RANGES = {
  '24h': { buckets: 24, bucketMs: HOUR },
  '7d': { buckets: 7, bucketMs: DAY },
  '30d': { buckets: 30, bucketMs: DAY },
  '90d': { buckets: 90, bucketMs: DAY },
} as const satisfies Record<StatsRange, { buckets: number; bucketMs: number }>;

const timeline = (from: number, count: number, step: number) =>
  Array.from({ length: count }, (_, index) => from + index * step);

const teamRows = (activity: Map<string, Activity>, stored: Map<string, Tally>) =>
  [...new Set([...activity.keys(), ...stored.keys()])].map((team) =>
    Object.assign({ team }, activity.get(team) ?? emptyActivity(), {
      storedArtifacts: stored.get(team)?.artifacts ?? 0,
      storedBytes: stored.get(team)?.bytes ?? 0,
    }),
  );

export const buildStats = async (
  database: Database,
  {
    range,
    expirationHours,
    now = Date.now(),
  }: { range: StatsRange; expirationHours: number; now?: number },
): Promise<Stats> => {
  const { buckets, bucketMs } = RANGES[range];
  const from = now - (now % bucketMs) - (buckets - 1) * bucketMs;
  const to = from + buckets * bucketMs;
  const calendarFrom = now - (now % DAY) - (CALENDAR_DAYS - 1) * DAY;

  const [series, previous, teams, allTime, calendar, storage, history, clients] = await Promise.all(
    [
      activityBy(database, { from, to, group: byBucket(bucketMs) }),
      activityBy(database, { from: from - (to - from), to: from, group: byBucket(bucketMs) }),
      activityBy(database, { from, to, group: byTeam }),
      allTimeSaved(database),
      runsPerDay(database, calendarFrom),
      latestSnapshot(database),
      storageHistory(database, { from, to }),
      clientShares(database, { from, to }),
    ],
  );

  return {
    enabled: true,
    generatedAt: now,
    range: { name: range, from, to, bucketMs },
    totals: { current: sumActivity(series.values()), previous: sumActivity(previous.values()) },
    series: timeline(from, buckets, bucketMs).map((start) =>
      Object.assign({ start }, series.get(String(start)) ?? emptyActivity()),
    ),
    allTime,
    calendar: timeline(calendarFrom, CALENDAR_DAYS, DAY).map((day) => ({
      day,
      runs: calendar.get(String(day)) ?? 0,
    })),
    storage: { expirationHours, latest: storage.snapshot, history },
    teams: teamRows(teams, storage.teams),
    clients,
  };
};
