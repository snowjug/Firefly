import { describe, expect, it } from 'vitest';
import type { StateEvent } from '#shared/domain/state.ts';
import type { StartTemperature } from '#shared/domain/vocab.ts';
import {
  moodAtTurn,
  RECOVERY_DROP,
  recoveringAtTurn,
  speakerFor,
  temperatureAtTurn,
  type DirectedScenario,
} from './direction.ts';

// What a voice reads from a stored call, with no scenario library behind it: only how the call
// started matters, so that is all these tests build.

const scenario = (startingTemperature: StartTemperature): DirectedScenario => ({
  config: {
    startingTemperature,
    difficulty: 'standard',
    callStage: 'first-contact',
    impact: 'medium',
  },
});

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

describe('recoveringAtTurn: whether the customer is cooling down', () => {
  const angry = scenario('angry');

  it('is not the case for an opening, a customer who has not moved, or one who has only got hotter', () => {
    expect(recoveringAtTurn(angry, [], 1)).toBe(false);
    expect(recoveringAtTurn(angry, [move(2, 72, 72)], 3)).toBe(false);
    expect(recoveringAtTurn(angry, [move(2, 72, 80), move(4, 80, 90)], 5)).toBe(false);
  });

  it('is the case once the temperature has fallen by the set amount with the latest change', () => {
    expect(RECOVERY_DROP).toBe(8);
    expect(recoveringAtTurn(angry, [move(2, 72, 64)], 3)).toBe(true);
    // One point short of the drop is not recovery.
    expect(recoveringAtTurn(angry, [move(2, 72, 65)], 3)).toBe(false);
  });

  it('sees a gradual cooling over several exchanges that no single one of them would show', () => {
    const events = [move(2, 72, 67), move(4, 67, 62), move(6, 62, 57)];
    expect(recoveringAtTurn(angry, events, 3)).toBe(false); // 72 -> 67
    expect(recoveringAtTurn(angry, events, 5)).toBe(true); // 72 -> 67 -> 62
    expect(recoveringAtTurn(angry, events, 7)).toBe(true); // 72 -> 67 -> 62 -> 57
  });

  it('stops when the customer heats up again, even from a lower point', () => {
    const events = [move(2, 72, 55), move(4, 55, 62)];
    expect(recoveringAtTurn(angry, events, 3)).toBe(true);
    expect(recoveringAtTurn(angry, events, 5)).toBe(false);
  });

  it('only counts the last few exchanges, so an old drop does not last for ever', () => {
    const events = [move(2, 72, 40), move(4, 40, 40), move(6, 40, 41), move(8, 41, 42)];
    expect(recoveringAtTurn(angry, events, 3)).toBe(true);
    expect(recoveringAtTurn(angry, events, 9)).toBe(false);
  });

  it('looks at the temperature alone, and only at changes before the turn', () => {
    expect(recoveringAtTurn(angry, [move(2, 90, 10, 'trust')], 3)).toBe(false);
    expect(recoveringAtTurn(angry, [move(4, 72, 50)], 3)).toBe(false);
  });
});

describe('speakerFor: which voice speaks for a customer who was not given a choice', () => {
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

  it('uses both voices across a spread of names, so the choice is not one voice for everyone', () => {
    const names = [
      'Maya Okafor',
      'Elias Lindqvist',
      'Priya Nair',
      'Tom Hughes',
      'Chen Wei',
      'Ana Silva',
    ];
    const chosen = new Set(names.map((name) => speakerFor({ name })));
    expect(chosen).toEqual(new Set(['female', 'male']));
  });
});
