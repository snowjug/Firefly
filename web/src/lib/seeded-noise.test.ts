import { describe, expect, it } from 'vitest';
import { hash32, noise, signedNoise } from './seeded-noise.ts';

describe('hash32', () => {
  it('is the same for the same text and a 32-bit unsigned integer', () => {
    expect(hash32('clarity:3')).toBe(hash32('clarity:3'));
    for (const text of ['', 'a', 'locked-out-after-password-reset', 'Ünïcode ✓']) {
      const value = hash32(text);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(2 ** 32);
    }
  });

  it('tells apart keys that differ by one character', () => {
    const values = new Set(Array.from({ length: 200 }, (_, i) => hash32(`cluster:${i}`)));
    expect(values.size).toBe(200);
  });
});

describe('noise', () => {
  it('stays in [0, 1) and does not depend on anything but the seed and the key', () => {
    for (let i = 0; i < 500; i += 1) {
      const value = noise(7, `key-${i}`);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      expect(noise(7, `key-${i}`)).toBe(value);
    }
  });

  it('changes with the seed', () => {
    const differing = Array.from({ length: 50 }, (_, i) => noise(1, `k${i}`) !== noise(2, `k${i}`));
    expect(differing.every(Boolean)).toBe(true);
  });

  it('is spread evenly enough to use for jitter', () => {
    const bins = new Array<number>(10).fill(0);
    const total = 5000;
    for (let i = 0; i < total; i += 1) {
      const bin = Math.floor(noise(3, `item:${i}`) * 10);
      bins[bin] = (bins[bin] ?? 0) + 1;
    }
    for (const count of bins) {
      expect(count).toBeGreaterThan(total / 10 - 120);
      expect(count).toBeLessThan(total / 10 + 120);
    }
  });

  it('has a signed twin in [-1, 1)', () => {
    for (let i = 0; i < 200; i += 1) {
      const value = signedNoise(5, `s${i}`);
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThan(1);
      expect(value).toBeCloseTo(noise(5, `s${i}`) * 2 - 1, 12);
    }
  });
});
