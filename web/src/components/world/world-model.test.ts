import { describe, expect, it } from 'vitest';
import { EASING_ENERGY_CAP, MOOD_ATMOSPHERE } from '../call/atmosphere.ts';
import {
  PULSE_SECONDS,
  STRAND_POINTS,
  X_MAX,
  X_MIN,
  Y_LIMIT,
  carryOver,
  createWorld,
  isSettled,
  pointsOf,
  settleWorld,
  startPulse,
  stepWorld,
  totalAlpha,
  type World,
} from './world-model.ts';
import type { WorldPose } from './world-store.ts';

type Mood = keyof typeof MOOD_ATMOSPHERE;
const MOODS: Mood[] = ['calm', 'concerned', 'frustrated', 'angry', 'escalating'];

const pose = (mood: Mood, extra: Partial<WorldPose> = {}): Partial<WorldPose> => ({
  ...MOOD_ATMOSPHERE[mood],
  intensity: 1,
  ...extra,
});

/** Runs the field for `seconds` at `fps` toward a pose. */
function run(world: World, seconds: number, to: Partial<WorldPose>, fps = 60) {
  for (let i = 0; i < Math.round(seconds * fps); i += 1) stepWorld(world, 1 / fps, to);
}

const settled = (mood: Mood, extra: Partial<WorldPose> = {}, seed = 3) => {
  const world = createWorld(seed, 'high');
  settleWorld(world, pose(mood, extra));
  return world;
};

/** A small deterministic random source, so a failure can be reproduced. */
function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const within = (values: ArrayLike<number>, low: number, high: number) => {
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i] as number;
    if (!(v >= low && v <= high)) return false;
  }
  return true;
};

const visible = (world: World) =>
  Array.from({ length: world.count }, (_, i) => i).filter((i) => (world.alpha[i] as number) > 0.05);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

/** How far the visible strands spread up and down the window (the standard deviation of their height). */
function spread(world: World) {
  const middle = Math.floor(world.size / 2);
  const ys = visible(world).map((i) => pointsOf(world, i)[middle * 2 + 1] as number);
  const centre = mean(ys);
  return Math.sqrt(mean(ys.map((y) => (y - centre) ** 2)));
}
const warmthOf = (world: World) => mean(visible(world).map((i) => world.warmth[i] as number));

describe('createWorld', () => {
  it('has the strands each tier can afford, and none at all in the lowest', () => {
    for (const tier of ['high', 'medium', 'low'] as const) {
      const [strands, points] = STRAND_POINTS[tier];
      const world = createWorld(1, tier);
      expect([world.count, world.size, world.pos.length]).toEqual([
        strands,
        points,
        strands * points * 2,
      ]);
    }
    expect(STRAND_POINTS.high).toEqual([90, 28]);
    expect(STRAND_POINTS.medium).toEqual([60, 22]);
    expect(STRAND_POINTS.low).toEqual([0, 0]);
  });

  it('is the same field for the same seed, and a different one for another', () => {
    const [a, b, c] = [7, 7, 8].map((seed) => createWorld(seed, 'high'));
    for (const world of [a, b, c]) run(world as World, 3, pose('angry'));
    expect(Array.from((a as World).pos)).toEqual(Array.from((b as World).pos));
    expect(Array.from((c as World).pos)).not.toEqual(Array.from((a as World).pos));
  });

  it('hands out the same points every time, so a frame allocates nothing', () => {
    const world = createWorld(1, 'high');
    expect(pointsOf(world, 4)).toBe(pointsOf(world, 4));
    expect(pointsOf(world, 4)).toHaveLength(world.size * 2);
    expect(pointsOf(world, 4).buffer).toBe(world.pos.buffer);
    expect(pointsOf(world, 999)).toHaveLength(0);
    expect(pointsOf(createWorld(1, 'low'), 0)).toHaveLength(0);
  });
});

describe('stepWorld', () => {
  it('keeps every number finite and inside its bounds, whatever it is asked for', () => {
    const next = random(12345);
    const odd = [Number.NaN, Infinity, -Infinity, -3, 7, 0, 1, undefined, null, '0.5'];
    const wild = () => (next() < 0.25 ? odd[Math.floor(next() * odd.length)] : next());
    const times = [0, 1 / 60, 0.1, 5, -1, Number.NaN, Infinity, 1e9];
    for (const tier of ['high', 'medium'] as const) {
      const world = createWorld(9, tier);
      for (let step = 0; step < 250; step += 1) {
        const asked = {
          tension: wild(),
          open: wild(),
          warmth: wild(),
          energy: wild(),
          intensity: wild(),
          recovering: next() < 0.5,
          focus: [undefined, null, { x: wild(), y: wild() }][Math.floor(next() * 3)],
        } as unknown as Partial<WorldPose>;
        stepWorld(world, times[Math.floor(next() * times.length)] as number, asked);
        if (step % 50 === 0)
          startPulse(world, next() < 0.5 ? 'discovery' : 'curveball', {
            x: wild(),
            y: wild(),
          } as never);
        const xs: number[] = [];
        const ys: number[] = [];
        for (let k = 0; k < world.count * world.size; k += 1) {
          xs.push(world.pos[k * 2] as number);
          ys.push(world.pos[k * 2 + 1] as number);
        }
        const ok = [
          // x lives in a Float32Array, so the last point is 1.08 to within single precision.
          within(xs, X_MIN - 1e-6, X_MAX + 1e-6),
          within(ys, -Y_LIMIT - 1e-6, 1 + Y_LIMIT + 1e-6),
          within(world.alpha, 0, 1),
          within(world.warmth, 0, 1),
          within(world.fray, 0, 1),
          within(world.width, 0.1, 3),
          within(world.lights, -0.2, world.count),
          within(Object.values(world.state), 0, 1),
          Number.isFinite(world.time),
        ];
        expect(ok, `step ${step} on ${tier}`).toEqual(ok.map(() => true));
      }
    }
  });

  it('does nothing, and does not throw, for a tier with no strands', () => {
    const world = createWorld(1, 'low');
    stepWorld(world, 0.016, pose('angry'));
    settleWorld(world, pose('angry'));
    startPulse(world, 'discovery');
    expect(world.pulse.kind).toBe(0);
    expect(totalAlpha(world)).toBe(0);
  });

  it('closes in quickly and opens up slowly: tension rises in about half a second and eases in about one and a half', () => {
    const rising = createWorld(2, 'high');
    settleWorld(rising, pose('calm'));
    run(rising, 0.5, pose('escalating'));
    const from = MOOD_ATMOSPHERE.calm.tension;
    const to = MOOD_ATMOSPHERE.escalating.tension;
    const risen = (rising.state.tension - from) / (to - from);

    const easing = createWorld(2, 'high');
    settleWorld(easing, pose('escalating'));
    run(easing, 0.5, pose('calm'));
    const eased = (to - easing.state.tension) / (to - from);

    expect(risen).toBeGreaterThan(0.55); // 1 - 1/e after one time constant
    expect(risen).toBeLessThan(0.7);
    expect(eased).toBeGreaterThan(0.2);
    expect(eased).toBeLessThan(0.36);
    expect(risen).toBeGreaterThan(eased * 2);
  });

  it('cannot be thrown forward by a stalled tab: a long gap counts as a short one', () => {
    const stalled = createWorld(4, 'high');
    const steady = createWorld(4, 'high');
    stepWorld(stalled, 3600, pose('angry'));
    stepWorld(steady, 0.1, pose('angry'));
    expect(Array.from(stalled.pos)).toEqual(Array.from(steady.pos));
  });

  it('knows when it has arrived and nothing is left to animate', () => {
    const world = createWorld(5, 'high');
    settleWorld(world, pose('calm'));
    expect(isSettled(world, pose('calm'))).toBe(true);
    expect(isSettled(world, pose('angry'))).toBe(false);
    run(world, 14, pose('angry'));
    expect(isSettled(world, pose('angry'))).toBe(true);
    startPulse(world, 'discovery');
    expect(isSettled(world, pose('angry'))).toBe(false);
  });

  it('carries the mood over when it steps down a tier: fewer strands, the same room, no pop', () => {
    const high = createWorld(5, 'high');
    settleWorld(high, pose('calm'));
    run(high, 0.4, pose('escalating')); // part way through a change
    const medium = createWorld(5, 'medium');
    carryOver(high, medium);
    expect(medium.state).toEqual(high.state);
    expect([medium.time, medium.crisp]).toEqual([high.time, high.crisp]);
    expect(medium.count).toBeLessThan(high.count);
    // The change carries on from there, at the same pace.
    run(high, 0.4, pose('escalating'));
    run(medium, 0.4, pose('escalating'));
    expect(medium.state.tension).toBeCloseTo(high.state.tension, 6);
    expect(medium.state.warmth).toBeCloseTo(high.state.warmth, 6);
  });
});

describe('what each mood looks like', () => {
  it('gathers as the customer tenses: the strands spread less, and more of them appear', () => {
    const looks = MOODS.map((mood) => settled(mood));
    const spreads = looks.map(spread);
    const shown = looks.map((world) => visible(world).length);
    for (let i = 1; i < MOODS.length; i += 1) {
      expect(spreads[i], `${MOODS[i]} is tighter than ${MOODS[i - 1]}`).toBeLessThan(
        spreads[i - 1] as number,
      );
      expect(shown[i], `${MOODS[i]} shows more than ${MOODS[i - 1]}`).toBeGreaterThanOrEqual(
        shown[i - 1] as number,
      );
    }
    expect(shown.at(-1)).toBeGreaterThan(2 * (shown[0] as number));
  });

  it('warms from sage toward ember', () => {
    const warmth = MOODS.map((mood) => warmthOf(settled(mood)));
    for (let i = 1; i < warmth.length; i += 1) {
      expect(warmth[i]).toBeGreaterThan(warmth[i - 1] as number);
    }
  });

  it('turns smooth waves into sharp ones as it tenses, and frays only at the edge of control', () => {
    const [calm, , frustrated, angry, escalating] = MOODS.map((mood) => settled(mood));
    expect(calm?.crisp).toBe(0);
    expect(frustrated?.crisp as number).toBeLessThan(0.5);
    expect(angry?.crisp as number).toBeGreaterThan(0.6);
    expect(escalating?.crisp as number).toBeGreaterThan(0.95);
    const frayed = (world?: World) => Math.max(...(world?.fray ?? [0]));
    expect([frayed(calm), frayed(frustrated)]).toEqual([0, 0]);
    expect(frayed(angry)).toBeLessThan(0.1);
    expect(frayed(escalating)).toBeGreaterThan(0.3);
  });

  it('is nearly absent at low intensity and fully present at one', () => {
    const quiet = settled('calm', { intensity: 0.15 });
    const full = settled('calm', { intensity: 1 });
    expect(totalAlpha(quiet)).toBeLessThan(0.25 * totalAlpha(full));
    expect(totalAlpha(settled('calm', { intensity: 0 }))).toBeLessThan(0.1 * totalAlpha(full));
  });

  it('eases back: slower, cooler, and with the fraying drawn in', () => {
    const tense = settled('escalating');
    const easing = settled('escalating', { energy: EASING_ENERGY_CAP, recovering: true });
    expect(warmthOf(easing)).toBeLessThan(warmthOf(tense));
    expect(Math.max(...easing.fray)).toBeLessThan(0.25 * Math.max(...tense.fray));

    const before = easing.time;
    run(easing, 5, pose('escalating', { energy: EASING_ENERGY_CAP, recovering: true }));
    run(tense, 5, pose('escalating'));
    expect(easing.time - before).toBeLessThan(0.4 * (tense.time - before));
  });

  it('leans toward a point when asked to', () => {
    const left = settled('angry', { focus: { x: 0.15, y: 0.5 } });
    const right = settled('angry', { focus: { x: 0.85, y: 0.5 } });
    // The ribbons cross at the focus: the spread is smallest there.
    const gap = (world: World, at: number) => {
      const j = Math.round(at * (world.size - 1));
      const ys = visible(world).map((i) => pointsOf(world, i)[j * 2 + 1] as number);
      return Math.max(...ys) - Math.min(...ys);
    };
    expect(gap(left, 0.15)).toBeLessThan(gap(left, 0.85));
    expect(gap(right, 0.85)).toBeLessThan(gap(right, 0.15));
  });
});

describe('never flashing', () => {
  const fps = 60;

  it('has no jump in the light of the whole field when the mood changes', () => {
    const world = createWorld(5, 'high');
    settleWorld(world, pose('calm'));
    let last = totalAlpha(world);
    let jump = 0;
    for (let i = 0; i < fps * 6; i += 1) {
      stepWorld(world, 1 / fps, pose('escalating'));
      const now = totalAlpha(world);
      jump = Math.max(jump, Math.abs(now - last) / Math.max(now, last, 1e-6));
      last = now;
    }
    // From calm to the worst, no single frame changes the light of the whole field by a tenth: it
    // ramps over about a second, and nothing like a flash is possible.
    expect(jump).toBeLessThan(0.1);
  });

  it('moves no part of the tense field faster than 3 Hz', () => {
    const world = settled('escalating');
    const probes = visible(world).slice(0, 14);
    const middle = Math.floor(world.size / 2);
    const series = probes.map(() => [] as number[]);
    const seconds = 10;
    for (let i = 0; i < fps * seconds; i += 1) {
      stepWorld(world, 1 / fps, pose('escalating'));
      probes.forEach((strand, k) =>
        series[k]?.push(pointsOf(world, strand)[middle * 2 + 1] as number),
      );
    }
    for (const ys of series) {
      // A wave of f Hz turns around 2f times a second.
      let turns = 0;
      let direction = 0;
      for (let i = 1; i < ys.length; i += 1) {
        const delta = (ys[i] as number) - (ys[i - 1] as number);
        if (Math.abs(delta) < 1e-6) continue;
        const now = Math.sign(delta);
        if (direction !== 0 && now !== direction) turns += 1;
        direction = now;
      }
      expect(turns / 2 / seconds).toBeLessThanOrEqual(3);
    }
  });
});

describe('events', () => {
  const rested = () => {
    const world = createWorld(6, 'high');
    settleWorld(world, pose('concerned'));
    return world;
  };

  it('shows a discovery as a light travelling along the strands nearest the place, for under a second', () => {
    const world = rested();
    startPulse(world, 'discovery', { x: 0.6, y: 0.4 });
    const { kind, found, strands, points } = world.pulse;
    expect(PULSE_SECONDS).toBeLessThanOrEqual(0.9);
    expect([kind, found]).toEqual([1, 8]);
    expect(new Set(Array.from(strands).slice(0, found)).size).toBe(found);
    // Each chosen strand really does pass near the place.
    for (let k = 0; k < found; k += 1) {
      const at = pointsOf(world, strands[k] as number);
      const j = points[k] as number;
      expect(
        Math.hypot(((at[j * 2] as number) - 0.6) * 1.6, (at[j * 2 + 1] as number) - 0.4),
      ).toBeLessThan(0.2);
    }
    run(world, PULSE_SECONDS + 0.05, pose('concerned'));
    expect(world.pulse.kind).toBe(0);
  });

  it('kinks the strands at a curveball, and lets them settle back exactly', () => {
    const kinked = rested();
    const calm = rested();
    startPulse(kinked, 'curveball', { x: 0.55, y: 0.5 });
    let largest = 0;
    for (let i = 0; i < 0.3 * 60; i += 1) {
      stepWorld(kinked, 1 / 60, pose('concerned'));
      stepWorld(calm, 1 / 60, pose('concerned'));
      for (let k = 0; k < kinked.pos.length; k += 1) {
        largest = Math.max(largest, Math.abs((kinked.pos[k] as number) - (calm.pos[k] as number)));
      }
    }
    expect(largest).toBeGreaterThan(0.01);
    run(kinked, PULSE_SECONDS, pose('concerned'));
    run(calm, PULSE_SECONDS, pose('concerned'));
    expect(kinked.pulse.kind).toBe(0);
    expect(Array.from(kinked.pos)).toEqual(Array.from(calm.pos));
  });

  it('copes with a missing or nonsensical place', () => {
    const world = rested();
    startPulse(world, 'discovery');
    expect(world.pulse.found).toBeGreaterThan(0);
    startPulse(world, 'discovery', { x: Number.NaN, y: Infinity });
    startPulse(world, 'curveball', { x: -4, y: 9 });
    expect(within([world.pulse.x, world.pulse.y], 0, 1)).toBe(true);
  });
});
