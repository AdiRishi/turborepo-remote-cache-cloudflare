import type { components } from '@turborepo-remote-cache/spec';
import type { H3Event } from 'nitro';

import { useDatabase } from 'nitro/database';

import type { Inventory } from './inventory';

export type Database = ReturnType<typeof useDatabase>;

type SqlValue = Parameters<ReturnType<Database['prepare']>['all']>[number];

const MILLISECONDS_PER_HOUR = 3_600_000;

// D1 binds at most 100 parameters in one statement.
const MAX_PARAMETERS = 100;

// The statements are portable between SQLite (D1, node:sqlite, libSQL) and PostgreSQL.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS cache_events (
    hour BIGINT NOT NULL,
    team TEXT NOT NULL,
    source TEXT NOT NULL,
    outcome TEXT NOT NULL,
    lookups BIGINT NOT NULL,
    time_saved_ms BIGINT NOT NULL,
    PRIMARY KEY (hour, team, source, outcome)
  )`,
  `CREATE TABLE IF NOT EXISTS runs (
    session_id TEXT PRIMARY KEY,
    team TEXT NOT NULL,
    started_at BIGINT NOT NULL,
    ci TEXT NOT NULL,
    agent TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS runs_started_at ON runs (started_at)',
  `CREATE TABLE IF NOT EXISTS transfers (
    hour BIGINT NOT NULL,
    team TEXT NOT NULL,
    direction TEXT NOT NULL,
    turbo_version TEXT NOT NULL,
    platform TEXT NOT NULL,
    requests BIGINT NOT NULL,
    bytes BIGINT NOT NULL,
    PRIMARY KEY (hour, team, direction, turbo_version, platform)
  )`,
  `CREATE TABLE IF NOT EXISTS storage_snapshots (
    taken_at BIGINT PRIMARY KEY,
    artifacts BIGINT NOT NULL,
    bytes BIGINT NOT NULL,
    ages TEXT NOT NULL,
    sizes TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS storage_teams (
    taken_at BIGINT NOT NULL,
    team TEXT NOT NULL,
    artifacts BIGINT NOT NULL,
    bytes BIGINT NOT NULL,
    PRIMARY KEY (taken_at, team)
  )`,
];

let ready: Database | undefined;

/** Opens the stats database and creates its tables. Resolves to `undefined` when no database is configured. */
export const openStatsDatabase = async () => {
  if (ready) {
    return ready;
  }
  let database: Database;
  try {
    database = useDatabase();
    // Connectors open their connection here. The D1 connector throws when STATS_DB is not bound.
    await database.getInstance();
  } catch {
    return undefined;
  }
  // D1's `exec` runs each line as its own statement, so the multi-line DDL goes through `prepare`.
  for (const statement of SCHEMA) {
    await database.prepare(statement).run();
  }
  ready = database;
  return database;
};

/** Stats are best effort: a failure is logged and never reaches the caller. */
const withStatsDatabase = async (write: (database: Database) => Promise<void>) => {
  try {
    const database = await openStatsDatabase();
    if (database) {
      await write(database);
    }
  } catch (error) {
    console.error('[stats]', error);
  }
};

const inBackground = (event: H3Event, write: (database: Database) => Promise<void>) => {
  event.waitUntil(withStatsDatabase(write));
};

const insertRows = async <TColumn extends string>(
  database: Database,
  {
    table,
    columns,
    rows,
    onConflict = '',
  }: {
    table: string;
    columns: readonly TColumn[];
    rows: readonly Record<TColumn, SqlValue>[];
    onConflict?: string;
  },
) => {
  const rowsPerStatement = Math.floor(MAX_PARAMETERS / columns.length);
  const tuple = `(${columns.map(() => '?').join(', ')})`;
  for (let start = 0; start < rows.length; start += rowsPerStatement) {
    const chunk = rows.slice(start, start + rowsPerStatement);
    await database
      .prepare(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${chunk.map(() => tuple).join(', ')} ${onConflict}`,
      )
      .run(...chunk.flatMap((row) => columns.map((column) => row[column])));
  }
};

const hourOf = (time: number) => time - (time % MILLISECONDS_PER_HOUR);

// `turbo` sends `x-ai-agent` as `<agent>_<version>_agent`, such as `claude-code_2-1-312_agent`.
const agentName = (header: string | null) =>
  header?.split('_')[0]?.slice(0, 50).toLowerCase() ?? '';

// `turbo 2.11.9 1.98.0-nightly macos aarch64`: the turbo version, the Rust version, then the platform.
const TURBO_USER_AGENT = /^turbo (?<version>\S+) \S+ (?<os>\S+) (?<arch>\S+)/u;

// The spec requires `sessionId`, but the `turbo` client models it as optional.
type CacheEvent = Omit<components['schemas']['CacheEvent'], 'sessionId'> &
  Partial<Pick<components['schemas']['CacheEvent'], 'sessionId'>>;

interface OutcomeRow {
  hour: number;
  team: string;
  source: string;
  outcome: string;
  lookups: number;
  time_saved_ms: number;
}

/** Sums a batch per source and outcome. Only hits save time: their duration is the task they replayed. */
const outcomeRows = (
  events: readonly CacheEvent[],
  { hour, team }: Pick<OutcomeRow, 'hour' | 'team'>,
) => {
  const rows = new Map<string, OutcomeRow>();
  for (const { source, event: outcome, duration = 0 } of events) {
    const key = `${source}:${outcome}`;
    const row = rows.get(key) ?? { hour, team, source, outcome, lookups: 0, time_saved_ms: 0 };
    rows.set(key, row);
    row.lookups += 1;
    row.time_saved_ms += outcome === 'HIT' ? duration : 0;
  }
  return [...rows.values()];
};

/** Adds a batch from `POST /v8/artifacts/events` to the hourly totals, and records each new run. */
export const recordCacheEvents = (
  event: H3Event,
  { team, ci, events }: { team: string; ci: string | undefined; events: readonly CacheEvent[] },
) => {
  const now = Date.now();
  const outcomes = outcomeRows(events, { hour: hourOf(now), team });
  const sessions = new Set(events.flatMap(({ sessionId }) => (sessionId ? [sessionId] : [])));
  const run = {
    team,
    started_at: now,
    // `turbo` names CI providers like `GITHUB_ACTIONS`; other clients may send `github-actions`.
    ci: ci?.toUpperCase().replaceAll('-', '_') ?? '',
    agent: agentName(event.req.headers.get('x-ai-agent')),
  };

  inBackground(event, async (database) => {
    await insertRows(database, {
      table: 'cache_events',
      columns: ['hour', 'team', 'source', 'outcome', 'lookups', 'time_saved_ms'],
      rows: outcomes,
      onConflict: `ON CONFLICT (hour, team, source, outcome) DO UPDATE SET
        lookups = cache_events.lookups + excluded.lookups,
        time_saved_ms = cache_events.time_saved_ms + excluded.time_saved_ms`,
    });
    await insertRows(database, {
      table: 'runs',
      columns: ['session_id', 'team', 'started_at', 'ci', 'agent'],
      rows: [...sessions].map((sessionId) => Object.assign({ session_id: sessionId }, run)),
      onConflict: 'ON CONFLICT (session_id) DO NOTHING',
    });
  });
};

/** Adds an artifact upload or download to the hourly totals, with the `turbo` client that made it. */
export const recordTransfer = (
  event: H3Event,
  { team, direction, bytes }: { team: string; direction: 'upload' | 'download'; bytes: number },
) => {
  const client = TURBO_USER_AGENT.exec(event.req.headers.get('user-agent') ?? '')?.groups;
  const row = {
    hour: hourOf(Date.now()),
    team,
    direction,
    turbo_version: client?.version ?? '',
    platform: client ? `${client.os} ${client.arch}` : '',
    requests: 1,
    bytes,
  };

  inBackground(event, async (database) => {
    await insertRows(database, {
      table: 'transfers',
      columns: ['hour', 'team', 'direction', 'turbo_version', 'platform', 'requests', 'bytes'],
      rows: [row],
      onConflict: `ON CONFLICT (hour, team, direction, turbo_version, platform) DO UPDATE SET
        requests = transfers.requests + excluded.requests,
        bytes = transfers.bytes + excluded.bytes`,
    });
  });
};

/**
 * Stores the inventory that expiry took of the artifacts it kept. Two expiry runs in the same millisecond
 * describe the same store, so the second snapshot is dropped.
 */
export const recordStorageSnapshot = (inventory: Inventory) =>
  withStatsDatabase(async (database) => {
    await insertRows(database, {
      table: 'storage_snapshots',
      columns: ['taken_at', 'artifacts', 'bytes', 'ages', 'sizes'],
      rows: [
        {
          taken_at: inventory.takenAt,
          artifacts: inventory.total.artifacts,
          bytes: inventory.total.bytes,
          ages: JSON.stringify(inventory.ages),
          sizes: JSON.stringify(inventory.sizes),
        },
      ],
      onConflict: 'ON CONFLICT (taken_at) DO NOTHING',
    });
    await insertRows(database, {
      table: 'storage_teams',
      columns: ['taken_at', 'team', 'artifacts', 'bytes'],
      rows: [...inventory.teams].map(([team, { artifacts, bytes }]) => ({
        taken_at: inventory.takenAt,
        team,
        artifacts,
        bytes,
      })),
      onConflict: 'ON CONFLICT (taken_at, team) DO NOTHING',
    });
  });
