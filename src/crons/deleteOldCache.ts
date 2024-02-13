import { Env } from '..';
import { ListResultWithMetadata } from '../storage';
import { isDateOlderThan } from '../utils/date';

// Cursor size should be kept below 1000 to avoid limits on bulk operations
export const CURSOR_SIZE = 500;

class R2KeysForDeletion {
  keys: string[] = [];
  add(key: string) {
    this.keys.push(key);
  }
}

export async function deleteOldCache(env: Env): Promise<void> {
  const BUCKET_CUTOFF_HOURS = env.BUCKET_OBJECT_EXPIRATION_HOURS;
  const storage = env.STORAGE_MANAGER.getActiveStorage();
  let truncated = false;
  let cursor: string | undefined;
  let list: ListResultWithMetadata;
  const keysMarkedForDeletion: R2KeysForDeletion[] = [];

  do {
    list = await storage.listWithMetadata({ limit: CURSOR_SIZE, cursor });
    truncated = list.truncated;
    cursor = list.cursor;

    /**
     * Deleting keys while iterating over the list can sometimes cause the list to be truncated.
     * So we mark the keys for deletion and delete after at least one additional iteration.
     */
    const keysAvailableForDeletion = keysMarkedForDeletion.shift();
    if (keysAvailableForDeletion) {
      await storage.delete(keysAvailableForDeletion.keys);
    }

    const keysForDeletion = new R2KeysForDeletion();
    for (const keyWithMeta of list.keys) {
      const createdAt = keyWithMeta.metadata?.staticMetadata.createdAt;
      if (!createdAt || isDateOlderThan(createdAt, BUCKET_CUTOFF_HOURS)) {
        keysForDeletion.add(keyWithMeta.key);
      }
    }

    // Only append if there's keys to delete from this page
    if (keysForDeletion.keys.length > 0) {
      keysMarkedForDeletion.push(keysForDeletion);
    }
  } while (truncated);
  for (const keysForDeletion of keysMarkedForDeletion) {
    await storage.delete(keysForDeletion.keys);
  }
}
