import { nitro } from 'nitro/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    nitro(
      // Each test file runs in its own process, so an in-memory database keeps their stats apart.
      process.env.VITEST
        ? { devDatabase: { default: { connector: 'sqlite', options: { name: ':memory:' } } } }
        : {},
    ),
  ],
  test: {
    coverage: {
      provider: 'istanbul',
      include: ['src/**'],
      reporter: ['text', 'html', 'clover', 'json'],
    },
    include: ['tests/**/*.test.ts'],
    env: {
      TURBO_TOKEN: 'test-token',
    },
  },
});
