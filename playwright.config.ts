import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/gym-tracker/`,
    timezoneId: 'Europe/Paris',
    locale: 'en-GB',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/gym-tracker/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      // Home Screen app on a modern iPhone: the full screen minus the notch and home bar.
      name: 'iphone',
      use: { ...devices['iPhone 15 Pro'], viewport: { width: 393, height: 760 } },
      grepInvert: /@pwa|@small/,
    },
    {
      name: 'iphone-small',
      use: { ...devices['iPhone SE (3rd gen)'], viewport: { width: 375, height: 647 } },
      grep: /@layout/,
    },
    {
      name: 'iphone-max',
      use: { ...devices['iPhone 17 Pro Max'], viewport: { width: 440, height: 860 } },
      grep: /@layout/,
    },
    {
      // Service worker / offline behaviour is checked in Chromium, where Playwright controls service workers.
      name: 'pwa',
      use: { ...devices['Pixel 7'], serviceWorkers: 'allow' },
      grep: /@pwa/,
    },
  ],
});
