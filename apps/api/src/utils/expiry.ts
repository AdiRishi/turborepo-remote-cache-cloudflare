import type { Files } from 'files-sdk';

const MILLISECONDS_PER_HOUR = 3_600_000;
const PAGE_SIZE = 1000;

/**
 * Deletes every stored object older than `maxAgeHours`, and objects whose age the store cannot report.
 * Each page is deleted before the next one is listed. That is safe because list cursors mark a position
 * after the last returned key, so deleting returned keys never shifts later pages.
 */
export const deleteExpiredArtifacts = async (storage: Files, maxAgeHours: number) => {
  const cutoff = Date.now() - maxAgeHours * MILLISECONDS_PER_HOUR;
  let deleted = 0;
  let cursor: string | undefined;
  do {
    const page = await storage.list({ cursor, limit: PAGE_SIZE });
    const expired = page.items
      .filter(({ lastModified }) => lastModified === undefined || lastModified <= cutoff)
      .map(({ key }) => key);
    if (expired.length > 0) {
      const { errors } = await storage.delete(expired);
      if (errors) {
        throw new Error(`Failed to delete ${errors.length} expired artifacts`, { cause: errors });
      }
      deleted += expired.length;
    }
    cursor = page.cursor;
  } while (cursor);
  return deleted;
};
