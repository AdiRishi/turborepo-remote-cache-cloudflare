import type { Files } from 'files-sdk';

import { isDateOlderThan } from '../utils/date';

// Keep pages below common provider bulk-operation limits.
export const CURSOR_SIZE = 500;

export interface DeleteOldCacheResult {
  deleted: number;
  skipped: number;
}

export async function deleteOldCache(
  files: Files,
  retentionHours: number,
): Promise<DeleteOldCacheResult> {
  if (retentionHours === 0) return { deleted: 0, skipped: 0 };

  let cursor: string | undefined;
  let skipped = 0;
  const keysForDeletion: string[][] = [];

  // Determine every candidate before deleting. Mutating a provider while
  // following its opaque listing cursor can otherwise skip objects.
  do {
    const page = await files.list({ cursor, limit: CURSOR_SIZE });
    const pageKeys: string[] = [];
    for (const item of page.items) {
      if (item.lastModified === undefined) {
        skipped += 1;
        continue;
      }
      if (isDateOlderThan(new Date(item.lastModified), retentionHours)) {
        pageKeys.push(item.key);
      }
    }
    if (pageKeys.length > 0) keysForDeletion.push(pageKeys);
    cursor = page.cursor;
  } while (cursor);

  let deleted = 0;
  for (const keys of keysForDeletion) {
    const result = await files.delete(keys, { concurrency: 16 });
    deleted += result.deleted.length;
    if (result.errors?.length) {
      throw result.errors[0].error;
    }
  }

  return { deleted, skipped };
}
