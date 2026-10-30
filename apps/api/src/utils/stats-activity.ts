import type { Activity } from '@turborepo-remote-cache/dashboard/contract';

import type { Database } from './stats';

// SQLite returns numbers. PostgreSQL returns BIGINT values and sums as strings, so numbers go through
// Number() on the way out.
export type Int = number | string;

const emptyActivity = (): Activity => ({
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
  downloads: 0,
  downloadedBytes: 0,
});

const sumActivity = (activities: readonly Activity[]) =>
  activities.reduce(
    (total, a): Activity => ({
      localHits: total.localHits + a.localHits,
      localMisses: total.localMisses + a.localMisses,
      remoteHits: total.remoteHits + a.remoteHits,
      remoteMisses: total.remoteMisses + a.remoteMisses,
      localTimeSavedMs: total.localTimeSavedMs + a.localTimeSavedMs,
      remoteTimeSavedMs: total.remoteTimeSavedMs + a.remoteTimeSavedMs,
      runs: total.runs + a.runs,
      ciRuns: total.ciRuns + a.ciRuns,
      agentRuns: total.agentRuns + a.agentRuns,
      uploads: total.uploads + a.uploads,
      uploadedBytes: total.uploadedBytes + a.uploadedBytes,
      downloads: total.downloads + a.downloads,
      downloadedBytes: total.downloadedBytes + a.downloadedBytes,
    }),
    emptyActivity(),
  );

interface Cell {
  bucket: number;
  team: string;
  activity: Activity;
}

interface EventRow {
  bucket: Int;
  team: string;
  source: string;
  outcome: string;
  lookups: Int;
  saved: Int;
}

interface RunRow {
  bucket: Int;
  team: string;
  runs: Int;
  ci: Int;
  agent: Int;
}

interface TransferRow {
  bucket: Int;
  team: string;
  direction: string;
  requests: Int;
  bytes: Int;
}

/** Merges rows from the three tables into one activity per time bucket and team. */
const toCells = (events: EventRow[], runs: RunRow[], transfers: TransferRow[]) => {
  const cells = new Map<string, Cell>();
  const activityOf = (bucket: Int, team: string) => {
    const key = `${bucket}/${team}`;
    const cell = cells.get(key) ?? { bucket: Number(bucket), team, activity: emptyActivity() };
    cells.set(key, cell);
    return cell.activity;
  };

  for (const row of events) {
    const activity = activityOf(row.bucket, row.team);
    const hit = row.outcome === 'HIT';
    if (row.source === 'LOCAL') {
      activity[hit ? 'localHits' : 'localMisses'] += Number(row.lookups);
      activity.localTimeSavedMs += Number(row.saved);
    } else {
      activity[hit ? 'remoteHits' : 'remoteMisses'] += Number(row.lookups);
      activity.remoteTimeSavedMs += Number(row.saved);
    }
  }
  for (const row of runs) {
    const activity = activityOf(row.bucket, row.team);
    activity.runs += Number(row.runs);
    activity.ciRuns += Number(row.ci);
    activity.agentRuns += Number(row.agent);
  }
  for (const row of transfers) {
    const activity = activityOf(row.bucket, row.team);
    if (row.direction === 'upload') {
      activity.uploads += Number(row.requests);
      activity.uploadedBytes += Number(row.bytes);
    } else {
      activity.downloads += Number(row.requests);
      activity.downloadedBytes += Number(row.bytes);
    }
  }
  return [...cells.values()];
};

/** Cache activity in `[from, to)`, one cell per time bucket and team. */
export const readActivity = async (db: Database, from: number, to: number, bucketMs: number) => {
  const [events, runs, transfers] = await Promise.all([
    db.sql<{ rows: EventRow[] }>`
      SELECT hour - hour % ${bucketMs} AS bucket, team, source, outcome,
        SUM(lookups) AS lookups, SUM(time_saved_ms) AS saved
      FROM cache_events WHERE hour >= ${from} AND hour < ${to}
      GROUP BY bucket, team, source, outcome`,
    db.sql<{ rows: RunRow[] }>`
      SELECT started_at - started_at % ${bucketMs} AS bucket, team,
        COUNT(*) AS runs, COUNT(NULLIF(ci, '')) AS ci, COUNT(NULLIF(agent, '')) AS agent
      FROM runs WHERE started_at >= ${from} AND started_at < ${to}
      GROUP BY bucket, team`,
    db.sql<{ rows: TransferRow[] }>`
      SELECT hour - hour % ${bucketMs} AS bucket, team, direction,
        SUM(requests) AS requests, SUM(bytes) AS bytes
      FROM transfers WHERE hour >= ${from} AND hour < ${to}
      GROUP BY bucket, team, direction`,
  ]);
  return toCells(events.rows, runs.rows, transfers.rows);
};

export const sumCells = (cells: readonly Cell[] = []) =>
  sumActivity(cells.map((cell) => cell.activity));
