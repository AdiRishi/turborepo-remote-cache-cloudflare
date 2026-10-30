import { queryOptions } from '@tanstack/react-query';
import * as v from 'valibot';

import type { Activity, StatsRange, StatsResponse } from '../../contract';

import { StatsResponseSchema } from './stats-schema';

export const RANGE_LABELS = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
} as const satisfies Record<StatsRange, string>;

export const statsQuery = (range: StatsRange) =>
  queryOptions({
    queryKey: ['stats', range],
    queryFn: async ({ signal }): Promise<StatsResponse> => {
      const response = await fetch(`/stats?range=${range}`, { signal });
      if (!response.ok) {
        throw new Error(`The server answered ${response.status} ${response.statusText}`.trim());
      }
      return v.parse(StatsResponseSchema, await response.json());
    },
    refetchInterval: 60_000,
  });

export const timeSaved = (activity: Activity) =>
  activity.localTimeSavedMs + activity.remoteTimeSavedMs;

export const cacheHits = (activity: Activity) => activity.localHits + activity.remoteHits;

/**
 * Tasks that looked up the cache. Every task checks the local cache and asks the server only after a
 * local miss, so a task is a local hit, a remote hit, or a remote miss.
 */
export const tasks = (activity: Activity) => cacheHits(activity) + activity.remoteMisses;

export const hitRate = (activity: Activity) => {
  const total = tasks(activity);
  return total === 0 ? null : cacheHits(activity) / total;
};

/** The share of lookups that reached this server and found the artifact. */
export const serverHitRate = (activity: Activity) => {
  const lookups = activity.remoteHits + activity.remoteMisses;
  return lookups === 0 ? null : activity.remoteHits / lookups;
};

export const savedPerRun = (activity: Activity) =>
  activity.runs === 0 ? null : timeSaved(activity) / activity.runs;

/**
 * The share of all task time that caches replayed instead of running. Run time arrives with uploads, so
 * a range with misses but no reported run time has no share.
 */
export const cachedShare = (activity: Activity) => {
  const saved = timeSaved(activity);
  if (activity.runTimeMs === 0 && activity.remoteMisses > 0) {
    return null;
  }
  return saved + activity.runTimeMs === 0 ? null : saved / (saved + activity.runTimeMs);
};
