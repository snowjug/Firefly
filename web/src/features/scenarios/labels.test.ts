// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { wordCount } from '#shared/domain/scenario.ts';
import { PRODUCT_IDS } from '#shared/domain/vocab.ts';
import {
  MODE_SENTENCE,
  PRODUCT_SHORT,
  RAIL_ORDER,
  STAGE_SHORT,
  cardTitle,
  curveballChoices,
  complicationCount,
  impactLabel,
  metaLine,
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

describe('what a card says', () => {
  it('writes how a scenario starts as three short phrases', () => {
    expect(metaLine(scenarioById(SAMPLE.challenge))).toBe(
      'High impact \u00b7 Angry \u00b7 Escalated',
    );
    expect(metaLine(scenarioById(SAMPLE.followUp))).toBe(
      'Medium impact \u00b7 Frustrated \u00b7 Follow-up',
    );
  });

  it('names every call stage in a word or two', () => {
    expect(Object.values(STAGE_SHORT).map(wordCount)).toEqual([2, 1, 1, 1]);
  });

  it('uses the short title, and the full one when there is no short one', () => {
    const scenario = scenarioById(SAMPLE.standard);
    expect(cardTitle(scenario)).toBe('Meeting recordings missing');
    expect(cardTitle({ ...scenario, shortTitle: '  ' })).toBe(scenario.title);
    expect(cardTitle({ title: 'A full title' } as Parameters<typeof cardTitle>[0])).toBe(
      'A full title',
    );
  });

  it('names every product in a few words, and lists each in the rail once', () => {
    for (const id of PRODUCT_IDS) expect(wordCount(PRODUCT_SHORT[id])).toBeLessThanOrEqual(3);
    expect([...RAIL_ORDER].sort()).toEqual([...PRODUCT_IDS].sort());
    // The brief's rail ends with Dynamics 365; Power Platform is the one added after it.
    expect(RAIL_ORDER.slice(-2)).toEqual(['dynamics-365', 'power-platform']);
  });

  it('says what each practice mode means in a sentence a person can read at a glance', () => {
    expect(MODE_SENTENCE).toEqual({
      guided: 'Short tips appear during the call',
      immersive: 'No tips on screen',
    });
  });
});
