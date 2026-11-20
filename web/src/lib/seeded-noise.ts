// Tiny deterministic helpers for layouts: the same seed and key always give the same number, on
// every machine, so a map or a constellation never reshuffles between visits.

/** A well-spread 32-bit hash of a string (FNV-1a, finished with a murmur-style avalanche). */
export function hash32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // FNV alone leaves similar keys (`a:1`, `a:2`) correlated in the high bits; this spreads them.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/**
 * A stable number in [0, 1) for a seed and a key. It depends on nothing else (not on call order or
 * on what else is being laid out), so one item keeps its place when another is added or removed.
 */
export function noise(seed: number, key: string): number {
  return hash32(`${seed}|${key}`) / 0x100000000;
}

/** `noise` stretched to [-1, 1), for jitter that can go either way. */
export function signedNoise(seed: number, key: string): number {
  return noise(seed, key) * 2 - 1;
}
