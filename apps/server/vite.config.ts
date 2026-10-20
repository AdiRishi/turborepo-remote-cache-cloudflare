import type { Nitro } from 'nitro/types';
import type { Plugin } from 'vite';

import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vitest/config';

// Nitro 3.0.260903-beta leaves its dev file watchers open after Vite closes, so Vitest cannot exit.
const closeNitroWithVite = (): Plugin => {
  let instance: Nitro | undefined;
  return {
    name: 'close-nitro-with-vite',
    apply: 'serve',
    nitro: {
      setup: (nitroInstance) => {
        instance = nitroInstance;
      },
    },
    closeBundle: () => instance?.close(),
  };
};

export default defineConfig({
  plugins: [nitro(), closeNitroWithVite()],
  test: {
    coverage: {
      provider: 'istanbul',
      include: ['server/**'],
      reporter: ['text', 'html', 'clover', 'json'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'nitro',
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/workerd/**'],
          environment: './tests/support/nitro-environment.ts',
          setupFiles: ['./tests/support/nitro-setup.ts'],
          env: {
            TURBO_TOKEN: 'test-token',
          },
        },
      },
      {
        plugins: [
          cloudflareTest({
            miniflare: {
              compatibilityDate: '2026-06-15',
              compatibilityFlags: ['nodejs_compat'],
              kvNamespaces: ['KV_STORE'],
              r2Buckets: ['R2_STORE'],
            },
          }),
        ],
        test: {
          name: 'workerd',
          include: ['tests/workerd/**/*.test.ts'],
        },
      },
    ],
  },
});
