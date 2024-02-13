import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'miniflare',
    environmentOptions: {
      envPath: './.dev.vars',
      modules: true,
      scriptPath: './dist/index.js',
      wranglerConfigPath: './wrangler.vitest.toml',
      bindings: { ENVIRONMENT: 'testing' },
    },
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'clover', 'json'],
    },
  },
});
