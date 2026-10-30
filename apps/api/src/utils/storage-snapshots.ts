import type { HistogramBin, StorageSnapshot } from '@turborepo-remote-cache/dashboard/contract';

import * as v from 'valibot';

import type { Tally } from './inventory';
import type { Database } from './stats';

import { AGE_BOUNDS, SIZE_BOUNDS } from './inventory';
import { Numeric, query } from './stats-queries';

const Tallies = v.pipe(
  v.string(),
  v.parseJson(),
  v.array(v.object({ artifacts: v.number(), bytes: v.number() })),
);

const toBins = (json: string, bounds: readonly number[]): HistogramBin[] =>
  v.parse(Tallies, json).map(({ artifacts, bytes }, index) => ({
    below: bounds[index] ?? null,
    artifacts,
    bytes,
  }));

const SnapshotRow = v.object({
  taken_at: Numeric,
  artifacts: Numeric,
  bytes: Numeric,
  ages: v.string(),
  sizes: v.string(),
});

const TeamTallyRow = v.object({ team: v.string(), artifacts: Numeric, bytes: Numeric });

/** The latest storage snapshot and what each team had stored at that time. */
export const latestSnapshot = async (database: Database) => {
  const [row] = await query(
    database,
    SnapshotRow,
    'SELECT taken_at, artifacts, bytes, ages, sizes FROM storage_snapshots ORDER BY taken_at DESC LIMIT 1',
  );
  const teams = new Map<string, Tally>();
  if (!row) {
    return { snapshot: null, teams };
  }
  const teamRows = await query(
    database,
    TeamTallyRow,
    'SELECT team, artifacts, bytes FROM storage_teams WHERE taken_at = ?',
    row.taken_at,
  );
  for (const { team, artifacts, bytes } of teamRows) {
    teams.set(team, { artifacts, bytes });
  }
  const snapshot: StorageSnapshot = {
    takenAt: row.taken_at,
    artifacts: row.artifacts,
    bytes: row.bytes,
    ages: toBins(row.ages, AGE_BOUNDS),
    sizes: toBins(row.sizes, SIZE_BOUNDS),
  };
  return { snapshot, teams };
};

export const storageHistory = async (
  database: Database,
  { from, to }: { from: number; to: number },
) =>
  (
    await query(
      database,
      v.object({ taken_at: Numeric, artifacts: Numeric, bytes: Numeric }),
      `SELECT taken_at, artifacts, bytes FROM storage_snapshots
      WHERE taken_at >= ? AND taken_at < ? ORDER BY taken_at`,
      from,
      to,
    )
  ).map(({ taken_at: takenAt, artifacts, bytes }) => ({ takenAt, artifacts, bytes }));
