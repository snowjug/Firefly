// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { practiceLink, toBriefHref } from '../report/brief-href.ts';
import { CALLS } from '../report/fixtures.ts';
import type { ScenarioIndex } from '../report/scenario-index.ts';
import { NO_FILTERS, readFilters } from './catalogue.ts';
import { hintsOn, inspectConfig, parseConfig } from './config-params.ts';
import { curveballChoices } from './labels.ts';
import { SAMPLE, scenarioById } from './testing/fixtures.ts';

// The report links back into the scenario pages ("Repeat scenario", "Practise this scenario"), and
// builds the addresses itself, with the keys agreed with these pages. These tests feed the report's
// own link builders into this feature's readers, so a key or a value that drifts apart on either
// side fails here and not in front of a trainee.

const search = (href: string) => new URL(href, 'https://firefly.test').search;

/**
 * One of the report's saved calls, as if it had been made on this scenario: when the call had an
 * unexpected turn, it is one the scenario offers, at a difficulty that allows one.
 */
function onScenario(session: SessionDTO, scenario: ReturnType<typeof scenarioById>): SessionDTO {
  const type = curveballChoices(scenario)[0];
  const withTurn = session.report?.curveball && type;
  return {
    ...session,
    scenario: {
      ...session.scenario,
      scenarioId: scenario.id,
      config: withTurn
        ? { ...session.scenario.config, difficulty: 'challenge' }
        : session.scenario.config,
    },
    report:
      session.report && session.report.curveball && type
        ? { ...session.report, curveball: { ...session.report.curveball, type } }
        : session.report,
  };
}

describe('the brief address the report writes ("Repeat scenario")', () => {
  const scenario = scenarioById(SAMPLE.challenge);

  it('is read in full by the brief: no key is ignored and every setting comes back as it was saved', () => {
    for (const call of Object.values(CALLS)) {
      const session = onScenario(call.session, scenario);
      const { config, ignored } = inspectConfig(search(toBriefHref(session)), scenario);
      const saved = session.scenario.config;
      expect(ignored, call.name).toEqual([]);
      expect(config.difficulty, call.name).toBe(saved.difficulty);
      expect(config.impact, call.name).toBe(saved.impact);
      expect(config.temperature, call.name).toBe(saved.startingTemperature);
      expect(config.proficiency, call.name).toBe(saved.proficiency);
      expect(config.style, call.name).toBe(saved.style);
      expect(config.stage, call.name).toBe(saved.callStage);
      expect(hintsOn(config), call.name).toBe(saved.mode === 'guided');
    }
  });

  it('switches unexpected turns off when the call had them off', () => {
    const session = onScenario(CALLS.strong.session, scenario);
    expect(session.scenario.config.curveballsEnabled).toBe(false);
    expect(inspectConfig(search(toBriefHref(session)), scenario).config.curveballs).toEqual({
      mode: 'none',
    });
  });

  it('asks for the kind of unexpected turn that came up, when the scenario offers it', () => {
    const type = curveballChoices(scenario)[0];
    expect(type).toBeDefined();
    const session = onScenario(CALLS.curveball.session, scenario);
    expect(session.report?.curveball?.type).toBe(type);
    const { config, ignored } = inspectConfig(search(toBriefHref(session)), scenario);
    expect(ignored).toEqual([]);
    expect(config.curveballs).toEqual({ mode: 'choose', types: [type] });
  });

  it('leaves the voice out: the voice is chosen on these pages and is not part of a saved call', () => {
    const session = onScenario(CALLS.strong.session, scenario);
    expect(new URLSearchParams(search(toBriefHref(session))).has('voice')).toBe(false);
  });
});

describe('the workspace address the report writes ("Practise this scenario")', () => {
  const scenario = scenarioById(SAMPLE.standard);
  const index: ScenarioIndex = {
    state: 'ready',
    byId: new Map([
      [
        scenario.id,
        {
          id: scenario.id,
          title: scenario.title,
          difficulty: scenario.difficulty,
          product: { name: scenario.product.name },
        },
      ],
    ]),
  };

  it('names the scenario and the difficulty, and the workspace opens on both with no filter', () => {
    const next = {
      suggestedScenarioId: scenario.id,
      suggestedScenarioTitle: scenario.title,
      suggestedDifficulty: 'challenge',
    } as CoachingReport['nextPractice'];
    const { to } = practiceLink(CALLS.strong.session, next, index);
    const url = new URL(to, 'https://firefly.test');
    expect(url.pathname).toBe('/scenarios');
    expect([...url.searchParams.keys()].sort()).toEqual(['difficulty', 'scenario']);
    expect(url.searchParams.get('scenario')).toBe(scenario.id);
    expect(parseConfig(url.searchParams, scenario).difficulty).toBe('challenge');
    expect(readFilters(url.searchParams)).toEqual(NO_FILTERS);
  });
});
