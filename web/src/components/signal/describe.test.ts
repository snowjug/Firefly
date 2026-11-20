import { describe, expect, it } from 'vitest';
import { buildAtlas } from '../atlas/atlas-model.ts';
import { CATALOGUE } from '../atlas/atlas.fixtures.ts';
import { coreParams } from '../atlas/core-params.ts';
import { defaultChoices, type SetupChoices } from '../scenario/setup-model.ts';
import { makeScenario } from '../scenario/scenario-fixtures.ts';
import { describeCore, describeCoreParts, describeGlyph } from './describe.ts';
import { traits } from './signal.fixtures.ts';
import type { GlyphTraits } from './types.ts';

const choices = (over: Partial<SetupChoices> = {}): SetupChoices => ({
  ...defaultChoices(makeScenario()),
  ...over,
});

describe('describeGlyph', () => {
  it('says everything the picture says, from the same inputs', () => {
    expect(describeGlyph(traits())).toBe(
      'Standard difficulty, medium impact. The customer starts frustrated. First contact. Not tried yet. About 10 minutes.',
    );
  });

  it('says where the trainee stands, and that a mission is suggested', () => {
    expect(describeGlyph(traits({ status: 'attempted' }))).toContain('Started, not completed yet.');
    expect(describeGlyph(traits({ status: 'completed' }))).toContain('Completed.');
    expect(describeGlyph(traits({ recommended: true }))).toMatch(/Suggested next\.$/);
    expect(describeGlyph(traits())).not.toContain('Suggested');
  });

  it('writes a single minute in the singular, and survives a missing length', () => {
    expect(describeGlyph(traits({ minutes: 1 }))).toContain('About 1 minute.');
    expect(describeGlyph(traits({ minutes: Number.NaN }))).toContain('About 1 minute.');
  });

  it('names the stage in the words the rest of the app uses', () => {
    expect(describeGlyph(traits({ stage: 'follow-up' }))).toContain('Follow-up on an open case.');
    expect(describeGlyph(traits({ stage: 'closure' }))).toContain('Closure call.');
  });

  it('can describe every mission of the library', () => {
    const { missions } = buildAtlas(CATALOGUE, [], null);
    expect(missions).toHaveLength(13);
    for (const mission of missions) {
      const text = describeGlyph(mission);
      expect(text).toContain('difficulty');
      expect(text).toContain(`The customer starts ${mission.start}.`);
      expect(/undefined|NaN/.test(text)).toBe(false);
    }
  });
});

describe('describeCoreParts', () => {
  const parts = (over: Partial<SetupChoices> = {}, t: Partial<GlyphTraits> = {}) =>
    describeCoreParts(traits(t), coreParams(choices(over)));

  it('has the six lettered parts in order', () => {
    expect(parts().map((part) => part.letter)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(parts().map((part) => part.name)).toEqual([
      'Minute ticks',
      'Pressure band',
      'Heart',
      'Edge and needle',
      'Rings',
      'Signal density',
    ]);
  });

  it('reads the pressure, the start and the difficulty from the parameters', () => {
    const [ticks, band, heart, edge, rings] = parts(
      { impact: 'high', startingTemperature: 'angry', difficulty: 'challenge' },
      { minutes: 12, stage: 'escalated', status: 'completed' },
    );
    expect(ticks?.value).toBe('12 of 15 engraved');
    expect(band?.value).toBe('high, 24 of 24 lit');
    expect(heart?.value).toBe('triangle, escalated, filled');
    expect(edge?.value).toBe('angry, a serrated edge');
    expect(rings?.value).toBe('challenge, 3 rings');
  });

  it('turns when a setting turns', () => {
    const calm = parts({ startingTemperature: 'calm', impact: 'low', difficulty: 'starter' });
    expect(calm[1]?.value).toBe('low, 5 of 24 lit');
    expect(calm[3]?.value).toBe('calm, a smooth edge');
    expect(calm[4]?.value).toBe('starter, 1 ring');
  });

  it('describes the signal density in a word and never in a number', () => {
    for (const difficulty of ['starter', 'standard', 'challenge'] as const) {
      const density = parts({ difficulty })[5];
      expect(density?.value).toMatch(/^(light|moderate|dense), still hidden$/);
      expect(/\d/.test(density?.value ?? '')).toBe(false);
    }
  });

  it('keeps the minutes to the fifteen ticks there are', () => {
    expect(parts({}, { minutes: 40 })[0]?.value).toBe('15 of 15 engraved');
    expect(parts({}, { minutes: 0 })[0]?.value).toBe('0 of 15 engraved');
  });
});

describe('describeCore', () => {
  it('is one description with every part, and never a count of hidden things', () => {
    const text = describeCore(traits(), coreParams(choices()));
    expect(text.startsWith('Scenario core.')).toBe(true);
    for (const name of [
      'Minute ticks',
      'Pressure band',
      'Heart',
      'Edge and needle',
      'Rings',
      'Signal density',
    ]) {
      expect(text).toContain(`${name}:`);
    }
    expect(text).not.toMatch(/\d+ (hidden|signals|dormant|facts)/i);
    expect(text).not.toMatch(/criteria|rubric|evaluator|score/i);
  });
});
