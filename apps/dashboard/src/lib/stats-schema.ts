import * as v from 'valibot';

import type { StatsResponse } from '../../contract';

import { STATS_RANGES } from '../../contract';

const count = v.number();

const Activity = v.object({
  localHits: count,
  localMisses: count,
  remoteHits: count,
  remoteMisses: count,
  localTimeSavedMs: count,
  remoteTimeSavedMs: count,
  runs: count,
  ciRuns: count,
  agentRuns: count,
  uploads: count,
  uploadedBytes: count,
  downloads: count,
  downloadedBytes: count,
});

const Share = v.object({ name: v.string(), count });

const HistogramBin = v.object({ below: v.nullable(count), artifacts: count, bytes: count });

const Snapshot = v.object({ takenAt: count, artifacts: count, bytes: count });

/** Parses the body of `GET /stats`, which crosses the network into the page. */
export const StatsResponseSchema = v.variant('enabled', [
  v.object({ enabled: v.literal(false) }),
  v.object({
    enabled: v.literal(true),
    generatedAt: count,
    range: v.object({
      name: v.picklist(STATS_RANGES),
      from: count,
      to: count,
      bucketMs: count,
    }),
    totals: v.object({ current: Activity, previous: Activity }),
    series: v.array(v.object({ ...Activity.entries, start: count })),
    allTime: v.object({ timeSavedMs: count, since: v.nullable(count) }),
    calendar: v.array(v.object({ day: count, runs: count, timeSavedMs: count })),
    storage: v.object({
      expirationHours: count,
      latest: v.nullable(
        v.object({
          ...Snapshot.entries,
          ages: v.array(HistogramBin),
          sizes: v.array(HistogramBin),
        }),
      ),
      history: v.array(Snapshot),
    }),
    teams: v.array(
      v.object({
        ...Activity.entries,
        team: v.string(),
        storedArtifacts: count,
        storedBytes: count,
      }),
    ),
    clients: v.object({
      ci: v.array(Share),
      agents: v.array(Share),
      versions: v.array(Share),
      platforms: v.array(Share),
    }),
  }),
]) satisfies v.GenericSchema<unknown, StatsResponse>;
