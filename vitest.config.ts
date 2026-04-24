import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

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
    reporters: ['verbose'],
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html', 'clover', 'json'],
    },
  },
});
