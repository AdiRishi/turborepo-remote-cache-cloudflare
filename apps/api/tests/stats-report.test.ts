import { createDatabase } from 'db0';
import sqlite from 'db0/connectors/node-sqlite';
import { expect, test } from 'vitest';

import { migrate } from '../src/utils/migrate';
import { buildStats } from '../src/utils/stats-report';

const HOUR = 3_600_000;

test('shows no change from the previous period when traffic is steady', async () => {
  const db = createDatabase(sqlite({ name: ':memory:' }));
  await migrate(db);
  const currentHour = Date.UTC(2026, 9, 20, 0);
  for (let hour = currentHour - 20 * 24 * HOUR; hour <= currentHour; hour += HOUR) {
    await db.sql`INSERT INTO cache_events (hour, team, source, outcome, lookups, time_saved_ms)
      VALUES (${hour}, 'team_a', 'LOCAL', 'HIT', 2, 1000)`;
  }

  const { totals } = await buildStats(db, {
    range: '7d',
    expirationHours: 720,
    now: currentHour + 30 * 60_000,
  });

  // Each side holds six full days and the first hour of the seventh, which is 145 hours.
  expect(totals.current).toMatchObject({ localHits: 290, localTimeSavedMs: 145_000 });
  expect(totals.previous).toMatchObject({ localHits: 290, localTimeSavedMs: 145_000 });
});
