import type { RuntimeEnv } from './env';

import { deleteOldCache, type DeleteOldCacheResult } from '../crons/deleteOldCache';
import { createStorageServices } from '../storage/files-storage';

export const runDeleteExpired = async (runtimeEnv: RuntimeEnv): Promise<DeleteOldCacheResult> => {
  try {
    const { files, retentionHours } = await createStorageServices(runtimeEnv);
    const result = await deleteOldCache(files, retentionHours);
    if (result.skipped > 0) {
      console.warn(
        JSON.stringify({
          message: 'Skipped cache entries without last-modified metadata',
          skipped: result.skipped,
        }),
      );
    }
    return result;
  } catch (error) {
    console.error(
      JSON.stringify({
        message: 'Failed to delete expired cache entries',
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    throw error;
  }
};
