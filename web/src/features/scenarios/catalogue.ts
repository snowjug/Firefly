import type { PublicProductDTO, PublicScenarioDTO } from '#shared/domain/api.ts';
import {
  DIFFICULTIES,
  DIFFICULTY_RANK,
  PRODUCT_FAMILIES,
  PRODUCT_IDS,
  type Difficulty,
  type ProductId,
} from '#shared/domain/vocab.ts';
import { RAIL_ORDER, difficultyLabel } from './labels.ts';

// Finding scenarios: the two filters, the order scenarios are shown in, and the counts the filters
// show. Pure functions over the public scenarios, so the gallery can be tested without a page.

export interface Filters {
  product: ProductId | null;
  difficulty: Difficulty | null;
}

export const NO_FILTERS: Filters = { product: null, difficulty: null };

/**
 * The query keys of the filters. `difficulty` alone always means the call's setup. An older link may
 * also carry `f_issue` (the issue-type filter that the product rail replaced): it is not read, so such
 * a link shows every scenario of its product and difficulty, and the address is tidied without it.
 */
export const FILTER_KEYS = {
  product: 'f_product',
  difficulty: 'f_difficulty',
} as const;

function oneOf<T extends string>(list: readonly T[], value: string | null): T | null {
  return list.find((item) => item === value) ?? null;
}

/** The filters in a query string. Anything that is not valid is ignored. */
export function readFilters(params: URLSearchParams): Filters {
  return {
    product: oneOf(PRODUCT_IDS, params.get(FILTER_KEYS.product)),
    difficulty: oneOf(DIFFICULTIES, params.get(FILTER_KEYS.difficulty)),
  };
}

/** Writes the filters that are set. */
export function writeFilters(filters: Filters, params: URLSearchParams): void {
  if (filters.product) params.set(FILTER_KEYS.product, filters.product);
  if (filters.difficulty) params.set(FILTER_KEYS.difficulty, filters.difficulty);
}

/** How many filters are in use. */
export function activeFilterCount(filters: Filters): number {
  return [filters.product, filters.difficulty].filter(Boolean).length;
}

// ---- Matching ------------------------------------------------------------------------------

export function matchesFilters(scenario: PublicScenarioDTO, filters: Filters): boolean {
  return (
    (filters.product === null || scenario.product.id === filters.product) &&
    (filters.difficulty === null || scenario.difficulty === filters.difficulty)
  );
}

export function filterScenarios(
  scenarios: readonly PublicScenarioDTO[],
  filters: Filters,
): PublicScenarioDTO[] {
  return scenarios.filter((scenario) => matchesFilters(scenario, filters));
}

// ---- Order ---------------------------------------------------------------------------------

const rankIn = <T>(list: readonly T[], item: T): number => {
  const index = list.indexOf(item);
  return index === -1 ? list.length : index;
};

function byProduct(a: PublicProductDTO, b: PublicProductDTO): number {
  return (
    rankIn(PRODUCT_FAMILIES, a.family) - rankIn(PRODUCT_FAMILIES, b.family) ||
    rankIn(PRODUCT_IDS, a.id) - rankIn(PRODUCT_IDS, b.id)
  );
}

/**
 * By product family, then product (the vocabulary's order), then the gentlest first, then by title.
 * The title is compared in English, so the order is the same on every machine.
 */
export function sortScenarios(scenarios: readonly PublicScenarioDTO[]): PublicScenarioDTO[] {
  return [...scenarios].sort(
    (a, b) =>
      byProduct(a.product, b.product) ||
      DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] ||
      a.title.localeCompare(b.title, 'en'),
  );
}

// ---- Counts --------------------------------------------------------------------------------

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  /** How many scenarios this choice would show with the other filters as they are. */
  count: number;
}

/** The scenarios that match every filter except one: the pool that filter's options are counted in. */
function without(
  scenarios: readonly PublicScenarioDTO[],
  filters: Filters,
  key: keyof Filters,
): PublicScenarioDTO[] {
  return scenarios.filter((scenario) => matchesFilters(scenario, { ...filters, [key]: null }));
}

/**
 * The product rail: every product the library has a scenario for, in rail order, each with how many
 * scenarios it would show with the difficulty as it is, and the number "All" would show. A product
 * with no scenario at all is left out; one that the difficulty empties is kept, with a count of zero.
 */
export function railProducts(
  scenarios: readonly PublicScenarioDTO[],
  filters: Filters,
): { products: { id: ProductId; count: number }[]; total: number } {
  const pool = without(scenarios, filters, 'product');
  const have = new Set(scenarios.map((scenario) => scenario.product.id));
  const known = RAIL_ORDER.filter((id) => have.has(id));
  // A product the rail does not know (a new one in the library) still gets a chip, after the others.
  const extra = PRODUCT_IDS.filter((id) => have.has(id) && !known.includes(id));
  return {
    products: [...known, ...extra].map((id) => ({
      id,
      count: pool.filter((scenario) => scenario.product.id === id).length,
    })),
    total: pool.length,
  };
}

export function difficultyOptions(
  scenarios: readonly PublicScenarioDTO[],
  filters: Filters,
): FilterOption<Difficulty>[] {
  const pool = without(scenarios, filters, 'difficulty');
  return DIFFICULTIES.map((difficulty) => ({
    value: difficulty,
    label: difficultyLabel(difficulty),
    count: pool.filter((scenario) => scenario.difficulty === difficulty).length,
  }));
}

/** "16 scenarios", "1 scenario". */
export function countLabel(shown: number, total: number): string {
  const noun = total === 1 ? 'scenario' : 'scenarios';
  return shown === total ? `${total} ${noun}` : `${shown} of ${total} ${noun}`;
}
