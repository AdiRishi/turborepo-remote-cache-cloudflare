import type { FileInfo } from 'files-sdk';

export interface Tally {
  artifacts: number;
  bytes: number;
}

export interface Inventory {
  takenAt: number;
  total: Tally;
  teams: Map<string, Tally>;
}

const emptyTally = (): Tally => ({ artifacts: 0, bytes: 0 });

const count = (tally: Tally, size: number) => {
  tally.artifacts += 1;
  tally.bytes += size;
};

export const emptyInventory = (takenAt: number): Inventory => ({
  takenAt,
  total: emptyTally(),
  teams: new Map(),
});

/** Counts a stored artifact, whose key is `<team>/<hash>`. Objects outside that layout are skipped. */
export const addToInventory = (
  inventory: Inventory,
  { key, size }: Pick<FileInfo, 'key' | 'size'>,
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
};
