// Measures how a page of a running Firefly loads and feels, in a real Chromium-based browser, through
// Playwright and the DevTools protocol. It is an aid for people changing the interface, not part of
// the tests or CI. The numbers belong to one machine and mean something only beside numbers taken on
// the same machine, so compare two builds in the same sitting.
//
//   node scripts/perf-probe.mjs <url> [options]
//   node scripts/perf-probe.mjs http://127.0.0.1:8787/home --runs=3 --throttle=4
//   node scripts/perf-probe.mjs "http://127.0.0.1:8787/calls/{call}" --software
//
// <url> may contain {call}: the script then starts a practice call through the API, sends two
// messages and puts the call's id in the address, so a live call can be measured too. It may contain
// {report} instead, which becomes the id of a finished call in the profile (see --profile). Start
// Firefly in demo mode first, ideally with a database of its own (see docs/performance.md).
//
// Options:
//   --runs=<n>          measure n times, each in a fresh browser, and report the median and range
//   --throttle=<n>      slow the CPU down n times (default 1)
//   --software          draw with the software renderer (SwiftShader), as a machine with no
//                       graphics card would, instead of the graphics card
//   --profile=<id>      use this anonymous profile (32 hexadecimal characters, the value of the
//                       firefly_profile cookie) so a page can be measured with practice history
//                       in it; every run otherwise starts as a first-time learner with no calls
//   --w=<px> --h=<px>   window size (default 1440 x 900)
//   --theme=dark|light  colour scheme (default dark)
//   --wait=<ms>         time to settle after the page has loaded (default 1500)
//   --json              print one JSON object per run and nothing else
//   PW_CHANNEL=msedge   browser channel (msedge or chrome); PW_CHANNEL=none uses Playwright's Chromium
//
// Each run reports the first and largest contentful paint, layout shift, long tasks (50 ms or more),
// the time between animation frames for three seconds untouched and for three and a half seconds while
// the pointer moves (a frame at 60 Hz is 16.7 ms), and the effects tier the page ended on, because the
// frame monitor steps the tier down by itself when frames run slow. Only the CPU is throttled: the
// network is the loopback, so transfer times are not representative.
/* global document, window, requestAnimationFrame */
import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';

const argv = process.argv.slice(2);
const target = argv.find((arg) => !arg.startsWith('--'));
const option = (name, fallback) => {
  const hit = argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const flag = (name) => argv.includes(`--${name}`);

if (!target) {
  console.error('Usage: node scripts/perf-probe.mjs <url> [--runs=3] [--throttle=4] [--software]');
  process.exit(2);
}

const runs = Math.max(1, Number(option('runs', 1)));
const throttle = Math.max(1, Number(option('throttle', 1)));
const width = Number(option('w', 1440));
const height = Number(option('h', 900));
const theme = option('theme', 'dark') === 'light' ? 'light' : 'dark';
const settle = Number(option('wait', 1500));
const software = flag('software');
const json = flag('json');
const profile = option('profile', '');
const channel = process.env.PW_CHANNEL ?? 'msedge';

const launchArgs = software
  ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  : [
      ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []),
      '--ignore-gpu-blocklist',
      '--enable-gpu-rasterization',
    ];

// A fictional learner who has already seen the tour, so that neither covers the page.
const PROFILE = {
  name: 'Sam Rivera',
  role: '',
  location: '',
  createdAt: '2026-01-05T09:00:00.000Z',
  preferences: {
    defaultDifficulty: 'starter',
    hints: 'auto',
    voice: false,
    notifyReports: true,
    notifyBadges: true,
  },
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

function frameStats(deltas) {
  // The first two frames are the page still settling, unless that is all there is.
  const sorted = (deltas.length > 4 ? deltas.slice(2) : deltas).sort((a, b) => a - b);
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  return {
    frames: deltas.length,
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    p95: at(95),
    over20: (sorted.filter((value) => value > 20).length / sorted.length) * 100,
  };
}

// Starts a call through the API and returns the address of its page.
async function withCall(context, address) {
  const origin = new URL(address.replace('{call}', 'x').replace('{report}', 'x')).origin;
  const catalogue = await (await context.request.get(`${origin}/api/scenarios`)).json();
  const first = (catalogue.scenarios ?? catalogue)[0].id;
  const created = await context.request.post(`${origin}/api/sessions`, {
    data: {
      scenarioId: first,
      overrides: { difficulty: 'starter' },
      clientRequestId: randomUUID(),
    },
  });
  const { session } = await created.json();
  for (const text of [
    'Hello, this is Sam from support. What exactly are you seeing when it happens?',
    'When did it start, and has anything changed on your side recently?',
  ]) {
    await context.request.post(`${origin}/api/sessions/${session.id}/messages`, {
      data: { text, clientMessageId: randomUUID() },
    });
  }
  return address.replace('{call}', session.id);
}

// The id of a finished call in the profile, for a report or transcript address.
async function withReport(context, address) {
  const origin = new URL(address.replace('{call}', 'x').replace('{report}', 'x')).origin;
  const list = await (await context.request.get(`${origin}/api/sessions`)).json();
  const finished = (list.sessions ?? list).find((session) => session.status === 'completed');
  if (!finished)
    throw new Error('This profile has no finished call. Use --profile with one that has.');
  return address.replace('{report}', finished.id);
}

async function measureOnce() {
  const browser = await chromium.launch({
    channel: channel === 'none' ? undefined : channel,
    args: launchArgs,
  });
  try {
    const context = await browser.newContext({
      viewport: { width, height },
      colorScheme: theme,
    });
    if (profile) {
      await context.addCookies([
        {
          name: 'firefly_profile',
          value: profile,
          url: new URL(target.replace(/\{\w+\}/g, 'x')).origin,
        },
      ]);
    }
    const page = await context.newPage();
    await page.addInitScript(
      ({ person, scheme }) => {
        if (localStorage.getItem('perf.seeded') === null) {
          localStorage.setItem('perf.seeded', '1');
          localStorage.setItem('firefly.profile', JSON.stringify(person));
          localStorage.setItem('firefly.tour', JSON.stringify('done'));
        }
        localStorage.setItem('firefly.theme', JSON.stringify(scheme));
      },
      { person: PROFILE, scheme: theme },
    );
    await page.addInitScript(() => {
      window.__perf = { long: [], lcp: 0, cls: 0 };
      const watch = (type, onEntry) => {
        try {
          new PerformanceObserver((list) => list.getEntries().forEach(onEntry)).observe({
            type,
            buffered: true,
          });
        } catch {
          // The browser does not report this kind of entry.
        }
      };
      watch('longtask', (entry) => window.__perf.long.push(Math.round(entry.duration)));
      watch(
        'largest-contentful-paint',
        (entry) => (window.__perf.lcp = Math.round(entry.startTime)),
      );
      watch('layout-shift', (entry) => {
        if (!entry.hadRecentInput) window.__perf.cls += entry.value;
      });
    });

    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });

    let address = target;
    if (address.includes('{call}')) address = await withCall(context, address);
    if (address.includes('{report}')) address = await withReport(context, address);
    await page.goto(address, { waitUntil: 'load' });
    await page.waitForTimeout(settle);

    const frames = (ms) =>
      page.evaluate(
        (duration) =>
          new Promise((resolve) => {
            const deltas = [];
            const begin = performance.now();
            let last = begin;
            const tick = (now) => {
              deltas.push(now - last);
              last = now;
              if (now - begin < duration) requestAnimationFrame(tick);
              else resolve(deltas);
            };
            requestAnimationFrame(tick);
          }),
        ms,
      );

    const idle = frameStats(await frames(3000));
    const [movingFrames] = await Promise.all([
      frames(3500),
      (async () => {
        for (let step = 0; step < 110; step += 1) {
          await page.mouse.move(180 + step * 10, 260 + Math.sin(step / 5) * 170);
          await page.waitForTimeout(28);
        }
      })(),
    ]);
    const pointer = frameStats(movingFrames);

    const load = await page.evaluate(() => {
      const paint = Object.fromEntries(
        performance.getEntriesByType('paint').map((entry) => [entry.name, entry.startTime]),
      );
      const resources = performance.getEntriesByType('resource');
      return {
        fcp: Math.round(paint['first-contentful-paint'] ?? 0),
        lcp: window.__perf.lcp,
        cls: window.__perf.cls,
        longTasks: window.__perf.long.length,
        longTaskMs: window.__perf.long.reduce((sum, value) => sum + value, 0),
        requests: resources.length,
        transferKB: resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0) / 1024,
        tier: document.documentElement.getAttribute('data-perf') ?? 'none',
      };
    });
    const metrics = Object.fromEntries(
      (await cdp.send('Performance.getMetrics')).metrics.map((entry) => [entry.name, entry.value]),
    );
    const renderer = await page.evaluate(() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl');
        return gl.getParameter(
          gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL,
        );
      } catch {
        return 'unknown';
      }
    });

    return {
      renderer,
      tier: load.tier,
      numbers: {
        fcp: load.fcp,
        lcp: load.lcp,
        cls: load.cls,
        longTasks: load.longTasks,
        longTaskMs: load.longTaskMs,
        idleFrames: idle.frames,
        idleP95: idle.p95,
        idleOver20: idle.over20,
        pointerFrames: pointer.frames,
        pointerMean: pointer.mean,
        pointerP95: pointer.p95,
        pointerOver20: pointer.over20,
        scriptSec: metrics.ScriptDuration,
        taskSec: metrics.TaskDuration,
        requests: load.requests,
        transferKB: load.transferKB,
      },
    };
  } finally {
    await browser.close();
  }
}

const ROWS = [
  ['fcp', 'First contentful paint', 'ms', 0],
  ['lcp', 'Largest contentful paint', 'ms', 0],
  ['cls', 'Layout shift (CLS)', '', 3],
  ['longTasks', 'Long tasks (50 ms or more)', '', 0],
  ['longTaskMs', 'Time in long tasks', 'ms', 0],
  ['idleFrames', 'Frames drawn, untouched, in 3 s', '', 0],
  ['idleP95', 'Frame time, untouched, 95th percentile', 'ms', 1],
  ['idleOver20', 'Frames over 20 ms, untouched', '%', 0],
  ['pointerFrames', 'Frames drawn, pointer moving, in 3.5 s', '', 0],
  ['pointerMean', 'Frame time, pointer moving, mean', 'ms', 1],
  ['pointerP95', 'Frame time, pointer moving, 95th percentile', 'ms', 1],
  ['pointerOver20', 'Frames over 20 ms, pointer moving', '%', 0],
  ['scriptSec', 'Script time', 's', 2],
  ['taskSec', 'Main-thread time', 's', 2],
  ['requests', 'Requests', '', 0],
  ['transferKB', 'Transferred', 'kB', 0],
];

const results = [];
for (let run = 1; run <= runs; run += 1) {
  const result = await measureOnce();
  results.push(result);
  if (json) console.log(JSON.stringify({ url: target, run, throttle, software, ...result }));
}

if (!json) {
  const first = results[0];
  const tiers = [...new Set(results.map((result) => result.tier))].join(', ');
  console.log(
    `\n${target}\n${width} x ${height}, ${theme} theme, CPU x${throttle}, ${runs} run${runs === 1 ? '' : 's'}`,
  );
  console.log(`Renderer: ${first.renderer}`);
  console.log(`Effects tier at the end: ${tiers}\n`);
  for (const [key, label, unit, digits] of ROWS) {
    const values = results.map((result) => result.numbers[key]);
    const low = Math.min(...values);
    const high = Math.max(...values);
    const text = (value) => value.toFixed(digits);
    const range = runs > 1 ? `  (${text(low)} to ${text(high)})` : '';
    console.log(`  ${label.padEnd(46)} ${text(median(values)).padStart(8)} ${unit}${range}`);
  }
  console.log('');
}
