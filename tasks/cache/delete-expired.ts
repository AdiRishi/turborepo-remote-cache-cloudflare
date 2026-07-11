import { defineTask } from 'nitro/task';

import { resolveTaskRuntimeEnv } from '~/runtime/nitro';
import { runDeleteExpired } from '~/runtime/retention';

export default defineTask({
  meta: {
    name: 'cache:delete-expired',
    description: 'Delete expired cache artifacts',
  },
  async run({ context }) {
    const result = await runDeleteExpired(resolveTaskRuntimeEnv(context));
    return { result };
  },
});
