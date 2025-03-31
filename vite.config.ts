import { cloudflare } from '@cloudflare/vite-plugin';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  build: {
    minify: true,
    sourcemap: true,
  },
  plugins: [tsconfigPaths(), cloudflare(), visualizer({ filename: 'dist/stats.html' })],
});
