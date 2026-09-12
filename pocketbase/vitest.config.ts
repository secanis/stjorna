import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000,
    include: ['**/*.test.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    globalTeardown: ['./tests/global-teardown.ts'],
    // Single process (no forks) — globalSetup/Teardown run once per run
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname),
    }
  },
  plugins: [],
});