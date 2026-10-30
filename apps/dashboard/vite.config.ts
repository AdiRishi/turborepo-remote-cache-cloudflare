import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3001,
    // `pnpm dev` at the root also starts the API on port 3000.
    proxy: { '/stats': 'http://localhost:3000' },
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    tanstackStart({ spa: { enabled: true, prerender: { outputPath: '/index.html' } } }),
    // The React plugin must come after the Start plugin.
    react(),
    tailwindcss(),
  ],
});
