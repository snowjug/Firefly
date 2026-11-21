// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { curveballChoices, situationParagraphs } from './labels.ts';
import { SAMPLE, scenarioById } from './testing/fixtures.ts';

describe('situationParagraphs', () => {
  const scenario = scenarioById(SAMPLE.starter);

  it('gives the situation, then the note for the chosen call stage', () => {
    expect(situationParagraphs(scenario, 'follow-up')).toEqual([
      scenario.brief.situation,
      scenario.stageBriefs['follow-up'],
    ]);
  });

  it('gives only the situation when the stage has no note of its own', () => {
    expect(scenario.stageBriefs['first-contact']).toBe('');
    expect(situationParagraphs(scenario, 'first-contact')).toEqual([scenario.brief.situation]);
  });

  it('falls back to the situation when the server sends no stage notes at all', () => {
    const { stageBriefs: _omitted, ...stale } = scenario;
    expect(() => situationParagraphs(stale, 'escalated')).not.toThrow();
    expect(situationParagraphs(stale, 'escalated')).toEqual([scenario.brief.situation]);
    expect(situationParagraphs({ ...stale, stageBriefs: {} }, 'closure')).toEqual([
      scenario.brief.situation,
    ]);
  });
});

describe('curveballChoices', () => {
  it('lists what the scenario offers in the order of the vocabulary', () => {
    const offered = curveballChoices({ curveballOptions: ['deadline', 'ask-manager'] });
    expect(offered).toEqual(['ask-manager', 'deadline']);
  });

  it('offers none to choose from when the server does not send the list', () => {
    expect(curveballChoices({})).toEqual([]);
  });
});
