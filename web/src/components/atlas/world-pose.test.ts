import { describe, expect, it } from 'vitest';
import { coreParams } from './core-params.ts';
import { worldPoseFor } from './world-pose.ts';
import { makeScenario } from '../scenario/scenario-fixtures.ts';
import { defaultChoices, type SetupChoices } from '../scenario/setup-model.ts';

const choices = (over: Partial<SetupChoices> = {}): SetupChoices => ({
  ...defaultChoices(makeScenario()),
  ...over,
});

describe('the field behind the calibration page', () => {
  it('is tighter, warmer and less open for a call with more riding on it and a less settled customer', () => {
    const gentle = worldPoseFor(
      coreParams(choices({ impact: 'low', startingTemperature: 'calm', difficulty: 'starter' })),
    );
    const hard = worldPoseFor(
      coreParams(
        choices({ impact: 'high', startingTemperature: 'angry', difficulty: 'challenge' }),
      ),
    );
    expect(hard.tension).toBeGreaterThan(gentle.tension);
    expect(hard.warmth).toBeGreaterThan(gentle.warmth);
    expect(hard.open).toBeLessThan(gentle.open);
    expect(hard.energy).toBeGreaterThan(gentle.energy);
  });

  it('keeps a form quiet: never as tense as the most escalated call, and always within 0 to 1', () => {
    for (const impact of ['low', 'medium', 'high'] as const) {
      for (const startingTemperature of ['calm', 'anxious', 'frustrated', 'angry'] as const) {
        const pose = worldPoseFor(coreParams(choices({ impact, startingTemperature })));
        for (const value of Object.values(pose)) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
        expect(pose.tension).toBeLessThan(0.7);
        expect(pose.energy).toBeLessThan(0.5);
      }
    }
  });

  it('answers curveballs: switching them off lowers the tension', () => {
    const on = worldPoseFor(coreParams(choices({ curveballMode: 'recommended' })));
    const off = worldPoseFor(coreParams(choices({ curveballMode: 'none' })));
    expect(off.tension).toBeLessThan(on.tension);
  });
});
