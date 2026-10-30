import { createDatabase } from 'db0';
import sqlite from 'db0/connectors/node-sqlite';
import { expect, test } from 'vitest';

import { migrate } from '../src/utils/migrate';
import { buildStats } from '../src/utils/stats-report';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

test('shows no change from the previous period when traffic is steady', async () => {
  const db = createDatabase(sqlite({ name: ':memory:' }));
  await migrate(db);
  const currentHour = Date.UTC(2026, 9, 20, 0);
  const now = currentHour + 30 * MINUTE;
  for (let hour = currentHour - 20 * 24 * HOUR; hour <= currentHour; hour += HOUR) {
    await db.sql`INSERT INTO cache_events (hour, team, source, outcome, lookups, time_saved_ms)
      VALUES (${hour}, 'team_a', 'LOCAL', 'HIT', 2, 1000)`;
    for (const startedAt of [hour + 10 * MINUTE, hour + 45 * MINUTE].filter((at) => at <= now)) {
      await db.sql`INSERT INTO runs (session_id, team, started_at, ci, agent)
        VALUES (${`run_${startedAt}`}, 'team_a', ${startedAt}, '', '')`;
    }
  }

  const { totals } = await buildStats(db, { range: '7d', expirationHours: 720, now });

  // Each side holds six full days and the first hour of the seventh, which is 145 hourly rows. Runs
  // start at :10 and :45 past each hour, and only the :10 run of the last hour has started by :30.
  expect(totals.current).toMatchObject({ localHits: 290, localTimeSavedMs: 145_000, runs: 289 });
  expect(totals.previous).toMatchObject({ localHits: 290, localTimeSavedMs: 145_000, runs: 289 });
});
