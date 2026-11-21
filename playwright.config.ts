import { defineConfig, devices } from '@playwright/test';
import { fakeMicrophoneArgs, writeFakeMicrophoneWav } from './e2e/support/fake-microphone.ts';

// Browser tests run against the production build served by the real Firefly server, in demo mode
// (no credentials needed): the built-in rules engine plays the customer, the scripted mock speech
// provider stands in for the speech service, the database is in memory and the /api/test failure
// hooks are enabled.
//
//   npm run test:e2e        build, then run every journey
//   npx playwright test     run against an existing build in dist/web
//
// The browser gets a fake microphone: a speech-like WAV that the suite generates itself (see
// e2e/support/fake-microphone.ts). Nothing here needs a real microphone, a speech service, a model
// provider or any network beyond the app itself. Locally you can reuse an installed browser with
// PW_CHANNEL=msedge (or chrome); in CI Playwright's own Chromium is used.
//
// Environment, all optional:
//   E2E_PORT        port of the server the suite starts (default 4321). When it is set, a server that
//                   is already listening is never reused: a stale one could be running another build.
//   E2E_WEB_DIR     the build to serve, as a path from the repository root or an absolute path
//                   (passed to the server as FIREFLY_WEB_DIR; default dist/web).
//   E2E_OUTPUT_DIR  where results and the generated microphone file go (default test-results), so
//                   that two runs started side by side do not clear each other's files.
//   E2E_BASE_URL    test a Firefly that is already running (for example the Vite dev server, which
//                   proxies /api to a server started with FIREFLY_TEST_HOOKS=1 and
//                   FIREFLY_SPEECH_PROVIDER=mock) instead of starting one.
//   PW_CHANNEL      msedge or chrome, to use an installed browser.
//   FIREFLY_E2E_REAL=1   also run e2e/real-provider.spec.ts (see its header; never run in CI).
//   E2E_PERF=1      also run the timing-sensitive checks in e2e/perf.spec.ts (tagged @perf), which depend
//                   on how fast the machine is and so are left out of ordinary and CI runs.
const explicitPort = process.env.E2E_PORT;
const port = Number(explicitPort ?? 4321);
const webDir = process.env.E2E_WEB_DIR?.trim();
const outputDir = process.env.E2E_OUTPUT_DIR?.trim() || 'test-results';
const channel = process.env.PW_CHANNEL;
const externalBaseUrl = process.env.E2E_BASE_URL;

const microphoneArgs = fakeMicrophoneArgs({ file: writeFakeMicrophoneWav() });

export default defineConfig({
  testDir: 'e2e',
  outputDir,
  globalSetup: './e2e/support/global-setup.ts',
  // The failure-injection hooks and the mock speech script are server-wide, so tests run one at a time.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: externalBaseUrl ?? `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    permissions: ['microphone'],
    launchOptions: { args: microphoneArgs },
    ...(channel ? { channel } : {}),
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      // Timing-sensitive checks (tagged @perf) only run on request: E2E_PERF=1.
      grepInvert: process.env.E2E_PERF ? /@mobile/ : /@mobile|@perf/,
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
        reuseExistingServer: !process.env.CI && explicitPort === undefined,
        timeout: 30_000,
        env: {
          FIREFLY_PORT: String(port),
          FIREFLY_HOST: '127.0.0.1',
          FIREFLY_DB_PATH: ':memory:',
          FIREFLY_PROVIDER: 'mock',
          FIREFLY_MOCK_DELAY_MS: '120',
          FIREFLY_SPEECH_PROVIDER: 'mock',
          FIREFLY_TEST_HOOKS: '1',
          ...(webDir ? { FIREFLY_WEB_DIR: webDir } : {}),
        },
      },
});
