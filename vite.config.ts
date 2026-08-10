import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// The game is served from https://<user>.github.io/moneymile/ in production and
// from / during local development. `base` must match or every asset 404s.
const base = process.env.MM_BASE ?? (process.env.NODE_ENV === 'production' ? '/moneymile/' : '/');

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
