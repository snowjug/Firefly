// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ISSUE_TYPES, ISSUE_TYPE_LABELS, DIFFICULTY_RANK } from '#shared/domain/vocab.ts';
import {
  NO_FILTERS,
  activeFilterCount,
  countLabel,
  filterScenarios,
  groupByIssue,
  listOrder,
  matchesQuery,
  readFilters,
  writeFilters,
  type Filters,
} from './catalogue.ts';
import { defaultConfig, parseConfig } from './config-params.ts';
import { SAMPLE, publicScenarios, scenarioById } from './testing/fixtures.ts';
import { normaliseSearch, workspaceSearch } from './workspace-url.ts';

const all = publicScenarios();
const titles = (list: readonly { title: string }[]) => list.map((s) => s.title);

describe('search', () => {
  it('finds a scenario by words in its title, summary, tags, customer and issue type', () => {
    const one = scenarioById(SAMPLE.challenge);
    expect(matchesQuery(one, 'checkout')).toBe(true);
    expect(matchesQuery(one, one.summary.split(' ').slice(2, 4).join(' '))).toBe(true);
    expect(matchesQuery(one, one.tags[0] as string)).toBe(true);
    expect(matchesQuery(one, one.persona.name.split(' ')[1] as string)).toBe(true);
    expect(matchesQuery(one, one.persona.role)).toBe(true);
    expect(matchesQuery(one, one.persona.organisation)).toBe(true);
    expect(matchesQuery(one, ISSUE_TYPE_LABELS[one.issueType])).toBe(true);
  });

  it('needs every word, in any order, ignoring case and accents', () => {
    const one = scenarioById(SAMPLE.challenge);
    expect(matchesQuery(one, '  CLOCK   checkout ')).toBe(true);
    expect(matchesQuery(one, 'checkout banana')).toBe(false);
    expect(matchesQuery(one, 'Dèclan')).toBe(true);
    expect(matchesQuery(one, '')).toBe(true);
    expect(matchesQuery(one, '   ')).toBe(true);
  });

  it('narrows the real library', () => {
    expect(filterScenarios(all, { ...NO_FILTERS, q: 'invoice' }).map((s) => s.id)).toContain(
      'invoice-shock-and-cancellation-threat',
    );
    expect(filterScenarios(all, { ...NO_FILTERS, q: 'zzzz-no-such-thing' })).toEqual([]);
  });
});

describe('filters', () => {
  it('combine, and each narrows on its own', () => {
    const byIssue = filterScenarios(all, { ...NO_FILTERS, issue: 'slow-performance' });
    expect(byIssue.length).toBeGreaterThan(0);
    expect(byIssue.every((s) => s.issueType === 'slow-performance')).toBe(true);

    const byDifficulty = filterScenarios(all, { ...NO_FILTERS, difficulty: 'challenge' });
    expect(byDifficulty.every((s) => s.difficulty === 'challenge')).toBe(true);

    const byImpact = filterScenarios(all, { ...NO_FILTERS, impact: 'low' });
    expect(byImpact.every((s) => s.impact === 'low')).toBe(true);

    const both = filterScenarios(all, {
      ...NO_FILTERS,
      issue: 'slow-performance',
      difficulty: 'challenge',
    });
    expect(titles(both)).toEqual(titles(byIssue.filter((s) => s.difficulty === 'challenge')));
    expect(both.length).toBeLessThan(byIssue.length);
  });

  it('read from the address, ignoring what is not valid', () => {
    const filters = readFilters(
      new URLSearchParams('q=billing&f_issue=how-to&f_difficulty=hard&f_impact=high'),
    );
    expect(filters).toEqual({ q: 'billing', issue: 'how-to', difficulty: null, impact: 'high' });
    expect(readFilters(new URLSearchParams('difficulty=challenge&impact=high'))).toEqual(
      NO_FILTERS,
    );
  });

  it('use keys that never clash with the call configuration', () => {
    const params = new URLSearchParams();
    writeFilters({ q: 'x', issue: 'how-to', difficulty: 'starter', impact: 'low' }, params);
    expect([...params.keys()]).toEqual(['q', 'f_issue', 'f_difficulty', 'f_impact']);
  });

  it('are counted, and a search of spaces is not a filter', () => {
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...NO_FILTERS, q: '   ' })).toBe(0);
    expect(
      activeFilterCount({ q: 'a', issue: 'how-to', difficulty: 'starter', impact: 'low' }),
    ).toBe(4);
  });
});

describe('order', () => {
  const groups = groupByIssue(all);

  it('groups by issue type in the vocabulary order and leaves out empty groups', () => {
    const order = groups.map((g) => g.issueType);
    expect(order).toEqual(ISSUE_TYPES.filter((type) => all.some((s) => s.issueType === type)));
    expect(groupByIssue([])).toEqual([]);
    expect(groups.every((g) => g.label === ISSUE_TYPE_LABELS[g.issueType])).toBe(true);
  });

  it('puts the gentlest first inside a group, then by title', () => {
    for (const group of groups) {
      for (let i = 1; i < group.scenarios.length; i++) {
        const a = group.scenarios[i - 1];
        const b = group.scenarios[i];
        if (!a || !b) continue;
        const ranks = DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty];
        expect(ranks <= 0).toBe(true);
        if (ranks === 0) expect(a.title.localeCompare(b.title)).toBeLessThanOrEqual(0);
      }
    }
  });

  it('lists every scenario exactly once', () => {
    expect(listOrder(groups)).toHaveLength(all.length);
    expect(new Set(listOrder(groups).map((s) => s.id)).size).toBe(all.length);
  });

  it('counts in words', () => {
    expect(countLabel(13, 13)).toBe('13 scenarios');
    expect(countLabel(3, 13)).toBe('3 of 13 scenarios');
    expect(countLabel(0, 13)).toBe('0 of 13 scenarios');
    expect(countLabel(1, 1)).toBe('1 scenario');
  });
});

describe('the workspace address', () => {
  const scenario = scenarioById(SAMPLE.standard);
  const filters: Filters = {
    q: 'team access',
    issue: 'sign-in-access',
    difficulty: null,
    impact: 'medium',
  };

  it('writes filters, then the scenario, then its configuration, in a fixed order', () => {
    const config = parseConfig('hints=on&difficulty=challenge', scenario);
    expect(workspaceSearch(filters, { scenarioId: scenario.id, scenario, config })).toBe(
      `?q=team+access&f_issue=sign-in-access&f_impact=medium&scenario=${scenario.id}&difficulty=challenge&hints=on`,
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
