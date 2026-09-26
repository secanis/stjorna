import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

// T-09: the backend integration tests now run in CI as well as
// locally. The previous "isCI ? unit-only" branch was a footgun —
// every test that proved a T-01..T-08 fix would pass on a developer's
// laptop and silently be skipped on a PR. The container-based
// integration tests run the SAME PB image CI builds, so there is no
// reason to skip them. The full suite must run on every PR.

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000,
    include: ['**/*.test.ts', '**/*.unit.test.ts'],
    // globalSetup.ts returns the teardown (vitest has no globalTeardown option)
    globalSetup: ['./tests/global-setup.ts'],
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
