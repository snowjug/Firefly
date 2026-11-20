import { describe, expect, it } from 'vitest';
import { TAU } from './geometry.ts';
import { presencePose } from './poses.ts';
import { BEZEL_RADIUS, ORBIT_RADIUS, detailFor, presenceShape } from './presence-shape.ts';
import { GOLDEN_ANGLE, bezelPaths, dotAt, ringPath, type RingSpec } from './rings.ts';

const spec = (over: Partial<RingSpec> = {}): RingSpec => ({
  radius: 62,
  weight: 1,
  teeth: 44,
  phase: 0,
  fragments: true,
  ...over,
});

const pose = (over: Partial<ReturnType<typeof presencePose>> = {}) => ({
  ...presencePose({ tension: 0.08, open: 1, energy: 0.2, recovering: false, silent: false }),
  ...over,
});

/** The points of a path of M and L commands. */
const points = (d: string) =>
  d
    .split(/[ML]/)
    .map((part) => part.replace('Z', '').trim())
    .filter(Boolean)
    .map((part) => part.split(' ').map(Number) as [number, number]);

describe('a ring', () => {
  it('is a closed line of four points to a tooth', () => {
    const d = ringPath(spec(), pose());
    expect(d.endsWith('Z')).toBe(true);
    expect(d.match(/M/g)).toHaveLength(1);
    expect(points(d)).toHaveLength(44 * 4);
  });

  it('stays close to a true circle when calm', () => {
    for (const [x, y] of points(ringPath(spec(), pose()))) {
      expect(Math.abs(Math.hypot(x, y) - 62)).toBeLessThan(0.4);
    }
  });

  it('wanders further from the circle as the unevenness grows', () => {
    const spread = (amp: number) => {
      const radii = points(ringPath(spec(), pose({ amp, wob: 1 }))).map(([x, y]) =>
        Math.hypot(x, y),
      );
      return Math.max(...radii) - Math.min(...radii);
    };
    expect(spread(4)).toBeGreaterThan(spread(1) * 2);
  });

  it('has crisp teeth when serrated: points alternate in and out on the grid', () => {
    const radii = points(ringPath(spec({ teeth: 20 }), pose({ amp: 3, zig: 1, wob: 0 }))).map(
      ([x, y]) => Math.hypot(x, y),
    );
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(4);
  });

  it('breaks into seven fragments when fragmented, and only for the edge', () => {
    const broken = ringPath(spec(), pose({ frag: 0.6 }));
    expect(broken.match(/M/g)).toHaveLength(7);
    expect(broken.includes('Z')).toBe(false);
    expect(ringPath(spec({ fragments: false }), pose({ frag: 0.6 })).match(/M/g)).toHaveLength(1);
  });

  it('is the same every time and never has a NaN', () => {
    const a = ringPath(spec(), pose({ amp: 4.2, zig: 1, frag: 0.92 }));
    expect(a).toBe(ringPath(spec(), pose({ amp: 4.2, zig: 1, frag: 0.92 })));
    expect(/NaN|undefined/.test(a)).toBe(false);
  });
});

describe('the bezel and the dots', () => {
  it('has a fine tick every 3 degrees and a long one every 30, unless it is small', () => {
    const full = bezelPaths(BEZEL_RADIUS, 'full');
    expect(full.strong.match(/M/g)).toHaveLength(12);
    expect(full.fine.match(/M/g)).toHaveLength(108);
    const medium = bezelPaths(BEZEL_RADIUS, 'medium');
    expect(medium.strong.match(/M/g)).toHaveLength(12);
    const small = bezelPaths(BEZEL_RADIUS, 'small');
    expect(small.strong.match(/M/g)).toHaveLength(12);
    expect(small.fine).toBe('');
  });

  it('places the first dormant dot at the top and spaces the rest by the golden angle', () => {
    expect(dotAt(0, ORBIT_RADIUS)).toEqual({ x: 0, y: -ORBIT_RADIUS });
    expect(GOLDEN_ANGLE).toBeCloseTo(TAU * 0.381966, 3);
    const spacing = (i: number) => {
      const a = dotAt(i, 10);
      const b = dotAt(i + 1, 10);
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    for (let i = 0; i < 6; i += 1) expect(spacing(i)).toBeGreaterThan(10);
  });

  it('keeps each dot where it was when more are added', () => {
    expect(dotAt(3, ORBIT_RADIUS)).toEqual(dotAt(3, ORBIT_RADIUS));
  });
});

describe('the presence shape', () => {
  it('trades detail for legibility as it gets smaller', () => {
    expect(detailFor(340)).toBe('full');
    expect(detailFor(120)).toBe('medium');
    expect(detailFor(64)).toBe('small');
    const big = presenceShape(pose({ amp: 3, zig: 1 }), 340);
    const small = presenceShape(pose({ amp: 3, zig: 1 }), 64);
    expect(small.edge.length).toBeLessThan(big.edge.length);
    expect(small.width.edge).toBeGreaterThan(big.width.edge);
    expect(small.heart.dot).toBeGreaterThan(big.heart.dot);
    expect(small.dot).toBeGreaterThan(big.dot);
  });

  it('stretches the dash pattern when small so the dashes stay visible', () => {
    const dashed = presencePose({
      tension: 0.56,
      open: 0.58,
      energy: 0.5,
      recovering: false,
      silent: false,
    });
    const big = presenceShape(dashed, 340).dasharray.split(' ').map(Number);
    const small = presenceShape(dashed, 64).dasharray.split(' ').map(Number);
    expect(big).toHaveLength(4);
    expect(small[0] ?? 0).toBeGreaterThan(big[0] ?? 0);
  });

  it('says whether the dashes are round: only the short, dotted look is', () => {
    const concerned = presencePose({
      tension: 0.3,
      open: 0.8,
      energy: 0.3,
      recovering: false,
      silent: false,
    });
    const frustrated = presencePose({
      tension: 0.56,
      open: 0.58,
      energy: 0.5,
      recovering: false,
      silent: false,
    });
    expect(presenceShape(concerned, 240).round).toBe(true);
    expect(presenceShape(frustrated, 240).round).toBe(false);
    expect(presenceShape(pose(), 240).round).toBe(false);
  });

  it('copes with a size of nothing', () => {
    expect(/NaN/.test(JSON.stringify(presenceShape(pose(), 0)))).toBe(false);
  });
});
