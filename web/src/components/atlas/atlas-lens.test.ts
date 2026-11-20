import { describe, expect, it } from 'vitest';
import {
  EMPTY_PLATE_QUERY,
  cleared,
  isNarrowed,
  lensGroups,
  lensOf,
  lensSetCount,
  parsePlateQuery,
  toPlateSearchParams,
  withLens,
} from './atlas-lens.ts';
import { applyLens, buildAtlas } from './atlas-model.ts';
import { CATALOGUE, fullCall, runningCall } from './atlas.fixtures.ts';

const params = (text: string) => new URLSearchParams(text);

describe('the address of a view of the missions', () => {
  it('is read safely, ignoring anything it does not know', () => {
    const query = parsePlateQuery(
      params(
        'q=invoice&issue=billing-licence&difficulty=nope&impact=high&status=completed&view=list',
      ),
    );
    expect(query).toEqual({
      search: { q: 'invoice', facets: { issue: 'billing-licence', impact: 'high' } },
      status: 'completed',
      view: 'list',
    });
    expect(parsePlateQuery(params('status=gone&view=wall&issue=x'))).toEqual(EMPTY_PLATE_QUERY);
    expect(parsePlateQuery(params(`q=${'a'.repeat(300)}`)).search.q).toHaveLength(100);
  });

  it('is written without what is empty, and keeps the names the library always used', () => {
    expect(toPlateSearchParams(EMPTY_PLATE_QUERY).toString()).toBe('');
    const query = withLens(
      withLens(
        { ...EMPTY_PLATE_QUERY, search: { q: ' invoice ', facets: {} }, view: 'chart' },
        'family',
        'billing-licence',
      ),
      'status',
      'new',
    );
    expect(toPlateSearchParams(query).toString()).toBe(
      'q=invoice&issue=billing-licence&status=new&view=chart',
    );
  });

  it('knows when anything narrows the missions, which does not include how they are shown', () => {
    expect(isNarrowed({ ...EMPTY_PLATE_QUERY, view: 'list' })).toBe(false);
    expect(isNarrowed(withLens(EMPTY_PLATE_QUERY, 'impact', 'high'))).toBe(true);
    expect(isNarrowed({ ...EMPTY_PLATE_QUERY, search: { q: 'x', facets: {} } })).toBe(true);
    expect(
      lensSetCount(withLens(withLens(EMPTY_PLATE_QUERY, 'impact', 'high'), 'status', 'new')),
    ).toBe(2);
  });

  it('sets, replaces and drops one part of the lens, and clears the rest but not the view', () => {
    const one = withLens(EMPTY_PLATE_QUERY, 'difficulty', 'challenge');
    expect(lensOf(one).difficulty).toBe('challenge');
    expect(lensOf(withLens(one, 'difficulty', 'starter')).difficulty).toBe('starter');
    expect(lensOf(withLens(one, 'difficulty', null)).difficulty).toBeNull();
    expect(withLens(one, 'status', 'bogus').status).toBeNull();
    expect(cleared({ ...one, status: 'new', view: 'list' })).toEqual({
      ...EMPTY_PLATE_QUERY,
      view: 'list',
    });
  });
});

describe('the options of the lens', () => {
  const model = buildAtlas(
    CATALOGUE,
    [fullCall('locked-out-after-password-reset'), runningCall('recurring-midday-slowdowns')],
    null,
  );
  const group = (query = EMPTY_PLATE_QUERY, key = 'difficulty') =>
    lensGroups(model, query).find((one) => one.key === key);

  it('counts what each option would light, and leaves out options no mission has', () => {
    expect(group()?.options.map((o) => [o.label, o.count])).toEqual([
      ['Starter', 4],
      ['Standard', 5],
      ['Challenge', 4],
    ]);
    expect(group(undefined, 'status')?.options.map((o) => [o.label, o.count])).toEqual([
      ['New', 11],
      ['Attempted', 1],
      ['Completed', 1],
    ]);
    const crowd = buildAtlas(
      CATALOGUE.filter((s) => s.difficulty === 'starter'),
      [],
      null,
    );
    expect(lensGroups(crowd, EMPTY_PLATE_QUERY)[0]?.options.map((o) => o.label)).toEqual([
      'Starter',
    ]);
  });

  it('honours the other parts of the lens, so a count answers "what happens if I pick this"', () => {
    const narrowed = withLens(EMPTY_PLATE_QUERY, 'impact', 'high');
    expect(group(narrowed)?.options.map((o) => [o.label, o.count])).toEqual([
      ['Starter', 0],
      ['Standard', 0],
      ['Challenge', 4],
    ]);
    const lit = applyLens(model, lensOf(withLens(narrowed, 'difficulty', 'challenge')));
    expect(lit.count).toBe(4);
  });

  it('keeps a chosen option even when no mission has it', () => {
    const none = buildAtlas(CATALOGUE.slice(0, 1), [], null);
    const options = lensGroups(none, withLens(EMPTY_PLATE_QUERY, 'difficulty', 'challenge'))[0]
      ?.options;
    expect(options?.map((o) => o.value)).toEqual(['starter', 'challenge']);
    expect(options?.at(-1)?.count).toBe(0);
  });
});
