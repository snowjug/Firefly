import { START_TEMPERATURES, TEMPERATURE_BANDS } from '#shared/domain/vocab.ts';
import { describe, expect, it } from 'vitest';
import { coreParams, type CoreParams } from '../atlas/core-params.ts';
import { defaultChoices, type SetupChoices } from '../scenario/setup-model.ts';
import { makeScenario } from '../scenario/scenario-fixtures.ts';
import { MOOD_ATMOSPHERE } from '../call/atmosphere.ts';
import { room } from './signal.fixtures.ts';
import {
  BAND_SEGMENTS,
  CORE_SECONDS,
  EASE_SECONDS,
  RISE_SECONDS,
  corePose,
  densityOf,
  difficultyOf,
  dormantDots,
  heatOf,
  impactOf,
  interpolatePose,
  litSegments,
  lookAt,
  omegaFor,
  posesEqual,
  presencePose,
  restingState,
  ringsOf,
  settleSeconds,
  startOf,
  stepPose,
  POSE_KEYS,
  type Pose,
} from './poses.ts';

const choices = (over: Partial<SetupChoices> = {}): SetupChoices => ({
  ...defaultChoices(makeScenario()),
  ...over,
});

const BANDS = TEMPERATURE_BANDS.map((band) => band.id);

describe('the presence pose', () => {
  it('gets more uneven, more serrated and more broken as the room tightens', () => {
    const poses = BANDS.map((mood) => presencePose(room(mood)));
    for (const key of ['amp', 'zig', 'frag', 'cross', 'hue'] as const) {
      for (let i = 1; i < poses.length; i += 1) {
        expect(poses[i]?.[key] ?? 0).toBeGreaterThanOrEqual(poses[i - 1]?.[key] ?? 0);
      }
    }
    for (let i = 1; i < poses.length; i += 1) {
      expect(poses[i]?.scale ?? 1).toBeLessThan(poses[i - 1]?.scale ?? 0);
    }
  });

  it('is smooth and wide when calm, and only escalating really fragments', () => {
    const calm = presencePose(room('calm'));
    expect(calm.zig).toBe(0);
    expect(calm.frag).toBe(0);
    expect(calm.scale).toBe(1);
    expect(presencePose(room('escalating')).frag).toBeGreaterThan(0.8);
    expect(presencePose(room('frustrated')).frag).toBeLessThan(0.2);
  });

  it('gives each band the edge of the glyph grammar: smooth, round, long-short, serrated', () => {
    const edge = (mood: keyof typeof MOOD_ATMOSPHERE) => {
      const pose = presencePose(room(mood));
      return { dash: Math.exp(pose.ld1), gap: pose.g1, zig: pose.zig };
    };
    expect(edge('calm').gap).toBe(0);
    expect(edge('concerned').dash).toBeLessThan(2);
    expect(edge('concerned').gap).toBeGreaterThan(2);
    expect(edge('frustrated').dash).toBeGreaterThan(5);
    expect(edge('frustrated').dash).toBeLessThan(20);
    expect(edge('angry').zig).toBeGreaterThan(0.8);
  });

  it('is the calm pose when the cues are off, never a tell', () => {
    const neutral = presencePose({
      tension: MOOD_ATMOSPHERE.calm.tension,
      open: MOOD_ATMOSPHERE.calm.open,
      energy: MOOD_ATMOSPHERE.calm.energy,
      recovering: false,
      silent: false,
    });
    expect(posesEqual(neutral, presencePose(room('calm')))).toBe(true);
  });

  it('eases back: rings widen, fragments rejoin, cool returns, and it is less jagged', () => {
    const tense = presencePose(room('escalating'));
    const easing = presencePose(
      room('escalating', { recovering: true, trend: 'falling', energy: 0.2 }),
    );
    expect(easing.scale).toBeGreaterThan(tense.scale);
    expect(easing.frag).toBeLessThan(tense.frag * 0.3);
    expect(easing.zig).toBeLessThan(tense.zig);
    expect(easing.cool).toBeGreaterThan(0.5);
    expect(easing.hue).toBeLessThan(0.3);
    expect(easing.energy).toBeLessThan(tense.energy);
  });

  it('dims and stills the room when the customer goes quiet', () => {
    const quiet = presencePose(room('frustrated', { silent: true }));
    expect(quiet.dim).toBe(1);
    expect(quiet.energy).toBe(0);
    expect(presencePose(room('frustrated')).dim).toBe(0);
  });

  it('is finite for every combination, including numbers outside 0 to 1', () => {
    for (const mood of BANDS) {
      for (const recovering of [false, true]) {
        const pose = presencePose(room(mood, { recovering, silent: !recovering }));
        for (const key of POSE_KEYS) expect(Number.isFinite(pose[key])).toBe(true);
      }
    }
    const wild = presencePose({
      tension: 4,
      open: -2,
      energy: Number.NaN,
      recovering: false,
      silent: false,
    });
    for (const key of POSE_KEYS) expect(Number.isNaN(wild[key])).toBe(false);
  });

  it('blends smoothly between the bands', () => {
    const a = lookAt(0.3);
    const b = lookAt(0.43);
    const c = lookAt(0.56);
    expect(b.amp).toBeGreaterThan(a.amp);
    expect(b.amp).toBeLessThan(c.amp);
  });
});

describe('the core pose', () => {
  it('turns the needle with the starting temperature: calm 0, angry 1', () => {
    const needle = START_TEMPERATURES.map(
      (startingTemperature) => corePose(coreParams(choices({ startingTemperature }))).needle,
    );
    expect(needle[0]).toBe(0);
    expect(needle[3]).toBeCloseTo(1, 5);
    expect(needle).toEqual([...needle].sort((a, b) => a - b));
  });

  it('adds rings and dormant dots with the difficulty: 1, 2, 3 rings and 3, 5, 7 dots', () => {
    const at = (difficulty: SetupChoices['difficulty']) => coreParams(choices({ difficulty }));
    expect(ringsOf(at('starter').complexity)).toBe(1);
    expect(ringsOf(at('standard').complexity)).toBe(2);
    expect(ringsOf(at('challenge').complexity)).toBe(3);
    expect(dormantDots(at('starter').complexity)).toBe(3);
    expect(dormantDots(at('standard').complexity)).toBeCloseTo(5, 5);
    expect(dormantDots(at('challenge').complexity)).toBeCloseTo(7, 5);
    expect(corePose(at('starter'))).toMatchObject({ r2: 0, r3: 0 });
    expect(corePose(at('standard'))).toMatchObject({ r2: 1, r3: 0 });
    expect(corePose(at('challenge'))).toMatchObject({ r2: 1, r3: 1 });
  });

  it('never reads the dots from anything but the difficulty: more than seven is impossible', () => {
    for (const complexity of [0, 0.25, 0.4, 0.55, 0.7, 0.9, 1, 5]) {
      const dots = dormantDots(complexity);
      expect(dots).toBeGreaterThanOrEqual(3);
      expect(dots).toBeLessThanOrEqual(7);
    }
  });

  it('lights more of the pressure band for a bigger impact: about 5, 15 and 24 of 24', () => {
    const lit = (impact: SetupChoices['impact']) =>
      litSegments(coreParams(choices({ impact })).pressure);
    expect(lit('low')).toBe(5);
    expect(lit('medium')).toBe(15);
    expect(lit('high')).toBe(BAND_SEGMENTS);
    expect(litSegments(5)).toBe(BAND_SEGMENTS);
    expect(litSegments(-1)).toBe(0);
  });

  it('reads the settings back from the parameters, so words and marks cannot disagree', () => {
    for (const impact of ['low', 'medium', 'high'] as const) {
      expect(impactOf(coreParams(choices({ impact })).pressure)).toBe(impact);
    }
    for (const startingTemperature of START_TEMPERATURES) {
      expect(startOf(coreParams(choices({ startingTemperature })).stability)).toBe(
        startingTemperature,
      );
    }
    for (const difficulty of ['starter', 'standard', 'challenge'] as const) {
      expect(difficultyOf(coreParams(choices({ difficulty })).complexity)).toBe(difficulty);
    }
    expect(heatOf(0.9)).toBe(0);
    expect(densityOf(0.25)).toBe('light');
    expect(densityOf(0.55)).toBe('moderate');
    expect(densityOf(0.9)).toBe('dense');
  });

  it('is finite for every parameter set', () => {
    const params: CoreParams = coreParams(choices());
    for (const key of POSE_KEYS) expect(Number.isFinite(corePose(params)[key])).toBe(true);
  });
});

describe('moving between poses', () => {
  const calm = presencePose(room('calm'));
  const angry = presencePose(room('angry'));

  const run = (from: Pose, to: Pose, seconds: number) => {
    let state = restingState(from);
    const omega = omegaFor(seconds);
    let t = 0;
    let settledAt: number | null = null;
    while (t < 6 && settledAt === null) {
      const next = stepPose(state, to, 1 / 60, omega);
      state = { pose: next.pose, velocity: next.velocity };
      t += 1 / 60;
      if (next.settled) settledAt = t;
    }
    return { state, settledAt };
  };

  it('is quick when tension rises and slow when it eases', () => {
    expect(settleSeconds(calm, angry)).toBe(RISE_SECONDS);
    expect(settleSeconds(angry, calm)).toBe(EASE_SECONDS);
    expect(RISE_SECONDS).toBeLessThan(EASE_SECONDS);
    const up = run(calm, angry, RISE_SECONDS);
    const down = run(angry, calm, EASE_SECONDS);
    expect(up.settledAt).not.toBeNull();
    expect(down.settledAt).not.toBeNull();
    expect(up.settledAt ?? 9).toBeLessThan(1.4);
    expect(down.settledAt ?? 0).toBeGreaterThan((up.settledAt ?? 9) * 1.5);
  });

  it('comes to rest exactly on the target, so the loop can stop', () => {
    const { state } = run(calm, angry, RISE_SECONDS);
    expect(posesEqual(state.pose, angry, 0)).toBe(true);
    for (const key of POSE_KEYS) expect(state.velocity[key]).toBe(0);
  });

  it('does not overshoot the edge of the pose (critical damping), apart from the springy needle', () => {
    let state = restingState(calm);
    const omega = omegaFor(RISE_SECONDS);
    let worst = 0;
    for (let i = 0; i < 180; i += 1) {
      const next = stepPose(state, angry, 1 / 60, omega);
      state = { pose: next.pose, velocity: next.velocity };
      worst = Math.max(worst, state.pose.amp - angry.amp);
    }
    expect(worst).toBeLessThan(0.01);
  });

  it('lets the needle overshoot a little, like a physical part', () => {
    const from = corePose(coreParams(choices({ startingTemperature: 'calm' })));
    const to = corePose(coreParams(choices({ startingTemperature: 'angry' })));
    let state = restingState(from);
    const omega = omegaFor(CORE_SECONDS);
    let peak = 0;
    for (let i = 0; i < 240; i += 1) {
      const next = stepPose(state, to, 1 / 60, omega);
      state = { pose: next.pose, velocity: next.velocity };
      peak = Math.max(peak, state.pose.needle);
    }
    expect(peak).toBeGreaterThan(to.needle + 0.005);
    expect(state.pose.needle).toBeCloseTo(to.needle, 5);
  });

  it('survives a long gap between frames without blowing up', () => {
    const next = stepPose(restingState(calm), angry, 5, omegaFor(RISE_SECONDS));
    for (const key of POSE_KEYS) expect(Number.isFinite(next.pose[key])).toBe(true);
  });

  it('blends two poses and clamps the amount', () => {
    expect(posesEqual(interpolatePose(calm, angry, 0), calm)).toBe(true);
    expect(posesEqual(interpolatePose(calm, angry, 1), angry)).toBe(true);
    expect(posesEqual(interpolatePose(calm, angry, 7), angry)).toBe(true);
    expect(interpolatePose(calm, angry, 0.5).amp).toBeCloseTo((calm.amp + angry.amp) / 2, 6);
  });
});
