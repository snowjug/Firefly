import { describe, expect, it } from 'vitest';
import { applyConfig } from '#shared/domain/config.ts';
import { ScenarioDefinitionSchema } from '#shared/domain/scenario.ts';
import type { StateEvent } from '#shared/domain/state.ts';
import exemplar from '../scenarios/library/locked-out-after-password-reset.ts';
import { getScenarioLibrary } from '../scenarios/index.ts';
import { moodAtTurn, speakerFor, temperatureAtTurn } from './direction.ts';

const base = ScenarioDefinitionSchema.parse(exemplar);
const scenario = (startingTemperature: 'calm' | 'anxious' | 'frustrated' | 'angry') =>
  applyConfig(base, { startingTemperature }, { seed: 1 });

const move = (
  turnIndex: number,
  previous: number,
  next: number,
  key: StateEvent['key'] = 'temperature',
): StateEvent => ({
  turnIndex,
  key,
  previous,
  next,
  delta: next - previous,
  category: 'empathy',
  reason: 'A reason.',
});

describe('temperatureAtTurn: how hot the customer was when a turn was said', () => {
  it('is the starting temperature for the opening and until something changes it', () => {
    expect(temperatureAtTurn(scenario('calm'), [], 1)).toBe(12);
    expect(temperatureAtTurn(scenario('anxious'), [], 1)).toBe(32);
    expect(temperatureAtTurn(scenario('frustrated'), [], 1)).toBe(52);
    expect(temperatureAtTurn(scenario('angry'), [], 1)).toBe(72);
    expect(temperatureAtTurn(scenario('angry'), [], 5)).toBe(72);
  });

  it('follows the changes made by the trainee turns before it, and not those after', () => {
    const events = [move(2, 52, 45), move(4, 45, 58), move(6, 58, 30)];
    const frustrated = scenario('frustrated');
    expect([1, 3, 5, 7, 9].map((turn) => temperatureAtTurn(frustrated, events, turn))).toEqual([
      52, 45, 58, 30, 30,
    ]);
  });

  it('leaves out what a turn itself caused, so a trainee turn is judged on the temperature it met', () => {
    const events = [move(2, 52, 45), move(4, 45, 58)];
    const frustrated = scenario('frustrated');
    expect([2, 4, 6].map((turn) => temperatureAtTurn(frustrated, events, turn))).toEqual([
      52, 45, 58,
    ]);
  });

  it('uses the last change when one turn changes the temperature more than once', () => {
    // A reaction to the trainee, then a curveball landing on the same turn.
    const events = [move(2, 52, 50), move(2, 50, 62)];
    expect(temperatureAtTurn(scenario('frustrated'), events, 3)).toBe(62);
  });

  it('ignores changes to everything but the temperature', () => {
    const events = [move(2, 50, 10, 'trust'), move(2, 40, 90, 'patience'), move(2, 52, 47)];
    expect(temperatureAtTurn(scenario('frustrated'), events, 3)).toBe(47);
    expect(temperatureAtTurn(scenario('frustrated'), [move(2, 50, 10, 'trust')], 3)).toBe(52);
  });
});

describe('moodAtTurn: the temperature band', () => {
  it('names the band for the starting temperature of each kind of customer', () => {
    expect(moodAtTurn(scenario('calm'), [], 1)).toBe('calm');
    expect(moodAtTurn(scenario('anxious'), [], 1)).toBe('concerned');
    expect(moodAtTurn(scenario('frustrated'), [], 1)).toBe('frustrated');
    expect(moodAtTurn(scenario('angry'), [], 1)).toBe('angry');
  });

  it('changes band exactly at the band edges', () => {
    const calm = scenario('calm');
    const at = (next: number) => moodAtTurn(calm, [move(2, 12, next)], 3);
    expect([20, 21, 40, 41, 60, 61, 80, 81, 100, 0].map(at)).toEqual([
      'calm',
      'concerned',
      'concerned',
      'frustrated',
      'frustrated',
      'angry',
      'angry',
      'escalating',
      'escalating',
      'calm',
    ]);
  });
});

describe('speakerFor: which voice speaks for a customer', () => {
  it('uses the speaker the persona names', () => {
    expect(speakerFor({ name: 'Anyone', speaker: 'female' })).toBe('female');
    expect(speakerFor({ name: 'Anyone', speaker: 'male' })).toBe('male');
  });

  it('chooses the same speaker for the same name every time when the persona names none', () => {
    for (const name of ['Maya Okafor', 'Elias Lindqvist', 'A', '']) {
      const first = speakerFor({ name });
      for (let i = 0; i < 5; i++) expect(speakerFor({ name })).toBe(first);
    }
    expect(speakerFor({ name: '  maya OKAFOR ' })).toBe(speakerFor({ name: 'Maya Okafor' }));
  });

  it('uses both voices across names, so the choice is not one voice for everyone', () => {
    const names = getScenarioLibrary().map((s) => s.persona.name);
    const chosen = new Set(names.map((name) => speakerFor({ name })));
    expect(chosen).toEqual(new Set(['female', 'male']));
  });

  it('follows the speaker the library gives every built-in persona', () => {
    for (const s of getScenarioLibrary()) {
      expect(speakerFor(s.persona), s.id).toBe(s.persona.speaker);
    }
  });
});
