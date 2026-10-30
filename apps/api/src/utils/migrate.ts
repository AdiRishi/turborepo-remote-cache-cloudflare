import type { Migration } from '../migrations';
import type { Database } from './stats';

import { MIGRATIONS } from '../migrations';

/**
 * Runs the migrations the database hasn't applied yet, in order, and records each one after it
 * succeeds. On an up-to-date database this is one `CREATE TABLE IF NOT EXISTS` and one `SELECT`.
 */
export const migrate = async (db: Database, migrations: readonly Migration[] = MIGRATIONS) => {
  await db.sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at BIGINT NOT NULL
  )`;
  const { rows } = await db.sql<{ rows: { version: number | string | null }[] }>`
    SELECT MAX(version) AS version FROM schema_migrations`;
  const applied = Number(rows[0]?.version ?? 0);

  for (const [index, migration] of migrations.entries()) {
    const version = index + 1;
    if (version > applied) {
      await migration(db);
      await db.sql`INSERT INTO schema_migrations (version, applied_at)
        VALUES (${version}, ${Date.now()})
        ON CONFLICT (version) DO NOTHING`;
    }
  }
};
