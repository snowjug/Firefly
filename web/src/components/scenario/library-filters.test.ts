import { describe, expect, it } from 'vitest';
import {
  EMPTY_QUERY,
  activeFilters,
  durationBand,
  facetCounts,
  filterScenarios,
  parseQuery,
  sortScenarios,
  toSearchParams,
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
  style: 'talkative',
  estimatedMinutes: 12,
  coachingFocus: ['scoping-discovery', 'clarity'],
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
  estimatedMinutes: 10,
});
const standard = makeScenario({
  id: 'standard',
  title: 'Orders missing from the weekly report',
  tags: ['missing data'],
  issueType: 'data-missing',
  difficulty: 'standard',
  callStage: 'follow-up',
  estimatedMinutes: 8,
});
const challenge = makeScenario({
  id: 'challenge',
  title: 'A much bigger invoice than expected',
  tags: ['billing', 'invoice'],
  issueType: 'billing-licence',
  difficulty: 'challenge',
  impact: 'high',
  callStage: 'escalated',
  estimatedMinutes: 16,
  coachingFocus: ['empathy-deescalation', 'ownership-next-steps'],
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
  it('combine, and coaching focus matches any of a scenario focus areas', () => {
    expect(run({ facets: { difficulty: 'standard' } })).toEqual(['spotlight', 'standard']);
    expect(run({ facets: { difficulty: 'standard', stage: 'follow-up' } })).toEqual(['standard']);
    expect(run({ facets: { focus: 'clarity' } })).toEqual(['starter']);
    expect(run({ facets: { impact: 'high' }, q: 'invoice' })).toEqual(['challenge']);
  });

  it('group duration into up to 10, 11 to 15 and over 15 minutes', () => {
    expect([10, 11, 15, 16].map(durationBand)).toEqual(['short', 'medium', 'medium', 'long']);
    expect(run({ facets: { duration: 'short' } })).toEqual(['spotlight', 'standard']);
    expect(run({ facets: { duration: 'medium' } })).toEqual(['starter']);
    expect(run({ facets: { duration: 'long' } })).toEqual(['challenge']);
  });
});

describe('order', () => {
  const order = (sort: LibraryQuery['sort']) => sortScenarios(library, sort).map((s) => s.id);

  it('recommends the spotlight first, then easiest to hardest', () => {
    expect(order('recommended')).toEqual(['spotlight', 'starter', 'standard', 'challenge']);
  });
  it('can put the shortest first or the easiest first', () => {
    expect(order('shortest')).toEqual(['standard', 'spotlight', 'starter', 'challenge']);
    expect(order('difficulty')).toEqual(['starter', 'standard', 'spotlight', 'challenge']);
  });
});

describe('the address', () => {
  it('is read safely and written without defaults', () => {
    const query = parseQuery(
      new URLSearchParams('q=mail&difficulty=starter&impact=bogus&sort=shortest&duration=long'),
    );
    expect(query).toEqual({
      q: 'mail',
      facets: { difficulty: 'starter', duration: 'long' },
      sort: 'shortest',
    });
    expect(toSearchParams(query).toString()).toBe(
      'q=mail&difficulty=starter&duration=long&sort=shortest',
    );
    expect(toSearchParams(EMPTY_QUERY).toString()).toBe('');
    expect(parseQuery(new URLSearchParams('sort=nonsense')).sort).toBe('recommended');
  });

  it('turns the active view into removable filters', () => {
    expect(
      activeFilters({ q: ' billing ', facets: { impact: 'high' }, sort: 'recommended' }),
    ).toEqual([
      { key: 'q', label: 'Search', value: 'billing' },
      { key: 'impact', label: 'Business impact', value: 'High' },
    ]);
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
    expect(totals.duration).toEqual({ short: 2, medium: 1, long: 1 });
  });
});
