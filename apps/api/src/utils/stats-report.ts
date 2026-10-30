import type { Share, Stats, StatsRange } from '@turborepo-remote-cache/dashboard/contract';

import type { Tally } from './inventory';
import type { Database } from './stats';
import type { Cell, Int } from './stats-activity';

import { readActivity, sumCells } from './stats-activity';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const RANGES = {
  '24h': { buckets: 24, bucketMs: HOUR },
  '7d': { buckets: 7, bucketMs: DAY },
  '30d': { buckets: 30, bucketMs: DAY },
  '90d': { buckets: 90, bucketMs: DAY },
} as const satisfies Record<StatsRange, { buckets: number; bucketMs: number }>;

const readAllTime = async (db: Database) => {
  const { rows } = await db.sql<{ rows: { saved: Int | null; since: Int | null }[] }>`
    SELECT SUM(time_saved_ms) AS saved, MIN(hour) AS since FROM cache_events`;
  const since = rows[0]?.since ?? null;
  return { timeSavedMs: Number(rows[0]?.saved ?? 0), since: since === null ? null : Number(since) };
};

interface ShareRows {
  rows: { name: string; count: Int }[];
}

const toShares = ({ rows }: ShareRows, unnamed: string): Share[] =>
  rows.map((row) => ({ name: row.name || unnamed, count: Number(row.count) }));

const readClients = async (db: Database, from: number, to: number) => {
  const [ci, agents, versions, platforms] = await Promise.all([
    db.sql<ShareRows>`SELECT ci AS name, COUNT(*) AS count FROM runs
      WHERE started_at >= ${from} AND started_at < ${to} GROUP BY ci ORDER BY count DESC`,
    db.sql<ShareRows>`SELECT agent AS name, COUNT(*) AS count FROM runs
      WHERE started_at >= ${from} AND started_at < ${to} AND agent <> ''
      GROUP BY agent ORDER BY count DESC`,
    db.sql<ShareRows>`SELECT turbo_version AS name, SUM(requests) AS count FROM transfers
      WHERE hour >= ${from} AND hour < ${to} GROUP BY turbo_version ORDER BY count DESC`,
    db.sql<ShareRows>`SELECT platform AS name, SUM(requests) AS count FROM transfers
      WHERE hour >= ${from} AND hour < ${to} GROUP BY platform ORDER BY count DESC`,
  ]);
  return {
    ci: toShares(ci, 'local'),
    agents: toShares(agents, 'unknown'),
    versions: toShares(versions, 'unknown'),
    platforms: toShares(platforms, 'unknown'),
  };
};

interface SnapshotRows {
  rows: { taken_at: Int; artifacts: Int; bytes: Int }[];
}

const toSnapshot = (row: SnapshotRows['rows'][number]) => ({
  takenAt: Number(row.taken_at),
  artifacts: Number(row.artifacts),
  bytes: Number(row.bytes),
});

/** The latest storage snapshot, what each team had stored then, and every snapshot in the range. */
const readStorage = async (db: Database, from: number, to: number) => {
  const [latest, history] = await Promise.all([
    db.sql<SnapshotRows>`SELECT taken_at, artifacts, bytes FROM storage_snapshots
      ORDER BY taken_at DESC LIMIT 1`,
    db.sql<SnapshotRows>`SELECT taken_at, artifacts, bytes FROM storage_snapshots
      WHERE taken_at >= ${from} AND taken_at < ${to} ORDER BY taken_at`,
  ]);
  const snapshot = latest.rows[0];
  if (!snapshot) {
    return { latest: null, teams: new Map<string, Tally>(), history: [] };
  }
  const teams = await db.sql<{ rows: { team: string; artifacts: Int; bytes: Int }[] }>`
    SELECT team, artifacts, bytes FROM storage_teams WHERE taken_at = ${snapshot.taken_at}`;
  return {
    latest: toSnapshot(snapshot),
    teams: new Map(
      teams.rows.map((row): [string, Tally] => [
        row.team,
        { artifacts: Number(row.artifacts), bytes: Number(row.bytes) },
      ]),
    ),
    history: history.rows.map(toSnapshot),
  };
};

const timeline = (from: number, count: number, step: number) =>
  Array.from({ length: count }, (_, index) => from + index * step);

/** Each team's activity in the range, what it had stored, and its time saved per bucket. */
const teamActivity = (
  byTeam: Map<string, Cell[]>,
  stored: Map<string, Tally>,
  starts: readonly number[],
) =>
  [...new Set([...byTeam.keys(), ...stored.keys()])].map((team) => {
    const cells = byTeam.get(team) ?? [];
    const saved = new Map(
      cells.map(({ bucket, activity }) => [
        bucket,
        activity.localTimeSavedMs + activity.remoteTimeSavedMs,
      ]),
    );
    return Object.assign({ team }, sumCells(cells), {
      storedArtifacts: stored.get(team)?.artifacts ?? 0,
      storedBytes: stored.get(team)?.bytes ?? 0,
      timeSavedSeries: starts.map((start) => saved.get(start) ?? 0),
    });
  });

export const buildStats = async (
  db: Database,
  {
    range,
    expirationHours,
    now = Date.now(),
  }: { range: StatsRange; expirationHours: number; now?: number },
): Promise<Stats> => {
  const { buckets, bucketMs } = RANGES[range];
  const from = now - (now % bucketMs) - (buckets - 1) * bucketMs;
  const to = from + buckets * bucketMs;
  const period = to - from;
  const elapsedEnd = now - (now % HOUR) + HOUR;

  // The last bucket is still in progress, so the previous range ends one period before the end of
  // the current hour, not at `from`.
  const [current, previous, allTime, clients, storage] = await Promise.all([
    readActivity(db, from, to, bucketMs),
    readActivity(db, from - period, elapsedEnd - period, bucketMs),
    readAllTime(db),
    readClients(db, from, to),
    readStorage(db, from, to),
  ]);
  const byBucket = Map.groupBy(current, (cell) => cell.bucket);
  const byTeam = Map.groupBy(current, (cell) => cell.team);
  const starts = timeline(from, buckets, bucketMs);

  return {
    enabled: true,
    generatedAt: now,
    range: { name: range, from, to, bucketMs },
    totals: { current: sumCells(current), previous: sumCells(previous) },
    series: starts.map((start) => Object.assign({ start }, sumCells(byBucket.get(start)))),
    allTime,
    storage: { expirationHours, latest: storage.latest, history: storage.history },
    teams: teamActivity(byTeam, storage.teams, starts),
    clients,
  };
};
