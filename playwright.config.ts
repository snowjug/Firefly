import { defineConfig, devices } from '@playwright/test';

// Browser tests run against the production build served by the real Firefly server, in demo mode
// (no credentials needed), with an in-memory database and the /api/test hooks enabled.
//   npm run test:e2e
// Locally you can reuse an installed browser: PW_CHANNEL=msedge (or chrome). In CI Playwright's
// own Chromium is used.
const port = Number(process.env.E2E_PORT ?? 4321);
const channel = process.env.PW_CHANNEL;
// Point the tests at an already running Firefly (for example the Vite dev server, which proxies
// /api to a server started with FIREFLY_TEST_HOOKS=1) instead of starting one.
const externalBaseUrl = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: 'e2e',
  // The failure-injection hooks are server-wide, so tests run one at a time.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: externalBaseUrl ?? `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(channel ? { channel } : {}),
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      grepInvert: /@mobile/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      grep: /@mobile/,
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: 'node --disable-warning=ExperimentalWarning server/index.ts',
        url: `http://127.0.0.1:${port}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
        env: {
          FIREFLY_PORT: String(port),
          FIREFLY_HOST: '127.0.0.1',
          FIREFLY_DB_PATH: ':memory:',
          FIREFLY_PROVIDER: 'mock',
          FIREFLY_MOCK_DELAY_MS: '120',
          FIREFLY_TEST_HOOKS: '1',
        },
      },
});
