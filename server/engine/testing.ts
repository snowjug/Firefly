import { applyConfig, type EffectiveScenario } from '#shared/domain/config.ts';
import { ScenarioDefinitionSchema, type ScenarioOverrides } from '#shared/domain/scenario.ts';
import exemplar from '../scenarios/library/locked-out-after-password-reset.ts';

// Helpers shared by engine tests.

export function makeScenario(overrides: ScenarioOverrides = {}, seed = 7): EffectiveScenario {
  const base = ScenarioDefinitionSchema.parse(exemplar);
  return applyConfig(base, { difficulty: 'standard', ...overrides }, { seed });
}
