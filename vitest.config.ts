import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

/**
 * Kept separate from vite.config.ts on purpose: Vitest ships its own copy of
 * Vite, and mixing the React plugin's types with it produces a type conflict.
 * The engine tests are pure Node anyway — no plugin needed.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
});
