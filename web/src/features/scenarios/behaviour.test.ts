// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { applyConfig } from '#shared/domain/config.ts';
import { ScenarioOverridesSchema, type ScenarioDefinition } from '#shared/domain/scenario.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { DIFFICULTIES, DIFFICULTY_RANK } from '#shared/domain/vocab.ts';
import { getScenarioLibrary } from '#server/scenarios/index.ts';
import { toPublicScenario } from '#server/services/dto.ts';
import { CreateSessionSchema } from '#server/services/sessions.ts';
import { curveballChoices } from './labels.ts';
import { parseConfig, toOverrides } from './config-params.ts';
import { timeOfDayFor } from './use-start-call.ts';

// These tests start from an address (what the page reads), go through `parseConfig` and
// `toOverrides` (what the page sends), and then run the REAL scenario library and the real request
// schemas and `applyConfig`. They prove that what the page sends is accepted, and that every choice
// on the page ends up in the call's configuration, whichever scenarios the library holds. They name
// no scenario and read no scenario text, so they follow the library when it changes.

const library = getScenarioLibrary();
const SEED = 11;

function configure(base: ScenarioDefinition, search = '') {
  const scenario = toPublicScenario(base);
  const config = parseConfig(search, scenario);
  const { overrides, mode } = toOverrides(config, scenario);
  return {
    scenario,
    config,
    overrides,
    mode,
    effective: applyConfig(base, overrides, { mode, seed: SEED }),
  };
}

describe.each(library.map((scenario) => [scenario.id, scenario] as const))('%s', (_id, base) => {
  it('is the scenario as written until something is changed', () => {
    const plain = configure(base);
    const authored = applyConfig(base, {}, { seed: SEED });
    expect(plain.overrides).toEqual({});
    expect(plain.effective.config).toEqual(authored.config);
  });

  it('puts every choice on the page into the call\u2019s configuration', () => {
    const { effective } = configure(
      base,
      'difficulty=challenge&impact=high&temperature=angry&proficiency=expert&style=vague&stage=escalated&hints=off',
    );
    expect(effective.config).toMatchObject({
      difficulty: 'challenge',
      impact: 'high',
      startingTemperature: 'angry',
      proficiency: 'expert',
      style: 'vague',
      callStage: 'escalated',
      mode: 'immersive',
    });
    const other = configure(
      base,
      'difficulty=starter&impact=low&temperature=calm&proficiency=novice&style=terse&stage=closure&hints=on',
    );
    expect(other.effective.config).toMatchObject({
      difficulty: 'starter',
      impact: 'low',
      startingTemperature: 'calm',
      proficiency: 'novice',
      style: 'terse',
      callStage: 'closure',
      mode: 'guided',
    });
  });

  it('changes the facts in play with the difficulty, never taking one away as it gets harder', () => {
    const inPlay = (difficulty: 'starter' | 'challenge') =>
      base.hiddenFacts
        .filter((fact) => DIFFICULTY_RANK[fact.minDifficulty] <= DIFFICULTY_RANK[difficulty])
        .map((fact) => fact.id);
    const starter = configure(base, 'difficulty=starter').effective;
    const challenge = configure(base, 'difficulty=challenge').effective;
    expect(starter.hiddenFacts.map((fact) => fact.id)).toEqual(inPlay('starter'));
    expect(challenge.hiddenFacts.map((fact) => fact.id)).toEqual(inPlay('challenge'));
    expect(challenge.hiddenFacts.length).toBeGreaterThanOrEqual(starter.hiddenFacts.length);
  });

  it('puts the chosen complication in the call, and none when they are switched off', () => {
    const [offered] = curveballChoices(toPublicScenario(base));
    expect(configure(base, 'curveballs=none').effective.config.curveballTypes).toEqual([]);
    if (offered) {
      expect(configure(base, `curveballs=${offered}`).effective.config.curveballTypes).toEqual([
        offered,
      ]);
    }
  });

  it('follows the difficulty for the complications when none are chosen', () => {
    for (const difficulty of DIFFICULTIES) {
      const { effective } = configure(base, `difficulty=${difficulty}`);
      expect(effective.config.curveballTypes.length).toBeLessThanOrEqual(
        DIFFICULTY_PROFILES[difficulty].defaultCurveballCount,
      );
    }
    expect(configure(base, 'difficulty=starter').effective.config.curveballTypes).toEqual([]);
  });

  it('turns the live hints switch into the practice mode', () => {
    expect(configure(base, 'hints=on&difficulty=standard').effective.config.mode).toBe('guided');
    expect(configure(base, 'hints=off&difficulty=starter').effective.config.mode).toBe('immersive');
    for (const difficulty of DIFFICULTIES) {
      const { effective, mode } = configure(base, `difficulty=${difficulty}`);
      expect(mode).toBe(DIFFICULTY_PROFILES[difficulty].defaultMode);
      expect(effective.config.mode).toBe(DIFFICULTY_PROFILES[difficulty].defaultMode);
    }
  });

  it('is accepted by the real request schemas, for every kind of choice and any time of day', () => {
    const queries = [
      '',
      'difficulty=challenge&impact=high&temperature=angry&proficiency=expert&style=vague&stage=escalated',
      'difficulty=starter&impact=low&temperature=calm&proficiency=novice&style=non-native&stage=closure&hints=off',
      'curveballs=none&hints=on',
      'difficulty=challenge&voice=voice-c',
    ];
    for (const search of queries) {
      const { overrides, mode } = configure(base, search);
      expect(ScenarioOverridesSchema.safeParse(overrides).success).toBe(true);
      for (const at of [9, 14, 20]) {
        const request = {
          scenarioId: base.id,
          overrides,
          mode,
          timeOfDay: timeOfDayFor(new Date(2026, 10, 21, at)),
          clientRequestId: globalThis.crypto.randomUUID(),
        };
        const parsed = CreateSessionSchema.safeParse(request);
        expect(parsed.success).toBe(true);
        if (parsed.success) expect(parsed.data.mode).toBe(mode);
      }
    }
  });
});

describe('the request schema', () => {
  it('rejects what the page never sends', () => {
    expect(
      CreateSessionSchema.safeParse({
        scenarioId: 'x',
        overrides: { curveballs: ['a', 'b', 'c', 'd', 'e'] },
      }).success,
    ).toBe(false);
    expect(
      CreateSessionSchema.safeParse({ scenarioId: 'x', clientRequestId: 'short' }).success,
    ).toBe(false);
  });
});
