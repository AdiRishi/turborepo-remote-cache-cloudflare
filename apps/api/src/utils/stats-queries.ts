import type { Activity, Share } from '@turborepo-remote-cache/dashboard/contract';

import * as v from 'valibot';

import type { Database } from './stats';

export const DAY = 86_400_000;

// PostgreSQL returns BIGINT sums as strings, and every dialect returns NULL for a sum over no rows.
export const Numeric = v.pipe(
  v.union([v.number(), v.string(), v.bigint(), v.null()]),
  v.transform((value) => Number(value ?? 0)),
);

const Key = v.pipe(v.union([v.number(), v.string(), v.bigint()]), v.transform(String));

export const query = async <TSchema extends v.GenericSchema>(
  database: Database,
  schema: TSchema,
  sql: string,
  ...params: (string | number)[]
) => v.parse(v.array(schema), await database.prepare(sql).all(...params));

export const emptyActivity = (): Activity => ({
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

const addActivity = (a: Activity, b: Activity): Activity => ({
  localHits: a.localHits + b.localHits,
  localMisses: a.localMisses + b.localMisses,
  remoteHits: a.remoteHits + b.remoteHits,
  remoteMisses: a.remoteMisses + b.remoteMisses,
  localTimeSavedMs: a.localTimeSavedMs + b.localTimeSavedMs,
  remoteTimeSavedMs: a.remoteTimeSavedMs + b.remoteTimeSavedMs,
  runs: a.runs + b.runs,
  ciRuns: a.ciRuns + b.ciRuns,
  agentRuns: a.agentRuns + b.agentRuns,
  uploads: a.uploads + b.uploads,
  uploadedBytes: a.uploadedBytes + b.uploadedBytes,
  downloads: a.downloads + b.downloads,
  downloadedBytes: a.downloadedBytes + b.downloadedBytes,
});

export const sumActivity = (activities: Iterable<Activity>) =>
  [...activities].reduce((total, activity) => addActivity(total, activity), emptyActivity());

/** A SQL expression that groups rows by a table's time column: into time buckets, or by team. */
export type Grouping = (timeColumn: string) => string;

export const byBucket =
  (bucketMs: number): Grouping =>
  (column) =>
    `${column} - ${column} % ${bucketMs}`;

export const byTeam: Grouping = () => 'team';

interface Window {
  from: number;
  to: number;
  group: Grouping;
}

const EventRow = v.object({
  key: Key,
  local_hits: Numeric,
  local_misses: Numeric,
  remote_hits: Numeric,
  remote_misses: Numeric,
  local_time_saved_ms: Numeric,
  remote_time_saved_ms: Numeric,
});

const cacheEvents = async (database: Database, { from, to, group }: Window) =>
  (
    await query(
      database,
      EventRow,
      `SELECT ${group('hour')} AS key,
        SUM(CASE WHEN source = 'LOCAL' AND outcome = 'HIT' THEN lookups ELSE 0 END) AS local_hits,
        SUM(CASE WHEN source = 'LOCAL' AND outcome = 'MISS' THEN lookups ELSE 0 END) AS local_misses,
        SUM(CASE WHEN source = 'REMOTE' AND outcome = 'HIT' THEN lookups ELSE 0 END) AS remote_hits,
        SUM(CASE WHEN source = 'REMOTE' AND outcome = 'MISS' THEN lookups ELSE 0 END) AS remote_misses,
        SUM(CASE WHEN source = 'LOCAL' THEN time_saved_ms ELSE 0 END) AS local_time_saved_ms,
        SUM(CASE WHEN source = 'REMOTE' THEN time_saved_ms ELSE 0 END) AS remote_time_saved_ms
      FROM cache_events WHERE hour >= ? AND hour < ? GROUP BY key`,
      from,
      to,
    )
  ).map((row): [string, Partial<Activity>] => [
    row.key,
    {
      localHits: row.local_hits,
      localMisses: row.local_misses,
      remoteHits: row.remote_hits,
      remoteMisses: row.remote_misses,
      localTimeSavedMs: row.local_time_saved_ms,
      remoteTimeSavedMs: row.remote_time_saved_ms,
    },
  ]);

const RunRow = v.object({ key: Key, runs: Numeric, ci_runs: Numeric, agent_runs: Numeric });

const runs = async (database: Database, { from, to, group }: Window) =>
  (
    await query(
      database,
      RunRow,
      `SELECT ${group('started_at')} AS key,
        COUNT(*) AS runs,
        SUM(CASE WHEN ci <> '' THEN 1 ELSE 0 END) AS ci_runs,
        SUM(CASE WHEN agent <> '' THEN 1 ELSE 0 END) AS agent_runs
      FROM runs WHERE started_at >= ? AND started_at < ? GROUP BY key`,
      from,
      to,
    )
  ).map((row): [string, Partial<Activity>] => [
    row.key,
    { runs: row.runs, ciRuns: row.ci_runs, agentRuns: row.agent_runs },
  ]);

const TransferRow = v.object({
  key: Key,
  uploads: Numeric,
  uploaded_bytes: Numeric,
  downloads: Numeric,
  downloaded_bytes: Numeric,
});

const transfers = async (database: Database, { from, to, group }: Window) =>
  (
    await query(
      database,
      TransferRow,
      `SELECT ${group('hour')} AS key,
        SUM(CASE WHEN direction = 'upload' THEN requests ELSE 0 END) AS uploads,
        SUM(CASE WHEN direction = 'upload' THEN bytes ELSE 0 END) AS uploaded_bytes,
        SUM(CASE WHEN direction = 'download' THEN requests ELSE 0 END) AS downloads,
        SUM(CASE WHEN direction = 'download' THEN bytes ELSE 0 END) AS downloaded_bytes
      FROM transfers WHERE hour >= ? AND hour < ? GROUP BY key`,
      from,
      to,
    )
  ).map((row): [string, Partial<Activity>] => [
    row.key,
    {
      uploads: row.uploads,
      uploadedBytes: row.uploaded_bytes,
      downloads: row.downloads,
      downloadedBytes: row.downloaded_bytes,
    },
  ]);

/** Sums cache events, runs, and transfers in `[from, to)` into one activity per group. */
export const activityBy = async (database: Database, window: Window) => {
  const groups = new Map<string, Activity>();
  const parts = await Promise.all([
    cacheEvents(database, window),
    runs(database, window),
    transfers(database, window),
  ]);
  for (const [key, part] of parts.flat()) {
    groups.set(key, Object.assign(groups.get(key) ?? emptyActivity(), part));
  }
  return groups;
};

export const allTimeSaved = async (database: Database) => {
  const [row] = await query(
    database,
    v.object({ saved: Numeric, since: v.nullable(Numeric) }),
    'SELECT SUM(time_saved_ms) AS saved, MIN(hour) AS since FROM cache_events',
  );
  return { timeSavedMs: row?.saved ?? 0, since: row?.since ?? null };
};

const ShareRow = v.object({ name: v.string(), count: Numeric });

const shares = async (
  database: Database,
  { sql, from, to, unnamed }: { sql: string; from: number; to: number; unnamed: string },
): Promise<Share[]> =>
  (await query(database, ShareRow, sql, from, to)).map(({ name, count }) => ({
    name: name || unnamed,
    count,
  }));

export const clientShares = async (database: Database, { from, to }: Omit<Window, 'group'>) => {
  const [ci, agents, versions, platforms] = await Promise.all([
    shares(database, {
      sql: `SELECT ci AS name, COUNT(*) AS count FROM runs
        WHERE started_at >= ? AND started_at < ? GROUP BY ci ORDER BY count DESC`,
      from,
      to,
      unnamed: 'local',
    }),
    shares(database, {
      sql: `SELECT agent AS name, COUNT(*) AS count FROM runs
        WHERE started_at >= ? AND started_at < ? AND agent <> '' GROUP BY agent ORDER BY count DESC`,
      from,
      to,
      unnamed: 'unknown',
    }),
    shares(database, {
      sql: `SELECT turbo_version AS name, SUM(requests) AS count FROM transfers
        WHERE hour >= ? AND hour < ? GROUP BY turbo_version ORDER BY count DESC`,
      from,
      to,
      unnamed: 'unknown',
    }),
    shares(database, {
      sql: `SELECT platform AS name, SUM(requests) AS count FROM transfers
        WHERE hour >= ? AND hour < ? GROUP BY platform ORDER BY count DESC`,
      from,
      to,
      unnamed: 'unknown',
    }),
  ]);
  return { ci, agents, versions, platforms };
};
