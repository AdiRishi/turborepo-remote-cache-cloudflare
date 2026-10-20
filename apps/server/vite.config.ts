import { cloudflare } from '@cloudflare/vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    minify: true,
    sourcemap: true,
  },
  plugins: [cloudflare()],
  resolve: {
    tsconfigPaths: true,
  },
});
