import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  DIFFICULTIES,
  IMPACTS,
  IMPACT_LABELS,
  ISSUE_TYPES,
  type BusinessImpact,
  type Difficulty,
  type IssueType,
} from '#shared/domain/vocab.ts';
import { isOneOf } from '../scenario/guards.ts';
import { toSearchParams, type LibraryQuery } from '../scenario/library-filters.ts';
import {
  ATLAS_FAMILY_LABELS,
  applyLens,
  isLensEmpty,
  type AtlasLens,
  type AtlasModel,
  type MissionStatus,
} from './atlas-model.ts';

// What the trainee has asked of the missions: a search, a lens (difficulty, impact, family, status)
// and how to show them. It lives in the address, so Back, Forward and a shared link all bring the
// same view. The search and the three older filters keep the names the library has always used
// (`q`, `issue`, `difficulty`, `impact`); `status` and `view` are new.

export type PlateView = 'chart' | 'list';

export const STATUSES: readonly MissionStatus[] = ['new', 'attempted', 'completed'];

export interface PlateQuery {
  search: LibraryQuery;
  status: MissionStatus | null;
  /** Null until the trainee chooses: the window then decides. */
  view: PlateView | null;
}

export const EMPTY_PLATE_QUERY: PlateQuery = {
  search: { q: '', facets: {} },
  status: null,
  view: null,
};

const MAX_QUERY_LENGTH = 100;

/** Reads the view from the address. Anything unknown or stale is ignored, never trusted. */
export function parsePlateQuery(params: URLSearchParams): PlateQuery {
  const facets: LibraryQuery['facets'] = {};
  const issue = params.get('issue');
  if (isOneOf(ISSUE_TYPES, issue)) facets.issue = issue;
  const difficulty = params.get('difficulty');
  if (isOneOf(DIFFICULTIES, difficulty)) facets.difficulty = difficulty;
  const impact = params.get('impact');
  if (isOneOf(IMPACTS, impact)) facets.impact = impact;
  const status = params.get('status');
  const view = params.get('view');
  return {
    search: { q: (params.get('q') ?? '').slice(0, MAX_QUERY_LENGTH), facets },
    status: isOneOf(STATUSES, status) ? status : null,
    view: view === 'chart' || view === 'list' ? view : null,
  };
}

/** Writes the view to the address, leaving out everything that is empty. */
export function toPlateSearchParams(query: PlateQuery): URLSearchParams {
  const params = toSearchParams(query.search);
  if (query.status) params.set('status', query.status);
  if (query.view) params.set('view', query.view);
  return params;
}

export type LensKey = 'family' | 'difficulty' | 'impact' | 'status';

/** The lens a query describes. */
export function lensOf(query: PlateQuery): AtlasLens {
  const { search } = query;
  return {
    query: search.q,
    family: search.facets.issue ?? null,
    difficulty: (search.facets.difficulty as Difficulty | undefined) ?? null,
    impact: (search.facets.impact as BusinessImpact | undefined) ?? null,
    status: query.status,
  };
}

/** True when a search or any part of the lens narrows the missions (the view does not count). */
export function isNarrowed(query: PlateQuery): boolean {
  return !isLensEmpty(lensOf(query));
}

/** How many parts of the lens are set (the search is counted apart). */
export function lensSetCount(query: PlateQuery): number {
  const lens = lensOf(query);
  return [lens.family, lens.difficulty, lens.impact, lens.status].filter(Boolean).length;
}

/** Sets one part of the lens, or clears it with null. */
export function withLens(query: PlateQuery, key: LensKey, value: string | null): PlateQuery {
  const facets = { ...query.search.facets };
  if (key === 'status')
    return { ...query, status: value && isOneOf(STATUSES, value) ? value : null };
  const facet = key === 'family' ? 'issue' : key;
  if (value) facets[facet] = value;
  else delete facets[facet];
  return { ...query, search: { ...query.search, facets } };
}

/** The lens and the search cleared, keeping how it is shown. */
export function cleared(query: PlateQuery): PlateQuery {
  return { ...EMPTY_PLATE_QUERY, view: query.view };
}

// ------------------------------------------------------------------------------------------
// The options of the lens

export interface LensOption {
  value: string;
  label: string;
  /** How many missions would be lit if this were chosen, with everything else as it is. */
  count: number;
}

export interface LensGroup {
  key: LensKey;
  label: string;
  /** The chosen value, or '' for any. */
  value: string;
  options: LensOption[];
}

const STATUS_LABELS: Record<MissionStatus, string> = {
  new: 'New',
  attempted: 'Attempted',
  completed: 'Completed',
};

/**
 * The groups of the lens, each with only the options that some mission has (a chosen one stays
 * even if none does) and, for each, how many missions it would light. A count answers "what happens
 * if I pick this", so it honours the search and every other part of the lens.
 */
export function lensGroups(model: AtlasModel, query: PlateQuery): LensGroup[] {
  const lens = lensOf(query);
  const has = {
    family: new Set<string>(model.missions.map((mission) => mission.family)),
    difficulty: new Set<string>(model.missions.map((mission) => mission.difficulty)),
    impact: new Set<string>(model.missions.map((mission) => mission.impact)),
    status: new Set<string>(model.missions.map((mission) => mission.status)),
  };
  const count = (key: LensKey, value: string): number =>
    applyLens(model, { ...lens, [key]: value } as AtlasLens).count;

  const group = (
    key: LensKey,
    label: string,
    values: readonly string[],
    nameOf: (value: string) => string,
  ): LensGroup => {
    const chosen = (lens[key] ?? '') as string;
    return {
      key,
      label,
      value: chosen,
      options: values
        .filter((value) => has[key].has(value) || value === chosen)
        .map((value) => ({ value, label: nameOf(value), count: count(key, value) })),
    };
  };

  return [
    group(
      'difficulty',
      'Difficulty',
      DIFFICULTIES,
      (v) => DIFFICULTY_PROFILES[v as Difficulty].label,
    ),
    group('impact', 'Business impact', IMPACTS, (v) => IMPACT_LABELS[v as BusinessImpact].label),
    group('status', 'Status', STATUSES, (v) => STATUS_LABELS[v as MissionStatus]),
    group('family', 'Family', ISSUE_TYPES, (v) => ATLAS_FAMILY_LABELS[v as IssueType]),
  ];
}
