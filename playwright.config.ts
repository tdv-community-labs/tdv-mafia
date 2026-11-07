import { defineConfig, devices } from '@playwright/test';

/**
 * TDV Mafia Milestone 13: Playwright Multi-Client E2E Test Configuration
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3005',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
        launchOptions: {
          args: [
            '--autoplay-policy=no-user-gesture-required',
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
          ],
        },
      },
    },
  ],
  webServer: {
    command: process.env.E2E_DEV ? 'npx next dev -p 3005' : 'npx next start -p 3005',
    port: 3005,
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});
