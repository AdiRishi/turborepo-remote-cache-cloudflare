import { defineTask } from 'nitro/task';

import { taskEnv } from '../../utils/env';
import { expireArtifacts } from '../../utils/expiry';

export default defineTask({
  meta: {
    description: 'Delete artifacts older than BUCKET_OBJECT_EXPIRATION_HOURS',
  },
  async run({ context }) {
    const deleted = await expireArtifacts(taskEnv(context));
    return { result: { deleted } };
  },
});
