import { defineConfig } from 'nitro';

export default defineConfig({
  serverDir: './src',
  defaultPreset: 'cloudflare_module',
  compatibilityDate: '2026-06-15',
  errorHandler: './src/error.ts',
  noExternals: true,
  experimental: {
    database: true,
    tasks: true,
  },
  scheduledTasks: {
    '0 3 * * *': ['cache:delete-expired'],
  },
  modules: [
    // Nitro gives Node.js presets a SQLite database and other presets none, so Cloudflare builds use D1.
    (nitro) => {
      if (nitro.options.preset.startsWith('cloudflare')) {
        // `database` is undefined until configured, and a configured `default` wins.
        nitro.options.database = Object.assign(
          { default: { connector: 'cloudflare-d1', options: { bindingName: 'STATS_DB' } } },
          nitro.options.database,
        );
      }
    },
  ],
});
