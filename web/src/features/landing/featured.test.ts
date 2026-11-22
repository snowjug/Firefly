import { describe, expect, it } from 'vitest';
import { PRODUCT_IDS, type ProductId } from '#shared/domain/vocab.ts';
import { FEATURED_MAX, pickFeatured } from './featured.ts';
import { FEATURED_PRODUCTS } from './landing-copy.ts';
import { makeScenario } from './test-utils.ts';

/** A library with the given scenarios, as [id, product, difficulty]. */
const library = (...rows: [string, ProductId, ('starter' | 'standard' | 'challenge')?][]) =>
  rows.map(([id, product, difficulty]) => makeScenario(id, product, difficulty));

describe('which scenarios the landing page features', () => {
  it('is one for each product, in the order the products are listed, and nothing twice', () => {
    const scenarios = library(
      ['azure-a', 'azure'],
      ['teams-a', 'teams'],
      ['teams-b', 'teams'],
      ['outlook-a', 'outlook'],
      ['windows-a', 'windows-11'],
    );
    const picked = pickFeatured(scenarios);
    expect(picked.map((scenario) => scenario.id)).toEqual([
      'teams-a',
      'outlook-a',
      'windows-a',
      'azure-a',
    ]);
    expect(new Set(picked.map((scenario) => scenario.id)).size).toBe(picked.length);
    expect(new Set(picked.map((scenario) => scenario.product.id)).size).toBe(picked.length);
  });

  it('leads with the gentlest scenario of a product, then the first by id', () => {
    const scenarios = library(
      ['teams-hard', 'teams', 'challenge'],
      ['teams-b', 'teams', 'starter'],
      ['teams-a', 'teams', 'starter'],
      ['teams-mid', 'teams', 'standard'],
    );
    expect(pickFeatured(scenarios).map((scenario) => scenario.id)).toEqual(['teams-a']);
  });

  it('does not change what it is given', () => {
    const scenarios = library(['b', 'teams', 'challenge'], ['a', 'teams', 'starter']);
    const before = scenarios.map((scenario) => scenario.id);
    pickFeatured(scenarios);
    expect(scenarios.map((scenario) => scenario.id)).toEqual(before);
  });

  it('features at most twelve, and every product it names is one the library has', () => {
    const scenarios = PRODUCT_IDS.map((product) => makeScenario(`${product}-a`, product));
    const picked = pickFeatured(scenarios);
    expect(picked.length).toBeLessThanOrEqual(FEATURED_MAX);
    expect(picked).toHaveLength(FEATURED_PRODUCTS.length);
    expect(picked.map((scenario) => scenario.product.id)).toEqual(FEATURED_PRODUCTS);
  });

  it('leaves out a product it has no card for, such as Power Platform', () => {
    const picked = pickFeatured(library(['flow', 'power-platform'], ['teams-a', 'teams']));
    expect(picked.map((scenario) => scenario.id)).toEqual(['teams-a']);
  });

  it('falls back to the scenarios as they came, so the row is not empty when there is something to show', () => {
    const scenarios = library(['flow-a', 'power-platform'], ['flow-b', 'power-platform']);
    expect(pickFeatured(scenarios).map((scenario) => scenario.id)).toEqual(['flow-a', 'flow-b']);
    const many = Array.from({ length: 20 }, (_, index) =>
      makeScenario(`flow-${index}`, 'power-platform'),
    );
    expect(pickFeatured(many)).toHaveLength(FEATURED_MAX);
  });

  it('is empty for an empty library', () => {
    expect(pickFeatured([])).toEqual([]);
  });
});
