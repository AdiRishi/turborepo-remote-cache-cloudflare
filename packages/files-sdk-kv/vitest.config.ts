import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: '2026-06-15',
        kvNamespaces: ['KV'],
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
