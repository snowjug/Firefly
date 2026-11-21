// Measures how the pages of a RUNNING Firefly load and feel, in a real Chromium-based browser, through
// Playwright and the DevTools protocol. It starts and stops nothing: point it at a server you started
// (see docs/performance.md). It is an aid for people changing the interface, not part of the tests or
// CI. The numbers belong to one machine in one sitting and mean something only beside numbers taken in
// the same sitting, so compare two builds back to back, never across machines or days.
//
//   node scripts/perf-probe.mjs <origin> [options]
//   node scripts/perf-probe.mjs http://127.0.0.1:8787 --runs=3
//   node scripts/perf-probe.mjs http://127.0.0.1:8787 --pages=call,report --throttle=4 --json
//
// Pages (--pages, comma separated; default all of them):
//   landing    /
//   scenarios  /scenarios
//   brief      /scenarios/<first scenario>/brief
//   call       /calls/<id>: an open call with --exchanges exchanges (default 30: 61 turns), opened as a
//              text call so the whole transcript is drawn. The probe starts the call itself through the
//              API, so the server should be in demo mode (FIREFLY_PROVIDER=mock) with a database of its
//              own. Spoken calls are tested by e2e/perf.spec.ts, not here.
//   report     /sessions/<id>/report: a finished call of the same length, with its coaching report
//
// Options:
//   --runs=<n>         measure each page n times, each in a fresh browser context with a cold cache, and
//                      report the median and the range (default 1)
//   --throttle=<n>     slow the CPU down n times (default 1)
//   --w=<px> --h=<px>  window size (default 1440 x 900)
//   --wait=<ms>        time to settle after the page has loaded (default 1500)
//   --exchanges=<n>    messages in the call and report sessions (default 30; the server allows 60)
//   --json             print one JSON object per page per run and nothing else
//   PW_CHANNEL=msedge  the browser channel (msedge or chrome, default msedge); PW_CHANNEL=none uses
//                      Playwright's own Chromium
//
// Per page it reports: first and largest contentful paint, layout shift (CLS), long tasks (50 ms or
// more: how many and how long in all), DOM nodes, the JavaScript heap after a full garbage collection
// once the page has settled, requests, and the scripts and stylesheets the page loaded, in kB: raw,
// gzip (level 9, the unit of scripts/budgets.json) and transferred (what the server really sent: the
// Node server does not compress, so it equals raw plus headers). Only the CPU is throttled: the network
// is the loopback, so transfer times are not representative.
/* global window, document */
import { randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';

const argv = process.argv.slice(2);
const origin = argv.find((arg) => !arg.startsWith('--'))?.replace(/\/+$/, '');
const option = (name, fallback) => {
  const hit = argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const flag = (name) => argv.includes(`--${name}`);

if (!origin) {
  console.error(
    'Usage: node scripts/perf-probe.mjs <origin> [--pages=call,report] [--runs=3] [--throttle=4]',
  );
  process.exit(2);
}

const ALL_PAGES = ['landing', 'scenarios', 'brief', 'call', 'report'];
const pages = option('pages', ALL_PAGES.join(','))
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);
for (const name of pages) {
  if (!ALL_PAGES.includes(name)) {
    console.error(`Unknown page "${name}". Choose from ${ALL_PAGES.join(', ')}.`);
    process.exit(2);
  }
}
const runs = Math.max(1, Number(option('runs', 1)));
const throttle = Math.max(1, Number(option('throttle', 1)));
const width = Number(option('w', 1440));
const height = Number(option('h', 900));
const settle = Number(option('wait', 1500));
const exchanges = Math.min(60, Math.max(1, Number(option('exchanges', 30))));
const json = flag('json');
const channel = process.env.PW_CHANNEL ?? 'msedge';

const MESSAGES = [
  'Hello, this is Sam from support. Thank you for getting in touch. Can you tell me exactly what you are seeing when it happens?',
  'When did it start, and has anything changed on your side recently, for example a new setting or an update?',
  'I understand why that is frustrating. Let me check what we can see on our side and I will come back to you in a moment.',
  'Could you tell me how many people are affected, and whether it happens for everyone or only some of them?',
  'Thank you, that helps. I am going to try something now, so please stay on the line while I look at it.',
  'To confirm, you saw the error after the update on Tuesday, and it has happened each morning since then. Is that right?',
];

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

// ---- Seeding: the calls the call and report pages need ---------------------------------------------

// The server limits each anonymous profile to 30 messages in a burst and then one every two seconds, so
// the call and the report each get a profile of their own, and a refused message waits and is sent again.
async function post(request, url, data) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await request.post(url, { data });
    if (response.status() !== 429 || attempt >= 40) return response;
    const body = await response.json().catch(() => null);
    const wait = Number(body?.error?.details?.retryAfterSeconds ?? 2);
    await new Promise((resolve) => setTimeout(resolve, Math.max(1, wait) * 1000));
  }
}

async function startCall(request, scenarioId, count) {
  const created = await post(request, `${origin}/api/sessions`, {
    scenarioId,
    overrides: { difficulty: 'starter' },
    clientRequestId: randomUUID(),
  });
  if (!created.ok()) throw new Error(`Could not start a call: HTTP ${created.status()}.`);
  const { session } = await created.json();
  for (let i = 0; i < count; i += 1) {
    const sent = await post(request, `${origin}/api/sessions/${session.id}/messages`, {
      text: MESSAGES[i % MESSAGES.length],
      clientMessageId: randomUUID(),
    });
    if (!sent.ok()) throw new Error(`Message ${i + 1} was refused: HTTP ${sent.status()}.`);
  }
  return session.id;
}

/** Runs `work` as a fresh anonymous profile and returns what it made with the profile's cookies. */
async function asNewProfile(browser, work) {
  const context = await browser.newContext();
  try {
    const catalogue = await (await context.request.get(`${origin}/api/scenarios`)).json();
    const result = await work(context.request, catalogue.scenarios[0].id);
    return { ...result, cookies: await context.cookies() };
  } finally {
    await context.close();
  }
}

async function seed(browser) {
  const catalogue = await asNewProfile(browser, async (_request, scenarioId) => ({ scenarioId }));
  const out = { scenarioId: catalogue.scenarioId, cookies: {} };
  if (pages.includes('call')) {
    const made = await asNewProfile(browser, async (request, scenarioId) => ({
      id: await startCall(request, scenarioId, exchanges),
    }));
    out.callId = made.id;
    out.cookies.call = made.cookies;
  }
  if (pages.includes('report')) {
    const made = await asNewProfile(browser, async (request, scenarioId) => {
      const id = await startCall(request, scenarioId, exchanges);
      await post(request, `${origin}/api/sessions/${id}/end`, {});
      for (let i = 0; ; i += 1) {
        const current = (await (await request.get(`${origin}/api/sessions/${id}`)).json()).session;
        if (current.status === 'completed') break;
        if (i > 120) throw new Error('The report was not ready after 30 seconds.');
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return { id };
    });
    out.reportId = made.id;
    out.cookies.report = made.cookies;
  }
  return out;
}

// ---- Measuring one page -----------------------------------------------------------------------------

async function measure(browser, seeded, name) {
  const context = await browser.newContext({ viewport: { width, height } });
  // The anonymous profile cookie owns the calls: the page needs the cookie of the profile that made its call.
  const cookies = seeded.cookies[name] ?? [];
  if (cookies.length > 0) await context.addCookies(cookies);
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__probe = { long: [], lcp: 0, cls: 0 };
    const watch = (type, onEntry) => {
      try {
        new PerformanceObserver((list) => list.getEntries().forEach(onEntry)).observe({
          type,
          buffered: true,
        });
      } catch {
        // This browser does not report that kind of entry.
      }
    };
    watch('longtask', (entry) => window.__probe.long.push(Math.round(entry.duration)));
    watch(
      'largest-contentful-paint',
      (entry) => (window.__probe.lcp = Math.round(entry.startTime)),
    );
    watch('layout-shift', (entry) => {
      if (!entry.hadRecentInput) window.__probe.cls += entry.value;
    });
  });

  const bodies = [];
  page.on('response', (response) => {
    const type = response.request().resourceType();
    if (type !== 'script' && type !== 'stylesheet') return;
    bodies.push(
      response.body().then(
        (body) => ({ type, raw: body.length, gzip: gzipSync(body, { level: 9 }).length }),
        () => null,
      ),
    );
  });

  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });

  const path = {
    landing: '/',
    scenarios: '/scenarios',
    brief: `/scenarios/${seeded.scenarioId}/brief`,
    call: `/calls/${seeded.callId}?input=text`,
    report: `/sessions/${seeded.reportId}/report`,
  }[name];
  await page.goto(origin + path, { waitUntil: 'load' });
  if (name === 'call') {
    // A call with messages in it opens on a "resume" step; the transcript is drawn after it.
    await page
      .getByRole('button', { name: /^Resume as a text-only call$|^Start text-only call$/ })
      .click();
    await page.locator('.cw-turn').last().waitFor();
  }
  if (name === 'report') await page.locator('.rp-turn').last().waitFor();
  await page.waitForTimeout(settle);

  await cdp.send('HeapProfiler.collectGarbage');
  const heap = (await cdp.send('Runtime.getHeapUsage')).usedSize / 1048576;
  const result = await page.evaluate(() => {
    const paint = Object.fromEntries(
      performance.getEntriesByType('paint').map((entry) => [entry.name, entry.startTime]),
    );
    const resources = performance.getEntriesByType('resource');
    const transferred = (kind) =>
      resources
        .filter((entry) => (kind === 'script' ? /\.js(\?|$)/ : /\.css(\?|$)/).test(entry.name))
        .reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
    return {
      fcp: Math.round(paint['first-contentful-paint'] ?? 0),
      lcp: window.__probe.lcp,
      cls: window.__probe.cls,
      longTasks: window.__probe.long.filter((ms) => ms >= 50).length,
      longTaskMs: window.__probe.long.filter((ms) => ms >= 50).reduce((sum, ms) => sum + ms, 0),
      domNodes: document.getElementsByTagName('*').length,
      requests: resources.length,
      jsTransferred: transferred('script'),
      cssTransferred: transferred('stylesheet'),
    };
  });
  const loaded = (await Promise.all(bodies)).filter(Boolean);
  const sum = (type, key) =>
    loaded.filter((entry) => entry.type === type).reduce((total, entry) => total + entry[key], 0);
  await context.close();
  return {
    page: name,
    fcp: result.fcp,
    lcp: result.lcp,
    cls: Math.round(result.cls * 1000) / 1000,
    longTasks: result.longTasks,
    longTaskMs: result.longTaskMs,
    domNodes: result.domNodes,
    heapMB: Math.round(heap * 10) / 10,
    requests: result.requests,
    jsKB: {
      raw: sum('script', 'raw') / 1024,
      gzip: sum('script', 'gzip') / 1024,
      transferred: result.jsTransferred / 1024,
    },
    cssKB: {
      raw: sum('stylesheet', 'raw') / 1024,
      gzip: sum('stylesheet', 'gzip') / 1024,
      transferred: result.cssTransferred / 1024,
    },
  };
}

// ---- Run and report ----------------------------------------------------------------------------------

const browser = await chromium.launch({ channel: channel === 'none' ? undefined : channel });
const version = browser.version();
try {
  const seeded = await seed(browser);
  const results = new Map(pages.map((name) => [name, []]));
  for (let run = 1; run <= runs; run += 1) {
    for (const name of pages) {
      const result = await measure(browser, seeded, name);
      results.get(name).push(result);
      if (json)
        console.log(
          JSON.stringify({ origin, browser: version, throttle, width, height, run, ...result }),
        );
    }
  }

  if (!json) {
    console.log(
      `\nFirefly performance probe: ${origin}\n` +
        `Browser ${version}, ${width} x ${height}, CPU x${throttle}, ${runs} run${runs === 1 ? '' : 's'} per page, cold cache.\n` +
        `One machine, one sitting: compare with numbers from the same sitting only.\n`,
    );
    const columns = [
      ['FCP ms', (r) => r.fcp, 0],
      ['LCP ms', (r) => r.lcp, 0],
      ['CLS', (r) => r.cls, 3],
      ['Long tasks', (r) => r.longTasks, 0],
      ['Long ms', (r) => r.longTaskMs, 0],
      ['DOM nodes', (r) => r.domNodes, 0],
      ['Heap MB', (r) => r.heapMB, 1],
      ['Requests', (r) => r.requests, 0],
      ['JS gzip kB', (r) => r.jsKB.gzip, 1],
      ['JS xfer kB', (r) => r.jsKB.transferred, 1],
      ['CSS gzip kB', (r) => r.cssKB.gzip, 1],
    ];
    const table = pages.map((name) => {
      const list = results.get(name);
      return columns.map(([, pick, digits]) => {
        const values = list.map(pick);
        const text = median(values).toFixed(digits);
        const low = Math.min(...values).toFixed(digits);
        const high = Math.max(...values).toFixed(digits);
        return runs > 1 && low !== high ? `${text} (${low}-${high})` : text;
      });
    });
    const widths = columns.map(([label], at) =>
      Math.max(label.length, ...table.map((row) => row[at].length)),
    );
    const line = (first, cells) =>
      first.padEnd(11) + cells.map((cell, at) => cell.padStart(widths[at] + 2)).join('');
    console.log(
      line(
        'Page',
        columns.map(([label]) => label),
      ),
    );
    pages.forEach((name, at) => console.log(line(name, table[at])));
    console.log(
      '\nEach cell is the median of the runs, with the lowest and highest in brackets. JS and CSS are\n' +
        'what the page loaded in all (the first load plus its own chunks), in kB: gzip is the unit of\n' +
        'scripts/budgets.json, xfer is what the server really sent (it does not compress).\n',
    );
  }
} finally {
  await browser.close();
}
