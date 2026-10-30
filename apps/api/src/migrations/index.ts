import type { Database } from '../utils/stats';

import statsTables from './0001-stats-tables';

/**
 * Changes the stats database from one version to the next. It can create or alter tables and move
 * data with `db.sql`, and must run on SQLite (D1, node:sqlite, libSQL) and PostgreSQL.
 */
export type Migration = (db: Database) => Promise<void>;

/**
 * Every migration, oldest first. A migration's version is its position in this list, so only append:
 * never edit, reorder, or remove a migration that has shipped.
 *
 * Isolates that start together after a deploy can run the same migration at the same time, and D1 has
 * no transactions to stop them. Write each migration so that running it twice is harmless: `IF NOT
 * EXISTS` for DDL, `ON CONFLICT DO NOTHING` for copied rows, and updates that are safe to repeat.
 *
 * The previous release keeps serving requests while a deploy rolls out, so add tables, columns with
 * defaults, and backfills. Drop or rename only in a later release, once no code reads the old shape.
 */
export const MIGRATIONS: readonly Migration[] = [statsTables];
