import { describe, expect, it } from 'vitest';
import { applyConfig } from '#shared/domain/config.ts';
import { ScenarioOverridesSchema, type ScenarioOverrides } from '#shared/domain/scenario.ts';
import {
  CALL_STAGES,
  CURVEBALL_TYPES,
  DIFFICULTIES,
  IMPACTS,
  PROFICIENCIES,
  START_TEMPERATURES,
  STYLES,
} from '#shared/domain/vocab.ts';
import { getScenarioLibrary } from '#server/scenarios/index.ts';
import { practiceHref, toBriefHref } from './brief-href.ts';
import { CALL_NAMES, callFixtures } from './fixtures.ts';

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

function parse(href: string) {
  const url = new URL(href, 'https://firefly.test');
  return { path: url.pathname, query: url.searchParams };
}

describe('toBriefHref', () => {
  it('goes to the brief of the same scenario with exactly the agreed keys', async () => {
    const calls = await callFixtures();
    for (const name of CALL_NAMES) {
      const { session } = calls[name];
      const { path, query } = parse(toBriefHref(session));
      expect(path).toBe(`/scenarios/${session.scenario.scenarioId}/brief`);
      const keys = [...query.keys()].sort();
      // `curveballs` is left out only when unexpected turns were on and none came up.
      const expected = EXACT_KEYS.filter((key) => key !== 'curveballs' || keys.includes(key));
      expect(keys, name).toEqual(expected);
    }
  });

  it('writes values the scenario pages understand', async () => {
    const calls = await callFixtures();
    for (const name of CALL_NAMES) {
      const { query } = parse(toBriefHref(calls[name].session));
      expect(DIFFICULTIES).toContain(query.get('difficulty'));
      expect(IMPACTS).toContain(query.get('impact'));
      expect(START_TEMPERATURES).toContain(query.get('temperature'));
      expect(PROFICIENCIES).toContain(query.get('proficiency'));
      expect(STYLES).toContain(query.get('style'));
      expect(CALL_STAGES).toContain(query.get('stage'));
      expect(['on', 'off']).toContain(query.get('hints'));
      const curveballs = query.get('curveballs');
      if (curveballs !== null && curveballs !== 'none') {
        for (const type of curveballs.split(',')) expect(CURVEBALL_TYPES).toContain(type);
      }
    }
  });

  it('round-trips: the query rebuilds the call settings through the real config code', async () => {
    const library = getScenarioLibrary();
    const calls = await callFixtures();
    for (const name of CALL_NAMES) {
      const { session } = calls[name];
      const { query } = parse(toBriefHref(session));
      const curveballs = query.get('curveballs');
      const overrides: ScenarioOverrides = {
        difficulty: query.get('difficulty') as ScenarioOverrides['difficulty'],
        impact: query.get('impact') as ScenarioOverrides['impact'],
        startingTemperature: query.get('temperature') as ScenarioOverrides['startingTemperature'],
        proficiency: query.get('proficiency') as ScenarioOverrides['proficiency'],
        style: query.get('style') as ScenarioOverrides['style'],
        callStage: query.get('stage') as ScenarioOverrides['callStage'],
        ...(curveballs === null
          ? {}
          : { curveballs: curveballs === 'none' ? [] : (curveballs.split(',') as never) }),
      };
      expect(ScenarioOverridesSchema.safeParse(overrides).success, name).toBe(true);
      const base = library.find((s) => s.id === session.scenario.scenarioId);
      if (!base) throw new Error('scenario missing');
      const rebuilt = applyConfig(base, overrides, {
        mode: query.get('hints') === 'on' ? 'guided' : 'immersive',
      }).config;
      const { config } = session.scenario;
      expect(rebuilt.difficulty, name).toBe(config.difficulty);
      expect(rebuilt.impact, name).toBe(config.impact);
      expect(rebuilt.startingTemperature, name).toBe(config.startingTemperature);
      expect(rebuilt.proficiency, name).toBe(config.proficiency);
      expect(rebuilt.style, name).toBe(config.style);
      expect(rebuilt.callStage, name).toBe(config.callStage);
      expect(rebuilt.mode, name).toBe(config.mode);
      if (curveballs !== null) {
        expect(rebuilt.curveballTypes.length > 0, name).toBe(config.curveballsEnabled);
      }
    }
  });

  it('says `none` when unexpected turns were off, and hints on or off from the practice mode', async () => {
    const { strong, short } = await callFixtures();
    expect(parse(toBriefHref(strong.session)).query.get('curveballs')).toBe('none');
    expect(parse(toBriefHref(strong.session)).query.get('hints')).toBe('off');
    expect(parse(toBriefHref(short.session)).query.get('hints')).toBe('on');
  });

  it('asks for the kind that came up when unexpected turns were on, and for the default when none did', async () => {
    const { curveball } = await callFixtures();
    expect(curveball.session.scenario.config.curveballsEnabled).toBe(true);
    expect(parse(toBriefHref(curveball.session)).query.get('curveballs')).toBe(
      curveball.report.curveball?.type,
    );
    // The same call, had no unexpected turn been reported.
    const unreported = {
      ...curveball.session,
      report: curveball.session.report && { ...curveball.session.report, curveball: null },
    };
    expect(parse(toBriefHref(unreported)).query.has('curveballs')).toBe(false);
  });
});

describe('practiceHref', () => {
  it('opens the workspace on the suggested scenario and difficulty', async () => {
    const { weak } = await callFixtures();
    const next = weak.report.nextPractice;
    expect(next.suggestedScenarioId).not.toBeNull();
    const { path, query } = parse(practiceHref(next));
    expect(path).toBe('/scenarios');
    expect(query.get('scenario')).toBe(next.suggestedScenarioId);
    expect(query.get('difficulty')).toBe(next.suggestedDifficulty);
  });

  it('is just the workspace when no scenario is suggested', async () => {
    const { weak } = await callFixtures();
    const none = {
      ...weak.report.nextPractice,
      suggestedScenarioId: null,
      suggestedScenarioTitle: null,
    };
    expect(practiceHref(none)).toBe('/scenarios');
  });
});
