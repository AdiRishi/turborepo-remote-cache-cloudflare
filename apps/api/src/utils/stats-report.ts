import type {
  HistogramBin,
  Share,
  Stats,
  StatsRange,
} from '@turborepo-remote-cache/dashboard/contract';

import type { Tally } from './inventory';
import type { Database } from './stats';
import type { Int } from './stats-activity';

import { AGE_BOUNDS, SIZE_BOUNDS } from './inventory';
import { readActivity, sumCells } from './stats-activity';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const CALENDAR_DAYS = 53 * 7;

const RANGES = {
  '24h': { buckets: 24, bucketMs: HOUR },
  '7d': { buckets: 7, bucketMs: DAY },
  '30d': { buckets: 30, bucketMs: DAY },
  '90d': { buckets: 90, bucketMs: DAY },
} as const satisfies Record<StatsRange, { buckets: number; bucketMs: number }>;

/** Runs and time saved per UTC day from `from` onwards, keyed by the day's start. */
const readCalendar = async (db: Database, from: number) => {
  const [saved, runs] = await Promise.all([
    db.sql<{ rows: { day: Int; saved: Int }[] }>`
      SELECT hour - hour % ${DAY} AS day, SUM(time_saved_ms) AS saved
      FROM cache_events WHERE hour >= ${from} GROUP BY day`,
    db.sql<{ rows: { day: Int; runs: Int }[] }>`
      SELECT started_at - started_at % ${DAY} AS day, COUNT(*) AS runs
      FROM runs WHERE started_at >= ${from} GROUP BY day`,
  ]);
  return {
    saved: new Map(saved.rows.map((row) => [Number(row.day), Number(row.saved)])),
    runs: new Map(runs.rows.map((row) => [Number(row.day), Number(row.runs)])),
  };
};

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
  const [teams, bins] = await Promise.all([
    db.sql<{ rows: { team: string; artifacts: Int; bytes: Int }[] }>`
      SELECT team, artifacts, bytes FROM storage_teams WHERE taken_at = ${snapshot.taken_at}`,
    db.sql<{ rows: { histogram: string; artifacts: Int; bytes: Int }[] }>`
      SELECT histogram, artifacts, bytes FROM storage_bins
      WHERE taken_at = ${snapshot.taken_at} ORDER BY histogram, bin`,
  ]);
  const histogram = (name: string, bounds: readonly number[]): HistogramBin[] =>
    bins.rows
      .filter((row) => row.histogram === name)
      .map((row, index) => ({
        below: bounds[index] ?? null,
        artifacts: Number(row.artifacts),
        bytes: Number(row.bytes),
      }));
  return {
    latest: {
      ...toSnapshot(snapshot),
      ages: histogram('age', AGE_BOUNDS),
      sizes: histogram('size', SIZE_BOUNDS),
    },
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
  const calendarFrom = now - (now % DAY) - (CALENDAR_DAYS - 1) * DAY;

  // One read covers this range and the equally long range before it, for the comparison.
  const [cells, calendar, allTime, clients, storage] = await Promise.all([
    readActivity(db, from - (to - from), to, bucketMs),
    readCalendar(db, calendarFrom),
    readAllTime(db),
    readClients(db, from, to),
    readStorage(db, from, to),
  ]);
  const current = cells.filter((cell) => cell.bucket >= from);
  const previous = cells.filter((cell) => cell.bucket < from);
  const byBucket = Map.groupBy(current, (cell) => cell.bucket);
  const byTeam = Map.groupBy(current, (cell) => cell.team);

  return {
    enabled: true,
    generatedAt: now,
    range: { name: range, from, to, bucketMs },
    totals: { current: sumCells(current), previous: sumCells(previous) },
    series: timeline(from, buckets, bucketMs).map((start) =>
      Object.assign({ start }, sumCells(byBucket.get(start))),
    ),
    allTime,
    calendar: timeline(calendarFrom, CALENDAR_DAYS, DAY).map((day) => ({
      day,
      runs: calendar.runs.get(day) ?? 0,
      timeSavedMs: calendar.saved.get(day) ?? 0,
    })),
    storage: { expirationHours, latest: storage.latest, history: storage.history },
    teams: [...new Set([...byTeam.keys(), ...storage.teams.keys()])].map((team) =>
      Object.assign({ team }, sumCells(byTeam.get(team)), {
        storedArtifacts: storage.teams.get(team)?.artifacts ?? 0,
        storedBytes: storage.teams.get(team)?.bytes ?? 0,
      }),
    ),
    clients,
  };
};
