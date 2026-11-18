// Takes a screenshot of a running Firefly page using a locally installed browser.
//
//   node scripts/shot.mjs --url http://127.0.0.1:8787/ --out screenshots/home.png
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
//   PW_CHANNEL=msedge  browser channel (msedge, chrome); unset to use Playwright's Chromium
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from '@playwright/test';

const argv = process.argv.slice(2);
const opts = { click: [] };
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (!arg.startsWith('--')) continue;
  const key = arg.slice(2);
  const next = argv[i + 1];
  if (next === undefined || next.startsWith('--')) {
    opts[key] = true;
  } else {
    if (key === 'click') opts.click.push(next);
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
  const page = await context.newPage();
  await page.goto(String(opts.url), { waitUntil: 'networkidle' });
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
