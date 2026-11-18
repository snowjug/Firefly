// Takes a screenshot of a running Firefly page using a locally installed browser, optionally after
// preparing app state through the API (each run uses a fresh browser profile).
//
//   node scripts/shot.mjs --url http://127.0.0.1:8787/ --out screenshots/home.png
//   node scripts/shot.mjs --url http://127.0.0.1:8787/sessions/{id}/report --out r.png \
//        --new-session locked-out-after-password-reset:starter --say "Hi, I'm Sam. What's going on?" --end
//
// Options:
//   --w 1440 --h 900   viewport size          --dpr 1       device scale factor
//   --scheme dark      colour scheme (light|dark)
//   --theme dark       also set the in-app theme preference (light|dark|system)
//   --reduced          emulate prefers-reduced-motion
//   --full             capture the full scrollable page
//   --wait "selector"  wait for a selector before capturing
//   --click "selector" click an element (repeatable), then wait for the UI to settle
//   --delay 300        extra settle time in ms (default 400)
//   --samples          load the labelled sample sessions first (POST /api/demo/samples)
//   --new-session id[:difficulty]  create a call first; "{id}" in --url is replaced by its session id
//   --say "text"       send a trainee message to that call (repeatable, in order)
//   --end              end that call and wait for the report
//   PW_CHANNEL=msedge  browser channel (msedge, chrome); unset to use Playwright's Chromium
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from '@playwright/test';

const argv = process.argv.slice(2);
const opts = { click: [], say: [] };
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (!arg.startsWith('--')) continue;
  const key = arg.slice(2);
  const next = argv[i + 1];
  if (next === undefined || next.startsWith('--')) {
    opts[key] = true;
  } else {
    if (key === 'click' || key === 'say') opts[key].push(next);
    else opts[key] = next;
    i++;
  }
}

if (!opts.url || !opts.out) {
  console.error('Usage: node scripts/shot.mjs --url <url> --out <file.png> [options]');
  process.exit(2);
}

const channel = process.env.PW_CHANNEL ?? 'msedge';
const browser = await chromium.launch({ channel: channel === 'none' ? undefined : channel });
try {
  const context = await browser.newContext({
    viewport: { width: Number(opts.w ?? 1440), height: Number(opts.h ?? 900) },
    deviceScaleFactor: Number(opts.dpr ?? 1),
    colorScheme: opts.scheme === 'light' ? 'light' : 'dark',
    reducedMotion: opts.reduced ? 'reduce' : 'no-preference',
  });
  if (opts.theme) {
    await context.addInitScript((theme) => {
      localStorage.setItem('firefly.theme', theme);
    }, String(opts.theme));
  }

  let url = String(opts.url);
  const base = new URL(url.replace('{id}', 'x')).origin;
  const post = async (path, data) => {
    const response = await context.request.post(base + path, {
      data,
      headers: { 'content-type': 'application/json' },
    });
    if (!response.ok()) throw new Error(`${path} -> ${response.status()} ${await response.text()}`);
    return response.json();
  };

  if (opts.samples) await post('/api/demo/samples', {});
  if (opts['new-session']) {
    const [scenarioId, difficulty] = String(opts['new-session']).split(':');
    const created = await post('/api/sessions', {
      scenarioId,
      ...(difficulty ? { overrides: { difficulty } } : {}),
    });
    const id = created.session.id;
    for (const line of opts.say) {
      await post(`/api/sessions/${id}/messages`, { text: line, clientMessageId: randomUUID() });
    }
    if (opts.end) {
      await post(`/api/sessions/${id}/end`, {});
      for (let i = 0; i < 40; i++) {
        const response = await context.request.get(`${base}/api/sessions/${id}`);
        const status = (await response.json()).session.status;
        if (status === 'completed' || status === 'evaluation_failed') break;
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    url = url.replace('{id}', id);
    console.log(`session ${id}`);
  }

  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  if (opts.wait) await page.waitForSelector(String(opts.wait), { timeout: 15_000 });
  for (const selector of opts.click) {
    await page.click(selector);
    await page.waitForLoadState('networkidle');
  }
  await page.waitForTimeout(Number(opts.delay ?? 400));
  mkdirSync(dirname(String(opts.out)), { recursive: true });
  await page.screenshot({ path: String(opts.out), fullPage: Boolean(opts.full) });
  console.log(`saved ${opts.out}`);
} finally {
  await browser.close();
}
