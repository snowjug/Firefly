import { describe, expect, it } from 'vitest';
import {
  bandIdFor,
  bandOf,
  customerPlayedBy,
  evaluatorByline,
  joinList,
  plainUnexpectedTurn,
  pluralise,
  skillName,
  unexpectedTurnDetail,
} from './copy.ts';

describe('plainUnexpectedTurn', () => {
  it('replaces the engine word in the evaluator\u2019s text, keeping the capital where there was one', () => {
    expect(plainUnexpectedTurn('Curveball: customer asks for a manager')).toBe(
      'Unexpected turn: customer asks for a manager',
    );
    expect(plainUnexpectedTurn('Handled the curveball well (customer asks for a manager)')).toBe(
      'Handled the unexpected turn well (customer asks for a manager)',
    );
    expect(plainUnexpectedTurn('A second curveball also came up. Curveballs end here.')).toBe(
      'A second unexpected turn also came up. Unexpected turns end here.',
    );
  });

  it('leaves everything else exactly as written', () => {
    const text = 'You said \u201cI\u2019ll look into it\u201d at turn 4.';
    expect(plainUnexpectedTurn(text)).toBe(text);
  });
});

describe('unexpectedTurnDetail', () => {
  it('drops a leading label the tag already says, and starts with a capital', () => {
    expect(unexpectedTurnDetail('Curveball: customer asks for a manager')).toBe(
      'Customer asks for a manager',
    );
    expect(
      unexpectedTurnDetail('The curveball was not addressed (customer asks for a manager)'),
    ).toBe('The unexpected turn was not addressed (customer asks for a manager)');
  });
});

describe('evaluatorByline', () => {
  const rules = {
    kind: 'rules',
    name: 'Firefly rules evaluator',
    version: 'rules-1.0.0',
    providerLabel: 'Demo',
  } as const;
  const model = {
    kind: 'model',
    name: 'Firefly model evaluator',
    version: 'v1',
    providerLabel: 'Gemini (gemini-3.5-flash-lite)',
  } as const;

  it('labels the rules evaluator as demo mode when the call ran in demo mode', () => {
    expect(evaluatorByline(rules, 'mock')).toBe("Firefly's built-in rules evaluator (demo mode)");
  });

  it('does not call it demo mode for a live provider', () => {
    expect(evaluatorByline(rules, 'gemini')).toBe("Firefly's built-in rules evaluator");
  });

  it('names the language model by its real label', () => {
    expect(evaluatorByline(model, 'gemini')).toBe(
      'the language model Gemini (gemini-3.5-flash-lite)',
    );
  });
});

describe('customerPlayedBy', () => {
  it('says plainly when the customer was the built-in rules engine', () => {
    expect(customerPlayedBy('mock', 'Demo mode (built-in rules engine)')).toMatch(
      /not a language model/,
    );
    expect(customerPlayedBy('azure-openai', 'Azure OpenAI (gpt)')).toBe(
      'the language model Azure OpenAI (gpt)',
    );
  });
});

describe('small helpers', () => {
  it('joins a list in plain English', () => {
    expect(joinList([])).toBe('');
    expect(joinList(['A'])).toBe('A');
    expect(joinList(['A', 'B'])).toBe('A and B');
    expect(joinList(['A', 'B', 'C'])).toBe('A, B and C');
  });

  it('finds a band from a temperature and from its label, never printing the number', () => {
    expect(bandOf(0)).toEqual({ id: 'calm', label: 'Calm' });
    expect(bandOf(52)).toEqual({ id: 'frustrated', label: 'Frustrated' });
    expect(bandOf(100)).toEqual({ id: 'escalating', label: 'Escalating' });
    expect(bandIdFor('Concerned')).toBe('concerned');
    expect(bandIdFor('Elated')).toBeNull();
  });

  it('names a skill, and falls back to the id for an unknown one', () => {
    expect(skillName('opening-rapport')).toBe('Opening & Rapport');
    expect(skillName('something-new')).toBe('something-new');
  });

  it('pluralises', () => {
    expect(pluralise(1, 'turn')).toBe('1 turn');
    expect(pluralise(3, 'turn')).toBe('3 turns');
    expect(pluralise(2, 'match', 'matches')).toBe('2 matches');
  });
});
