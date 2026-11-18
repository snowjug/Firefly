import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  CALL_STAGES,
  CALL_STAGE_LABELS,
  DIFFICULTIES,
  DIFFICULTY_RANK,
  DIMENSIONS,
  DIMENSION_IDS,
  IMPACTS,
  IMPACT_LABELS,
  ISSUE_TYPE_LABELS,
  STYLES,
  STYLE_LABELS,
} from '#shared/domain/vocab.ts';
import { isOneOf } from './guards.ts';

// Pure logic for the scenario library: what can be filtered, how a filtered view is written to and
// read from the URL, and how scenarios are matched, counted and ordered.

export const DURATION_BANDS = ['short', 'medium', 'long'] as const;
export type DurationBand = (typeof DURATION_BANDS)[number];

const DURATION_LABELS: Record<DurationBand, string> = {
  short: 'Up to 10 minutes',
  medium: '11 to 15 minutes',
  long: 'Over 15 minutes',
};

export function durationBand(minutes: number): DurationBand {
  return minutes <= 10 ? 'short' : minutes <= 15 ? 'medium' : 'long';
}

export const SORT_KEYS = ['recommended', 'shortest', 'difficulty'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const SORT_LABELS: Record<SortKey, string> = {
  recommended: 'Recommended',
  shortest: 'Shortest first',
  difficulty: 'Easiest first',
};

export const FACET_KEYS = ['difficulty', 'impact', 'style', 'stage', 'focus', 'duration'] as const;
export type FacetKey = (typeof FACET_KEYS)[number];

export interface FacetDefinition {
  key: FacetKey;
  label: string;
  anyLabel: string;
  values: readonly string[];
  valueLabel(value: string): string;
  valuesOf(scenario: PublicScenarioDTO): readonly string[];
}

function facet(
  key: FacetKey,
  label: string,
  anyLabel: string,
  entries: readonly (readonly [string, string])[],
  valuesOf: (scenario: PublicScenarioDTO) => readonly string[],
): FacetDefinition {
  const labels = new Map(entries);
  return {
    key,
    label,
    anyLabel,
    values: entries.map(([value]) => value),
    valueLabel: (value) => labels.get(value) ?? value,
    valuesOf,
  };
}

export const FACETS: readonly FacetDefinition[] = [
  facet(
    'difficulty',
    'Difficulty',
    'Any difficulty',
    DIFFICULTIES.map((d) => [d, DIFFICULTY_PROFILES[d].label] as const),
    (s) => [s.difficulty],
  ),
  facet(
    'impact',
    'Business impact',
    'Any impact',
    IMPACTS.map((i) => [i, IMPACT_LABELS[i].label] as const),
    (s) => [s.impact],
  ),
  facet(
    'style',
    'Communication style',
    'Any style',
    STYLES.map((s) => [s, STYLE_LABELS[s].label] as const),
    (s) => [s.style],
  ),
  facet(
    'stage',
    'Call stage',
    'Any stage',
    CALL_STAGES.map((c) => [c, CALL_STAGE_LABELS[c].label] as const),
    (s) => [s.callStage],
  ),
  facet(
    'focus',
    'Coaching focus',
    'Any focus',
    DIMENSION_IDS.map((d) => [d, DIMENSIONS[d].label] as const),
    (s) => s.coachingFocus,
  ),
  facet(
    'duration',
    'Duration',
    'Any length',
    DURATION_BANDS.map((b) => [b, DURATION_LABELS[b]] as const),
    (s) => [durationBand(s.estimatedMinutes)],
  ),
];

export interface LibraryQuery {
  q: string;
  facets: Partial<Record<FacetKey, string>>;
  sort: SortKey;
}

export const EMPTY_QUERY: LibraryQuery = { q: '', facets: {}, sort: 'recommended' };

const MAX_QUERY_LENGTH = 100;

/** Reads a filtered view from the URL. Unknown or stale values are ignored, never trusted. */
export function parseQuery(params: URLSearchParams): LibraryQuery {
  const facets: Partial<Record<FacetKey, string>> = {};
  for (const def of FACETS) {
    const value = params.get(def.key);
    if (value && def.values.includes(value)) facets[def.key] = value;
  }
  const sort = params.get('sort');
  return {
    q: (params.get('q') ?? '').slice(0, MAX_QUERY_LENGTH),
    facets,
    sort: isOneOf(SORT_KEYS, sort) ? sort : 'recommended',
  };
}

/** Writes a view to the URL, leaving out everything that is at its default. */
export function toSearchParams(query: LibraryQuery): URLSearchParams {
  const params = new URLSearchParams();
  const q = query.q.trim();
  if (q) params.set('q', q);
  for (const def of FACETS) {
    const value = query.facets[def.key];
    if (value) params.set(def.key, value);
  }
  if (query.sort !== 'recommended') params.set('sort', query.sort);
  return params;
}

export function withFacet(query: LibraryQuery, key: FacetKey, value: string): LibraryQuery {
  const facets = { ...query.facets };
  if (value) facets[key] = value;
  else delete facets[key];
  return { ...query, facets };
}

export interface ActiveFilter {
  key: FacetKey | 'q';
  /** The control this filter belongs to, for example "Difficulty". */
  label: string;
  value: string;
}

export function activeFilters(query: LibraryQuery): ActiveFilter[] {
  const filters: ActiveFilter[] = [];
  const q = query.q.trim();
  if (q) filters.push({ key: 'q', label: 'Search', value: q });
  for (const def of FACETS) {
    const value = query.facets[def.key];
    if (value) filters.push({ key: def.key, label: def.label, value: def.valueLabel(value) });
  }
  return filters;
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
    return def.key === skip || !wanted || def.valuesOf(scenario).includes(wanted);
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
  return { difficulty: {}, impact: {}, style: {}, stage: {}, focus: {}, duration: {} };
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
      for (const value of def.valuesOf(s)) {
        totals[def.key][value] = (totals[def.key][value] ?? 0) + 1;
      }
    }
    for (const s of searched) {
      if (!matchesFacets(s, query.facets, def.key)) continue;
      for (const value of def.valuesOf(s)) {
        available[def.key][value] = (available[def.key][value] ?? 0) + 1;
      }
    }
  }
  return { available, totals };
}

// ------------------------------------------------------------------------------------------
// Order

export function sortScenarios(
  scenarios: readonly PublicScenarioDTO[],
  sort: SortKey,
): PublicScenarioDTO[] {
  const rank = (s: PublicScenarioDTO) => DIFFICULTY_RANK[s.difficulty];
  const byTitle = (a: PublicScenarioDTO, b: PublicScenarioDTO) => a.title.localeCompare(b.title);
  const ordered = [...scenarios];
  if (sort === 'shortest') {
    ordered.sort(
      (a, b) => a.estimatedMinutes - b.estimatedMinutes || rank(a) - rank(b) || byTitle(a, b),
    );
  } else if (sort === 'difficulty') {
    ordered.sort(
      (a, b) => rank(a) - rank(b) || a.estimatedMinutes - b.estimatedMinutes || byTitle(a, b),
    );
  } else {
    ordered.sort(
      (a, b) => Number(b.spotlight) - Number(a.spotlight) || rank(a) - rank(b) || byTitle(a, b),
    );
  }
  return ordered;
}
