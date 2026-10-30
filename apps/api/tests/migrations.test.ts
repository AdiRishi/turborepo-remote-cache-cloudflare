import { createDatabase } from 'db0';
import sqlite from 'db0/connectors/node-sqlite';
import { describe, expect, test } from 'vitest';

import type { Migration } from '../src/migrations';

import { MIGRATIONS } from '../src/migrations';
import { migrate } from '../src/utils/migrate';

const openDatabase = () => createDatabase(sqlite({ name: ':memory:' }));

const appliedVersions = async (db: ReturnType<typeof openDatabase>) => {
  const { rows } = await db.sql<{ rows: { version: number }[] }>`
    SELECT version FROM schema_migrations ORDER BY version`;
  return rows.map(({ version }) => version);
};

const createNotes: Migration = async (db) => {
  await db.sql`CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, body TEXT NOT NULL)`;
  await db.sql`INSERT INTO notes (id, body) VALUES (1, 'first') ON CONFLICT (id) DO NOTHING`;
};

const addAuthor: Migration = async (db) => {
  await db.sql`ALTER TABLE notes ADD COLUMN author TEXT NOT NULL DEFAULT ''`;
  await db.sql`UPDATE notes SET author = 'unknown' WHERE author = ''`;
};

const failing: Migration = () => Promise.reject(new Error('connection lost'));

describe('migrate', () => {
  test('brings a new database to the latest version of the stats schema', async () => {
    const db = openDatabase();
    await migrate(db);

    expect(await appliedVersions(db)).toEqual(MIGRATIONS.map((_, index) => index + 1));
    const { rows } = await db.sql`SELECT COUNT(*) AS count FROM cache_events`;
    expect(rows).toEqual([{ count: 0 }]);
  });

  test('runs only the migrations a database is missing, including their data changes', async () => {
    const db = openDatabase();
    await migrate(db, [createNotes]);
    await db.sql`INSERT INTO notes (id, body) VALUES (2, 'second')`;

    await migrate(db, [createNotes, addAuthor]);
    await migrate(db, [createNotes, addAuthor]);

    expect(await appliedVersions(db)).toEqual([1, 2]);
    const { rows } = await db.sql`SELECT id, body, author FROM notes ORDER BY id`;
    expect(rows).toEqual([
      { id: 1, body: 'first', author: 'unknown' },
      { id: 2, body: 'second', author: 'unknown' },
    ]);
  });

  test('records nothing for a migration that fails, and runs it again next time', async () => {
    const db = openDatabase();
    await expect(migrate(db, [createNotes, failing])).rejects.toThrow('connection lost');
    expect(await appliedVersions(db)).toEqual([1]);

    await migrate(db, [createNotes, addAuthor]);
    expect(await appliedVersions(db)).toEqual([1, 2]);
  });
});
