import { defineConfig } from 'nitro';

export default defineConfig({
  serverDir: './src',
  defaultPreset: 'cloudflare_module',
  compatibilityDate: '2026-06-15',
  errorHandler: './src/error.ts',
  noExternals: true,
  experimental: {
    tasks: true,
  },
  scheduledTasks: {
    '0 3 * * *': ['cache:delete-expired'],
  },
});
