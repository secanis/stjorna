import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const isCI = !!process.env.CI;

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000,
    // In CI we skip the Docker-based PocketBase integration tests because
    // they are too flaky on shared runners. Pure unit tests (*.unit.test.ts)
    // still run. Locally the full suite including integration tests runs.
    include: isCI ? ['**/*.unit.test.ts'] : ['**/*.test.ts', '**/*.unit.test.ts'],
    // global-setup.ts returns the teardown (vitest has no globalTeardown option)
    globalSetup: isCI ? [] : ['./tests/global-setup.ts'],
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