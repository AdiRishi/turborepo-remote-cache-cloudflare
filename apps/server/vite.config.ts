import { cloudflare } from '@cloudflare/vite-plugin';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    minify: true,
    sourcemap: true,
  },
  plugins: [cloudflare(), visualizer({ filename: 'dist/stats.html' })],
  resolve: {
    tsconfigPaths: true,
  },
});
