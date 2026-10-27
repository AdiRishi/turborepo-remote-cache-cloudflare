import type { components } from '@turborepo-remote-cache/spec';

import { defineHandler } from 'nitro';

export default defineHandler(
  () => ({ status: 'enabled' }) satisfies components['schemas']['CachingStatusResponse'],
);
