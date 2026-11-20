import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HEIGHT,
  KINK_REACH,
  SPINE_HEIGHT,
  SPINE_WIDTH,
  envelope,
  estimateHeight,
  spineMoods,
  spineSegment,
  type SpineMood,
} from './spine-model.ts';
import type { TurnMood } from './useCall.ts';

const CENTRE = SPINE_WIDTH / 2;
const TENSE: SpineMood[] = ['concerned', 'frustrated', 'angry', 'escalating'];

/** The points of a path of straight runs, as [x, y] pairs. */
function pointsOf(d: string): [number, number][] {
  const absolute = d.replace(/V(-?\d+(?:\.\d+)?)/g, `L${CENTRE} $1`);
  const numbers = absolute.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < numbers.length; i += 2)
    pairs.push([numbers[i] as number, numbers[i + 1] as number]);
  return pairs;
}

describe('spineSegment', () => {
  it('draws a calm customer, or no known mood, as one straight line down the centre', () => {
    for (const mood of ['calm', 'neutral'] as const) {
      for (const seed of ['t1', 't2', 'a longer seed']) {
        const segment = spineSegment({ mood, seed });
        expect(segment.d).toBe(`M${CENTRE} 0V${SPINE_HEIGHT}`);
        expect(segment.reach).toBe(0);
        expect(segment.dash).toBeNull();
      }
    }
    expect(spineSegment({ mood: 'calm', seed: 't1', easing: true }).d).toBe(`M${CENTRE} 0V100`);
  });

  it('starts and ends every stretch on the centre line, so stretches of different moods join without a seam', () => {
    for (const mood of [
      'calm',
      'concerned',
      'frustrated',
      'angry',
      'escalating',
      'neutral',
    ] as const) {
      for (const options of [{}, { easing: true }, { kink: true }, { kink: true, easing: true }]) {
        for (const height of [40, 90, 150, 400, 1200]) {
          const points = pointsOf(
            spineSegment({ mood, seed: `s-${height}`, height, ...options }).d,
          );
          expect(points.length).toBeGreaterThanOrEqual(2);
          expect(points[0]).toEqual([CENTRE, 0]);
          expect(points[points.length - 1]).toEqual([CENTRE, SPINE_HEIGHT]);
        }
      }
    }
  });

  it('only ever runs downwards, and stays inside its box', () => {
    for (const mood of TENSE) {
      for (let i = 0; i < 40; i++) {
        const segment = spineSegment({
          mood,
          seed: `seed-${i}`,
          height: 60 + i * 30,
          kink: i % 3 === 0,
        });
        const points = pointsOf(segment.d);
        for (const [x, y] of points) {
          expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(SPINE_WIDTH);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(SPINE_HEIGHT);
        }
        for (let p = 1; p < points.length; p++) {
          expect((points[p] as [number, number])[1]).toBeGreaterThanOrEqual(
            (points[p - 1] as [number, number])[1],
          );
        }
      }
    }
  });

  it('strays further from the centre the more tense the customer is', () => {
    const reach = (mood: SpineMood) =>
      Math.max(
        ...Array.from(
          { length: 12 },
          (_, i) => spineSegment({ mood, seed: `r${i}`, height: 220 }).reach,
        ),
      );
    expect(reach('calm')).toBe(0);
    expect(reach('concerned')).toBeGreaterThan(0);
    expect(reach('frustrated')).toBeGreaterThan(reach('concerned'));
    expect(reach('angry')).toBeGreaterThan(reach('frustrated'));
    expect(reach('escalating')).toBeGreaterThan(reach('angry'));
  });

  it('draws the same line for the same turn, and different lines for different turns', () => {
    const a = spineSegment({ mood: 'frustrated', seed: 't4' });
    expect(spineSegment({ mood: 'frustrated', seed: 't4' })).toEqual(a);
    expect(spineSegment({ mood: 'frustrated', seed: 't5' }).d).not.toBe(a.d);
  });

  it('keeps sharp corners for a kinked or broken line and breaks an escalating one into pieces', () => {
    expect(spineSegment({ mood: 'concerned', seed: 'a' }).join).toBe('round');
    expect(spineSegment({ mood: 'frustrated', seed: 'a' }).join).toBe('round');
    expect(spineSegment({ mood: 'angry', seed: 'a' }).join).toBe('miter');
    const broken = spineSegment({ mood: 'escalating', seed: 'a' });
    expect(broken.join).toBe('miter');
    expect(broken.dash).toMatch(/^\d/);
    expect(spineSegment({ mood: 'angry', seed: 'a' }).dash).toBeNull();
  });

  it('settles as the customer eases: smaller bends, softer corners, and no gaps', () => {
    const tense = spineSegment({ mood: 'escalating', seed: 'e', height: 240 });
    const easing = spineSegment({ mood: 'escalating', seed: 'e', height: 240, easing: true });
    expect(easing.reach).toBeLessThan(tense.reach);
    expect(easing.dash).toBeNull();
    expect(spineSegment({ mood: 'frustrated', seed: 'e', easing: true }).join).toBe('round');
    expect(spineSegment({ mood: 'angry', seed: 'e', easing: true }).join).toBe('round');
  });

  it('takes a sharp jog sideways in a turn that carried a curveball, whatever the mood', () => {
    for (const mood of ['calm', 'neutral', 'concerned', 'angry'] as const) {
      const jog = spineSegment({ mood, seed: 'k', kink: true });
      expect(jog.join).toBe('miter');
      expect(jog.reach).toBeGreaterThanOrEqual(KINK_REACH - 0.6);
      expect(jog.reach).toBeLessThanOrEqual(KINK_REACH + 8.1);
    }
    expect(spineSegment({ mood: 'calm', seed: 'k', kink: true }).d).not.toBe(`M${CENTRE} 0V100`);
  });

  it('keeps the same character at any height: a taller turn gets more bends, not bigger ones', () => {
    const bends = (height: number) =>
      pointsOf(spineSegment({ mood: 'angry', seed: 'h', height }).d).length;
    expect(bends(600)).toBeGreaterThan(bends(100));
    const reach = (height: number) => spineSegment({ mood: 'frustrated', seed: 'h', height }).reach;
    expect(reach(900)).toBeLessThanOrEqual(3.4 + 0.01);
    expect(reach(60)).toBeLessThanOrEqual(3.4 + 0.01);
  });

  it('copes with a mood that is not one of ours, and with heights that make no sense', () => {
    const odd = spineSegment({ mood: 'furious' as unknown as SpineMood, seed: 'x' });
    expect(odd.d).toBe(`M${CENTRE} 0V100`);
    for (const height of [0, -50, 1e9, Number.POSITIVE_INFINITY]) {
      const points = pointsOf(spineSegment({ mood: 'angry', seed: 'x', height }).d);
      expect(points.length).toBeGreaterThanOrEqual(2);
      expect(points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
    }
    expect(DEFAULT_HEIGHT).toBeGreaterThan(0);
  });
});

describe('envelope', () => {
  it('is nothing at both ends, full through the middle and never outside 0 to 1', () => {
    expect(envelope(0)).toBe(0);
    expect(envelope(1)).toBe(0);
    expect(envelope(0.5)).toBe(1);
    for (let t = -0.5; t <= 1.5; t += 0.01) {
      expect(envelope(t)).toBeGreaterThanOrEqual(0);
      expect(envelope(t)).toBeLessThanOrEqual(1);
    }
  });
});

describe('spineMoods', () => {
  const known: Record<string, TurnMood> = {
    c3: { id: 'concerned', label: 'Concerned', trend: 'rising' },
    c5: { id: 'angry', label: 'Angry', trend: 'rising' },
  };
  const turns = [
    { key: 'c1', role: 'customer' as const },
    { key: 't2', role: 'trainee' as const },
    { key: 'c3', role: 'customer' as const },
    { key: 't4', role: 'trainee' as const },
    { key: 'c5', role: 'customer' as const },
  ];

  it('gives a reply the mood known at that reply, and the message after it the mood it was said into', () => {
    expect(spineMoods(turns, known).map((mood) => mood?.id ?? null)).toEqual([
      null, // the opening reply, from before the screen opened
      null, // said into a mood nobody saw
      'concerned',
      'concerned',
      'angry',
    ]);
  });

  it('says nothing for a call with no known moods, and for no turns at all', () => {
    expect(spineMoods(turns, {}).every((mood) => mood === null)).toBe(true);
    expect(spineMoods([], known)).toEqual([]);
  });
});

describe('estimateHeight', () => {
  it('grows with the words, counts every line of a message and is never less than one line', () => {
    const one = estimateHeight('Hello', 'customer');
    expect(one).toBeGreaterThan(0);
    expect(estimateHeight('', 'trainee')).toBe(one);
    expect(estimateHeight('word '.repeat(200), 'customer')).toBeGreaterThan(one * 3);
    expect(estimateHeight('One\nTwo\nThree', 'trainee')).toBeGreaterThan(
      estimateHeight('One', 'trainee'),
    );
    // A customer's lines are set larger, so the same words take more room.
    const words = 'word '.repeat(80);
    expect(estimateHeight(words, 'customer')).toBeGreaterThanOrEqual(
      estimateHeight(words, 'trainee'),
    );
  });
});
