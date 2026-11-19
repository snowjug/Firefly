import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  DIFFICULTIES,
  DIFFICULTY_RANK,
  IMPACTS,
  IMPACT_LABELS,
  ISSUE_TYPES,
  ISSUE_TYPE_LABELS,
} from '#shared/domain/vocab.ts';

// Pure logic for the scenario library: what can be filtered, how a filtered view is written to and
// read from the address, and how scenarios are matched, counted and ordered.

export const FACET_KEYS = ['issue', 'difficulty', 'impact'] as const;
export type FacetKey = (typeof FACET_KEYS)[number];

export interface FacetDefinition {
  key: FacetKey;
  label: string;
  anyLabel: string;
  values: readonly string[];
  valueLabel(value: string): string;
  valueOf(scenario: PublicScenarioDTO): string;
}

function facet(
  key: FacetKey,
  label: string,
  anyLabel: string,
  entries: readonly (readonly [string, string])[],
  valueOf: (scenario: PublicScenarioDTO) => string,
): FacetDefinition {
  const labels = new Map(entries);
  return {
    key,
    label,
    anyLabel,
    values: entries.map(([value]) => value),
    valueLabel: (value) => labels.get(value) ?? value,
    valueOf,
  };
}

export const FACETS: readonly FacetDefinition[] = [
  facet(
    'issue',
    'Issue type',
    'All issue types',
    ISSUE_TYPES.map((type) => [type, ISSUE_TYPE_LABELS[type]] as const),
    (scenario) => scenario.issueType,
  ),
  facet(
    'difficulty',
    'Difficulty',
    'All difficulties',
    DIFFICULTIES.map((difficulty) => [difficulty, DIFFICULTY_PROFILES[difficulty].label] as const),
    (scenario) => scenario.difficulty,
  ),
  facet(
    'impact',
    'Business impact',
    'All impacts',
    IMPACTS.map((impact) => [impact, IMPACT_LABELS[impact].label] as const),
    (scenario) => scenario.impact,
  ),
];

export interface LibraryQuery {
  q: string;
  facets: Partial<Record<FacetKey, string>>;
}

export const EMPTY_QUERY: LibraryQuery = { q: '', facets: {} };

const MAX_QUERY_LENGTH = 100;

/** Reads a filtered view from the address. Unknown or stale values are ignored, never trusted. */
export function parseQuery(params: URLSearchParams): LibraryQuery {
  const facets: Partial<Record<FacetKey, string>> = {};
  for (const def of FACETS) {
    const value = params.get(def.key);
    if (value && def.values.includes(value)) facets[def.key] = value;
  }
  return { q: (params.get('q') ?? '').slice(0, MAX_QUERY_LENGTH), facets };
}

/** Writes a view to the address, leaving out everything that is empty. */
export function toSearchParams(query: LibraryQuery): URLSearchParams {
  const params = new URLSearchParams();
  const q = query.q.trim();
  if (q) params.set('q', q);
  for (const def of FACETS) {
    const value = query.facets[def.key];
    if (value) params.set(def.key, value);
  }
  return params;
}

export function withFacet(query: LibraryQuery, key: FacetKey, value: string): LibraryQuery {
  const facets = { ...query.facets };
  if (value) facets[key] = value;
  else delete facets[key];
  return { ...query, facets };
}

/** True when a search or any filter narrows the list. */
export function isFiltered(query: LibraryQuery): boolean {
  return query.q.trim() !== '' || FACETS.some((def) => Boolean(query.facets[def.key]));
}

// ------------------------------------------------------------------------------------------
// Matching

function fold(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

const haystacks = new WeakMap<PublicScenarioDTO, string>();

/** Everything a person can see on a card and might search for. */
function haystack(scenario: PublicScenarioDTO): string {
  let text = haystacks.get(scenario);
  if (text === undefined) {
    text = fold(
      [
        scenario.title,
        scenario.summary,
        ...scenario.tags,
        ISSUE_TYPE_LABELS[scenario.issueType],
        scenario.persona.name,
        scenario.persona.role,
        scenario.persona.organisation,
      ].join('\n'),
    );
    haystacks.set(scenario, text);
  }
  return text;
}

/** Every word typed must appear somewhere in the scenario. */
export function matchesSearch(scenario: PublicScenarioDTO, q: string): boolean {
  const terms = fold(q).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const text = haystack(scenario);
  return terms.every((term) => text.includes(term));
}

function matchesFacets(
  scenario: PublicScenarioDTO,
  facets: LibraryQuery['facets'],
  skip?: FacetKey,
): boolean {
  return FACETS.every((def) => {
    const wanted = facets[def.key];
    return def.key === skip || !wanted || def.valueOf(scenario) === wanted;
  });
}

export function filterScenarios(
  scenarios: readonly PublicScenarioDTO[],
  query: LibraryQuery,
): PublicScenarioDTO[] {
  return scenarios.filter((s) => matchesSearch(s, query.q) && matchesFacets(s, query.facets));
}

export type FacetCounts = Record<FacetKey, Record<string, number>>;

function emptyCounts(): FacetCounts {
  return { issue: {}, difficulty: {}, impact: {} };
}

/**
 * How many scenarios each option would show. `available` honours the search and every other
 * filter (so a count answers "what happens if I pick this"); `totals` ignores all filters and is
 * used to hide options that no scenario in the library has.
 */
export function facetCounts(
  scenarios: readonly PublicScenarioDTO[],
  query: LibraryQuery,
): { available: FacetCounts; totals: FacetCounts } {
  const available = emptyCounts();
  const totals = emptyCounts();
  const searched = scenarios.filter((s) => matchesSearch(s, query.q));
  for (const def of FACETS) {
    for (const s of scenarios) {
      const value = def.valueOf(s);
      totals[def.key][value] = (totals[def.key][value] ?? 0) + 1;
    }
    for (const s of searched) {
      if (!matchesFacets(s, query.facets, def.key)) continue;
      const value = def.valueOf(s);
      available[def.key][value] = (available[def.key][value] ?? 0) + 1;
    }
  }
  return { available, totals };
}

// ------------------------------------------------------------------------------------------
// Order

/**
 * The one suggested next comes first, then the demo spotlight, then the gentlest to the hardest,
 * with the title breaking ties so the order never shuffles.
 */
export function orderScenarios(
  scenarios: readonly PublicScenarioDTO[],
  recommendedId: string | null,
): PublicScenarioDTO[] {
  const rank = (s: PublicScenarioDTO) => DIFFICULTY_RANK[s.difficulty];
  return [...scenarios].sort(
    (a, b) =>
      Number(b.id === recommendedId) - Number(a.id === recommendedId) ||
      Number(b.spotlight) - Number(a.spotlight) ||
      rank(a) - rank(b) ||
      a.title.localeCompare(b.title),
  );
}
