import { Env } from '..';
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
  let truncated = false;
  let cursor: string | undefined;
  let list: R2Objects;
  const keysMarkedForDeletion: R2KeysForDeletion[] = [];

  do {
    list = await env.R2_STORE.list({ limit: CURSOR_SIZE, cursor });
    truncated = list.truncated;
    cursor = list.truncated ? list.cursor : undefined;

    /**
     * Deleting keys while iterating over the list can sometimes cause the list to be truncated.
     * So we mark the keys for deletion and delete after at least one additional iteration.
     */
    const keysAvailableForDeletion = keysMarkedForDeletion.shift();
    if (keysAvailableForDeletion) {
      await env.R2_STORE.delete(keysAvailableForDeletion.keys);
    }

    const keysForDeletion = new R2KeysForDeletion();
    for (const object of list.objects) {
      if (isDateOlderThan(object.uploaded, BUCKET_CUTOFF_HOURS)) {
        keysForDeletion.add(object.key);
      }
    }

    // Only append if there's keys to delete from this page
    if (keysForDeletion.keys.length > 0) {
      keysMarkedForDeletion.push(keysForDeletion);
    }
  } while (truncated);
  for (const keysForDeletion of keysMarkedForDeletion) {
    await env.R2_STORE.delete(keysForDeletion.keys);
  }
}
