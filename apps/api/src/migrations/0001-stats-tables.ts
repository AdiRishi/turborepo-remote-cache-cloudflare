import type { Migration } from './index';

/** Creates the tables for cache events, runs, artifact transfers, and storage snapshots. */
const migration: Migration = async (db) => {
  await db.sql`CREATE TABLE IF NOT EXISTS cache_events (
    hour BIGINT NOT NULL,
    team TEXT NOT NULL,
    source TEXT NOT NULL,
    outcome TEXT NOT NULL,
    lookups BIGINT NOT NULL,
    time_saved_ms BIGINT NOT NULL,
    PRIMARY KEY (hour, team, source, outcome)
  )`;
  await db.sql`CREATE TABLE IF NOT EXISTS runs (
    session_id TEXT PRIMARY KEY,
    team TEXT NOT NULL,
    started_at BIGINT NOT NULL,
    ci TEXT NOT NULL,
    agent TEXT NOT NULL
  )`;
  await db.sql`CREATE INDEX IF NOT EXISTS runs_started_at ON runs (started_at)`;
  await db.sql`CREATE TABLE IF NOT EXISTS transfers (
    hour BIGINT NOT NULL,
    team TEXT NOT NULL,
    direction TEXT NOT NULL,
    turbo_version TEXT NOT NULL,
    platform TEXT NOT NULL,
    requests BIGINT NOT NULL,
    bytes BIGINT NOT NULL,
    PRIMARY KEY (hour, team, direction, turbo_version, platform)
  )`;
  await db.sql`CREATE TABLE IF NOT EXISTS storage_snapshots (
    taken_at BIGINT PRIMARY KEY,
    artifacts BIGINT NOT NULL,
    bytes BIGINT NOT NULL
  )`;
  await db.sql`CREATE TABLE IF NOT EXISTS storage_teams (
    taken_at BIGINT NOT NULL,
    team TEXT NOT NULL,
    artifacts BIGINT NOT NULL,
    bytes BIGINT NOT NULL,
    PRIMARY KEY (taken_at, team)
  )`;
};

export default migration;
