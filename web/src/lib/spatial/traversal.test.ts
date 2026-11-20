import { describe, expect, it } from 'vitest';
import { seeded, type Random } from '../../test-rng.ts';
import {
  DEFAULT_CONE_DEGREES,
  nextInDirection,
  readingOrder,
  type Direction,
  type SpatialPoint,
} from './traversal.ts';

const pt = (id: string, x: number, y: number): SpatialPoint => ({ id, x, y });
const ids = (points: readonly SpatialPoint[]) => points.map((point) => point.id);
const DIRECTIONS: readonly Direction[] = ['left', 'right', 'up', 'down'];

/** Three rows of three, 100 apart: a b c / d e f / g h i. */
const GRID = [
  pt('a', 0, 0),
  pt('b', 100, 0),
  pt('c', 200, 0),
  pt('d', 0, 100),
  pt('e', 100, 100),
  pt('f', 200, 100),
  pt('g', 0, 200),
  pt('h', 100, 200),
  pt('i', 200, 200),
];

const move = (
  points: readonly SpatialPoint[],
  from: string | null,
  direction: Direction,
  wrap = false,
  coneDegrees?: number,
) => nextInDirection(points, from, direction, { wrap, coneDegrees });

describe('readingOrder', () => {
  it('reads top to bottom, then left to right', () => {
    const points = [pt('d', 30, 20), pt('a', 0, 0), pt('c', 10, 20), pt('b', 5, 0)];
    expect(ids(readingOrder(points))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps rows exact: a point one pixel lower starts the next row', () => {
    expect(ids(readingOrder([pt('low', 0, 1), pt('high', 100, 0)]))).toEqual(['high', 'low']);
  });

  it('leaves its input alone and hands back the very same points', () => {
    const input = Object.freeze([pt('b', 1, 1), pt('a', 0, 0)]);
    const ordered = readingOrder(input);
    expect(ids(input)).toEqual(['b', 'a']);
    expect(ordered[0]).toBe(input[1]);
    expect(ordered[1]).toBe(input[0]);
    expect(ordered).not.toBe(input);
  });

  it('orders points in the same place by id, whatever order they arrive in', () => {
    const rand = seeded(7);
    const twins = [pt('c', 5, 5), pt('a', 5, 5), pt('b', 5, 5)];
    for (let round = 0; round < 20; round++) {
      expect(ids(readingOrder(rand.shuffle(twins)))).toEqual(['a', 'b', 'c']);
    }
  });

  it('copes with nothing, one point, and negative or fractional positions', () => {
    expect(readingOrder([])).toEqual([]);
    expect(ids(readingOrder([pt('only', 3, 4)]))).toEqual(['only']);
    const points = [pt('p', 0, 0), pt('n', -5.5, -0.25), pt('m', -5.6, -0.25)];
    expect(ids(readingOrder(points))).toEqual(['m', 'n', 'p']);
  });

  it('puts points without a usable position last, in id order', () => {
    const points = [pt('z', Number.NaN, 0), pt('a', 0, 0), pt('m', Infinity, 1), pt('b', 5, 5)];
    expect(ids(readingOrder(points))).toEqual(['a', 'b', 'm', 'z']);
  });
});

describe('moving in a direction', () => {
  it('returns null when there is nothing to move between', () => {
    for (const direction of DIRECTIONS) {
      for (const wrap of [false, true]) {
        expect(move([], null, direction, wrap)).toBeNull();
        expect(move([], 'gone', direction, wrap)).toBeNull();
      }
    }
  });

  it('enters at the first point in reading order when nothing is focused', () => {
    expect(move(GRID, null, 'right')).toBe('a');
    expect(move([pt('z', 50, 50), pt('y', 20, 0), pt('x', 10, 0)], null, 'down')).toBe('x');
    for (const direction of DIRECTIONS) expect(move(GRID, 'not-on-the-map', direction)).toBe('a');
  });

  it('stays where it is when it is the only point', () => {
    for (const direction of DIRECTIONS) {
      for (const wrap of [false, true])
        expect(move([pt('only', 4, 4)], 'only', direction, wrap)).toBe('only');
    }
  });

  it('moves to the neighbouring node in every direction', () => {
    expect(move(GRID, 'e', 'right')).toBe('f');
    expect(move(GRID, 'e', 'left')).toBe('d');
    expect(move(GRID, 'e', 'up')).toBe('b');
    expect(move(GRID, 'e', 'down')).toBe('h');
    expect(move(GRID, 'a', 'right')).toBe('b');
    expect(move(GRID, 'a', 'down')).toBe('d');
    expect(move(GRID, 'i', 'left')).toBe('h');
    expect(move(GRID, 'i', 'up')).toBe('f');
  });

  it('stays put at an edge unless asked to wrap', () => {
    expect(move(GRID, 'a', 'up')).toBe('a');
    expect(move(GRID, 'a', 'left')).toBe('a');
    expect(move(GRID, 'c', 'right')).toBe('c');
    expect(move(GRID, 'h', 'down')).toBe('h');
  });

  it('prefers a node straight ahead to a nearer one well off to the side', () => {
    const points = [pt('here', 0, 0), pt('side', 40, 60), pt('ahead', 100, 0)];
    expect(move(points, 'here', 'right')).toBe('ahead');
  });

  it('prefers a much nearer node that is only a little off to the side', () => {
    const points = [pt('here', 0, 0), pt('near', 30, 30), pt('ahead', 100, 0)];
    expect(move(points, 'here', 'right')).toBe('near');
  });

  it('ignores nodes outside the cone while any lies inside it', () => {
    // `steep` is at about 72 degrees and would win on distance alone.
    const points = [pt('here', 0, 0), pt('steep', 10, 30), pt('inside', 100, 10)];
    expect(move(points, 'here', 'right')).toBe('inside');
    expect(move(points, 'here', 'right', false, 80)).toBe('steep');
  });

  it('falls back to the nearest along the axis when the cone is empty', () => {
    // Both are outside the cone; `mid` is the closer of the two, `far` the closer along the axis.
    const points = [pt('here', 0, 0), pt('far', 10, 200), pt('mid', 30, 100)];
    expect(move(points, 'here', 'right')).toBe('far');
    expect(move(points, 'here', 'down')).toBe('mid');
  });

  it('widens and narrows the cone with coneDegrees', () => {
    const points = [pt('here', 0, 0), pt('steep', 10, 30), pt('inside', 100, 10)];
    expect(DEFAULT_CONE_DEGREES).toBe(60);
    expect(move(points, 'here', 'right', false, 90)).toBe('steep');
    expect(move(points, 'here', 'right', false, 120)).toBe('steep');
    expect(move(points, 'here', 'right', false, Number.NaN)).toBe('inside');
    expect(move(points, 'here', 'right', false, 10)).toBe('inside');
    // A cone of nothing keeps only nodes exactly on the axis; with none, it uses the fallback.
    const mixed = [pt('here', 0, 0), pt('off', 100, 1), pt('line', 500, 0)];
    expect(move(mixed, 'here', 'right')).toBe('off');
    expect(move(mixed, 'here', 'right', false, 0)).toBe('line');
    expect(move(mixed, 'here', 'right', false, -30)).toBe('line');
    const none = [pt('here', 0, 0), pt('near', 60, 80), pt('steep', 50, 200)];
    expect(move(none, 'here', 'right')).toBe('near');
    expect(move(none, 'here', 'right', false, 0)).toBe('steep');
  });

  it('counts a node exactly on the edge of the cone as inside it', () => {
    const points = [pt('here', 0, 0), pt('edge', 10, 10), pt('line', 200, 0)];
    expect(move(points, 'here', 'right', false, 45)).toBe('edge');
    expect(move(points, 'here', 'right', false, 44)).toBe('line');
    // In degrees this angle converts back to a hair less than itself; it must still be inside.
    const slanted = [pt('here', 0, 0), pt('edge', 4, 1), pt('line', 200, 0)];
    expect(move(slanted, 'here', 'right', false, (Math.atan2(1, 4) * 180) / Math.PI)).toBe('edge');
  });

  it('never treats a node beside it as ahead', () => {
    const points = [pt('here', 0, 0), pt('beside', 0, 50)];
    expect(move(points, 'here', 'right')).toBe('here');
    expect(move(points, 'here', 'left')).toBe('here');
    expect(move(points, 'here', 'up')).toBe('here');
    expect(move(points, 'here', 'down')).toBe('beside');
    expect(move(points, 'here', 'right', true)).toBe('here');
  });

  it('cannot steer to a node in the very same place, but reading order still reaches it', () => {
    const twins = [pt('b', 10, 10), pt('a', 10, 10)];
    for (const direction of DIRECTIONS) expect(move(twins, 'a', direction, true)).toBe('a');
    expect(move(twins, null, 'right')).toBe('a');
  });

  it('breaks every kind of tie by id, whatever order the points arrive in', () => {
    const rand = seeded(11);
    const cases: {
      points: SpatialPoint[];
      from: string;
      direction: Direction;
      wrap: boolean;
      to: string;
    }[] = [
      // Mirror images either side of the axis score the same.
      {
        points: [pt('here', 0, 0), pt('b', 100, 10), pt('a', 100, -10)],
        from: 'here',
        direction: 'right',
        wrap: false,
        to: 'a',
      },
      // Nothing inside the cone: equally near along the axis and equally far to the side.
      {
        points: [pt('here', 0, 0), pt('q', 10, 100), pt('p', 10, -100)],
        from: 'here',
        direction: 'right',
        wrap: false,
        to: 'p',
      },
      // Wrapping: equally far behind and equally far to the side.
      {
        points: [pt('here', 100, 0), pt('n', 0, 5), pt('m', 0, -5)],
        from: 'here',
        direction: 'right',
        wrap: true,
        to: 'm',
      },
    ];
    for (const { points, from, direction, wrap, to } of cases) {
      for (let round = 0; round < 10; round++) {
        expect(move(rand.shuffle(points), from, direction, wrap)).toBe(to);
      }
    }
  });

  it('ignores points without a usable position, and cannot move from one', () => {
    const points = [
      pt('a', 0, 0),
      pt('lost', Number.NaN, 0),
      pt('far', Infinity, 0),
      pt('b', 50, 0),
    ];
    expect(move(points, 'a', 'right')).toBe('b');
    expect(move(points, 'b', 'right', true)).toBe('a');
    expect(move(points, 'lost', 'right', true)).toBe('lost');
    expect(move(points, null, 'right')).toBe('a');
    expect(move([pt('z', Number.NaN, 0), pt('y', 0, Infinity)], null, 'left')).toBe('y');
  });

  it('gives the same answer at any scale, and far from the origin', () => {
    const moves = (points: SpatialPoint[]) =>
      DIRECTIONS.map((direction) => move(points, 'e', direction));
    const expected = ['d', 'f', 'b', 'h'];
    expect(moves(GRID)).toEqual(expected);
    for (const scale of [1e6, 0.001]) {
      const scaled = GRID.map((p) => pt(p.id, p.x * scale + 5e5, p.y * scale - 3e5));
      expect(moves(scaled)).toEqual(expected);
    }
  });
});

describe('wrapping', () => {
  it('jumps to the far side on the same row or column, like a ring', () => {
    expect(move(GRID, 'c', 'right', true)).toBe('a');
    expect(move(GRID, 'f', 'right', true)).toBe('d');
    expect(move(GRID, 'a', 'left', true)).toBe('c');
    expect(move(GRID, 'h', 'down', true)).toBe('b');
    expect(move(GRID, 'b', 'up', true)).toBe('h');
  });

  it('does nothing special while there is still somewhere to go', () => {
    for (const direction of DIRECTIONS) {
      expect(move(GRID, 'e', direction, true)).toBe(move(GRID, 'e', direction));
    }
  });

  it('roves through a whole row and comes back to where it started', () => {
    const row = ['a', 'b', 'c', 'd', 'e'].map((id, i) => pt(id, i * 10, 0));
    let at: string | null = 'a';
    const visited: (string | null)[] = [];
    for (let step = 0; step < 5; step++) {
      at = move(row, at, 'right', true);
      visited.push(at);
    }
    expect(visited).toEqual(['b', 'c', 'd', 'e', 'a']);
    expect(move(row, 'a', 'left', true)).toBe('e');
  });

  it('stays put in a single column when moving sideways', () => {
    const column = [pt('a', 5, 0), pt('b', 5, 10), pt('c', 5, 20)];
    expect(move(column, 'b', 'right', true)).toBe('b');
    expect(move(column, 'b', 'left', true)).toBe('b');
    expect(move(column, 'c', 'down', true)).toBe('a');
  });
});

describe('on random maps', () => {
  const AXIS: Record<Direction, readonly [number, number]> = {
    right: [1, 0],
    left: [-1, 0],
    down: [0, 1],
    up: [0, -1],
  };

  /** Small integer positions, so layouts often have ties, shared rows and points in one place. */
  function layout(rand: Random): SpatialPoint[] {
    const span = rand.pick([2, 4, 20]);
    const count = rand.int(1, 12);
    return Array.from({ length: count }, (_, i) =>
      pt(`p${String(i).padStart(2, '0')}`, rand.int(-span, span), rand.int(-span, span)),
    );
  }

  function offsets(from: SpatialPoint, to: SpatialPoint, direction: Direction) {
    const [ax, ay] = AXIS[direction];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return { along: dx * ax + dy * ay, across: Math.abs(dy * ax - dx * ay) };
  }

  const inCone = ({ along, across }: { along: number; across: number }) =>
    Math.atan2(across, along) <= (DEFAULT_CONE_DEGREES * Math.PI) / 180 + 1e-9;

  function eachTrial(
    seed: number,
    run: (trial: {
      label: string;
      points: readonly SpatialPoint[];
      from: SpatialPoint;
      direction: Direction;
      rand: Random;
    }) => void,
  ) {
    const rand = seeded(seed);
    for (let n = 0; n < 400; n++) {
      const points = Object.freeze(layout(rand));
      run({
        label: `seed ${seed}, trial ${n}`,
        points,
        from: rand.pick(points),
        direction: rand.pick(DIRECTIONS),
        rand,
      });
    }
  }

  it('lands on something that lies ahead, preferring the cone, or stays put when nothing does', () => {
    eachTrial(101, ({ label, points, from, direction }) => {
      const result = nextInDirection(points, from.id, direction);
      const ahead = points.filter((p) => p.id !== from.id && offsets(from, p, direction).along > 0);
      if (ahead.length === 0) {
        expect(result, label).toBe(from.id);
        return;
      }
      const chosen = ahead.find((p) => p.id === result);
      expect(chosen, label).toBeDefined();
      const inside = ahead.filter((p) => inCone(offsets(from, p, direction)));
      if (inside.length > 0) {
        expect(inside, label).toContain(chosen);
      } else {
        const nearest = Math.min(...ahead.map((p) => offsets(from, p, direction).along));
        expect(offsets(from, chosen as SpatialPoint, direction).along, label).toBe(nearest);
      }
    });
  });

  it('wraps to the farthest point behind only when nothing is ahead', () => {
    eachTrial(102, ({ label, points, from, direction }) => {
      const others = points.filter((p) => p.id !== from.id);
      const along = (p: SpatialPoint) => offsets(from, p, direction).along;
      const result = nextInDirection(points, from.id, direction, { wrap: true });
      if (others.some((p) => along(p) > 0)) {
        expect(result, label).toBe(nextInDirection(points, from.id, direction));
        return;
      }
      const behind = others.filter((p) => along(p) < 0);
      if (behind.length === 0) {
        expect(result, label).toBe(from.id);
        return;
      }
      const chosen = behind.find((p) => p.id === result);
      expect(chosen, label).toBeDefined();
      expect(along(chosen as SpatialPoint), label).toBe(Math.min(...behind.map(along)));
    });
  });

  it('never depends on the order the points are listed in', () => {
    eachTrial(103, ({ label, points, from, direction, rand }) => {
      for (const wrap of [false, true]) {
        const expected = nextInDirection(points, from.id, direction, { wrap });
        for (let round = 0; round < 3; round++) {
          expect(nextInDirection(rand.shuffle(points), from.id, direction, { wrap }), label).toBe(
            expected,
          );
        }
      }
      expect(nextInDirection(rand.shuffle(points), null, direction), label).toBe(
        nextInDirection(points, null, direction),
      );
    });
  });

  it('enters at the first point in reading order', () => {
    eachTrial(104, ({ label, points, direction }) => {
      const first = readingOrder(points)[0]?.id;
      expect(nextInDirection(points, null, direction), label).toBe(first);
      expect(nextInDirection(points, 'missing', direction), label).toBe(first);
    });
  });

  it('is the same after moving, or scaling by a power of two, the whole map', () => {
    eachTrial(105, ({ label, points, from, direction }) => {
      for (const wrap of [false, true]) {
        const expected = nextInDirection(points, from.id, direction, { wrap });
        const moved = points.map((p) => pt(p.id, p.x + 37, p.y - 12));
        const scaled = points.map((p) => pt(p.id, p.x * 4, p.y * 4));
        expect(nextInDirection(moved, from.id, direction, { wrap }), label).toBe(expected);
        expect(nextInDirection(scaled, from.id, direction, { wrap }), label).toBe(expected);
      }
    });
  });

  it('follows the map when it is turned a quarter or mirrored', () => {
    const turned: Record<Direction, Direction> = {
      right: 'down',
      down: 'left',
      left: 'up',
      up: 'right',
    };
    const mirrored: Record<Direction, Direction> = {
      right: 'left',
      left: 'right',
      up: 'up',
      down: 'down',
    };
    eachTrial(106, ({ label, points, from, direction }) => {
      for (const wrap of [false, true]) {
        const expected = nextInDirection(points, from.id, direction, { wrap });
        const quarter = points.map((p) => pt(p.id, -p.y, p.x));
        const flipped = points.map((p) => pt(p.id, -p.x, p.y));
        expect(nextInDirection(quarter, from.id, turned[direction], { wrap }), label).toBe(
          expected,
        );
        expect(nextInDirection(flipped, from.id, mirrored[direction], { wrap }), label).toBe(
          expected,
        );
      }
    });
  });

  it('never traps the keyboard: with wrapping, some arrow leads somewhere unless all else is in one spot', () => {
    eachTrial(107, ({ label, points, from }) => {
      const moves = DIRECTIONS.map((direction) =>
        nextInDirection(points, from.id, direction, { wrap: true }),
      );
      const movable = points.some((p) => p.id !== from.id && (p.x !== from.x || p.y !== from.y));
      if (movable)
        expect(
          moves.some((id) => id !== from.id),
          label,
        ).toBe(true);
      else
        expect(
          moves.every((id) => id === from.id),
          label,
        ).toBe(true);
    });
  });
});
