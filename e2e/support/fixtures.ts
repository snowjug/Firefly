import { expect, test as base } from '@playwright/test';
import { FireflyApi } from './api.ts';
import { installProbes } from './page-probes.ts';
import { ProblemRecorder } from './problems.ts';

// The test fixtures every browser journey uses. Import `test` and `expect` from here, not from
// '@playwright/test':
//
//   import { expect, test } from './support/fixtures.ts';
//
//   test('...', async ({ page, api, problems }) => { ... });
//
// What a test gets on top of Playwright's own fixtures:
//
//   api       a FireflyApi (support/api.ts) that shares the page's anonymous profile, so a call it
//             creates is the call the page can open. Any failure a test queues with `api.failNext`
//             and did not use is cleared when the test ends, so it cannot leak into the next test.
//   problems  a ProblemRecorder (support/problems.ts), started for every test (it is an automatic
//             fixture). A passing test still fails if the browser logged a console error or warning,
//             threw an uncaught error, failed a request or received an HTTP error that the test
//             did not declare with `problems.allow(...)` or `problems.allowOffline()`.
//   context   as Playwright's, with the page probe installed before any page script runs, so that
//             `readProbe(page)` (support/page-probes.ts) can report what the page did with the
//             microphone, with sound and with the call's status line.
//
// The other modules in this folder, all importable on their own:
//
//   api.ts              FireflyApi: create a call, say things in it, end it and wait for its report,
//                       or queue a failure, all through the HTTP API (GOOD_CALL is a call that covers
//                       what the coaching looks for).
//   call-screen.ts      callScreen(page): the call page's locators by role and name; flows such as
//                       startSpokenCall, startTypedCall, sendTyped.
//   fake-microphone.ts  generates the speech-like WAV the browser uses as its microphone, and the
//                       Chromium launch arguments for it (see playwright.config.ts).
//   global-setup.ts     runs once: writes the WAV and refuses a server that is not set up for the suite.
//   mock-speech.ts      the eight sentences the server's mock speech provider "hears", and a check.
//   page-probes.ts      the in-page instrumentation, readProbe, and refuseMicrophone / allowMicrophone
//                       (the browser's own refusal cannot be provoked the same way in every browser).
//   problems.ts         the console and network recorder behind `problems`.
//   raw-text.ts         expectNoRawFailureText: no provider text, codes or stack traces on screen.
//   scenario-library.ts the server's real scenarios, to check that nothing hidden is ever shown.
//
// Every test gets a new browser context, and so a new anonymous profile: no test sees another's calls.
// The projects (playwright.config.ts) start Chromium with a fake microphone and grant the
// `microphone` permission. A test that needs a different permission uses `test.use({ permissions })`.

interface Fixtures {
  api: FireflyApi;
  problems: ProblemRecorder;
}

export const test = base.extend<Fixtures>({
  context: async ({ context }, use) => {
    await installProbes(context);
    await use(context);
  },

  api: async ({ context }, use) => {
    const api = new FireflyApi(context.request);
    await use(api);
    if (api.queuedFailures) await api.clearFailures();
  },

  problems: [
    async ({ context }, use, testInfo) => {
      const recorder = new ProblemRecorder(context);
      await use(recorder);
      recorder.dispose();
      // A test that already failed reports its own failure; this is for tests that otherwise passed.
      if (testInfo.status === 'passed') recorder.assertNone();
    },
    { auto: true },
  ],
});

export { expect };
