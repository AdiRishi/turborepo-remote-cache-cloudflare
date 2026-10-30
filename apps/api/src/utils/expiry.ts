import type { Files } from 'files-sdk';

import type { PlatformEnv } from './env';

import { readExpirationHours } from './config';
import { addToInventory, emptyInventory } from './inventory';
import { recordStorageSnapshot } from './stats';
import { openStorage } from './storage';

const MILLISECONDS_PER_HOUR = 3_600_000;
const PAGE_SIZE = 1000;

/**
 * Deletes every stored object older than `maxAgeHours`, and objects whose age the store cannot report,
 * and takes an inventory of the objects it keeps.
 * Each page is deleted before the next one is listed. That is safe because list cursors mark a position
 * after the last returned key, so deleting returned keys never shifts later pages.
 */
export const deleteExpiredArtifacts = async (storage: Files, maxAgeHours: number) => {
  const now = Date.now();
  const cutoff = now - maxAgeHours * MILLISECONDS_PER_HOUR;
  const inventory = emptyInventory(now);
  let deleted = 0;
  let cursor: string | undefined;
  do {
    const page = await storage.list({ cursor, limit: PAGE_SIZE });
    const expired: string[] = [];
    for (const item of page.items) {
      if (item.lastModified === undefined || item.lastModified <= cutoff) {
        expired.push(item.key);
      } else {
        addToInventory(inventory, item);
      }
    }
    if (expired.length > 0) {
      const { errors } = await storage.delete(expired);
      if (errors) {
        throw new Error(`Failed to delete ${errors.length} expired artifacts`, { cause: errors });
      }
      deleted += expired.length;
    }
    cursor = page.cursor;
  } while (cursor);
  return { deleted, inventory };
};

/** Runs expiry against the configured store and records what remains for the dashboard. */
export const expireArtifacts = async (env: PlatformEnv, maxAgeHours = readExpirationHours(env)) => {
  const { deleted, inventory } = await deleteExpiredArtifacts(openStorage(env), maxAgeHours);
  await recordStorageSnapshot(inventory);
  return deleted;
};
