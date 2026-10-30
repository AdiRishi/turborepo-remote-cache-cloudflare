import type { components } from '@turborepo-remote-cache/spec';
import type { H3Event } from 'nitro';

import { useDatabase } from 'nitro/database';

import type { Inventory } from './inventory';

import { migrate } from './migrate';

export type Database = ReturnType<typeof useDatabase>;

const HOUR = 3_600_000;

// `turbo 2.11.9 1.98.0-nightly macos aarch64`: the turbo version, the Rust version, then the platform.
const TURBO_USER_AGENT = /^turbo (?<version>\S+) \S+ (?<os>\S+) (?<arch>\S+)/u;

// The spec requires `sessionId`, but the `turbo` client models it as optional.
type CacheEvent = Omit<components['schemas']['CacheEvent'], 'sessionId'> &
  Partial<Pick<components['schemas']['CacheEvent'], 'sessionId'>>;

let migrated: Promise<void> | undefined;

/** Returns the migrated stats database, or `undefined` when none is configured. */
export const useStatsDatabase = async () => {
  let db: Database;
  try {
    db = useDatabase();
    // The D1 connector looks up its binding here, so this throws when STATS_DB is not bound.
    await db.getInstance();
  } catch {
    return undefined;
  }
  // Migrate once per isolate. Requests that arrive meanwhile wait for the same run, and a failed run is
  // retried by the next request.
  migrated ??= migrate(db).catch((error: unknown) => {
    migrated = undefined;
    throw error;
  });
  await migrated;
  return db;
};

/** Writes stats after the response. Stats are best effort, so a failure is logged and dropped. */
const writeAfterResponse = (event: H3Event, write: (db: Database) => Promise<void>) => {
  event.waitUntil(
    useStatsDatabase()
      .then((db) => db && write(db))
      .catch((error: unknown) => {
        console.error('[stats]', error);
      }),
  );
};

/** Adds a batch from `POST /v8/artifacts/events` to the hourly totals, and records each new run. */
export const recordCacheEvents = (
  event: H3Event,
  { team, ci, events }: { team: string; ci: string | undefined; events: readonly CacheEvent[] },
) => {
  const now = Date.now();
  const hour = now - (now % HOUR);
  // `turbo` names CI providers like `GITHUB_ACTIONS`; other clients may send `github-actions`.
  const provider = ci?.toUpperCase().replaceAll('-', '_') ?? '';
  // `turbo` sends `x-ai-agent` as `<agent>_<version>_agent`, such as `claude-code_2-1-312_agent`.
  const agent =
    event.req.headers.get('x-ai-agent')?.split('_')[0]?.slice(0, 50).toLowerCase() ?? '';
  const sessions = new Set(events.flatMap(({ sessionId }) => (sessionId ? [sessionId] : [])));

  writeAfterResponse(event, async (db) => {
    for (const source of ['LOCAL', 'REMOTE'] as const) {
      for (const outcome of ['HIT', 'MISS'] as const) {
        const matching = events.filter((e) => e.source === source && e.event === outcome);
        if (matching.length === 0) {
          continue;
        }
        // A hit's duration is the run time of the task it replayed.
        const saved =
          outcome === 'HIT' ? matching.reduce((sum, { duration = 0 }) => sum + duration, 0) : 0;
        await db.sql`INSERT INTO cache_events (hour, team, source, outcome, lookups, time_saved_ms)
          VALUES (${hour}, ${team}, ${source}, ${outcome}, ${matching.length}, ${saved})
          ON CONFLICT (hour, team, source, outcome) DO UPDATE SET
            lookups = cache_events.lookups + excluded.lookups,
            time_saved_ms = cache_events.time_saved_ms + excluded.time_saved_ms`;
      }
    }
    for (const sessionId of sessions) {
      await db.sql`INSERT INTO runs (session_id, team, started_at, ci, agent)
        VALUES (${sessionId}, ${team}, ${now}, ${provider}, ${agent})
        ON CONFLICT (session_id) DO NOTHING`;
    }
  });
};

/** Adds an artifact upload or download to the hourly totals, with the `turbo` client that made it. */
export const recordTransfer = (
  event: H3Event,
  { team, direction, bytes }: { team: string; direction: 'upload' | 'download'; bytes: number },
) => {
  const now = Date.now();
  const hour = now - (now % HOUR);
  const client = TURBO_USER_AGENT.exec(event.req.headers.get('user-agent') ?? '')?.groups;
  const version = client?.version ?? '';
  const platform = client ? `${client.os} ${client.arch}` : '';

  writeAfterResponse(event, async (db) => {
    await db.sql`INSERT INTO transfers (hour, team, direction, turbo_version, platform, requests, bytes)
      VALUES (${hour}, ${team}, ${direction}, ${version}, ${platform}, 1, ${bytes})
      ON CONFLICT (hour, team, direction, turbo_version, platform) DO UPDATE SET
        requests = transfers.requests + excluded.requests,
        bytes = transfers.bytes + excluded.bytes`;
  });
};

/**
 * Stores the inventory that expiry took of the artifacts it kept. Two expiry runs in the same
 * millisecond describe the same store, so the second snapshot is dropped.
 */
export const recordStorageSnapshot = async ({ takenAt, total, teams }: Inventory) => {
  try {
    const db = await useStatsDatabase();
    if (!db) {
      return;
    }
    await db.sql`INSERT INTO storage_snapshots (taken_at, artifacts, bytes)
      VALUES (${takenAt}, ${total.artifacts}, ${total.bytes})
      ON CONFLICT (taken_at) DO NOTHING`;
    for (const [team, { artifacts, bytes }] of teams) {
      await db.sql`INSERT INTO storage_teams (taken_at, team, artifacts, bytes)
        VALUES (${takenAt}, ${team}, ${artifacts}, ${bytes})
        ON CONFLICT (taken_at, team) DO NOTHING`;
    }
  } catch (error) {
    console.error('[stats]', error);
  }
};
