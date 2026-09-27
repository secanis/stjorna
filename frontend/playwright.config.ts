import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  // CI: stop after 10 failures so a broken suite reports in minutes,
  // not an hour of 30s timeouts. Local runs keep going for the full list.
  maxFailures: process.env.CI ? 10 : 0,
  // Screenshot baselines are OS/font-specific (generated on a dev box), so
  // pixel comparisons on the CI runner only produce noise. CI still runs
  // every other assertion in those tests.
  ignoreSnapshots: !!process.env.CI,
  // CI also writes playwright-report/ for the upload-on-failure step.
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 60000,
  },
  globalSetup: './tests/e2e/helpers/global-setup',
  globalTeardown: './tests/e2e/helpers/global-teardown',
});
