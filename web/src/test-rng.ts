// A small seeded random source for property-style tests. The same seed always replays the same
// cases, so a failure can be reproduced from the seed named in the test.

export interface Random {
  /** A number from 0 up to, but not including, 1. */
  next(): number;
  /** A whole number from min to max, both included. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  chance(probability: number): boolean;
  shuffle<T>(items: readonly T[]): T[];
}

/** mulberry32: tiny, fast and plenty good enough for making up test inputs. */
export function seeded(seed: number): Random {
  let state = seed >>> 0;

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function int(min: number, max: number): number {
    return min + Math.floor(next() * (max - min + 1));
  }

  function pick<T>(items: readonly T[]): T {
    return items[int(0, items.length - 1)] as T;
  }

  function chance(probability: number): boolean {
    return next() < probability;
  }

  function shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = int(0, i);
      [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
    }
    return copy;
  }

  return { next, int, pick, chance, shuffle };
}
