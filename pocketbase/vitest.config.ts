import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

// T-09: the backend integration tests now run in CI as well as
// locally. The previous "isCI ? unit-only" branch was a footgun —
// every test that proved a T-01..T-08 fix would pass on a developer's
// laptop and silently be skipped on a PR. The container-based
// integration tests run the SAME PB image CI builds, so there is no
// reason to skip them. The full suite must run on every PR.
//
// T-09 (follow-up): the previous config used `pool: 'forks'` with
// `singleFork: true`. On GitHub Actions Linux runners, the forked
// worker sometimes loses access to the host's loopback network
// interface (where the PB container is reachable via --network=host),
// so PB startup timeouts out and vitest reports 'No test files
// found' as it tries to recover. The default pool (threads in node
// mode) is sufficient: vitest runs the suite serially in the main
// process, which is what we want for the single-PB-container model.

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000,
    include: ['**/*.test.ts', '**/*.unit.test.ts'],
    // global-setup.ts returns the teardown (vitest has no globalTeardown option)
    globalSetup: ['./tests/global-setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname),
    }
  },
  plugins: [],
});
