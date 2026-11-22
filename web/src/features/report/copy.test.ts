import { describe, expect, it } from 'vitest';
import { wordCount } from '#shared/domain/scenario.ts';
import {
  bandIdFor,
  bandOf,
  clampWords,
  countWords,
  customerPlayedBy,
  evaluatorByline,
  inYourVoice,
  joinList,
  plainUnexpectedTurn,
  pluralise,
  quoteCount,
  scoreText,
  skillName,
  splitSentences,
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

describe('splitSentences', () => {
  it('splits where a sentence ends and a new one starts, keeping quotes and abbreviations of numbers whole', () => {
    expect(
      splitSentences(
        'Keep this opening. To stretch it, ask what Marcus saw. On this call the question was: \u201cWhen did you last see it?\u201d Then 4.2 of 5 stays whole.',
      ),
    ).toEqual([
      'Keep this opening.',
      'To stretch it, ask what Marcus saw.',
      'On this call the question was: \u201cWhen did you last see it?\u201d',
      'Then 4.2 of 5 stays whole.',
    ]);
  });

  it('is one sentence for text with no break, and none for empty text', () => {
    expect(splitSentences('Just one sentence without an end')).toEqual([
      'Just one sentence without an end',
    ]);
    expect(splitSentences('   ')).toEqual([]);
  });
});

describe('clampWords with whole sentences', () => {
  const text =
    'You greeted Marcus and asked an open question. Core topics you asked about: when it started, recent changes, who is affected and what was already tried. One point off.';

  it('shows the sentences that fit and holds the rest, never cutting inside one', () => {
    const result = clampWords(text, 12, { whole: true });
    expect(result.shown).toBe('You greeted Marcus and asked an open question.');
    expect(result.clamped).toBe(true);
    expect(result.full).toBe(text);
    expect(result.shown).not.toContain('\u2026');
  });

  it('shows a first sentence that is longer than the budget whole', () => {
    const long =
      'In your first two turns you greeted Marcus, introduced yourself or offered help, asked an open question and acknowledged how the problem affected them. More.';
    const result = clampWords(long, 10, { whole: true });
    expect(result.shown).toBe(
      'In your first two turns you greeted Marcus, introduced yourself or offered help, asked an open question and acknowledged how the problem affected them.',
    );
    expect(result.clamped).toBe(true);
  });

  it('is not clamped when there is only the one sentence, however long', () => {
    const only =
      'A single sentence that runs on for far longer than the small budget it was given here without any full stop in the middle';
    expect(clampWords(only, 5, { whole: true })).toEqual({
      shown: only,
      full: only,
      clamped: false,
    });
  });

  it('takes every sentence that fits when the budget has room', () => {
    expect(clampWords(text, 40, { whole: true }).clamped).toBe(false);
    expect(clampWords(text, 28, { whole: true }).shown).toBe(
      'You greeted Marcus and asked an open question. Core topics you asked about: when it started, recent changes, who is affected and what was already tried.',
    );
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

  it('speaks to the trainee as "you" where a scenario wrote "the engineer"', () => {
    expect(
      plainUnexpectedTurn(
        'Without the timing, the engineer never learns that something changed while he was away and may suggest generic fixes for Outlook itself.',
      ),
    ).toBe(
      'Without the timing, you never learn that something changed while he was away and may suggest generic fixes for Outlook itself.',
    );
  });
});

describe('inYourVoice', () => {
  const cases: [string, string][] = [
    [
      'The engineer treats this as one broken script and misses that the service account itself is the common factor.',
      'You treat this as one broken script and miss that the service account itself is the common factor.',
    ],
    [
      'The engineer suggests running it as himself without knowing it breaks his change rules, or never explores an emergency route when time is short.',
      'You suggest running it as himself without knowing it breaks his change rules, or never explore an emergency route when time is short.',
    ],
    [
      'The engineer does not learn why the project charges are hard to separate, so the plan to trace them is vague.',
      'You do not learn why the project charges are hard to separate, so the plan to trace them is vague.',
    ],
    [
      'The engineer relies on the unavailable IT manager and does not check who else can review the messages before the payment run.',
      'You rely on the unavailable IT manager and do not check who else can review the messages before the payment run.',
    ],
    [
      'The engineer guesses at update times, or skips them, and the customer has to chase for news while operations control waits.',
      'You guess at update times, or skip them, and the customer has to chase for news while operations control waits.',
    ],
    [
      'The engineer either accepts her licence theory unchallenged or argues with it without evidence, and the call turns into a disagreement instead of a shared check.',
      'You either accept her licence theory unchallenged or argue with it without evidence, and the call turns into a disagreement instead of a shared check.',
    ],
    [
      'A risk to customer data goes unnoticed, and the engineer misses a reason to move quickly and to advise against sharing lists.',
      'A risk to customer data goes unnoticed, and you miss a reason to move quickly and to advise against sharing lists.',
    ],
    [
      'The engineer repeats advice that has already failed, which confirms his belief that nobody is listening and pushes his temperature up.',
      'You repeat advice that has already failed, which confirms his belief that nobody is listening and pushes his temperature up.',
    ],
    [
      'Without knowing only production fails, the engineer cannot tell a script or account fault from a permission problem on one target.',
      'Without knowing only production fails, you cannot tell a script or account fault from a permission problem on one target.',
    ],
    [
      'The pattern ties the problem to the timing, and the engineer keeps looking at accounts and licences instead of at what changed.',
      'The pattern ties the problem to the timing, and you keep looking at accounts and licences instead of at what changed.',
    ],
    [
      'The update takes all the blame, and the engineer never learns that the laptop was already struggling before it.',
      'The update takes all the blame, and you never learn that the laptop was already struggling before it.',
    ],
    [
      'The engineer has no useful next step to give her.',
      'You have no useful next step to give her.',
    ],
  ];

  it.each(cases)('turns "%s"', (before, after) => {
    expect(inYourVoice(before)).toBe(after);
  });

  it('turns each sentence on its own', () => {
    expect(
      inYourVoice('The engineer asks him to repeat steps. The engineer tells her to wait.'),
    ).toBe('You ask him to repeat steps. You tell her to wait.');
  });

  it('leaves a sentence it cannot turn right as it was written, in the third person', () => {
    // "needs" is not a verb it knows: better "the engineer needs" than "you needs".
    expect(inYourVoice('The engineer needs a name for the process.')).toBe(
      'The engineer needs a name for the process.',
    );
    expect(inYourVoice("The engineer's notes say nothing.")).toBe(
      "The engineer's notes say nothing.",
    );
  });

  it('leaves text with no "the engineer" exactly as it was', () => {
    const text = 'You asked about the engineers on call. Marcus keeps looking at it.';
    expect(inYourVoice(text)).toBe(text);
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
