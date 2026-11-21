// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  curveballChoices,
  complicationCount,
  impactLabel,
  minutesLabel,
  moodLabel,
  productLine,
} from './labels.ts';
import { SAMPLE, scenarioById } from './testing/fixtures.ts';

describe('wording', () => {
  it('uses the first word of the vocabulary for a mood', () => {
    expect(moodLabel('calm')).toBe('Calm');
    expect(moodLabel('anxious')).toBe('Anxious');
    expect(moodLabel('frustrated')).toBe('Frustrated');
    // "Angry / escalating" is long for a button.
    expect(moodLabel('angry')).toBe('Angry');
  });

  it('says the impact and the time in a few words', () => {
    expect(impactLabel('high')).toBe('High');
    expect(minutesLabel(12)).toBe('About 12 min');
  });

  it('counts complications in words', () => {
    expect(complicationCount(0)).toBe('no complications');
    expect(complicationCount(1)).toBe('one complication');
    expect(complicationCount(2)).toBe('two complications');
  });

  it('writes the product on one line, with its area', () => {
    expect(productLine(scenarioById(SAMPLE.standard).product)).toBe(
      'Microsoft Teams \u00b7 Meetings',
    );
    expect(productLine({ ...scenarioById(SAMPLE.standard).product, area: '' })).toBe(
      'Microsoft Teams',
    );
  });
});

describe('curveballChoices', () => {
  it('lists what the scenario offers in the order of the vocabulary', () => {
    expect(curveballChoices({ curveballOptions: ['deadline', 'ask-manager'] })).toEqual([
      'ask-manager',
      'deadline',
    ]);
  });

  it('offers none to choose from when the server does not send the list', () => {
    expect(curveballChoices({})).toEqual([]);
  });
});
