// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  DIFFICULTIES,
  DIFFICULTY_RANK,
  PRODUCT_FAMILIES,
  PRODUCT_IDS,
} from '#shared/domain/vocab.ts';
import {
  NO_FILTERS,
  activeFilterCount,
  countLabel,
  difficultyOptions,
  filterScenarios,
  matchesFilters,
  railProducts,
  readFilters,
  sortScenarios,
  writeFilters,
  type Filters,
} from './catalogue.ts';
import { defaultConfig, parseConfig } from './config-params.ts';
import { RAIL_ORDER } from './labels.ts';
import { SAMPLE, publicScenarios, scenarioById } from './testing/fixtures.ts';
import { defaultVoiceFor } from './voice-choice.ts';
import { normaliseSearch, workspaceSearch } from './workspace-url.ts';

const all = publicScenarios();
const ids = (list: readonly { id: string }[]) => list.map((scenario) => scenario.id);

describe('the library the tests use', () => {
  it('has at least twelve scenarios across the products and all three difficulties', () => {
    expect(all.length).toBeGreaterThanOrEqual(12);
    expect(new Set(all.map((scenario) => scenario.product.id)).size).toBeGreaterThanOrEqual(10);
    expect(new Set(all.map((scenario) => scenario.difficulty))).toEqual(new Set(DIFFICULTIES));
  });
});

describe('filters', () => {
  it('each narrow on their own, and together', () => {
    const teams = filterScenarios(all, { ...NO_FILTERS, product: 'teams' });
    expect(teams.length).toBeGreaterThan(1);
    expect(teams.every((scenario) => scenario.product.id === 'teams')).toBe(true);

    const challenge = filterScenarios(all, { ...NO_FILTERS, difficulty: 'challenge' });
    expect(challenge.every((scenario) => scenario.difficulty === 'challenge')).toBe(true);

    const both = filterScenarios(all, { product: 'teams', difficulty: 'challenge' });
    expect(ids(both)).toEqual(ids(teams.filter((scenario) => scenario.difficulty === 'challenge')));
    expect(both.length).toBeLessThan(teams.length);
  });

  it('match a scenario only when every filter set matches it', () => {
    const one = scenarioById(SAMPLE.standard);
    expect(matchesFilters(one, NO_FILTERS)).toBe(true);
    expect(matchesFilters(one, { product: 'teams', difficulty: 'standard' })).toBe(true);
    expect(matchesFilters(one, { ...NO_FILTERS, product: 'outlook' })).toBe(false);
    expect(matchesFilters(one, { ...NO_FILTERS, difficulty: 'starter' })).toBe(false);
  });

  it('are read from the address, ignoring what is not valid', () => {
    const filters = readFilters(
      new URLSearchParams('f_product=teams&f_difficulty=hard&q=old&f_impact=high'),
    );
    expect(filters).toEqual({ product: 'teams', difficulty: null });
    expect(readFilters(new URLSearchParams('f_product=notes&difficulty=challenge'))).toEqual(
      NO_FILTERS,
    );
  });

  it('read an older link that names an issue type without applying it', () => {
    // The issue-type filter went when the product rail came: such a link still opens, and still
    // honours the product and difficulty in it.
    const filters = readFilters(
      new URLSearchParams('f_product=azure&f_issue=billing-licence&f_difficulty=starter'),
    );
    expect(filters).toEqual({ product: 'azure', difficulty: 'starter' });
    const written = new URLSearchParams();
    writeFilters(filters, written);
    expect(written.has('f_issue')).toBe(false);
  });

  it('use keys that never clash with the call configuration', () => {
    const params = new URLSearchParams();
    writeFilters({ product: 'azure', difficulty: 'starter' }, params);
    expect([...params.keys()]).toEqual(['f_product', 'f_difficulty']);
  });

  it('are counted', () => {
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
    expect(activeFilterCount({ product: 'teams', difficulty: 'starter' })).toBe(2);
  });
});

describe('order', () => {
  const sorted = sortScenarios(all);

  it('goes by product family, then product, then the gentlest first, then title', () => {
    const rank = (list: readonly string[], item: string) => list.indexOf(item);
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1];
      const b = sorted[i];
      if (!a || !b) continue;
      const families =
        rank(PRODUCT_FAMILIES, a.product.family) - rank(PRODUCT_FAMILIES, b.product.family);
      expect(families).toBeLessThanOrEqual(0);
      if (families !== 0) continue;
      const products = rank(PRODUCT_IDS, a.product.id) - rank(PRODUCT_IDS, b.product.id);
      expect(products).toBeLessThanOrEqual(0);
      if (products !== 0) continue;
      const levels = DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty];
      expect(levels).toBeLessThanOrEqual(0);
      if (levels === 0) expect(a.title.localeCompare(b.title, 'en')).toBeLessThanOrEqual(0);
    }
  });

  it('lists every scenario once, and leaves the input as it was', () => {
    const before = ids(all);
    expect(sorted).toHaveLength(all.length);
    expect(new Set(ids(sorted)).size).toBe(all.length);
    expect(ids(all)).toEqual(before);
  });
});

describe('the product rail', () => {
  it('lists every product that has a scenario, in the brief\u2019s order with Power Platform last', () => {
    const { products, total } = railProducts(all, NO_FILTERS);
    expect(products.map((product) => product.id)).toEqual([...RAIL_ORDER]);
    expect(RAIL_ORDER.at(-1)).toBe('power-platform');
    expect(products.reduce((sum, product) => sum + product.count, 0)).toBe(all.length);
    expect(total).toBe(all.length);
    expect(products.find((product) => product.id === 'teams')?.count).toBe(2);
  });

  it('leaves out a product the library has no scenario for', () => {
    const withoutAzure = all.filter((scenario) => scenario.product.id !== 'azure');
    const { products } = railProducts(withoutAzure, NO_FILTERS);
    expect(products.map((product) => product.id)).not.toContain('azure');
    expect(products).toHaveLength(RAIL_ORDER.length - 1);
  });

  it('counts each product against the difficulty, and keeps one the difficulty empties', () => {
    const { products, total } = railProducts(all, { ...NO_FILTERS, difficulty: 'starter' });
    expect(products.find((product) => product.id === 'teams')?.count).toBe(0);
    expect(products.find((product) => product.id === 'outlook')?.count).toBe(1);
    expect(total).toBe(all.filter((scenario) => scenario.difficulty === 'starter').length);
  });

  it('counts against the others, never against the product that is chosen', () => {
    // Choosing Teams does not hide the other products' counts: they show what choosing one would give.
    const filters: Filters = { product: 'teams', difficulty: 'challenge' };
    const { products, total } = railProducts(all, filters);
    const challenge = all.filter((scenario) => scenario.difficulty === 'challenge');
    expect(total).toBe(challenge.length);
    expect(products.reduce((sum, product) => sum + product.count, 0)).toBe(challenge.length);
  });
});

describe('the difficulty filter', () => {
  it('counts each difficulty against the product, never against itself', () => {
    const byDifficulty = difficultyOptions(all, { product: 'teams', difficulty: 'challenge' });
    expect(byDifficulty.map((option) => [option.value, option.count])).toEqual([
      ['starter', 0],
      ['standard', 1],
      ['challenge', 1],
    ]);
    expect(byDifficulty.map((option) => option.label)).toEqual([
      'Starter',
      'Standard',
      'Challenge',
    ]);
  });
});

describe('the count in words', () => {
  it('says how many scenarios there are', () => {
    expect(countLabel(16, 16)).toBe('16 scenarios');
    expect(countLabel(3, 16)).toBe('3 of 16 scenarios');
    expect(countLabel(0, 16)).toBe('0 of 16 scenarios');
    expect(countLabel(1, 1)).toBe('1 scenario');
  });
});

describe('the workspace address', () => {
  const scenario = scenarioById(SAMPLE.standard);
  const filters: Filters = { product: 'teams', difficulty: 'standard' };

  it('writes filters, then the scenario, then its configuration, in a fixed order', () => {
    // A voice that is the scenario's own is left out, so the test names one that is not.
    const other = defaultVoiceFor(scenario.id) === 'voice-d' ? 'voice-c' : 'voice-d';
    const config = parseConfig(`hints=on&difficulty=challenge&voice=${other}`, scenario);
    expect(workspaceSearch(filters, { scenarioId: scenario.id, scenario, config })).toBe(
      `?f_product=teams&f_difficulty=standard&scenario=${scenario.id}&difficulty=challenge&hints=on&voice=${other}`,
    );
  });

  it('is empty when nothing is chosen', () => {
    expect(workspaceSearch(NO_FILTERS, null)).toBe('');
  });

  it('is unchanged by being read and written again', () => {
    const config = parseConfig('curveballs=none&stage=closure&hints=on', scenario);
    const search = workspaceSearch(filters, { scenarioId: scenario.id, scenario, config });
    const params = new URLSearchParams(search);
    const again = workspaceSearch(readFilters(params), {
      scenarioId: params.get('scenario') as string,
      scenario,
      config: parseConfig(params, scenario),
    });
    expect(again).toBe(search);
    expect(normaliseSearch(search)).toBe(search);
  });

  it('keeps a plain scenario address short', () => {
    expect(
      workspaceSearch(NO_FILTERS, {
        scenarioId: scenario.id,
        scenario,
        config: defaultConfig(scenario),
      }),
    ).toBe(`?scenario=${scenario.id}`);
  });
});
