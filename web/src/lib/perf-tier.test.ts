import { describe, expect, it } from 'vitest';
import { seeded } from '../test-rng.ts';
import {
  DEFAULT_WINDOW_MS,
  PERF_TIERS,
  SLOW_FRAME_MS,
  STEADY_WINDOWS,
  VERY_SLOW_FRAME_MS,
  createFrameMonitor,
  effectiveDpr,
  forcedTierFromSearch,
  initialTier,
  readPerfEnv,
  tierBudget,
  tierRank,
  type PerfEnv,
  type PerfSource,
  type PerfTier,
} from './perf-tier.ts';

const env = (patch: Partial<PerfEnv> = {}): PerfEnv => ({
  coarsePointer: false,
  devicePixelRatio: 1,
  ...patch,
});

describe('initialTier', () => {
  it.each([
    ['a capable desktop', { hardwareConcurrency: 8, deviceMemory: 8 }, 'high'],
    ['a desktop that does not report memory (Safari)', { hardwareConcurrency: 10 }, 'high'],
    ['a browser that reports nothing', {}, 'high'],
    [
      'data saver on, whatever the hardware',
      { saveData: true, hardwareConcurrency: 16, deviceMemory: 8 },
      'low',
    ],
    ['two cores', { hardwareConcurrency: 2, deviceMemory: 8 }, 'low'],
    ['one core', { hardwareConcurrency: 1 }, 'low'],
    ['2 GB of memory', { hardwareConcurrency: 8, deviceMemory: 2 }, 'low'],
    ['half a gigabyte', { deviceMemory: 0.5 }, 'low'],
    ['three cores', { hardwareConcurrency: 3, deviceMemory: 8 }, 'medium'],
    ['four cores', { hardwareConcurrency: 4 }, 'medium'],
    ['4 GB of memory', { hardwareConcurrency: 8, deviceMemory: 4 }, 'medium'],
    [
      'a touch screen as the main pointer',
      { hardwareConcurrency: 8, deviceMemory: 8, coarsePointer: true },
      'medium',
    ],
    ['five cores and 8 GB', { hardwareConcurrency: 5, deviceMemory: 8 }, 'high'],
    ['a weak phone: two cores and touch', { hardwareConcurrency: 2, coarsePointer: true }, 'low'],
  ] as [string, Partial<PerfEnv>, PerfTier][])('is %s → %s', (_name, patch, tier) => {
    expect(initialTier(env(patch))).toBe(tier);
  });

  it('reads a figure that is not a usable number as unknown, not as a weak device', () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(initialTier(env({ hardwareConcurrency: bad, deviceMemory: bad }))).toBe('high');
    }
    expect(initialTier(env({ hardwareConcurrency: undefined, deviceMemory: 2 }))).toBe('low');
  });

  it('never gets better with worse hardware, and never worse with better', () => {
    const { pick } = seeded(3);
    for (let i = 0; i < 300; i += 1) {
      const base = env({
        hardwareConcurrency: pick([undefined, 1, 2, 3, 4, 6, 8, 16]),
        deviceMemory: pick([undefined, 0.5, 1, 2, 4, 8]),
        saveData: pick([false, true]),
        coarsePointer: pick([false, true]),
      });
      const rank = tierRank(initialTier(base));
      expect(
        tierRank(initialTier({ ...base, hardwareConcurrency: 32, deviceMemory: 8 })),
      ).toBeLessThanOrEqual(rank);
      expect(tierRank(initialTier({ ...base, saveData: true }))).toBeGreaterThanOrEqual(rank);
      expect(tierRank(initialTier({ ...base, coarsePointer: true }))).toBeGreaterThanOrEqual(rank);
      expect(tierRank(initialTier({ ...base, hardwareConcurrency: 1 }))).toBeGreaterThanOrEqual(
        rank,
      );
    }
  });
});

describe('tierBudget', () => {
  it('gives each tier its budget', () => {
    expect(tierBudget('high')).toEqual({
      motes: 120,
      dprCap: 2,
      blur: true,
      shader: true,
      shaderScale: 1,
      pointerEffects: true,
      filaments: 14,
    });
    expect(tierBudget('medium')).toEqual({
      motes: 70,
      dprCap: 1.5,
      blur: true,
      shader: true,
      shaderScale: 0.6,
      pointerEffects: true,
      filaments: 8,
    });
    expect(tierBudget('low')).toEqual({
      motes: 24,
      dprCap: 1,
      blur: false,
      shader: false,
      shaderScale: 0.5,
      pointerEffects: false,
      filaments: 3,
    });
  });

  it('never grants more at a cheaper tier, and cannot be changed by whoever reads it', () => {
    const [high, medium, low] = PERF_TIERS.map(tierBudget);
    for (const [better, worse] of [
      [high, medium],
      [medium, low],
    ] as const) {
      expect(worse?.motes).toBeLessThan(better?.motes ?? 0);
      expect(worse?.dprCap).toBeLessThanOrEqual(better?.dprCap ?? 0);
      expect(worse?.shaderScale).toBeLessThanOrEqual(better?.shaderScale ?? 0);
      expect(worse?.filaments).toBeLessThan(better?.filaments ?? 0);
      for (const flag of ['blur', 'shader', 'pointerEffects'] as const) {
        expect(Number(worse?.[flag])).toBeLessThanOrEqual(Number(better?.[flag]));
      }
    }
    expect(Object.isFrozen(tierBudget('high'))).toBe(true);
    expect(tierBudget('high')).toBe(tierBudget('high'));
  });

  it('gives an unknown tier the cheapest budget', () => {
    expect(tierBudget('ultra' as PerfTier)).toBe(tierBudget('low'));
  });
});

describe('effectiveDpr', () => {
  it('uses the screen ratio within the cap of the tier, and never less than 1', () => {
    expect(effectiveDpr({ devicePixelRatio: 3 }, 'high')).toBe(2);
    expect(effectiveDpr({ devicePixelRatio: 3 }, 'medium')).toBe(1.5);
    expect(effectiveDpr({ devicePixelRatio: 3 }, 'low')).toBe(1);
    expect(effectiveDpr({ devicePixelRatio: 1.25 }, 'high')).toBe(1.25);
    expect(effectiveDpr({ devicePixelRatio: 0.5 }, 'high')).toBe(1);
    expect(effectiveDpr({ devicePixelRatio: Number.NaN }, 'high')).toBe(1);
  });
});

describe('readPerfEnv', () => {
  it('reads what the browser reports', () => {
    const source: PerfSource = {
      navigator: { hardwareConcurrency: 6, deviceMemory: 4, connection: { saveData: true } },
      matchMedia: (query) => ({ matches: query === '(pointer: coarse)' }),
      devicePixelRatio: 2.5,
    };
    expect(readPerfEnv(source)).toEqual({
      hardwareConcurrency: 6,
      deviceMemory: 4,
      saveData: true,
      coarsePointer: true,
      devicePixelRatio: 2.5,
    });
  });

  it('copes with a browser that has no window, no media queries or no network information', () => {
    expect(readPerfEnv(undefined)).toEqual({
      hardwareConcurrency: undefined,
      deviceMemory: undefined,
      saveData: false,
      coarsePointer: false,
      devicePixelRatio: 1,
    });
    expect(readPerfEnv({ navigator: { hardwareConcurrency: 4 } })).toMatchObject({
      hardwareConcurrency: 4,
      saveData: false,
      coarsePointer: false,
    });
    expect(
      readPerfEnv({
        matchMedia: () => {
          throw new Error('not supported');
        },
        devicePixelRatio: 0,
      }),
    ).toMatchObject({ coarsePointer: false, devicePixelRatio: 1 });
  });
});

describe('forcedTierFromSearch', () => {
  it.each([
    ['?perf=low', 'low'],
    ['perf=medium', 'medium'],
    ['?a=1&perf=high&b=2', 'high'],
    ['?perf=LOW', 'low'],
    ['?perf=ultra', null],
    ['?perf=', null],
    ['?perfect=low', null],
    ['', null],
  ] as [string, PerfTier | null][])('reads %j as %s', (search, tier) => {
    expect(forcedTierFromSearch(search)).toBe(tier);
  });
});

// ------------------------------------------------------------------------------------------

function harness(start: PerfTier, windowMs?: number) {
  let time = 1000;
  let nextId = 0;
  let hidden = false;
  const pending = new Map<number, () => void>();
  const degrades: [PerfTier, string][] = [];
  let requests = 0;
  const monitor = createFrameMonitor({
    now: () => time,
    requestFrame: (callback) => {
      nextId += 1;
      requests += 1;
      pending.set(nextId, callback);
      return nextId;
    },
    cancelFrame: (id) => {
      pending.delete(id);
    },
    isHidden: () => hidden,
    onDegrade: (tier, reason) => degrades.push([tier, reason]),
    start,
    windowMs,
  });
  /** One frame, `ms` after the last. */
  const frame = (ms: number) => {
    time += ms;
    const callbacks = [...pending.values()];
    pending.clear();
    for (const callback of callbacks) callback();
  };
  /** Frames every `ms` for `duration` ms. */
  const run = (ms: number, duration: number) => {
    for (let spent = 0; spent < duration; spent += ms) frame(ms);
  };
  return {
    monitor,
    degrades,
    frame,
    run,
    pending: () => pending.size,
    requests: () => requests,
    hide: (value: boolean) => {
      hidden = value;
    },
    tiers: () => degrades.map(([tier]) => tier),
  };
}

describe('the frame monitor', () => {
  it('leaves a smooth page alone, and stops after five steady windows', () => {
    const h = harness('high');
    h.monitor.start();
    expect(h.pending()).toBe(1);
    h.run(16.7, DEFAULT_WINDOW_MS * (STEADY_WINDOWS - 1));
    expect(h.pending()).toBe(1);
    h.run(16.7, DEFAULT_WINDOW_MS * 1.2);
    expect(h.degrades).toEqual([]);
    expect(h.pending()).toBe(0);
    const requests = h.requests();
    h.run(16.7, 3000);
    expect(h.requests()).toBe(requests);
  });

  it('drops one tier when the median frame is slower than 22 ms', () => {
    const h = harness('high');
    h.monitor.start();
    h.run(30, DEFAULT_WINDOW_MS * 1.1);
    expect(h.tiers()).toEqual(['medium']);
    expect(h.pending()).toBe(1); // still watching: it may need to go further
  });

  it('keeps stepping down while the page stays slow, and stops itself at low', () => {
    const h = harness('high');
    h.monitor.start();
    h.run(30, DEFAULT_WINDOW_MS * 4);
    expect(h.tiers()).toEqual(['medium', 'low']);
    expect(h.pending()).toBe(0);
  });

  it('drops straight to low when the median frame is slower than 40 ms', () => {
    const h = harness('high');
    h.monitor.start();
    h.run(50, DEFAULT_WINDOW_MS * 1.1);
    expect(h.tiers()).toEqual(['low']);
    expect(h.pending()).toBe(0);
  });

  it('starts from the tier it is given', () => {
    const h = harness('medium');
    h.monitor.start();
    h.run(30, DEFAULT_WINDOW_MS * 1.1);
    expect(h.tiers()).toEqual(['low']);
  });

  it('does nothing at all when it starts at low: there is nothing left to give up', () => {
    const h = harness('low');
    h.monitor.start();
    expect(h.requests()).toBe(0);
    expect(h.pending()).toBe(0);
  });

  it('never steps back up, however smooth the page becomes', () => {
    const h = harness('high');
    h.monitor.start();
    h.run(30, DEFAULT_WINDOW_MS * 1.1);
    h.run(8, DEFAULT_WINDOW_MS * 10);
    expect(h.tiers()).toEqual(['medium']);
  });

  it('restarts the count of steady windows after a step down', () => {
    const h = harness('high');
    h.monitor.start();
    h.run(16.7, DEFAULT_WINDOW_MS * 3.2); // three steady windows
    h.run(30, DEFAULT_WINDOW_MS * 1.1); // then a slow one: one tier down
    expect(h.tiers()).toEqual(['medium']);
    h.run(16.7, DEFAULT_WINDOW_MS * 4.2); // four steady windows are not enough on their own
    expect(h.pending()).toBe(1);
    h.run(16.7, DEFAULT_WINDOW_MS * 1.2);
    expect(h.pending()).toBe(0);
  });

  it('judges by the median: occasional long frames do not count, a mostly slow page does', () => {
    const jank = harness('high');
    jank.monitor.start();
    for (let i = 0; i < 120; i += 1) jank.frame(i % 5 === 0 ? 120 : 16);
    expect(jank.degrades).toEqual([]);

    const slow = harness('high');
    slow.monitor.start();
    for (let i = 0; i < 120; i += 1) slow.frame(i % 5 < 3 ? 30 : 16);
    expect(slow.tiers()).toEqual(['medium']);
  });

  it('draws the lines exactly at 22 ms and 40 ms: above them, not at them', () => {
    const at22 = harness('high');
    at22.monitor.start();
    at22.run(SLOW_FRAME_MS, DEFAULT_WINDOW_MS * 1.1);
    expect(at22.degrades).toEqual([]);

    const above22 = harness('high');
    above22.monitor.start();
    above22.run(SLOW_FRAME_MS + 0.5, DEFAULT_WINDOW_MS * 1.1);
    expect(above22.tiers()).toEqual(['medium']);

    const at40 = harness('high');
    at40.monitor.start();
    at40.run(VERY_SLOW_FRAME_MS, DEFAULT_WINDOW_MS * 1.1);
    expect(at40.tiers()).toEqual(['medium']);

    const above40 = harness('high');
    above40.monitor.start();
    above40.run(VERY_SLOW_FRAME_MS + 0.5, DEFAULT_WINDOW_MS * 1.1);
    expect(above40.tiers()).toEqual(['low']);
  });

  it('ignores a window in which the page was hidden, and does not count it as steady', () => {
    const h = harness('high');
    h.monitor.start();
    h.run(16.7, DEFAULT_WINDOW_MS * 4.2); // four steady windows
    h.hide(true);
    h.run(80, DEFAULT_WINDOW_MS * 2); // slow, but nobody is looking
    h.hide(false);
    expect(h.degrades).toEqual([]);
    expect(h.pending()).toBe(1);
    h.run(16.7, DEFAULT_WINDOW_MS * 1.3); // one steady window after the gap is the fifth
    expect(h.pending()).toBe(0);
    expect(h.degrades).toEqual([]);
  });

  it('ignores the long pause of a page that was suspended without saying so', () => {
    const h = harness('high');
    h.monitor.start();
    h.run(16.7, 600);
    h.frame(30_000); // the tab slept; the next frame arrives much later
    h.run(16.7, DEFAULT_WINDOW_MS * 1.2);
    expect(h.degrades).toEqual([]);
  });

  it('waits for a few frames before judging, so one long frame cannot decide a window', () => {
    const h = harness('high');
    h.monitor.start();
    h.frame(16);
    h.frame(1600); // a lone, long frame as the window closes
    expect(h.degrades).toEqual([]);
    h.frame(16);
    h.frame(16);
    h.frame(16);
    expect(h.degrades).toEqual([]);
  });

  it('still notices a page so slow it manages only a frame or two a second', () => {
    const h = harness('high');
    h.monitor.start();
    h.run(900, 10_000);
    expect(h.tiers()).toEqual(['low']);
  });

  it('uses the window length it is given', () => {
    const h = harness('high', 400);
    h.monitor.start();
    h.run(30, 450);
    expect(h.tiers()).toEqual(['medium']);
    const wrong = harness('high', Number.NaN);
    wrong.monitor.start();
    wrong.run(30, DEFAULT_WINDOW_MS * 1.1);
    expect(wrong.tiers()).toEqual(['medium']);
  });

  it('explains a step down in a line that names the measurement and the new tier', () => {
    const h = harness('high');
    h.monitor.start();
    h.run(30, DEFAULT_WINDOW_MS * 1.1);
    const reason = h.degrades[0]?.[1] ?? '';
    expect(reason).toMatch(/30\.0 ms over 1\.5 s/);
    expect(reason).toMatch(/medium/);
    expect(reason).toMatch(/22 ms/);
  });

  it('stops on request, cancels the frame it was waiting for, and ignores one that arrives late', () => {
    const h = harness('high');
    h.monitor.start();
    expect(h.pending()).toBe(1);
    h.monitor.stop();
    expect(h.pending()).toBe(0);
    h.run(60, 5000);
    expect(h.degrades).toEqual([]);
    expect(h.requests()).toBe(1);
  });

  it('can be started again, and starting twice does not double the watching', () => {
    const h = harness('high');
    h.monitor.start();
    h.monitor.start();
    expect(h.requests()).toBe(1);
    h.monitor.stop();
    h.monitor.start();
    expect(h.pending()).toBe(1);
    h.run(30, DEFAULT_WINDOW_MS * 1.1);
    expect(h.tiers()).toEqual(['medium']);
  });

  it('only ever reports a cheaper tier than before, whatever the frames do', () => {
    const random = seeded(2026);
    for (let trial = 0; trial < 60; trial += 1) {
      const start = random.pick(PERF_TIERS);
      const h = harness(start, random.int(300, 1800));
      h.monitor.start();
      let hidden = false;
      for (let i = 0; i < 600; i += 1) {
        if (random.chance(0.01)) {
          hidden = !hidden;
          h.hide(hidden);
        }
        h.frame(random.chance(0.7) ? 8 + random.next() * 20 : 20 + random.next() * 90);
      }
      let rank = tierRank(start);
      for (const tier of h.tiers()) {
        expect(tierRank(tier)).toBeGreaterThan(rank);
        rank = tierRank(tier);
      }
      expect(h.pending()).toBeLessThanOrEqual(1);
    }
  });
});
