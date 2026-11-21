import type { PublicProductDTO, PublicScenarioDTO } from '#shared/domain/api.ts';
import {
  DIFFICULTIES,
  DIFFICULTY_RANK,
  ISSUE_TYPES,
  ISSUE_TYPE_LABELS,
  PRODUCT_FAMILIES,
  PRODUCT_IDS,
  type Difficulty,
  type IssueType,
  type ProductFamily,
  type ProductId,
} from '#shared/domain/vocab.ts';
import { difficultyLabel } from './labels.ts';

// Finding scenarios: the three filters, the order scenarios are listed in, and the counts the
// filters show. Pure functions over the public scenarios, so the list can be tested without a page.

export interface Filters {
  product: ProductId | null;
  issue: IssueType | null;
  difficulty: Difficulty | null;
}

export const NO_FILTERS: Filters = { product: null, issue: null, difficulty: null };

/** The query keys of the filters. `difficulty` alone always means the call's setup. */
export const FILTER_KEYS = {
  product: 'f_product',
  issue: 'f_issue',
  difficulty: 'f_difficulty',
} as const;

function oneOf<T extends string>(list: readonly T[], value: string | null): T | null {
  return list.find((item) => item === value) ?? null;
}

/** The filters in a query string. Anything that is not valid is ignored. */
export function readFilters(params: URLSearchParams): Filters {
  return {
    product: oneOf(PRODUCT_IDS, params.get(FILTER_KEYS.product)),
    issue: oneOf(ISSUE_TYPES, params.get(FILTER_KEYS.issue)),
    difficulty: oneOf(DIFFICULTIES, params.get(FILTER_KEYS.difficulty)),
  };
}

/** Writes the filters that are set. */
export function writeFilters(filters: Filters, params: URLSearchParams): void {
  if (filters.product) params.set(FILTER_KEYS.product, filters.product);
  if (filters.issue) params.set(FILTER_KEYS.issue, filters.issue);
  if (filters.difficulty) params.set(FILTER_KEYS.difficulty, filters.difficulty);
}

/** How many filters are in use. */
export function activeFilterCount(filters: Filters): number {
  return [filters.product, filters.issue, filters.difficulty].filter(Boolean).length;
}

// ---- Matching ------------------------------------------------------------------------------

export function matchesFilters(scenario: PublicScenarioDTO, filters: Filters): boolean {
  return (
    (filters.product === null || scenario.product.id === filters.product) &&
    (filters.issue === null || scenario.issueType === filters.issue) &&
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

export interface ProductGroup {
  family: ProductFamily;
  label: string;
  options: FilterOption<ProductId>[];
}

/** The scenarios that match every filter except one: the pool that filter's options are counted in. */
function without(
  scenarios: readonly PublicScenarioDTO[],
  filters: Filters,
  key: keyof Filters,
): PublicScenarioDTO[] {
  return scenarios.filter((scenario) => matchesFilters(scenario, { ...filters, [key]: null }));
}

/** The products in the library, grouped by family, each with its count. */
export function productGroups(
  scenarios: readonly PublicScenarioDTO[],
  filters: Filters,
): ProductGroup[] {
  const pool = without(scenarios, filters, 'product');
  const products = new Map<ProductId, PublicProductDTO>();
  for (const scenario of scenarios) {
    if (!products.has(scenario.product.id)) products.set(scenario.product.id, scenario.product);
  }
  const groups: ProductGroup[] = [];
  for (const product of [...products.values()].sort(byProduct)) {
    let group = groups.find((item) => item.family === product.family);
    if (!group) {
      group = { family: product.family, label: product.familyLabel, options: [] };
      groups.push(group);
    }
    group.options.push({
      value: product.id,
      label: product.name,
      count: pool.filter((scenario) => scenario.product.id === product.id).length,
    });
  }
  return groups;
}

export function issueOptions(
  scenarios: readonly PublicScenarioDTO[],
  filters: Filters,
): FilterOption<IssueType>[] {
  const pool = without(scenarios, filters, 'issue');
  return ISSUE_TYPES.filter((type) =>
    scenarios.some((scenario) => scenario.issueType === type),
  ).map((type) => ({
    value: type,
    label: ISSUE_TYPE_LABELS[type],
    count: pool.filter((scenario) => scenario.issueType === type).length,
  }));
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
