import { defineHandler } from 'nitro';

import type { components } from '../../../../openapi/turborepo';

export default defineHandler(
  () => ({ status: 'enabled' }) satisfies components['schemas']['CachingStatusResponse'],
);
