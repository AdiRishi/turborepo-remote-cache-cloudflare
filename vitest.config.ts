import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'miniflare',
    environmentOptions: {
      envPath: './.dev.vars',
    },
    reporters: ['verbose'],
    coverage: {
      provider: 'c8',
      reporter: ['text'],
    },
  },
});
