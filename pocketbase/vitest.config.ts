import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000,
    include: ['**/*.test.ts'],
    // Run test files serially. Each file's beforeAll starts a PocketBase
    // container; if vitest runs files in parallel they race to start/stop
    // the same container and most calls fail with "Failed to start
    // PocketBase". singleFork forces one test file at a time, which is
    // slower (~30s vs ~6s locally) but reliable on CI where PB startup
    // is slower and a fresh container has no warm cache.
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