// Regenerates the screenshots used in the README and the docs from a running Firefly, using a locally
// installed browser. It seeds its own fictional practice through the public API, so it needs a Firefly
// in demo mode and, ideally, an empty in-memory database so nothing else shows up in the pictures:
//
//   FIREFLY_DB_PATH=:memory: FIREFLY_PROVIDER=mock FIREFLY_MOCK_DELAY_MS=120 FIREFLY_PORT=4444 npm start
//   node scripts/readme-screenshots.mjs --base http://127.0.0.1:4444
//
// Options:
//   --base <url>     where Firefly is running (default http://127.0.0.1:8787)
//   --out <folder>   where to write the images (default docs/images)
//   --only a,b       only these images (see NAMES below)
//   PW_CHANNEL=msedge  browser channel (msedge, chrome); PW_CHANNEL=none uses Playwright's Chromium
//
// The images are ordinary screenshots, never mockups, saved as JPEG (quality 88) to keep the
// repository small. After running it, look at `git diff --stat docs/images` and open the pictures
// that changed: that is the visual review for a design change.
/* global document, window */
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const argv = process.argv.slice(2);
const option = (name, fallback) => {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 && argv[at + 1] ? argv[at + 1] : fallback;
};
const BASE = option('base', 'http://127.0.0.1:8787').replace(/\/$/, '');
const OUT = option('out', 'docs/images');
const NAMES = [
  'home-dark',
  'home-light',
  'library-map',
  'setup',
  'launch',
  'call',
  'report',
  'evidence',
  'timeline',
  'progress',
  'milestones',
  'mobile',
];
const only = option('only', '') ? option('only', '').split(',') : NAMES;
const wanted = (name) => only.includes(name);
mkdirSync(OUT, { recursive: true });

// Fictional trainee messages, written for these pictures: a strong call, a call with several
// mistakes, and a call that goes wrong and is partly recovered.
const STRONG = [
  "Hello, this is Sam from support. I'm sorry you're dealing with this, I can see how disruptive it is. What exactly are you seeing when it happens?",
  'Thank you. When did it start, and has anything changed on your side recently?',
  'Is anyone else affected, and what have you already tried so far?',
  "I'll take this on and get it moving now. I'll update you by 3pm, even if I have no fix yet.",
  "To recap: it started this morning, others are affected, and I'll update you by 3pm. Is there anything else I can help with?",
];
const WEAK = [
  'Have you tried restarting?',
  'Clear your cache and try again.',
  'It will definitely be fixed in 10 minutes.',
  'We will get back to you soon.',
  'ok',
];
const RECOVERED = [
  'Honestly that error is coming from your end, not ours.',
  "I'm sorry, that came across badly. I can hear how stressful this is.",
  "I'm going to get an engineer on this right now and call you back at 9:30 with an update.",
];

const channel = process.env.PW_CHANNEL ?? 'msedge';
const browser = await chromium.launch({ channel: channel === 'none' ? undefined : channel });

async function open(width, height, { scheme = 'dark', cookies, scale = 1 } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    colorScheme: scheme,
    locale: 'en-GB',
    baseURL: BASE,
  });
  if (cookies) await context.addCookies(cookies);
  // The theme is only chosen on the first page; later pictures change it themselves.
  await context.addInitScript((theme) => {
    if (localStorage.getItem('firefly.theme') === null)
      localStorage.setItem('firefly.theme', theme);
  }, JSON.stringify(scheme));
  return { context, page: await context.newPage() };
}

const api = (page) => ({
  async create(scenarioId, difficulty, mode) {
    const response = await page.request.post('/api/sessions', {
      data: {
        scenarioId,
        overrides: { difficulty },
        ...(mode ? { mode } : {}),
        clientRequestId: randomUUID(),
      },
    });
    if (!response.ok())
      throw new Error(`Could not create a call: ${response.status()} ${await response.text()}`);
    return (await response.json()).session.id;
  },
  async say(id, lines) {
    for (const text of lines) {
      const response = await page.request.post(`/api/sessions/${id}/messages`, {
        data: { text, clientMessageId: randomUUID() },
      });
      if (!response.ok()) throw new Error(`Could not send a message: ${response.status()}`);
    }
  },
  async finish(id) {
    await page.request.post(`/api/sessions/${id}/end`, { data: {} });
    for (let i = 0; i < 120; i++) {
      const state = await (await page.request.get(`/api/sessions/${id}`)).json();
      if (state.session.status === 'completed') return;
      await page.waitForTimeout(250);
    }
    throw new Error('The report was not ready in time');
  },
});

const settle = async (page, extra = 1500) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(extra);
};
/** Scrolls (at once, not smoothly) so the element sits just below the sticky navigation. */
const bring = async (page, selector) => {
  await page.evaluate((target) => {
    const element = document.querySelector(target);
    if (element) {
      window.scrollTo({
        top: element.getBoundingClientRect().top + window.scrollY - 96,
        behavior: 'instant',
      });
    }
  }, selector);
  await page.waitForTimeout(900);
};
const save = async (page, name, options = {}) => {
  const file = join(OUT, `${name}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 88, ...options });
  console.log('wrote', file);
};
const go = async (page, route, extra) => {
  await page.goto(route);
  await settle(page, extra);
};

// One browser profile holds all the practice; the phone pictures reuse its cookie.
const desktop = await open(1440, 900);
const firefly = api(desktop.page);
const ids = {};
for (const [key, scenario, difficulty, lines] of [
  ['starter', 'locked-out-after-password-reset', 'starter', STRONG],
  ['standard', 'team-cannot-open-shared-workspace', 'standard', STRONG],
  ['weak', 'cannot-find-export-feature', 'standard', WEAK],
  ['challenge', 'checkout-outage-before-investor-event', 'challenge', RECOVERED],
  ['easy', 'slow-dashboard-with-workaround', 'starter', STRONG],
]) {
  ids[key] = await firefly.create(scenario, difficulty);
  await firefly.say(ids[key], lines);
  await firefly.finish(ids[key]);
}
ids.live = await firefly.create('locked-out-after-password-reset', 'starter', 'guided');
await firefly.say(ids.live, STRONG.slice(0, 3));
const cookies = await desktop.context.cookies();
const { page } = desktop;

if (wanted('home-dark')) {
  await go(page, '/');
  await save(page, 'home-dark');
}
if (wanted('library-map')) {
  await go(page, '/scenarios');
  await save(page, 'library-map', { fullPage: true });
}
if (wanted('setup')) {
  await go(page, '/scenarios/team-cannot-open-shared-workspace/setup?step=3');
  await save(page, 'setup');
}
if (wanted('launch')) {
  await go(page, '/scenarios/slow-dashboard-with-workaround/brief');
  await page.getByRole('button', { name: /Begin call/ }).click();
  await page.getByRole('dialog', { name: 'Starting your call' }).waitFor();
  await page.waitForTimeout(900);
  await save(page, 'launch');
  await page.waitForURL(/\/calls\//, { timeout: 10_000 }).catch(() => {});
}
if (wanted('call')) {
  await go(page, `/calls/${ids.live}`);
  await save(page, 'call');
}
if (wanted('report') || wanted('evidence') || wanted('timeline')) {
  await go(page, `/sessions/${ids.standard}/report`, 2200);
  if (wanted('report')) await save(page, 'report');
  if (wanted('evidence')) {
    // The Scoping & Discovery card: its rationale, the quoted moments and what to try next.
    await bring(page, '#dim-scoping-discovery');
    await save(page, 'evidence');
  }
  if (wanted('timeline')) {
    // A call that started Frustrated, got worse after a mistake and ended Calm.
    await bring(page, '#mood');
    await save(page, 'timeline');
  }
}
if (wanted('progress') || wanted('milestones')) {
  await go(page, '/progress', 2600);
  if (wanted('progress')) await save(page, 'progress');
  if (wanted('milestones')) {
    await bring(page, '#pg-path-title');
    await save(page, 'milestones');
  }
}
if (wanted('home-light')) {
  await page.evaluate(() => localStorage.setItem('firefly.theme', '"light"'));
  await page.emulateMedia({ colorScheme: 'light' });
  await go(page, '/');
  await save(page, 'home-light');
}
await desktop.context.close();

if (wanted('mobile')) {
  // Three real phone-sized screenshots set side by side on one page.
  const phone = await open(390, 844, { cookies, scale: 1 });
  const shots = [];
  for (const route of ['/', `/calls/${ids.live}`, `/sessions/${ids.standard}/report`]) {
    await go(phone.page, route, 2000);
    shots.push((await phone.page.screenshot()).toString('base64'));
  }
  await phone.context.close();
  const sheet = await open(1320, 940);
  await sheet.page
    .setContent(`<!doctype html><body style="margin:0;display:flex;gap:36px;justify-content:center;align-items:center;height:100vh;background:#061110">
    ${shots
      .map(
        (data) =>
          `<img alt="" style="width:390px;height:844px;border-radius:34px;border:1px solid rgba(176,228,210,.25);box-shadow:0 30px 70px -20px #000" src="data:image/png;base64,${data}">`,
      )
      .join('')}</body>`);
  await sheet.page.waitForTimeout(300);
  await save(sheet.page, 'mobile');
  await sheet.context.close();
}

await browser.close();
console.log('done');
