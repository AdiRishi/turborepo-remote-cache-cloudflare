import type { FileInfo } from 'files-sdk';

const MILLISECONDS_PER_HOUR = 3_600_000;

/** Upper bounds of the age bins, in hours. A last bin holds everything older. */
export const AGE_BOUNDS = [24, 72, 168, 336, 720, 1440, 2160] as const;

/** Upper bounds of the size bins, in bytes. A last bin holds everything larger. */
export const SIZE_BOUNDS = [10_000, 100_000, 1_000_000, 10_000_000, 100_000_000] as const;

export interface Tally {
  artifacts: number;
  bytes: number;
}

export interface Inventory {
  takenAt: number;
  total: Tally;
  teams: Map<string, Tally>;
  ages: Tally[];
  sizes: Tally[];
}

const emptyTally = (): Tally => ({ artifacts: 0, bytes: 0 });

const binIndex = (bounds: readonly number[], value: number) => {
  const index = bounds.findIndex((bound) => value < bound);
  return index === -1 ? bounds.length : index;
};

const count = (tally: Tally | undefined, size: number) => {
  if (tally) {
    tally.artifacts += 1;
    tally.bytes += size;
  }
};

export const emptyInventory = (takenAt: number): Inventory => ({
  takenAt,
  total: emptyTally(),
  teams: new Map(),
  ages: Array.from({ length: AGE_BOUNDS.length + 1 }, emptyTally),
  sizes: Array.from({ length: SIZE_BOUNDS.length + 1 }, emptyTally),
});

/** Counts a stored artifact, whose key is `<team>/<hash>`. Objects outside that layout are skipped. */
export const addToInventory = (
  inventory: Inventory,
  { key, size, lastModified = inventory.takenAt }: Pick<FileInfo, 'key' | 'size' | 'lastModified'>,
) => {
  const separator = key.lastIndexOf('/');
  if (separator === -1) {
    return;
  }
  const team = key.slice(0, separator);
  const teamTally = inventory.teams.get(team) ?? emptyTally();
  inventory.teams.set(team, teamTally);

  count(inventory.total, size);
  count(teamTally, size);
  count(
    inventory.ages[
      binIndex(AGE_BOUNDS, (inventory.takenAt - lastModified) / MILLISECONDS_PER_HOUR)
    ],
    size,
  );
  count(inventory.sizes[binIndex(SIZE_BOUNDS, size)], size);
};
