/* eslint-disable @typescript-eslint/no-explicit-any -- the probes below patch browser globals, which have no useful types */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type CDPSession,
  type Page,
  type Route,
} from '@playwright/test';

// Performance and media-lifecycle checks, in a real Chromium-based browser (set PW_CHANNEL=msedge to
// use the installed Edge). Each test prints its numbers as `PERF {...}` lines and attaches them to the
// report, so docs/performance.md can quote what was measured. The numbers belong to one machine in one
// sitting: compare two builds in the same sitting, never across machines.
//
// The spoken-call test needs the server's mock speech provider (FIREFLY_SPEECH_PROVIDER=mock) and
// Chromium's fake microphone, which plays a short generated tone on a loop. It skips itself, with the
// reason, when the server does not offer speech. Real browser speech recognition cannot be tested:
// Edge and Chrome return no words under automation.
//
//   $env:FIREFLY_SPEECH_PROVIDER='mock'; npm run build; npm start     (another terminal)
//   $env:E2E_BASE_URL='http://127.0.0.1:8787'; $env:PW_CHANNEL='msedge'; npx playwright test e2e/perf.spec.ts
//
// The timing tests (tagged @perf in their titles) depend on how fast the machine is, so they are left
// out of an ordinary `npx playwright test` and CI run. Run them on purpose with E2E_PERF=1:
//
//   $env:E2E_PERF='1'; npx playwright test e2e/perf.spec.ts           (PowerShell)
//   E2E_PERF=1 npx playwright test e2e/perf.spec.ts                   (bash)
//
// The media-lifecycle tests count tracks, audio contexts, object URLs, elements and listeners rather
// than milliseconds, so they always run.
//
// PERF_SPOKEN_TURNS sets the number of spoken turns in the lifecycle test (default 30, and 12 in CI
// to keep the job short).

const SPOKEN_TURNS = Number(process.env.PERF_SPOKEN_TURNS ?? (process.env.CI ? 12 : 30));

function report(testInfo: { attach: (name: string, options: { body: string }) => Promise<void> }) {
  return async (label: string, numbers: Record<string, unknown>) => {
    const body = JSON.stringify({ label, ...numbers });
    console.log(`PERF ${body}`);
    await testInfo.attach(label, { body });
  };
}

// ---- Fixtures ---------------------------------------------------------------------------------

const CUSTOMER_LINES = [
  'It started on Tuesday morning and it happens every time I open the dashboard. I have tried twice already and nothing changed.',
  'Nothing that I know of. A colleague changed a setting last week but she says it is unrelated. I am not so sure about that.',
  'Honestly I need this fixed today. We have a review with our leadership this afternoon and I cannot show them an empty page.',
  'About twelve of us, all on the same team. The others in the office seem fine, which is odd.',
  'Yes, that is right. Every morning since Tuesday. It works for a few minutes and then it stops.',
];
const TRAINEE_LINES = [
  'Hello, this is Sam from support. Thank you for getting in touch. Can you tell me exactly what you are seeing when it happens?',
  'When did it start, and has anything changed on your side recently, for example a new setting or an update?',
  'I understand why that is frustrating. Let me check what we can see on our side and I will come back to you in a moment.',
  'Could you tell me how many people are affected, and whether it happens for everyone or only some of them?',
  'To confirm, you saw the error after the update on Tuesday, and it has happened each morning since then. Is that right?',
];

type Session = {
  id: string;
  scenarioId: string;
  startedAt: string;
  turns: Record<string, unknown>[];
  state: unknown;
  status: string;
};

async function createSession(request: APIRequestContext, messages = 0): Promise<Session> {
  const catalogue = await (await request.get('/api/scenarios')).json();
  const created = await request.post('/api/sessions', {
    data: {
      scenarioId: catalogue.scenarios[0].id,
      overrides: { difficulty: 'starter' },
      clientRequestId: randomUUID(),
    },
  });
  expect(created.ok()).toBe(true);
  const { session } = await created.json();
  for (let i = 0; i < messages; i += 1) {
    const sent = await request.post(`/api/sessions/${session.id}/messages`, {
      data: { text: TRAINEE_LINES[i % TRAINEE_LINES.length], clientMessageId: randomUUID() },
    });
    expect(sent.ok()).toBe(true);
  }
  return (await (await request.get(`/api/sessions/${session.id}`)).json()).session;
}

async function finishedSession(request: APIRequestContext): Promise<Session> {
  const session = await createSession(request, 3);
  await request.post(`/api/sessions/${session.id}/end`, { data: {} });
  for (let i = 0; i < 80; i += 1) {
    const current = (await (await request.get(`/api/sessions/${session.id}`)).json()).session;
    if (current.status === 'completed') return current;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('The report was not ready in time.');
}

/**
 * A copy of the session with `count` turns. The server allows at most 60 messages in a call, so
 * longer ones are made here and served to the page by route interception: they test the interface
 * with more turns than a real call can have, and they are labelled synthetic wherever they are quoted.
 */
function withTurns(session: Session, count: number): Session {
  const turns = [...session.turns];
  const start = Date.parse(session.startedAt);
  while (turns.length < count) {
    const index = turns.length + 1;
    const role = index % 2 === 1 ? 'customer' : 'trainee';
    const pool = role === 'trainee' ? TRAINEE_LINES : CUSTOMER_LINES;
    turns.push({
      index,
      role,
      text: pool[index % pool.length],
      createdAt: new Date(start + index * 20_000).toISOString(),
      source: role === 'trainee' ? 'trainee' : 'demo',
      inputMode: 'text',
    });
  }
  return { ...session, turns };
}

/** Serves a longer copy of the session, and answers new messages in the same invented style. */
async function serveLongSession(page: Page, session: Session, count: number): Promise<void> {
  const long = withTurns(session, count);
  let next = long.turns.length;
  await page.route(new RegExp(`/api/sessions/${session.id}$`), async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ json: { session: long } });
  });
  await page.route(`**/api/sessions/${session.id}/messages`, async (route) => {
    const body = route.request().postDataJSON() as { text: string };
    const at = new Date().toISOString();
    const trainee = {
      index: next + 1,
      role: 'trainee',
      text: body.text,
      createdAt: at,
      source: 'trainee',
      inputMode: 'text',
    };
    const customer = {
      index: next + 2,
      role: 'customer',
      text: CUSTOMER_LINES[(next + 2) % CUSTOMER_LINES.length],
      createdAt: at,
      source: 'demo',
      inputMode: 'text',
    };
    next += 2;
    await route.fulfill({
      json: {
        traineeTurn: trainee,
        customerTurn: customer,
        state: long.state,
        redactions: [],
        turnsRemaining: 1,
      },
    });
  });
}

/** Records long tasks, layout shifts and event timings from the first byte of every page. */
async function watchPage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as any;
    w.__perf = { long: [], cls: 0, events: [] };
    const watch = (type: string, onEntry: (entry: any) => void, extra: object = {}) => {
      try {
        new PerformanceObserver((list) => list.getEntries().forEach(onEntry)).observe({
          type,
          buffered: true,
          ...extra,
        });
      } catch {
        // This browser does not report that kind of entry.
      }
    };
    watch('longtask', (entry) => w.__perf.long.push(Math.round(entry.duration)));
    watch('layout-shift', (entry) => {
      if (!entry.hadRecentInput) w.__perf.cls += entry.value;
    });
    // The control a click was on, noted as it happens: by the time Event Timing reports the click, a
    // button inside a dialog that has closed is no longer in the page.
    const labels: { at: number; label: string }[] = [];
    document.addEventListener(
      'click',
      (event) => {
        const target =
          event.target instanceof Element ? event.target.closest('button, a, [role]') : null;
        const text = target?.getAttribute('aria-label') || target?.textContent || '';
        labels.push({ at: event.timeStamp, label: text.trim().slice(0, 40) });
      },
      true,
    );
    watch(
      'event',
      (entry) => {
        if (entry.interactionId) {
          w.__perf.events.push({
            name: entry.name,
            ms: Math.round(entry.duration),
            target: labels.find((item) => Math.abs(item.at - entry.startTime) < 2)?.label ?? '',
          });
        }
      },
      { durationThreshold: 16 },
    );
  });
}

async function metrics(cdp: CDPSession): Promise<Record<string, number>> {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(metrics.map((metric) => [metric.name, metric.value]));
}

const framesFor = (page: Page, ms: number) =>
  page.evaluate(
    (duration) =>
      new Promise<number[]>((resolve) => {
        const deltas: number[] = [];
        let last = performance.now();
        const begin = last;
        const tick = (now: number) => {
          deltas.push(now - last);
          last = now;
          if (now - begin < duration) requestAnimationFrame(tick);
          else resolve(deltas);
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );

const p95 = (values: number[]) => {
  const sorted = values.slice(2).sort((a, b) => a - b);
  return Math.round((sorted[Math.floor(sorted.length * 0.95)] ?? 0) * 10) / 10;
};

// ---- Long transcripts -------------------------------------------------------------------------

test.describe('long transcripts', () => {
  for (const turns of [60, 200, 500]) {
    test(`the call page stays cheap with ${turns} turns (synthetic) @perf`, async ({
      page,
      browser: _browser,
    }, testInfo) => {
      test.setTimeout(90_000);
      const say = report(testInfo);
      await watchPage(page);
      const session = await createSession(page.request, 3);
      await serveLongSession(page, session, turns);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Performance.enable');

      const opened = Date.now();
      await page.goto(`/calls/${session.id}?input=text`);
      await page.getByRole('button', { name: 'Resume with text' }).click();
      await page
        .locator('.cw-turn')
        .nth(turns - 1)
        .waitFor();
      const openMs = Date.now() - opened;
      await page.waitForTimeout(500);
      const nodes = await page.evaluate(() => document.getElementsByTagName('*').length);

      // Five quiet seconds: the clock ticks once a second and must not cost more with more turns.
      const before = await metrics(cdp);
      await page.waitForTimeout(5000);
      const after = await metrics(cdp);
      const idleScriptMsPerSecond = ((after.ScriptDuration! - before.ScriptDuration!) / 5) * 1000;

      // Scroll up and down through the transcript.
      const frames = framesFor(page, 2500);
      const box = (await page.locator('.cw-log-scroll').boundingBox())!;
      await page.mouse.move(box.x + 200, Math.min(box.y + 300, 700));
      for (let i = 0; i < 16; i += 1) {
        await page.mouse.wheel(0, i < 8 ? -900 : 900);
        await page.waitForTimeout(80);
      }
      const scrollP95 = p95(await frames);

      // A new turn arrives.
      const beforeSend = await metrics(cdp);
      await page
        .getByRole('textbox', { name: 'Your reply' })
        .fill('Thanks, I have noted that and will check it now.');
      await page.getByRole('button', { name: 'Send' }).click();
      await page
        .locator('.cw-turn')
        .nth(turns + 1)
        .waitFor();
      const afterSend = await metrics(cdp);
      const perf = await page.evaluate(() => (window as any).__perf);

      await say(`call-${turns}-turns`, {
        synthetic: turns > 121,
        openMs,
        domNodes: nodes,
        idleScriptMsPerSecond: Math.round(idleScriptMsPerSecond * 10) / 10,
        scrollFrameP95Ms: scrollP95,
        newTurnScriptMs: Math.round(
          (afterSend.ScriptDuration! - beforeSend.ScriptDuration!) * 1000,
        ),
        longTasks: perf.long.length,
        longestTaskMs: Math.max(0, ...perf.long),
        cls: Math.round(perf.cls * 1000) / 1000,
      });
      // The rows are not drawn again each second, so the idle cost does not grow with the call.
      expect(idleScriptMsPerSecond).toBeLessThan(15);
      expect(nodes).toBeLessThan(turns * 12 + 800);
    });

    test(`the report transcript stays cheap with ${turns} turns (synthetic) @perf`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(90_000);
      const say = report(testInfo);
      await watchPage(page);
      const session = await finishedSession(page.request);
      await serveLongSession(page, session, turns);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Performance.enable');

      const opened = Date.now();
      await page.goto(`/sessions/${session.id}/report`);
      await page
        .locator('.rp-turn')
        .nth(turns - 1)
        .waitFor();
      const openMs = Date.now() - opened;
      const nodes = await page.evaluate(() => document.getElementsByTagName('*').length);

      // Typing in the find box must not freeze the page: the search is deferred.
      const find = page.getByRole('searchbox', { name: 'Find in transcript' });
      const typed = await page.evaluate(async () => {
        const input = document.querySelector<HTMLInputElement>(
          'input[type="search"], input[placeholder="Find in transcript"]',
        )!;
        const longTasks: number[] = [];
        const observer = new PerformanceObserver((list) =>
          list.getEntries().forEach((e) => longTasks.push(Math.round(e.duration))),
        );
        observer.observe({ type: 'longtask' });
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
        const start = performance.now();
        for (const text of ['c', 'co', 'col', 'coll', 'colle', 'collea']) {
          setter.call(input, text);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
        observer.disconnect();
        return { ms: Math.round(performance.now() - start), longTasks };
      });
      await expect(find).toHaveValue('collea');
      const matches = await page.locator('.rp-find__count').innerText();

      // Stepping to a match scrolls to it, even inside a turn the browser had skipped.
      let visibleAfterStep = 0;
      for (let step = 0; step < 6; step += 1) {
        await page.getByRole('button', { name: 'Next match' }).click();
        const mark = page.locator('[data-rp-current-match]');
        await expect(mark).toBeInViewport();
        visibleAfterStep += 1;
      }
      const perf = await page.evaluate(() => (window as any).__perf);
      await say(`report-${turns}-turns`, {
        synthetic: turns > 121,
        openMs,
        domNodes: nodes,
        searchTypingLongTasks: typed.longTasks,
        searchStatus: matches,
        stepsScrolledToAMatch: visibleAfterStep,
        longTasks: perf.long.length,
        longestTaskMs: Math.max(0, ...perf.long),
        cls: Math.round(perf.cls * 1000) / 1000,
      });
      expect(Math.max(0, ...typed.longTasks)).toBeLessThan(250);
    });
  }
});

// ---- Input latency ----------------------------------------------------------------------------

test('every control on a 200-turn call answers quickly, with the CPU slowed four times @perf', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(150_000);
  const say = report(testInfo);
  // PERF_CPU_RATE slows the CPU down this many times (default 4, as a modest office laptop would be).
  const rate = Math.max(1, Number(process.env.PERF_CPU_RATE ?? 4));
  // With the server's speech provider (and the fake microphone) the call is a spoken one, so the
  // microphone controls are there to be pressed; without it the call is typed.
  const config = await (await request.get('/api/config')).json();
  const spoken = Boolean(config.speech?.transcribe && config.speech?.synthesize);
  await watchPage(page);
  const session = await createSession(page.request, 3);
  await serveLongSession(page, session, 200);
  await page.goto(`/calls/${session.id}`);
  await page
    .getByRole('button', {
      name: spoken ? 'Resume voice call' : 'Resume with text',
    })
    .click();
  await page.locator('.cw-turn').nth(199).waitFor();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await page.waitForTimeout(800);
  // Starting the call (the microphone and the audio) is its own, one-off cost; the controls follow it.
  await page.evaluate(() => {
    (window as any).__perf.events.length = 0;
  });
  const press = async (name: RegExp) => {
    const button = page.getByRole('button', { name }).first();
    if (!(await button.isVisible())) return;
    await button.click();
    await page.waitForTimeout(450);
  };
  await press(/^Mute/);
  await press(/^Mute|^Unmute/);
  await press(/^Pause$/);
  await press(/^Resume$/);
  await press(/^Settings$/);
  if (await page.getByRole('dialog').isVisible()) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(450);
  }
  for (let again = 0; again < 3; again += 1) {
    await press(/^End call$/);
    await press(/^Continue call$/);
  }
  // A spoken call has no reply box until the person chooses to type.
  if (spoken) await press(/^Text$/);
  await page
    .getByRole('textbox', { name: 'Your reply' })
    .fill('Thank you, I will look into that now.');
  await press(/^Send$/);
  await page.locator('.cw-turn').nth(201).waitFor();
  await page.waitForTimeout(450);

  const perf = await page.evaluate(() => (window as any).__perf);
  // One "click" entry per interaction; the pointer and key entries of the same interaction repeat it.
  const clicks = (perf.events as { name: string; ms: number; target: string }[]).filter(
    (event) => event.name === 'click',
  );
  const worst = clicks.reduce((a, b) => (b.ms > a.ms ? b : a), { name: 'none', ms: 0, target: '' });
  await say(`input-latency-200-turns-cpu-x${rate}`, {
    cpuSlowedTimes: rate,
    spokenCall: spoken,
    interactions: clicks.length,
    worstEventMs: worst.ms,
    worstEvent: `click on "${worst.target}"`,
    everyClickMs: clicks.map((event) => `${event.target || '(unnamed)'}: ${event.ms}`),
  });
  // Event Timing is rounded to 8 ms. This records how long each control takes to show its result, and
  // asserts only that nothing comes near freezing the page (a quarter of a second per CPU slowdown):
  // the first opening of a dialog or the first press of a control costs more (the browser's first style
  // and layout work), and other programs on the machine add noise. docs/performance.md quotes the
  // measured values against the 100 ms target.
  expect(clicks.length).toBeGreaterThanOrEqual(6);
  expect(worst.ms).toBeLessThan(250 * rate);
});

// ---- Evaluating -------------------------------------------------------------------------------

test('the wait after End and review never freezes the page, never animates under reduced motion, and stops polling when left @perf', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const say = report(testInfo);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await watchPage(page);
  // The demo engine evaluates in a moment, so the waiting screen is made to last: the session is
  // served as "still being evaluated" for a number of polls, then as it really is.
  const session = await finishedSession(page.request);
  const address = new RegExp(`/api/sessions/${session.id}$`);
  let polls = 0;
  let evaluatingFor = 4;
  const stillEvaluating = async (route: Route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    polls += 1;
    if (evaluatingFor <= 0) return route.fallback();
    evaluatingFor -= 1;
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({
      response,
      json: {
        session: {
          ...body.session,
          status: 'completing',
          evaluationPhase: 'scoring',
          evaluationError: null,
          report: null,
        },
      },
    });
  };
  await page.route(address, stillEvaluating);

  await page.goto(`/sessions/${session.id}/report`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Building your coaching report' }),
  ).toBeVisible();
  const running = await page.evaluate(
    () =>
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.playState === 'running' &&
            (animation.effect?.getComputedTiming().iterations ?? 1) === Infinity,
        ).length,
  );
  await expect(
    page.getByRole('heading', { level: 1, name: 'Coaching report', exact: true }),
  ).toBeVisible({
    timeout: 30_000,
  });
  const perf = await page.evaluate(() => (window as any).__perf);
  const pollsToFinish = polls;

  // An evaluation that never finishes: leave the page by a link in the app, and nothing keeps asking.
  await page.unroute(address, stillEvaluating);
  evaluatingFor = 1_000;
  polls = 0;
  await page.route(address, stillEvaluating);
  await page.goto(`/sessions/${session.id}/report`);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Building your coaching report' }),
  ).toBeVisible();
  await expect.poll(() => polls, { timeout: 10_000 }).toBeGreaterThanOrEqual(3);
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Responsible AI' })
    .click();
  await page.waitForURL(/\/responsible-ai$/);
  const pollsAtLeaving = polls;
  await page.waitForTimeout(3_000);

  await say('evaluating', {
    pollsUntilTheReportAppeared: pollsToFinish,
    infiniteAnimationsRunningUnderReducedMotion: running,
    longTasksDuringTheWait: perf.long.length,
    longestTaskMs: Math.max(0, ...perf.long),
    pollsInThreeSecondsAfterLeaving: polls - pollsAtLeaving,
  });
  expect(running).toBe(0);
  expect(Math.max(0, ...perf.long)).toBeLessThan(100);
  expect(polls - pollsAtLeaving).toBe(0);
});

// ---- The microphone, the audio and everything else a spoken call opens -------------------------

const LOOP_WAV = join(
  process.cwd(),
  'node_modules',
  '.cache',
  'firefly-perf',
  'speech-loop-3s.wav',
);

/**
 * A 3.2 s loop: half a second of speech-like tone, then silence, so every pass hears one utterance.
 * The silence has to be longer than the 1.4 s of quiet that ends an utterance (the call's
 * `endpointSilenceMs`), or the call would hear one endless utterance and end it only at its limit.
 */
function writeSpeechLoop(file: string): void {
  if (existsSync(file)) return;
  mkdirSync(join(file, '..'), { recursive: true });
  const rate = 48_000;
  const seconds = 3.2;
  const count = Math.round(rate * seconds);
  const wav = Buffer.alloc(44 + count * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + count * 2, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i += 1) {
    const t = i / rate;
    const tone =
      t < 0.55
        ? 0.35 *
          (0.6 + 0.4 * Math.sin(2 * Math.PI * 4 * t)) *
          (Math.sin(2 * Math.PI * 220 * t) +
            0.6 * Math.sin(2 * Math.PI * 440 * t) +
            0.3 * Math.sin(2 * Math.PI * 880 * t))
        : 0;
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, tone)) * 32767), 44 + i * 2);
  }
  writeFileSync(file, wav);
}
writeSpeechLoop(LOOP_WAV);

/** Patches the browser's media APIs, before the page runs, so every resource a call opens is counted. */
async function watchMedia(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const w = window as any;
    const m: any = (w.__media = {
      contexts: [] as AudioContext[],
      maxLiveContexts: 0,
      tracks: [] as MediaStreamTrack[],
      getUserMediaCalls: 0,
      urlsCreated: 0,
      urlsRevoked: 0,
      liveUrls: new Set<string>(),
      maxLiveUrls: 0,
      played: new Set<HTMLMediaElement>(),
      maxPlaying: 0,
      worklets: [] as any[],
      workletDisconnects: 0,
      portCloses: 0,
      timeouts: new Set<number>(),
      intervals: new Set<number>(),
      frames: new Set<number>(),
      listeners: {} as Record<string, Map<string, Set<unknown>>>,
      speechCancels: 0,
      speechSpeaks: 0,
      pageshows: [] as boolean[],
      pagehides: [] as boolean[],
    });

    const NativeContext = w.AudioContext;
    if (NativeContext) {
      const Wrapped = function (this: unknown, ...args: unknown[]) {
        const created = new NativeContext(...args);
        m.contexts.push(created);
        const live = m.contexts.filter((c: AudioContext) => c.state !== 'closed').length;
        m.maxLiveContexts = Math.max(m.maxLiveContexts, live);
        return created;
      } as any;
      Wrapped.prototype = NativeContext.prototype;
      w.AudioContext = Wrapped;
    }
    const NativeWorklet = w.AudioWorkletNode;
    if (NativeWorklet) {
      const Wrapped = function (this: unknown, ...args: unknown[]) {
        const created = new NativeWorklet(...args);
        const disconnect = created.disconnect.bind(created);
        created.disconnect = (...a: unknown[]) => {
          m.workletDisconnects += 1;
          return disconnect(...a);
        };
        m.worklets.push(created);
        return created;
      } as any;
      Wrapped.prototype = NativeWorklet.prototype;
      w.AudioWorkletNode = Wrapped;
    }
    const nativeClose = MessagePort.prototype.close;
    MessagePort.prototype.close = function () {
      m.portCloses += 1;
      return nativeClose.call(this);
    };

    const devices = navigator.mediaDevices;
    if (devices) {
      const getUserMedia = devices.getUserMedia.bind(devices);
      devices.getUserMedia = async (constraints) => {
        m.getUserMediaCalls += 1;
        const stream = await getUserMedia(constraints);
        m.tracks.push(...stream.getTracks());
        return stream;
      };
    }

    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (source) => {
      const url = create(source as Blob);
      m.urlsCreated += 1;
      m.liveUrls.add(url);
      m.maxLiveUrls = Math.max(m.maxLiveUrls, m.liveUrls.size);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      if (m.liveUrls.delete(url)) m.urlsRevoked += 1;
      revoke(url);
    };

    const nativePlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      m.played.add(this);
      const result = nativePlay.call(this);
      const playing = [...m.played].filter(
        (element: HTMLMediaElement) => !element.paused && !element.ended,
      ).length;
      m.maxPlaying = Math.max(m.maxPlaying, playing);
      return result;
    };

    const nativeSetTimeout = w.setTimeout.bind(w);
    w.setTimeout = (handler: TimerHandler, ms?: number, ...args: unknown[]) => {
      const id: number = nativeSetTimeout(() => {
        m.timeouts.delete(id);
        if (typeof handler === 'function') handler(...args);
      }, ms);
      m.timeouts.add(id);
      return id;
    };
    const nativeClearTimeout = w.clearTimeout.bind(w);
    w.clearTimeout = (id?: number) => {
      if (id !== undefined) m.timeouts.delete(id);
      nativeClearTimeout(id);
    };
    const nativeSetInterval = w.setInterval.bind(w);
    w.setInterval = (handler: TimerHandler, ms?: number, ...args: unknown[]) => {
      const id: number = nativeSetInterval(handler, ms, ...args);
      m.intervals.add(id);
      return id;
    };
    const nativeClearInterval = w.clearInterval.bind(w);
    w.clearInterval = (id?: number) => {
      if (id !== undefined) m.intervals.delete(id);
      nativeClearInterval(id);
    };
    const nativeFrame = w.requestAnimationFrame.bind(w);
    w.requestAnimationFrame = (callback: FrameRequestCallback) => {
      const id: number = nativeFrame((time: number) => {
        m.frames.delete(id);
        callback(time);
      });
      m.frames.add(id);
      return id;
    };
    const nativeCancelFrame = w.cancelAnimationFrame.bind(w);
    w.cancelAnimationFrame = (id: number) => {
      m.frames.delete(id);
      nativeCancelFrame(id);
    };

    // Listeners on the window, the document and the microphone's device list, by event type.
    const label = (target: unknown) =>
      target === window
        ? 'window'
        : target === document
          ? 'document'
          : target === navigator.mediaDevices
            ? 'mediaDevices'
            : null;
    const nativeAdd = EventTarget.prototype.addEventListener;
    const nativeRemove = EventTarget.prototype.removeEventListener;
    const key = (type: string, options: unknown) =>
      `${type}|${typeof options === 'boolean' ? options : Boolean((options as any)?.capture)}`;
    EventTarget.prototype.addEventListener = function (type: string, listener: any, options?: any) {
      const name = label(this);
      if (name && listener && !(options && typeof options === 'object' && options.once)) {
        const byKey = (m.listeners[name] ??= new Map());
        const set = byKey.get(key(type, options)) ?? new Set();
        set.add(listener);
        byKey.set(key(type, options), set);
      }
      return nativeAdd.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (
      type: string,
      listener: any,
      options?: any,
    ) {
      const name = label(this);
      if (name) m.listeners[name]?.get(key(type, options))?.delete(listener);
      return nativeRemove.call(this, type, listener, options);
    };

    if ('speechSynthesis' in w) {
      const synth = w.speechSynthesis;
      const cancel = synth.cancel.bind(synth);
      synth.cancel = () => {
        m.speechCancels += 1;
        cancel();
      };
      const speak = synth.speak.bind(synth);
      synth.speak = (utterance: SpeechSynthesisUtterance) => {
        m.speechSpeaks += 1;
        speak(utterance);
      };
    }
    nativeAdd.call(window, 'pageshow', (event: any) => m.pageshows.push(Boolean(event.persisted)));
    nativeAdd.call(window, 'pagehide', (event: any) => m.pagehides.push(Boolean(event.persisted)));
  });
}

interface MediaState {
  contexts: { total: number; live: number; max: number };
  tracks: { total: number; live: number };
  getUserMediaCalls: number;
  urls: { created: number; revoked: number; live: number; maxLive: number };
  elements: { everPlayed: number; playingNow: number; maxPlaying: number; inDocument: number };
  worklets: { created: number; disconnects: number; portCloses: number };
  timers: { timeouts: number; intervals: number; frames: number };
  listeners: Record<string, number>;
  speech: { speaks: number; cancels: number; speakingNow: boolean; pendingNow: boolean };
  pageshows: boolean[];
  pagehides: boolean[];
}

const mediaState = (page: Page): Promise<MediaState> =>
  page.evaluate(() => {
    const m = (window as any).__media;
    const count = (name: string) =>
      [...(m.listeners[name]?.values() ?? [])].reduce(
        (sum: number, set: Set<unknown>) => sum + set.size,
        0,
      );
    return {
      contexts: {
        total: m.contexts.length,
        live: m.contexts.filter((c: AudioContext) => c.state !== 'closed').length,
        max: m.maxLiveContexts,
      },
      tracks: {
        total: m.tracks.length,
        live: m.tracks.filter((t: MediaStreamTrack) => t.readyState === 'live').length,
      },
      getUserMediaCalls: m.getUserMediaCalls,
      urls: {
        created: m.urlsCreated,
        revoked: m.urlsRevoked,
        live: m.liveUrls.size,
        maxLive: m.maxLiveUrls,
      },
      elements: {
        everPlayed: m.played.size,
        playingNow: [...m.played].filter((e: HTMLMediaElement) => !e.paused && !e.ended).length,
        maxPlaying: m.maxPlaying,
        inDocument: document.querySelectorAll('audio, video').length,
      },
      worklets: {
        created: m.worklets.length,
        disconnects: m.workletDisconnects,
        portCloses: m.portCloses,
      },
      timers: { timeouts: m.timeouts.size, intervals: m.intervals.size, frames: m.frames.size },
      listeners: {
        window: count('window'),
        document: count('document'),
        mediaDevices: count('mediaDevices'),
      },
      speech: {
        speaks: m.speechSpeaks,
        cancels: m.speechCancels,
        speakingNow: speechSynthesis.speaking,
        pendingNow: speechSynthesis.pending,
      },
      pageshows: m.pageshows,
      pagehides: m.pagehides,
    } satisfies MediaState;
  });

async function heapMB(cdp: CDPSession): Promise<number> {
  await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  return Math.round((usedSize / 1048576) * 100) / 100;
}

// Chromium's fake microphone, for the spoken-call tests (a launch option, so it applies to the whole file;
// it changes nothing for the others). Tracing is off for the whole file: Playwright's trace recorder keeps
// the page's DOM nodes alive and adds script time of its own, which would be measured as the page's.
test.use({
  trace: 'off',
  screenshot: 'off',
  permissions: ['microphone'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${LOOP_WAV}`,
    ],
  },
});

test.describe('a spoken call', () => {
  test.beforeEach(async ({ request }) => {
    const config = await (await request.get('/api/config')).json();
    test.skip(
      !(config.speech?.transcribe && config.speech?.synthesize),
      'The server has no speech provider. Start it with FIREFLY_SPEECH_PROVIDER=mock.',
    );
  });

  async function beginSpoken(page: Page, context: BrowserContext): Promise<Session> {
    await watchMedia(context);
    const session = await createSession(page.request);
    await page.goto(`/calls/${session.id}?input=voice`);
    await page.getByRole('button', { name: 'Start voice call' }).click();
    return session;
  }

  /**
   * One spoken turn: wait for the words to be heard and answered, then for the customer to finish
   * speaking. There is no speaking over the customer, so the microphone opens when the voice ends.
   */
  async function spokenTurn(page: Page, number: number): Promise<void> {
    await expect(page.locator('.cw-turn--you')).toHaveCount(number, { timeout: 40_000 });
    await expect(page.locator('.cw-turn--customer')).toHaveCount(number + 1, { timeout: 40_000 });
    await expect(page.locator('.cw-status[data-status="customer-speaking"]')).toHaveCount(0, {
      timeout: 40_000,
    });
  }

  test(`${SPOKEN_TURNS} spoken turns, then pause, resume and end, leave nothing open`, async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(Math.max(180_000, SPOKEN_TURNS * 9_000));
    const say = report(testInfo);
    const cdp = await context.newCDPSession(page);
    await beginSpoken(page, context);

    let early: MediaState | null = null;
    let earlyHeap = 0;
    // The heap and the page's node and listener counts every five turns, after a full garbage collection.
    const series: { turn: number; heapMB: number; domNodes: number; jsEventListeners: number }[] =
      [];
    const sample = async (turn: number) => {
      const heap = await heapMB(cdp);
      const counters = await cdp.send('Memory.getDOMCounters');
      series.push({
        turn,
        heapMB: heap,
        domNodes: counters.nodes,
        jsEventListeners: counters.jsEventListeners,
      });
      return heap;
    };
    for (let turn = 1; turn <= SPOKEN_TURNS; turn += 1) {
      await spokenTurn(page, turn);
      if (turn === 5) {
        early = await mediaState(page);
        earlyHeap = await sample(turn);
      } else if (turn % 5 === 0 && turn !== SPOKEN_TURNS) {
        await sample(turn);
      }
    }
    const late = await mediaState(page);
    const lateHeap = await sample(SPOKEN_TURNS);
    expect(early).not.toBeNull();

    // While the call runs: one microphone, bounded audio contexts, one audio element, no URL piling up.
    expect(late.getUserMediaCalls).toBe(1);
    expect(late.tracks.live).toBe(1);
    expect(late.contexts.max).toBeLessThanOrEqual(2); // the microphone's graph and the voice's level meter
    expect(late.contexts.total).toBe(early!.contexts.total);
    expect(late.urls.maxLive).toBeLessThanOrEqual(2);
    expect(late.elements.everPlayed).toBe(1);
    expect(late.elements.maxPlaying).toBeLessThanOrEqual(1);
    expect(late.listeners).toEqual(early!.listeners);
    // A timer that belongs to the voice that has just finished may still be winding down at the instant
    // of sampling, so the count is read until it settles: it is the settled count that must not grow.
    await expect
      .poll(async () => (await mediaState(page)).timers.intervals, { timeout: 5_000 })
      .toBeLessThanOrEqual(early!.timers.intervals + 1);
    const growthMB = lateHeap - earlyHeap;
    expect(growthMB).toBeLessThan(Math.max(2, earlyHeap * 0.1));

    // Pause lets go of the microphone; resume asks for it again.
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect.poll(async () => (await mediaState(page)).tracks.live, { timeout: 5_000 }).toBe(0);
    const paused = await mediaState(page);
    await page.getByRole('button', { name: 'Resume' }).click();
    await expect
      .poll(async () => (await mediaState(page)).tracks.live, { timeout: 10_000 })
      .toBe(1);

    // End and review: everything is released, and the report opens.
    await page.getByRole('button', { name: 'End call' }).click();
    await page.getByRole('button', { name: 'End and review' }).click();
    await page.waitForURL(/\/report$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect
      .poll(async () => (await mediaState(page)).contexts.live, { timeout: 5_000 })
      .toBe(0);
    const ended = await mediaState(page);

    await say('spoken-call-lifecycle', {
      spokenTurns: SPOKEN_TURNS,
      browser: await page.evaluate(() => navigator.userAgent),
      afterTurn5: early,
      afterLastTurn: late,
      heapMB: {
        afterTurn5: earlyHeap,
        afterLastTurn: lateHeap,
        growth: Math.round(growthMB * 100) / 100,
        series,
      },
      afterPause: { liveTracks: paused.tracks.live, liveContexts: paused.contexts.live },
      afterEnd: ended,
    });

    expect(paused.tracks.live).toBe(0);
    expect(ended.tracks.total).toBe(2);
    expect(ended.tracks.live).toBe(0);
    expect(ended.contexts.live).toBe(0);
    expect(ended.urls.live).toBe(0);
    expect(ended.urls.created).toBe(ended.urls.revoked);
    expect(ended.elements.playingNow).toBe(0);
    expect(ended.elements.inDocument).toBe(0);
    expect(ended.worklets.disconnects).toBeGreaterThanOrEqual(ended.worklets.created);
    expect(ended.worklets.portCloses).toBeGreaterThanOrEqual(ended.worklets.created);
    expect(ended.speech.speakingNow).toBe(false);
    expect(ended.speech.pendingNow).toBe(false);
    expect(ended.timers.intervals).toBe(0);
  });

  test('leaving the call by the back button, or by leaving the page, releases the microphone', async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(120_000);
    const say = report(testInfo);
    await watchMedia(context);

    // In the app: brief, then the call, then the back button.
    const session = await createSession(page.request);
    await page.goto(`/scenarios/${session.scenarioId}/brief`);
    await expect(page.getByRole('button', { name: 'Start voice call' })).toBeVisible();
    const baseline = await mediaState(page);
    await page.getByRole('button', { name: 'Start voice call' }).click();
    await page.waitForURL(/\/calls\//);
    await page.getByRole('button', { name: 'Start voice call' }).click();
    await expect
      .poll(async () => (await mediaState(page)).tracks.live, { timeout: 15_000 })
      .toBe(1);
    await page.goBack();
    await expect(page.getByRole('button', { name: 'Start voice call' })).toBeVisible();
    await expect.poll(async () => (await mediaState(page)).tracks.live, { timeout: 5_000 }).toBe(0);
    await expect
      .poll(async () => (await mediaState(page)).contexts.live, { timeout: 5_000 })
      .toBe(0);
    const afterBack = await mediaState(page);

    // Out of the app: the page is left for another document while the microphone is open.
    const second = await createSession(page.request);
    await page.goto(`/calls/${second.id}?input=voice`);
    await page.getByRole('button', { name: 'Start voice call' }).click();
    await expect
      .poll(async () => (await mediaState(page)).tracks.live, { timeout: 15_000 })
      .toBe(1);
    await page.goto('about:blank');
    await page.goBack();
    await page.waitForLoadState('load');
    const restored = await page.evaluate(() => {
      const m = (window as any).__media;
      return {
        pageshows: m?.pageshows ?? [],
        liveTracks: (m?.tracks ?? []).filter((t: MediaStreamTrack) => t.readyState === 'live')
          .length,
        tracksEver: (m?.tracks ?? []).length,
      };
    });
    await say('leaving-a-spoken-call', {
      backButtonLiveTracks: afterBack.tracks.live,
      backButtonLiveContexts: afterBack.contexts.live,
      listenersBeforeTheCallAndAfterTheBackButton: [baseline.listeners, afterBack.listeners],
      intervalsBeforeTheCallAndAfterTheBackButton: [
        baseline.timers.intervals,
        afterBack.timers.intervals,
      ],
      afterLeavingThePage: restored,
      cameBackFromTheBackForwardCache: restored.pageshows.includes(true),
    });
    // The back button leaves nothing behind: no microphone, no context, no listener, no repeating timer.
    expect(afterBack.tracks.live).toBe(0);
    expect(afterBack.contexts.live).toBe(0);
    expect(afterBack.listeners).toEqual(baseline.listeners);
    expect(afterBack.timers.intervals).toBe(baseline.timers.intervals);
    // Whether the page was frozen in the back/forward cache or loaded afresh, it holds no live microphone.
    expect(restored.liveTracks).toBe(0);
  });
});
