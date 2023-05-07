import { Env } from '..';
import { isDateOlderThan } from '../utils/date';

const CURSOR_SIZE = 500;

export async function deleteOldCache(env: Env) {
  const BUCKET_CUTOFF_HOURS = env.BUCKET_OBJECT_EXPIRATION_HOURS;
  let truncated = false;
  let cursor: string | undefined;
  let list: R2Objects;
  const keysMarkedForDeletion: string[] = [];

  do {
    list = await env.R2_STORE.list({ limit: CURSOR_SIZE, cursor });
    truncated = list.truncated;
    cursor = list.truncated ? list.cursor : undefined;

    for (const object of list.objects) {
      if (isDateOlderThan(object.uploaded, BUCKET_CUTOFF_HOURS)) {
        keysMarkedForDeletion.push(object.key);
      }
    }
  } while (truncated);

  if (keysMarkedForDeletion.length > 0) {
    // if (env.ENVIRONMENT === 'development') {
    //   console.log(`Deleting ${keysMarkedForDeletion.length} keys`, keysMarkedForDeletion);
    // }
    await env.R2_STORE.delete(keysMarkedForDeletion);
  }
}
