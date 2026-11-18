import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@cbr/core': fileURLToPath(new URL('./packages/cbr/src/index.ts', import.meta.url)),
      '@cbr/data': fileURLToPath(new URL('./packages/data/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['packages/**/*.test.ts', 'tools/**/*.test.ts', 'apps/api/src/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
  },
});
