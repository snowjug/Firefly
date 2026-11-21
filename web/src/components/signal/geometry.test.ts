import { CALL_STAGES, DIFFICULTIES, IMPACTS, START_TEMPERATURES } from '#shared/domain/vocab.ts';
import { describe, expect, it } from 'vitest';
import {
  COMPACT_BELOW,
  GLYPH_HALF,
  HEART_SHAPES,
  IMPACT_SCALE,
  RING_COUNT,
  buildGlyph,
  clampMinutes,
  edgeShape,
  glintPaths,
  heartHalfPath,
  heartPath,
  num,
  serratedPath,
  tickPaths,
} from './geometry.ts';
import type { GlyphTraits } from './types.ts';

const traits = (over: Partial<GlyphTraits> = {}): GlyphTraits => ({
  difficulty: 'standard',
  impact: 'medium',
  start: 'calm',
  stage: 'first-contact',
  status: 'new',
  minutes: 10,
  ...over,
});

const segments = (d: string) => d.split('M').filter(Boolean).length;
const hasNaN = (text: string) => /NaN|Infinity|undefined/.test(text);

describe('numbers', () => {
  it('rounds to two decimals and never prints -0', () => {
    expect(num(1.23456)).toBe(1.23);
    expect(num(-0.001)).toBe(0);
    expect(Object.is(num(-0.001), -0)).toBe(false);
  });

  it('keeps minutes to whole numbers between 0 and fifteen, and survives junk', () => {
    expect(clampMinutes(9.6)).toBe(10);
    expect(clampMinutes(40)).toBe(15);
    expect(clampMinutes(-3)).toBe(0);
    expect(clampMinutes(Number.NaN)).toBe(0);
  });
});

describe('ticks', () => {
  it('draws fifteen ticks: those below the minutes lit, the rest ghosts, every fifth long', () => {
    const { on, off } = tickPaths(10, 30, 3, 6);
    expect(segments(on)).toBe(10);
    expect(segments(off)).toBe(5);
    const lengths = (on + off)
      .split('M')
      .filter(Boolean)
      .map((segment) => {
        const [a, b] = segment.split('L').map((pair) => pair.split(' ').map(Number));
        return Math.round(Math.hypot((b?.[0] ?? 0) - (a?.[0] ?? 0), (b?.[1] ?? 0) - (a?.[1] ?? 0)));
      });
    expect(lengths.filter((length) => length === 6)).toHaveLength(3);
    expect(lengths.filter((length) => length === 3)).toHaveLength(12);
  });

  it('lights every tick for a long call and none for no minutes', () => {
    expect(segments(tickPaths(40, 30, 3, 6).on)).toBe(15);
    expect(tickPaths(0, 30, 3, 6).on).toBe('');
  });
});

describe('the heart', () => {
  it('has one closed shape per stage, and a half for the fill', () => {
    for (const stage of CALL_STAGES) {
      for (const draw of [heartPath, heartHalfPath]) {
        const d = draw(stage, 10);
        expect(d.startsWith('M')).toBe(true);
        expect(d.endsWith('Z')).toBe(true);
        expect(hasNaN(d)).toBe(false);
      }
    }
    expect(new Set(CALL_STAGES.map((stage) => heartPath(stage, 10))).size).toBe(4);
    expect(Object.values(HEART_SHAPES)).toEqual(['circle', 'diamond', 'triangle', 'square']);
  });

  it('keeps the fill to the left half of each shape', () => {
    expect(heartHalfPath('first-contact', 10)).toBe('M0 -10A10 10 0 0 0 0 10Z');
    expect(heartHalfPath('follow-up', 10)).toBe('M0 -11.8L-11.8 0L0 11.8Z');
    expect(heartHalfPath('escalated', 10)).toBe('M0 -13L-11.26 6.5L0 6.5Z');
    expect(heartHalfPath('closure', 10)).toBe('M0 -9H-9V9H0Z');
  });
});

describe('the outer edge', () => {
  it('is a smooth circle for a calm start', () => {
    expect(edgeShape('calm', 20, 1)).toEqual({ kind: 'smooth', radius: 20 });
  });

  it('is round dashes for anxious and long-short for frustrated, fitted to the ring', () => {
    const round = edgeShape('anxious', 22, 1);
    const longShort = edgeShape('frustrated', 22, 1);
    if (round.kind !== 'round-dashes' || longShort.kind !== 'long-short') throw new Error('kind');
    expect(round.round).toBe(true);
    expect(longShort.round).toBe(false);
    for (const edge of [round, longShort]) {
      const pattern = edge.dasharray.split(' ').map(Number);
      const cycle = pattern.reduce((sum, part) => sum + part, 0);
      const cycles = (2 * Math.PI * 22) / cycle;
      expect(Math.abs(cycles - Math.round(cycles))).toBeLessThan(0.05);
    }
    expect(longShort.dasharray.split(' ')).toHaveLength(4);
  });

  it('is serrated for an angry start, with an even number of points', () => {
    const edge = edgeShape('angry', 22, 1);
    if (edge.kind !== 'serrated') throw new Error('kind');
    expect(edge.d.endsWith('Z')).toBe(true);
    expect(serratedPath(20, 10, 2).split('L')).toHaveLength(20);
  });

  it('uses fewer, larger marks when it is small', () => {
    const big = edgeShape('angry', 22, 1);
    const small = edgeShape('angry', 22, 0.3);
    if (big.kind !== 'serrated' || small.kind !== 'serrated') throw new Error('kind');
    expect(small.d.split('L').length).toBeLessThan(big.d.split('L').length);
    const dashesBig = edgeShape('frustrated', 22, 1);
    const dashesSmall = edgeShape('frustrated', 22, 0.3);
    if (dashesBig.kind !== 'long-short' || dashesSmall.kind !== 'long-short')
      throw new Error('kind');
    expect(Number(dashesSmall.dasharray.split(' ')[0])).toBeGreaterThan(
      Number(dashesBig.dasharray.split(' ')[0]),
    );
  });
});

describe('the glint', () => {
  it('reaches out of the ring in four directions', () => {
    const { cardinal, diagonal } = glintPaths(20);
    expect(segments(cardinal)).toBe(4);
    expect(segments(diagonal)).toBe(4);
  });
});

describe('a whole glyph', () => {
  it('has as many rings as the difficulty says (the outer one is the edge)', () => {
    for (const difficulty of DIFFICULTIES) {
      const model = buildGlyph(traits({ difficulty }), 92);
      expect(model.rings.length + 1).toBe(RING_COUNT[difficulty]);
    }
  });

  it('is bigger for a bigger impact, at every size', () => {
    for (const size of [28, 48, 92, 140]) {
      const radii = IMPACTS.map((impact) => buildGlyph(traits({ impact }), size).radius);
      expect(radii[0]).toBeLessThan(radii[1] ?? 0);
      expect(radii[1]).toBeLessThan(radii[2] ?? 0);
    }
    expect(IMPACT_SCALE.low).toBeLessThan(IMPACT_SCALE.high);
  });

  it('fills the heart by status: open, half, solid', () => {
    expect(buildGlyph(traits({ status: 'new' }), 92).heart).toMatchObject({
      half: null,
      solid: false,
    });
    const attempted = buildGlyph(traits({ status: 'attempted' }), 92).heart;
    expect(attempted.half).not.toBeNull();
    expect(attempted.solid).toBe(false);
    expect(buildGlyph(traits({ status: 'completed' }), 92).heart).toMatchObject({
      half: null,
      solid: true,
    });
  });

  it('draws the glint only for the recommended mission', () => {
    expect(buildGlyph(traits(), 92).glint).toBeNull();
    expect(buildGlyph(traits({ recommended: true }), 92).glint).not.toBeNull();
  });

  it('is the same every time, so a map never changes between renders', () => {
    const a = JSON.stringify(buildGlyph(traits({ start: 'angry', stage: 'closure' }), 64));
    const b = JSON.stringify(buildGlyph(traits({ start: 'angry', stage: 'closure' }), 64));
    expect(a).toBe(b);
  });

  it('keeps ticks and rings inside the box when small, and gives the heart room', () => {
    for (const impact of IMPACTS) {
      for (const difficulty of DIFFICULTIES) {
        for (const size of [28, 36, 48]) {
          const model = buildGlyph(traits({ impact, difficulty }), size);
          expect(model.compact).toBe(size < COMPACT_BELOW);
          expect(model.radius).toBeLessThan(GLYPH_HALF);
          const innermost = model.rings.at(-1) ?? model.radius;
          expect(model.heart.radius).toBeLessThan(innermost);
        }
      }
    }
  });

  it('drops the ghost ticks when very small', () => {
    expect(buildGlyph(traits(), 28).ticks.off).toBeNull();
    expect(buildGlyph(traits(), 92).ticks.off).not.toBeNull();
  });

  it('never produces a NaN, whatever the traits or the size', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const impact of IMPACTS) {
        for (const start of START_TEMPERATURES) {
          for (const stage of CALL_STAGES) {
            for (const size of [28, 92, 180]) {
              const model = buildGlyph(
                traits({
                  difficulty,
                  impact,
                  start,
                  stage,
                  status: 'attempted',
                  recommended: true,
                }),
                size,
              );
              expect(hasNaN(JSON.stringify(model))).toBe(false);
            }
          }
        }
      }
    }
  });

  it('copes with values the vocabulary does not know and with a size of nothing', () => {
    const odd = buildGlyph(
      traits({ difficulty: 'nightmare' as never, impact: '??' as never, start: 'x' as never }),
      0,
    );
    expect(hasNaN(JSON.stringify(odd))).toBe(false);
    expect(odd.radius).toBeGreaterThan(0);
  });
});
