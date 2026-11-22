import { describe, expect, it } from 'vitest';
import { PRODUCT_IDS } from '#shared/domain/vocab.ts';
import { ACCENTS, PRODUCT_ACCENT, accentClass } from './product-accent.ts';

describe('product accents', () => {
  it('gives every Microsoft product one of the seven hues', () => {
    expect(Object.keys(PRODUCT_ACCENT).sort()).toEqual([...PRODUCT_IDS].sort());
    for (const product of PRODUCT_IDS) expect(ACCENTS).toContain(PRODUCT_ACCENT[product]);
  });

  it('uses most of the palette, so neighbouring scenarios are easy to tell apart', () => {
    expect(new Set(Object.values(PRODUCT_ACCENT)).size).toBeGreaterThanOrEqual(6);
  });

  it('names the class for a product, and falls back to blue for a call saved with none', () => {
    expect(accentClass('teams')).toBe('ff-accent ff-accent--purple');
    expect(accentClass('sharepoint-online')).toBe('ff-accent ff-accent--teal');
    expect(accentClass(null)).toBe('ff-accent ff-accent--blue');
    expect(accentClass(undefined)).toBe('ff-accent ff-accent--blue');
  });
});
