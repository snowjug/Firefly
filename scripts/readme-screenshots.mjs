// Regenerates the pictures in docs/images/ from a running Firefly, using a locally installed browser.
//
// Start Firefly in demo mode with the scripted demo speech provider, on a build of the current code,
// with its own port and an in-memory database:
//
//   npm run build
//   $env:FIREFLY_PROVIDER='mock'; $env:FIREFLY_SPEECH_PROVIDER='mock'; $env:FIREFLY_DB_PATH=':memory:'
//   $env:FIREFLY_MOCK_DELAY_MS='300'; $env:FIREFLY_PORT='8791'; npm start          (PowerShell)
//
// then, in another terminal:
//
//   $env:FIREFLY_URL='http://127.0.0.1:8791'; node scripts/readme-screenshots.mjs
//
// Variables: FIREFLY_URL (default http://127.0.0.1:8787), PW_CHANNEL (msedge by default; chrome, or
// none for Playwright's own Chromium), FIREFLY_SHOTS_DIR (where the pictures go, docs/images by
// default) and FIREFLY_SHOTS_WORK (a git-ignored folder for the fake microphone's file, by default
// scripts/_tmp/readme-shots). The browser runs headless.
//
// It takes five pictures of the real app: the landing page, the scenario workspace with a scenario
// selected, the case brief, a spoken call in progress, and the top of the coaching report. The call is
// a real voice call in demo mode: the microphone is a fake device that plays a generated, speech-like
// burst in a loop (e2e/support/fake-microphone.ts; no real audio is recorded or committed), the demo
// speech provider answers each burst with the next of its eight scripted sentences, so what the
// engineer "says" is scripted, and a rules engine plays the customer. Nothing in the pictures is a
// live model, a real voice or a real person. The call preview on the landing page is a captioned
// illustration, not a call. Look at every picture before committing it: a picture that shows
// something the app does not do is worse than none.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { fakeMicrophoneArgs, speechLikeWav } from '../e2e/support/fake-microphone.ts';

const base = (process.env.FIREFLY_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const channel = process.env.PW_CHANNEL ?? 'msedge';
const outDir = process.env.FIREFLY_SHOTS_DIR ?? 'docs/images';
const workDir = process.env.FIREFLY_SHOTS_WORK ?? join('scripts', '_tmp', 'readme-shots');
mkdirSync(outDir, { recursive: true });
mkdirSync(workDir, { recursive: true });

// The scenario in the pictures, and how many scripted sentences the engineer "says". The demo speech
// provider has eight, in order, and the eight make a whole call: greeting, empathy, scoping questions,
// ownership with a time, a summary and a close.
const SCENARIO = 'Colleagues cannot join scheduled Teams meetings';
const SPOKEN_TURNS = 8;
const PICTURE_AFTER = 4; // the call picture is taken while the customer answers this turn

// Chromium needs an absolute path for the fake microphone's file.
const microphoneFile = resolve(workDir, 'speech-like.wav');
writeFileSync(microphoneFile, speechLikeWav());

const browser = await chromium.launch({
  channel: channel === 'none' ? undefined : channel,
  args: fakeMicrophoneArgs({ file: microphoneFile }),
});

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ['microphone'],
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  const shot = async (name) => {
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${outDir}/${name}.png` });
    console.log(`saved ${outDir}/${name}.png`);
  };

  const config = await (await context.request.get(`${base}/api/config`)).json();
  if (!config.provider.demo || config.speech.provider !== 'mock') {
    throw new Error(
      'Start Firefly with FIREFLY_PROVIDER=mock and FIREFLY_SPEECH_PROVIDER=mock (see the top of this file).',
    );
  }

  // 1. The landing page.
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.waitForTimeout(3000); // the preview of a call settles after a few seconds
  await shot('landing');

  // 2. The scenario workspace, with one scenario selected.
  await page.goto(`${base}/scenarios`, { waitUntil: 'networkidle' });
  await page.getByRole('radio', { name: SCENARIO, exact: true }).check();
  await shot('scenarios');

  // 3. The case brief.
  await page
    .getByRole('region', { name: SCENARIO })
    .getByRole('link', { name: 'Review brief' })
    .click();
  await page.waitForURL(/\/brief/);
  await page.getByRole('button', { name: 'Start voice call' }).waitFor();
  await shot('brief');

  // 4. A spoken call: the brief starts it, the pre-flight asks for the microphone, and each tone from
  // the fake microphone becomes the next scripted sentence.
  await page.getByRole('button', { name: 'Start voice call' }).click();
  await page.waitForURL(/\/calls\//);
  await page.getByRole('heading', { level: 1, name: 'Ready to call?' }).waitFor();
  await page.getByRole('button', { name: 'Start voice call' }).click();

  const turns = page.getByRole('log', { name: 'Call transcript' }).getByRole('listitem');
  const status = page
    .getByRole('region', { name: 'Customer', exact: true })
    .locator('[data-status] .cw-status__label');
  let taken = false;
  for (let exchange = 1; exchange <= SPOKEN_TURNS; exchange++) {
    // The greeting is turn 1; each exchange adds the engineer's turn and the customer's reply.
    await turns.nth(exchange * 2 - 1).waitFor({ timeout: 90_000 });
    if (exchange === PICTURE_AFTER && !taken) {
      await status.filter({ hasText: 'Customer speaking' }).waitFor({ timeout: 30_000 });
      await shot('call-in-progress');
      taken = true;
    }
    await turns.nth(exchange * 2).waitFor({ timeout: 90_000 });
  }
  if (!taken) throw new Error('The call picture was not taken.');

  // 5. End the call and read the report.
  await page.getByRole('button', { name: 'End call', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'End the call?' })
    .getByRole('button', { name: 'End and review' })
    .click();
  await page.waitForURL(/\/report/, { timeout: 60_000 });
  await page
    .getByRole('heading', { level: 1, name: 'Coaching report' })
    .waitFor({ timeout: 60_000 });
  await shot('report-summary');
} finally {
  await browser.close();
}
