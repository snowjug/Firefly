// Small deterministic random number helpers. Everything in the simulation that involves chance is
// seeded (session seed + turn number) so a conversation can be reproduced in tests.

export type Rng = () => number;

/** mulberry32: tiny, fast and good enough for choosing between phrasings. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngFor(seed: number, turn: number, salt = 0): Rng {
  const mixed = (Math.imul(seed >>> 0, 2654435761) + Math.imul(turn + 1, 40503) + salt * 97) >>> 0;
  return createRng(mixed);
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() needs at least one item');
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))] as T;
}

/** Picks an item that was not used recently, when possible. */
export function pickFresh(rng: Rng, items: readonly string[], recent: readonly string[]): string {
  const fresh = items.filter((item) => !recent.includes(item));
  return pick(rng, fresh.length > 0 ? fresh : items);
}

export function chance(rng: Rng, probability: number): boolean {
  return rng() < probability;
}
