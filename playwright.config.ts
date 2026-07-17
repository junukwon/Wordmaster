import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173/wordmaster/',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/serve-e2e.mjs',
    url: 'http://127.0.0.1:4173/wordmaster/',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'iPad Mini landscape',
      use: {
        browserName: 'webkit', viewport: { width: 1133, height: 744 },
        deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      },
    },
    {
      name: 'iPad Mini portrait',
      use: {
        browserName: 'webkit', viewport: { width: 744, height: 1133 },
        deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      },
    },
    { name: 'iPhone', use: { ...devices['iPhone 13'] } },
  ],
});
