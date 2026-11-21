import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import {
  DIFFICULTIES,
  DIFFICULTY_RANK,
  IMPACTS,
  ISSUE_TYPES,
  ISSUE_TYPE_LABELS,
  type BusinessImpact,
  type Difficulty,
  type IssueType,
} from '#shared/domain/vocab.ts';

// Finding scenarios: search, filters, and the order they are listed in. Pure functions over the
// public scenarios, so the list can be tested against the real library.

export interface Filters {
  /** What was typed in the search box (as typed: trimmed only when matching). */
  q: string;
  issue: IssueType | null;
  difficulty: Difficulty | null;
  impact: BusinessImpact | null;
}

export const NO_FILTERS: Filters = { q: '', issue: null, difficulty: null, impact: null };

/** The query keys of the filters. `difficulty` and `impact` alone always mean the call's setup. */
export const FILTER_KEYS = {
  q: 'q',
  issue: 'f_issue',
  difficulty: 'f_difficulty',
  impact: 'f_impact',
} as const;

const MAX_QUERY_LENGTH = 120;

function oneOf<T extends string>(list: readonly T[], value: string | null): T | null {
  return list.find((item) => item === value) ?? null;
}

/** The filters in a query string. Anything that is not valid is ignored. */
export function readFilters(params: URLSearchParams): Filters {
  return {
    q: (params.get(FILTER_KEYS.q) ?? '').slice(0, MAX_QUERY_LENGTH),
    issue: oneOf(ISSUE_TYPES, params.get(FILTER_KEYS.issue)),
    difficulty: oneOf(DIFFICULTIES, params.get(FILTER_KEYS.difficulty)),
    impact: oneOf(IMPACTS, params.get(FILTER_KEYS.impact)),
  };
}

/** Writes the filters that are set. */
export function writeFilters(filters: Filters, params: URLSearchParams): void {
  if (filters.q.trim() !== '') params.set(FILTER_KEYS.q, filters.q.slice(0, MAX_QUERY_LENGTH));
  if (filters.issue) params.set(FILTER_KEYS.issue, filters.issue);
  if (filters.difficulty) params.set(FILTER_KEYS.difficulty, filters.difficulty);
  if (filters.impact) params.set(FILTER_KEYS.impact, filters.impact);
}

/** How many filters are in use (a search counts as one). */
export function activeFilterCount(filters: Filters): number {
  return [filters.q.trim() !== '', filters.issue, filters.difficulty, filters.impact].filter(
    Boolean,
  ).length;
}

// ---- Matching ------------------------------------------------------------------------------

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const haystacks = new WeakMap<PublicScenarioDTO, string>();

/** Everything a search looks in: title, summary, tags, the customer, and the issue type's name. */
function haystack(scenario: PublicScenarioDTO): string {
  let text = haystacks.get(scenario);
  if (text === undefined) {
    text = fold(
      [
        scenario.title,
        scenario.summary,
        ...scenario.tags,
        scenario.persona.name,
        scenario.persona.role,
        scenario.persona.organisation,
        ISSUE_TYPE_LABELS[scenario.issueType],
      ].join('\n'),
    );
    haystacks.set(scenario, text);
  }
  return text;
}

/** Every word typed must be found somewhere in the scenario, in any order, ignoring case and accents. */
export function matchesQuery(scenario: PublicScenarioDTO, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = haystack(scenario);
  return words.every((word) => text.includes(word));
}

export function matchesFilters(scenario: PublicScenarioDTO, filters: Filters): boolean {
  return (
    matchesQuery(scenario, filters.q) &&
    (filters.issue === null || scenario.issueType === filters.issue) &&
    (filters.difficulty === null || scenario.difficulty === filters.difficulty) &&
    (filters.impact === null || scenario.impact === filters.impact)
  );
}

export function filterScenarios(
  scenarios: readonly PublicScenarioDTO[],
  filters: Filters,
): PublicScenarioDTO[] {
  return scenarios.filter((scenario) => matchesFilters(scenario, filters));
}

// ---- Order ---------------------------------------------------------------------------------

export interface ScenarioGroup {
  issueType: IssueType;
  label: string;
  scenarios: PublicScenarioDTO[];
}

/** Gentlest first, then by title. */
function byDifficultyThenTitle(a: PublicScenarioDTO, b: PublicScenarioDTO): number {
  return (
    DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] || a.title.localeCompare(b.title)
  );
}

/** Scenarios grouped by issue type, in the vocabulary's order; empty groups are left out. */
export function groupByIssue(scenarios: readonly PublicScenarioDTO[]): ScenarioGroup[] {
  return ISSUE_TYPES.map((issueType) => ({
    issueType,
    label: ISSUE_TYPE_LABELS[issueType],
    scenarios: scenarios
      .filter((scenario) => scenario.issueType === issueType)
      .sort(byDifficultyThenTitle),
  })).filter((group) => group.scenarios.length > 0);
}

/** The scenarios in the order they are listed on the page. */
export function listOrder(groups: readonly ScenarioGroup[]): PublicScenarioDTO[] {
  return groups.flatMap((group) => group.scenarios);
}

/** "13 scenarios", "1 scenario" or "3 of 13 scenarios". */
export function countLabel(shown: number, total: number): string {
  const noun = total === 1 ? 'scenario' : 'scenarios';
  return shown === total ? `${total} ${noun}` : `${shown} of ${total} ${noun}`;
}
