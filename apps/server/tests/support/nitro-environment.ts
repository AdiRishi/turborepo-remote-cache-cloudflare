import type { Environment } from 'vitest/runtime';

export default {
  name: 'nitro',
  viteEnvironment: 'nitro',
  setup: () => ({ teardown: () => undefined }),
} satisfies Environment;
