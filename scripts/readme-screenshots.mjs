// Regenerates the pictures in docs/images/ from a running Firefly, using a locally installed browser.
//
// Start Firefly in demo mode with the scripted demo speech provider, on a build of the current code:
//
//   npm run build
//   FIREFLY_PROVIDER=mock FIREFLY_SPEECH_PROVIDER=mock FIREFLY_DB_PATH=:memory: FIREFLY_MOCK_DELAY_MS=300 npm start
//
// then, in another terminal:
//
//   node scripts/readme-screenshots.mjs                      (uses http://127.0.0.1:8787, Microsoft Edge)
//   FIREFLY_URL=http://127.0.0.1:8791 PW_CHANNEL=chrome node scripts/readme-screenshots.mjs
//
// Everything in the pictures is the fictional demo content of the app. The microphone is a fake device
// that plays a short generated tone (no real audio is recorded or committed), the demo speech provider
// answers with scripted sentences, and the demo rules engine plays the customer. Look at every picture
// before committing it: a picture that shows something the app does not do is worse than none.
/* global window */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const base = (process.env.FIREFLY_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const channel = process.env.PW_CHANNEL ?? 'msedge';
const outDir = process.env.FIREFLY_SHOTS_DIR ?? 'docs/images';
mkdirSync(outDir, { recursive: true });

// A 16-bit mono WAV the fake microphone plays in a loop: 1.6 s of a wobbling tone that the voice
// activity detector hears as speech, then 2.4 s of silence so it can tell the utterance has ended.
function makeToneWav() {
  const rate = 16000;
  const seconds = 4;
  const samples = new Int16Array(rate * seconds);
  for (let i = 0; i < rate * 1.6; i++) {
    const t = i / rate;
    const wobble = 0.55 + 0.45 * Math.sin(2 * Math.PI * 3.1 * t);
    samples[i] = Math.round(
      Math.sin(2 * Math.PI * (180 + 40 * Math.sin(2 * Math.PI * 1.3 * t)) * t) * wobble * 9000,
    );
  }
  const data = Buffer.from(samples.buffer);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  const dir = mkdtempSync(join(tmpdir(), 'firefly-shots-'));
  const file = join(dir, 'tone.wav');
  writeFileSync(file, Buffer.concat([header, data]));
  return file;
}

const browser = await chromium.launch({
  channel: channel === 'none' ? undefined : channel,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${makeToneWav()}`,
  ],
});

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ['microphone'],
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  const shot = async (name, options = {}) => {
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${outDir}/${name}.png`, ...options });
    console.log(`saved ${outDir}/${name}.png`);
  };

  const config = await (await context.request.get(`${base}/api/config`)).json();
  if (!config.provider.demo || config.speech.provider !== 'mock') {
    throw new Error(
      'Start Firefly with FIREFLY_PROVIDER=mock and FIREFLY_SPEECH_PROVIDER=mock (see the top of this file).',
    );
  }

  // 1. Landing
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(4200); // the preview waveform settles after a few seconds
  await shot('landing');

  // 2. Scenario workspace with a scenario chosen
  await page.goto(`${base}/scenarios`, { waitUntil: 'networkidle' });
  await page.getByRole('radio', { name: /Team cannot open the shared project workspace/ }).click();
  await shot('scenarios');

  // 3. Call brief
  await page.getByRole('link', { name: 'Continue to call brief' }).click();
  await page.waitForURL(/\/brief/);
  await shot('brief');

  // 4. A spoken call: the customer speaks, then the trainee is heard
  await page.getByRole('button', { name: 'Start voice call' }).click();
  await page.waitForURL(/\/calls\//);
  await shot('call-preflight');
  await page.getByRole('button', { name: 'Allow microphone and start' }).click();
  await page.locator('[data-stage="speaking"]').waitFor({ timeout: 15000 });
  await page.locator('[data-stage="hearing"]').waitFor({ timeout: 40000 });
  await shot('call-hearing-you');
  // Let the exchange finish, then switch the microphone off and carry on by typing, so the call has
  // real content and each customer reply is heard to the end.
  await page.getByRole('button', { name: 'Stop talking' }).click();
  await page.locator('[data-stage="speaking"]').waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Interrupt' }).click();
  await page.getByRole('button', { name: 'Mute' }).click();
  const typed = [
    'Thank you, Daniel. When did it start, and has anything changed recently, like a permissions update?',
    "That's not my problem, you should have told us earlier. Calm down.",
    'I am sorry, that was wrong of me. I will take ownership of this and call you back by three o\u2019clock with an update. Is there anything else I can help with?',
  ];
  for (const line of typed) {
    const box = page.getByRole('textbox', { name: /Type a reply/ });
    if (!(await box.isVisible().catch(() => false))) {
      await page
        .getByRole('button', { name: /Type instead|Type a reply instead/ })
        .first()
        .click();
    }
    await box.fill(line);
    await page.getByRole('button', { name: 'Send' }).click();
    await page.locator('[data-stage="speaking"]').waitFor({ timeout: 20000 });
    // The microphone is muted, so the call settles on "muted" once the customer has finished.
    await page.locator('[data-stage="speaking"]').waitFor({ state: 'hidden', timeout: 40000 });
  }
  await shot('call-in-progress');

  // 5. End the call and read the report
  await page.getByRole('button', { name: 'End call' }).click();
  await page.getByRole('button', { name: 'End and review' }).click();
  await page.waitForURL(/\/report/, { timeout: 30000 });
  await page.getByRole('heading', { name: 'Coaching report' }).waitFor({ timeout: 30000 });
  await shot('report-summary');
  await page
    .getByRole('heading', { name: 'Customer temperature' })
    .evaluate((heading) => heading.scrollIntoView({ block: 'start' })); // the page leaves room for its header
  await shot('report-temperature');
} finally {
  await browser.close();
}
