// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, START_TEMPERATURES, CALL_STAGES } from '#shared/domain/vocab.ts';
import type { CallConfig } from './config-params.ts';
import { customerPreview, LEVEL_STEPS, type Level } from './customer-preview.ts';

const base: Pick<CallConfig, 'difficulty' | 'impact' | 'stage' | 'temperature'> = {
  difficulty: 'standard',
  impact: 'medium',
  stage: 'first-contact',
  temperature: 'frustrated',
};
const rank = (level: Level) => LEVEL_STEPS[level];

describe('the customer at the start of the call', () => {
  it('is gentler on Starter and harder on Challenge, for patience and for trust', () => {
    const [starter, standard, challenge] = DIFFICULTIES.map((difficulty) =>
      customerPreview({ ...base, difficulty }),
    );
    expect(rank(starter!.patience)).toBeGreaterThan(rank(challenge!.patience));
    expect(rank(starter!.trust)).toBeGreaterThan(rank(challenge!.trust));
    expect(rank(standard!.patience)).toBeLessThanOrEqual(rank(starter!.patience));
    expect(rank(standard!.patience)).toBeGreaterThanOrEqual(rank(challenge!.patience));
  });

  it('changes with the starting mood: calm is more patient than angry', () => {
    const calm = customerPreview({ ...base, temperature: 'calm' });
    const angry = customerPreview({ ...base, temperature: 'angry' });
    expect(rank(calm.patience)).toBeGreaterThan(rank(angry.patience));
    expect(rank(calm.trust)).toBeGreaterThan(rank(angry.trust));
  });

  it('changes with the call stage: an escalated case starts with less trust than a first call', () => {
    const first = customerPreview({ ...base, stage: 'first-contact' });
    const escalated = customerPreview({ ...base, stage: 'escalated' });
    expect(rank(escalated.trust)).toBeLessThan(rank(first.trust));
  });

  it('names the mood in a word, and draws "anxious" as the amber concerned state', () => {
    expect(customerPreview({ ...base, temperature: 'anxious' })).toMatchObject({
      mood: 'Anxious',
      state: 'concerned',
    });
    expect(customerPreview({ ...base, temperature: 'angry' })).toMatchObject({
      mood: 'Angry',
      state: 'angry',
    });
  });

  it('gives words, never the numbers behind them', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const temperature of START_TEMPERATURES) {
        for (const stage of CALL_STAGES) {
          const preview = customerPreview({ difficulty, temperature, stage, impact: 'high' });
          expect(['low', 'medium', 'high']).toContain(preview.patience);
          expect(['low', 'medium', 'high']).toContain(preview.trust);
          expect(JSON.stringify(preview)).not.toMatch(/\d/);
        }
      }
    }
  });
});
