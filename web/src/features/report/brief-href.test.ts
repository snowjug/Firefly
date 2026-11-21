import { describe, expect, it } from 'vitest';
import type { SessionDTO } from '#shared/domain/api.ts';
import {
  CALL_STAGES,
  DIFFICULTIES,
  IMPACTS,
  PROFICIENCIES,
  START_TEMPERATURES,
  STYLES,
} from '#shared/domain/vocab.ts';
import {
  SCENARIO_LIST,
  practiceLink,
  repeatLink,
  scenarioExists,
  toBriefHref,
} from './brief-href.ts';
import { CALLS, SCENARIO_INDEX } from './fixtures.ts';
import type { ScenarioIndex } from './scenario-index.ts';

const EXACT_KEYS = [
  'curveballs',
  'difficulty',
  'hints',
  'impact',
  'proficiency',
  'stage',
  'style',
  'temperature',
];

const ready: ScenarioIndex = {
  state: 'ready',
  byId: new Map(SCENARIO_INDEX.map((s) => [s.id, s] as const)),
};
const loading: ScenarioIndex = { state: 'loading' };
const unavailable: ScenarioIndex = { state: 'unavailable' };

function parse(href: string) {
  const url = new URL(href, 'https://firefly.test');
  return { path: url.pathname, query: url.searchParams };
}

describe('toBriefHref', () => {
  it('goes to the brief of the same scenario with exactly the agreed keys', () => {
    for (const call of Object.values(CALLS)) {
      const { path, query } = parse(toBriefHref(call.session));
      expect(path).toBe(`/scenarios/${call.session.scenario.scenarioId}/brief`);
      const keys = [...query.keys()].sort();
      // `curveballs` is left out only when unexpected turns were on and none came up.
      const expected = EXACT_KEYS.filter((key) => key !== 'curveballs' || keys.includes(key));
      expect(keys, call.name).toEqual(expected);
    }
  });

  it('writes values the scenario pages understand', () => {
    for (const call of Object.values(CALLS)) {
      const { query } = parse(toBriefHref(call.session));
      expect(DIFFICULTIES).toContain(query.get('difficulty'));
      expect(IMPACTS).toContain(query.get('impact'));
      expect(START_TEMPERATURES).toContain(query.get('temperature'));
      expect(PROFICIENCIES).toContain(query.get('proficiency'));
      expect(STYLES).toContain(query.get('style'));
      expect(CALL_STAGES).toContain(query.get('stage'));
      expect(['on', 'off']).toContain(query.get('hints'));
    }
  });

  it('says `none` when unexpected turns were off, and hints on or off from the practice mode', () => {
    expect(parse(toBriefHref(CALLS.strong.session)).query.get('curveballs')).toBe('none');
    expect(parse(toBriefHref(CALLS.strong.session)).query.get('hints')).toBe('off');
    expect(parse(toBriefHref(CALLS.short.session)).query.get('hints')).toBe('on');
  });

  it('asks for the kind that came up when unexpected turns were on, and for the default when none did', () => {
    expect(parse(toBriefHref(CALLS.curveball.session)).query.get('curveballs')).toBe(
      CALLS.curveball.report.curveball?.type,
    );
    const unreported: SessionDTO = {
      ...CALLS.curveball.session,
      report: CALLS.curveball.session.report && {
        ...CALLS.curveball.session.report,
        curveball: null,
      },
    };
    expect(parse(toBriefHref(unreported)).query.has('curveballs')).toBe(false);
  });

  it('encodes an id that is not a plain word', () => {
    const odd: SessionDTO = {
      ...CALLS.strong.session,
      scenario: { ...CALLS.strong.session.scenario, scenarioId: 'a b/c' },
    };
    expect(parse(toBriefHref(odd)).path).toBe('/scenarios/a%20b%2Fc/brief');
  });
});

describe('scenarioExists', () => {
  it('lets the list of scenarios decide once it has arrived', () => {
    expect(scenarioExists(ready, 'entra-mfa-lockout', CALLS.strong.session)).toBe(true);
    expect(scenarioExists(ready, 'recurring-midday-slowdowns', CALLS.legacy.session)).toBe(false);
  });

  it('takes a call without a product to name a retired scenario until it hears otherwise', () => {
    for (const index of [loading, unavailable]) {
      expect(scenarioExists(index, 'recurring-midday-slowdowns', CALLS.legacy.session)).toBe(false);
      expect(scenarioExists(index, 'teams-recordings-missing', CALLS.strong.session)).toBe(true);
    }
  });
});

describe('repeatLink', () => {
  it('opens the brief with the same settings when the scenario exists', () => {
    const link = repeatLink(CALLS.strong.session, ready);
    expect(link.available).toBe(true);
    expect(link.to).toBe(toBriefHref(CALLS.strong.session));
  });

  it('opens the scenario list instead when the scenario is gone', () => {
    expect(repeatLink(CALLS.legacy.session, ready)).toEqual({
      to: SCENARIO_LIST,
      available: false,
    });
    expect(repeatLink(CALLS.legacy.session, unavailable)).toEqual({
      to: SCENARIO_LIST,
      available: false,
    });
  });

  it('opens the brief while the list of scenarios is still on its way, for a call that has a product', () => {
    expect(repeatLink(CALLS.strong.session, loading).available).toBe(true);
  });
});

describe('practiceLink', () => {
  it('opens the workspace on the suggested scenario and difficulty, with the scenario\u2019s title', () => {
    const next = CALLS.weak.report.nextPractice;
    const link = practiceLink(CALLS.weak.session, next, ready);
    const { path, query } = parse(link.to);
    expect(path).toBe('/scenarios');
    expect(query.get('scenario')).toBe(next.suggestedScenarioId);
    expect(query.get('difficulty')).toBe(next.suggestedDifficulty);
    expect(link.scenario).toEqual({ title: 'Shared calendar is not updating', product: 'Outlook' });
  });

  it('uses the title in the report when the list of scenarios has not arrived', () => {
    const link = practiceLink(CALLS.weak.session, CALLS.weak.report.nextPractice, loading);
    expect(link.scenario).toEqual({ title: 'Shared calendar is not updating', product: null });
  });

  it('is just the scenario list when the suggested scenario no longer exists', () => {
    const next = CALLS.legacy.report.nextPractice;
    expect(practiceLink(CALLS.legacy.session, next, ready)).toEqual({
      to: SCENARIO_LIST,
      scenario: null,
    });
    expect(practiceLink(CALLS.legacy.session, next, unavailable).scenario).toBeNull();
  });

  it('is just the scenario list when no scenario is suggested', () => {
    const next = {
      ...CALLS.weak.report.nextPractice,
      suggestedScenarioId: null,
      suggestedScenarioTitle: null,
    };
    expect(practiceLink(CALLS.weak.session, next, ready)).toEqual({
      to: SCENARIO_LIST,
      scenario: null,
    });
  });
});
