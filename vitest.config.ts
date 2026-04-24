import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

const ciTimeout = process.env.CI ? 15_000 : undefined;

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: './wrangler.jsonc',
      },
      miniflare: {
        bindings: {
          ENVIRONMENT: 'testing',
          TURBO_TOKEN: 'test-token',
        },
        kvNamespaces: ['KV_STORE'],
      },
    }),
  ],
  test: {
    hookTimeout: ciTimeout,
    testTimeout: ciTimeout,
    reporters: ['verbose'],
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html', 'clover', 'json'],
    },
  },
});
