import { defineConfig } from 'nitro';

export default defineConfig({
  compatibilityDate: '2026-07-08',
  preset: process.env.NITRO_PRESET ?? 'cloudflare_module',
  cloudflare: {
    dev: process.env.NITRO_CLOUDFLARE_DEV_CONFIG_PATH
      ? {
          configPath: process.env.NITRO_CLOUDFLARE_DEV_CONFIG_PATH,
          persistDir: process.env.NITRO_CLOUDFLARE_DEV_PERSIST_DIR,
        }
      : undefined,
  },
  serverDir: './',
  serverEntry: './server.ts',
  alias: {
    '~': './src',
  },
  exportConditions: ['module'],
  rolldownConfig: {
    resolve: {
      mainFields: ['module', 'main'],
    },
  },
  experimental: {
    tasks: true,
  },
  scheduledTasks: {
    '0 3 * * *': 'cache:delete-expired',
  },
});
