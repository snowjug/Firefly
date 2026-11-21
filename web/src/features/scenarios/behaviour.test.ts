// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { applyConfig } from '#shared/domain/config.ts';
import { ScenarioOverridesSchema, type ScenarioDefinition } from '#shared/domain/scenario.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { DIFFICULTIES, DIFFICULTY_RANK } from '#shared/domain/vocab.ts';
import { createInitialRuntime, openingMessage } from '#server/engine/session.ts';
import { getScenarioLibrary } from '#server/scenarios/index.ts';
import { toPublicScenario } from '#server/services/dto.ts';
import { CreateSessionSchema } from '#server/services/sessions.ts';
import { parseConfig, toOverrides } from './config-params.ts';
import { SAMPLE } from './testing/fixtures.ts';

// These tests start from an address (what the page reads), go through `parseConfig` and
// `toOverrides` (what the page sends), and then run the REAL scenario library, `applyConfig` and the
// engine's own starting state and opening line. They prove that a choice on the page changes the
// simulation, not only the words around it.

const library = getScenarioLibrary();
const SEED = 11;
const SCENARIOS = [SAMPLE.starter, SAMPLE.standard, SAMPLE.challenge, SAMPLE.followUp];

function definition(id: string): ScenarioDefinition {
  const found = library.find((scenario) => scenario.id === id);
  if (!found) throw new Error(`No scenario "${id}"`);
  return found;
}

function configure(id: string, search = '') {
  const base = definition(id);
  const scenario = toPublicScenario(base);
  const config = parseConfig(search, scenario);
  const { overrides, mode } = toOverrides(config, scenario);
  const effective = applyConfig(base, overrides, { mode, seed: SEED });
  return {
    base,
    config,
    overrides,
    mode,
    effective,
    customer: createInitialRuntime(effective).customer,
    opening: openingMessage(effective),
  };
}

describe.each(SCENARIOS)('%s', (id) => {
  it('is the scenario as written until something is changed', () => {
    const plain = configure(id);
    const authored = applyConfig(plain.base, {}, { seed: SEED });
    expect(plain.overrides).toEqual({});
    expect(plain.effective.config).toEqual(authored.config);
    expect(plain.opening).toBe(openingMessage(authored));
  });

  it('changes the facts in play and the customer profile with the difficulty', () => {
    const starter = configure(id, 'difficulty=starter');
    const challenge = configure(id, 'difficulty=challenge');
    const inPlay = (difficulty: 'starter' | 'challenge') =>
      definition(id)
        .hiddenFacts.filter((f) => DIFFICULTY_RANK[f.minDifficulty] <= DIFFICULTY_RANK[difficulty])
        .map((f) => f.id);

    expect(starter.effective.hiddenFacts.map((f) => f.id)).toEqual(inPlay('starter'));
    expect(challenge.effective.hiddenFacts.map((f) => f.id)).toEqual(inPlay('challenge'));
    expect(challenge.effective.hiddenFacts.length).toBeGreaterThanOrEqual(
      starter.effective.hiddenFacts.length,
    );

    expect(starter.customer.trust).toBeGreaterThan(challenge.customer.trust);
    expect(starter.customer.patience).toBeGreaterThan(challenge.customer.patience);
    expect(starter.effective.config.difficulty).toBe('starter');
    expect(challenge.effective.config.difficulty).toBe('challenge');
  });

  it('changes the starting state and the opening line with the starting temperature', () => {
    const calm = configure(id, 'temperature=calm');
    const angry = configure(id, 'temperature=angry');
    expect(calm.customer.temperature).toBeLessThan(angry.customer.temperature);
    expect(calm.customer.trust).toBeGreaterThan(angry.customer.trust);
    expect(calm.effective.config.startingTemperature).toBe('calm');
    expect(angry.effective.config.startingTemperature).toBe('angry');
    expect(calm.opening).not.toBe(angry.opening);
  });

  it('changes the opening line with the communication style', () => {
    const terse = configure(id, 'style=terse');
    const talkative = configure(id, 'style=talkative');
    const demanding = configure(id, 'style=demanding');
    expect(terse.opening).not.toBe(talkative.opening);
    expect(terse.opening.length).toBeLessThan(talkative.opening.length);
    expect(demanding.opening).not.toBe(talkative.opening);
    expect(terse.effective.config.style).toBe('terse');
  });

  it('changes the opening line and the strain on trust with the call stage', () => {
    const first = configure(id, 'stage=first-contact');
    const followUp = configure(id, 'stage=follow-up');
    const escalated = configure(id, 'stage=escalated');
    expect(followUp.opening).not.toBe(first.opening);
    expect(followUp.opening).toContain(followUp.effective.stageFrame.opening.slice(0, 30));
    expect(escalated.opening).not.toBe(followUp.opening);
    expect(first.customer.trust).toBeGreaterThan(followUp.customer.trust);
    expect(followUp.customer.trust).toBeGreaterThan(escalated.customer.trust);
    expect(escalated.effective.config.callStage).toBe('escalated');
  });

  it('swaps the impact variant and the urgency with the business impact', () => {
    const low = configure(id, 'impact=low');
    const high = configure(id, 'impact=high');
    expect(low.effective.impactVariant).toEqual(definition(id).impactVariants.low);
    expect(high.effective.impactVariant).toEqual(definition(id).impactVariants.high);
    expect(low.effective.impactVariant).not.toEqual(high.effective.impactVariant);
    expect(high.customer.urgency).toBeGreaterThan(low.customer.urgency);
    expect(low.opening).not.toBe(high.opening);
  });

  it('puts the chosen curveballs in the call, and none when switched off', () => {
    expect(configure(id, 'curveballs=none').effective.config.curveballTypes).toEqual([]);
    expect(configure(id, 'curveballs=deadline').effective.config.curveballTypes).toEqual([
      'deadline',
    ]);
    expect(
      configure(id, 'difficulty=challenge&curveballs=go-silent,ask-manager').effective.config
        .curveballTypes,
    ).toEqual(['go-silent', 'ask-manager']);
  });

  it('follows the difficulty for the curveballs when none are chosen', () => {
    for (const difficulty of DIFFICULTIES) {
      const { effective } = configure(id, `difficulty=${difficulty}`);
      expect(effective.config.curveballTypes.length).toBeLessThanOrEqual(
        DIFFICULTY_PROFILES[difficulty].defaultCurveballCount,
      );
    }
    expect(configure(id, 'difficulty=starter').effective.config.curveballTypes).toEqual([]);
  });

  it('turns the live hints switch into the practice mode', () => {
    expect(configure(id, 'hints=on&difficulty=standard').effective.config.mode).toBe('guided');
    expect(configure(id, 'hints=off&difficulty=starter').effective.config.mode).toBe('immersive');
    for (const difficulty of DIFFICULTIES) {
      const { effective, mode } = configure(id, `difficulty=${difficulty}`);
      expect(mode).toBe(DIFFICULTY_PROFILES[difficulty].defaultMode);
      expect(effective.config.mode).toBe(DIFFICULTY_PROFILES[difficulty].defaultMode);
    }
  });
});

describe('across the whole library', () => {
  it('a harder difficulty puts more hidden facts in play for most scenarios', () => {
    const grows = library.filter((scenario) => {
      const starter = configure(scenario.id, 'difficulty=starter').effective.hiddenFacts.length;
      const challenge = configure(scenario.id, 'difficulty=challenge').effective.hiddenFacts.length;
      return challenge > starter;
    });
    expect(grows.length).toBeGreaterThanOrEqual(3);
  });

  const QUERIES = [
    '',
    'difficulty=challenge&impact=high&temperature=angry&proficiency=expert&style=vague&stage=escalated',
    'difficulty=starter&impact=low&temperature=calm&proficiency=novice&style=non-native&stage=closure&hints=off',
    'curveballs=none&hints=on',
    'difficulty=challenge&curveballs=ask-manager,deadline,go-silent',
  ];

  it.each(library.map((scenario) => scenario.id))(
    '%s: every configuration is accepted by the real request schemas',
    (id) => {
      for (const search of QUERIES) {
        const { overrides, mode } = configure(id, search);
        expect(ScenarioOverridesSchema.safeParse(overrides).success).toBe(true);
        const request = {
          scenarioId: id,
          overrides,
          mode,
          clientRequestId: globalThis.crypto.randomUUID(),
        };
        const parsed = CreateSessionSchema.safeParse(request);
        expect(parsed.success).toBe(true);
        if (parsed.success) expect(parsed.data.mode).toBe(mode);
      }
    },
  );

  it('the request schema rejects what the page never sends', () => {
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
