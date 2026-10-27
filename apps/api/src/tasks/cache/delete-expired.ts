import { defineTask } from 'nitro/task';

import { readExpirationHours } from '../../utils/config';
import { taskEnv } from '../../utils/env';
import { deleteExpiredArtifacts } from '../../utils/expiry';
import { openStorage } from '../../utils/storage';

export default defineTask({
  meta: {
    description: 'Delete artifacts older than BUCKET_OBJECT_EXPIRATION_HOURS',
  },
  async run({ context }) {
    const env = taskEnv(context);
    const deleted = await deleteExpiredArtifacts(openStorage(env), readExpirationHours(env));
    return { result: { deleted } };
  },
});
