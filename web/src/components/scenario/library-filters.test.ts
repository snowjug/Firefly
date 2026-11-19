import { describe, expect, it } from 'vitest';
import {
  EMPTY_QUERY,
  facetCounts,
  filterScenarios,
  isFiltered,
  orderScenarios,
  parseQuery,
  toSearchParams,
  withFacet,
  type LibraryQuery,
} from './library-filters.ts';
import { makeScenario } from './scenario-fixtures.ts';

const starter = makeScenario({
  id: 'starter',
  title: 'Locked out after a password reset',
  summary: 'A front-desk coordinator cannot sign in to the staff portal.',
  tags: ['sign-in', 'password'],
  difficulty: 'starter',
  impact: 'low',
  persona: {
    name: 'Carmen Fraser',
    role: 'Accounts assistant',
    organisation: 'Tailspin Print Works',
  },
});
const spotlight = makeScenario({
  id: 'spotlight',
  title: 'Team cannot open the shared workspace',
  difficulty: 'standard',
  spotlight: true,
});
const standard = makeScenario({
  id: 'standard',
  title: 'Orders missing from the weekly report',
  tags: ['missing data'],
  issueType: 'data-missing',
  difficulty: 'standard',
});
const challenge = makeScenario({
  id: 'challenge',
  title: 'A much bigger invoice than expected',
  tags: ['billing', 'invoice'],
  issueType: 'billing-licence',
  difficulty: 'challenge',
  impact: 'high',
});
const library = [challenge, starter, spotlight, standard];

const run = (query: Partial<LibraryQuery>) =>
  filterScenarios(library, { ...EMPTY_QUERY, ...query }).map((s) => s.id);

describe('searching', () => {
  it('looks at the title, summary, tags, issue type and customer', () => {
    expect(run({ q: 'password' })).toEqual(['starter']); // title and tag
    expect(run({ q: 'staff portal' })).toEqual(['starter']); // summary
    expect(run({ q: 'billing or licence' })).toEqual(['challenge']); // issue type label
    expect(run({ q: 'tailspin' })).toEqual(['starter']); // customer organisation
  });

  it('needs every word, ignores case and accents', () => {
    expect(run({ q: 'invoice password' })).toEqual([]);
    expect(run({ q: '  FRÄSER  ' })).toEqual(['starter']);
    expect(run({ q: '' })).toHaveLength(4);
  });
});

describe('filters', () => {
  it('narrow by issue type, difficulty and impact, and combine with the search', () => {
    expect(run({ facets: { issue: 'sign-in-access' } })).toEqual(['starter', 'spotlight']);
    expect(run({ facets: { difficulty: 'standard' } })).toEqual(['spotlight', 'standard']);
    expect(run({ facets: { difficulty: 'standard', issue: 'data-missing' } })).toEqual([
      'standard',
    ]);
    expect(run({ facets: { impact: 'high' }, q: 'invoice' })).toEqual(['challenge']);
    expect(run({ facets: { impact: 'high' }, q: 'password' })).toEqual([]);
  });
});

describe('order', () => {
  it('puts the suggestion first, then the spotlight, then easiest to hardest', () => {
    const order = (recommended: string | null) =>
      orderScenarios(library, recommended).map((s) => s.id);
    expect(order(null)).toEqual(['spotlight', 'starter', 'standard', 'challenge']);
    expect(order('challenge')).toEqual(['challenge', 'spotlight', 'starter', 'standard']);
  });
});

describe('the address', () => {
  it('is read safely and written without what is empty', () => {
    const query = parseQuery(
      new URLSearchParams('q=mail&difficulty=starter&impact=bogus&issue=how-to&view=map'),
    );
    expect(query).toEqual({ q: 'mail', facets: { difficulty: 'starter', issue: 'how-to' } });
    expect(toSearchParams(query).toString()).toBe('q=mail&issue=how-to&difficulty=starter');
    expect(toSearchParams(EMPTY_QUERY).toString()).toBe('');
  });

  it('knows when anything narrows the list and can drop a filter again', () => {
    expect(isFiltered(EMPTY_QUERY)).toBe(false);
    expect(isFiltered({ q: '  ', facets: {} })).toBe(false);
    expect(isFiltered({ q: 'a', facets: {} })).toBe(true);
    const narrowed = withFacet(EMPTY_QUERY, 'impact', 'high');
    expect(isFiltered(narrowed)).toBe(true);
    expect(withFacet(narrowed, 'impact', '')).toEqual(EMPTY_QUERY);
  });
});

describe('option counts', () => {
  it('count what picking an option would show, honouring the other filters', () => {
    const { available, totals } = facetCounts(library, {
      ...EMPTY_QUERY,
      facets: { difficulty: 'standard' },
    });
    // Difficulty counts ignore the difficulty filter itself, so every level stays comparable.
    expect(available.difficulty).toEqual({ starter: 1, standard: 2, challenge: 1 });
    // The other facets only count what the difficulty filter leaves.
    expect(available.impact).toEqual({ medium: 2 });
    // Totals ignore every filter; an option with no scenario at all never appears.
    expect(totals.impact).toEqual({ low: 1, medium: 2, high: 1 });
    expect(totals.issue).toEqual({ 'sign-in-access': 2, 'data-missing': 1, 'billing-licence': 1 });
  });
});
