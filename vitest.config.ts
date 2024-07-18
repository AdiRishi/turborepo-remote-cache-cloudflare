import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineWorkersConfig({
  plugins: [tsconfigPaths()],
  test: {
    poolOptions: {
      workers: {
        miniflare: {
          bindings: {
            ENVIRONMENT: 'testing',
          },
        },
        wrangler: {
          configPath: './wrangler.vitest.toml',
        },
      },
    },
    reporters: ['verbose'],
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html', 'clover', 'json'],
    },
  },
});
