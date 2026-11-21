import { describe, expect, it } from 'vitest';
import { wordCount } from '#shared/domain/scenario.ts';
import {
  bandIdFor,
  bandOf,
  clampWords,
  countWords,
  customerPlayedBy,
  evaluatorByline,
  joinList,
  plainUnexpectedTurn,
  pluralise,
  quoteCount,
  scoreText,
  skillName,
  unexpectedTurnDetail,
} from './copy.ts';

describe('countWords', () => {
  it('counts words the way the product budgets do', () => {
    for (const text of [
      '',
      '   ',
      'one',
      'Two words',
      '  spaced   out\twords\nacross lines ',
      "It's a quote: \u201cstay calm\u201d, then ask.",
    ]) {
      expect(countWords(text), JSON.stringify(text)).toBe(wordCount(text));
    }
  });
});

describe('clampWords', () => {
  const sentences =
    'You introduced yourself clearly. You named the deadline. You agreed a time for the update. You also thanked her at the end.';

  it('leaves text that fits exactly as it is', () => {
    expect(clampWords('A short reason.', 10)).toEqual({
      shown: 'A short reason.',
      full: 'A short reason.',
      clamped: false,
    });
    expect(clampWords(sentences, countWords(sentences)).clamped).toBe(false);
  });

  it('stops at the end of a sentence when one falls late enough in the budget', () => {
    const result = clampWords(sentences, 12);
    expect(result.clamped).toBe(true);
    expect(result.shown).toBe('You introduced yourself clearly. You named the deadline.');
    expect(countWords(result.shown)).toBeLessThanOrEqual(12);
    expect(result.full).toBe(sentences);
  });

  it('keeps every word in `full`, so "Show more" shows it all', () => {
    const text = 'Word '.repeat(80).trim();
    const result = clampWords(text, 20);
    expect(result.full).toBe(text);
    expect(countWords(result.full)).toBe(80);
  });

  it('cuts after the last word that fits, with an ellipsis, when there is no sentence end to use', () => {
    const text = 'one two three four five six seven eight nine ten eleven twelve';
    const result = clampWords(text, 5);
    expect(result.shown).toBe('one two three four five\u2026');
    expect(countWords(result.shown)).toBe(5);
  });

  it('does not leave a comma before the ellipsis, and ignores extra whitespace', () => {
    const result = clampWords('alpha  beta   gamma,   delta epsilon zeta', 3);
    expect(result.shown).toBe('alpha beta gamma\u2026');
  });

  it('never returns an empty first view, whatever the budget', () => {
    expect(countWords(clampWords('Some words here to cut', 0).shown)).toBe(1);
    expect(countWords(clampWords('Some words here to cut', -4).shown)).toBe(1);
  });

  it('does not take a sentence end that is too early in the budget', () => {
    const text = 'Yes. And then a long run of words with no stop for a good while after that';
    const result = clampWords(text, 10);
    expect(result.shown.endsWith('\u2026')).toBe(true);
  });
});

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
    version: 'rules-2.0.0',
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

  it('pluralises, counts quotes and writes scores for people', () => {
    expect(pluralise(1, 'turn')).toBe('1 turn');
    expect(pluralise(3, 'turn')).toBe('3 turns');
    expect(pluralise(2, 'match', 'matches')).toBe('2 matches');
    expect(quoteCount(0)).toBe('No quotes');
    expect(quoteCount(1)).toBe('1 quote');
    expect(quoteCount(3)).toBe('3 quotes');
    expect(scoreText(4)).toBe('4');
    expect(scoreText(4.25)).toBe('4.3');
  });
});
