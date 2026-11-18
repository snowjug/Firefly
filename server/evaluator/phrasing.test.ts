import { describe, expect, it } from 'vitest';
import { DIMENSION_IDS } from '#shared/domain/vocab.ts';
import {
  IMPROVEMENT_DIMENSION,
  STRENGTH_DIMENSION,
  dimensionGuidance,
  firstFitting,
  improvementText,
  lcfirst,
  plainVersion,
  practiceRecommendation,
  quoted,
  strengthText,
  type FactSlots,
  type ImprovementKind,
  type PhraseContext,
  type StrengthKind,
} from './phrasing.ts';

const ctx: PhraseContext = {
  name: 'Maya',
  product: 'the Northwind staff portal',
  stage: 'first-contact',
  proficiency: 'novice',
  impact: 'high',
  impactQuote: 'The whole front desk can\u2019t sign in and patients are already waiting.',
  deadlineQuote: 'We needed this fixed ten minutes ago.',
  nextQuestion: 'Can you read me exactly what the sign-in screen says when it stops you?',
};

const fact: FactSlots = {
  label: 'Phone still using the old password',
  importance: 'critical',
  betterQuestion:
    'Is your work email signed in on any other device, like a phone, that might still have your old password?',
  revealWhen: 'Asks whether any other device or app is signed in with the account.',
  missedConsequence: 'Without finding the phone, the account may lock again within minutes.',
  partial: false,
};

const KINDS = Object.keys(IMPROVEMENT_DIMENSION) as ImprovementKind[];
const noBrokenText = (text: string) => {
  expect(text).not.toMatch(/undefined|null|NaN|\[object|\{\w+\}/);
  expect(text.trim()).not.toBe('');
};

describe('improvement templates', () => {
  it.each(KINDS)('%s: fills every slot and fits the report limits', (kind) => {
    const out = improvementText(kind, ctx, { quote: 'Clear your cache and restart.', fact });
    for (const text of Object.values(out)) noBrokenText(text);
    expect(out.title.length).toBeLessThanOrEqual(120);
    expect(out.risk.length).toBeLessThanOrEqual(300);
    expect(out.betterPhrasing.length).toBeLessThanOrEqual(500);
    expect(out.whyItWorks.length).toBeLessThanOrEqual(400);
  });

  it.each(KINDS.filter((k) => k !== 'missed-fact'))(
    '%s: the suggested line names the customer, not a generic platitude',
    (kind) => {
      const out = improvementText(kind, ctx, { quote: 'Clear your cache and restart.' });
      expect(out.betterPhrasing).toMatch(/Maya|\[your name\]|\bI\b/);
      expect(out.betterPhrasing).not.toMatch(/great job|well done|keep it up/i);
    },
  );

  it('maps every kind to a dimension', () => {
    for (const kind of KINDS) expect(DIMENSION_IDS).toContain(IMPROVEMENT_DIMENSION[kind]);
  });

  it('uses the customer\u2019s own words about the impact, but only when they said them', () => {
    const withWords = improvementText('no-impact-ack', ctx, { quote: null });
    expect(withWords.betterPhrasing).toContain('patients are already waiting');
    const without = improvementText(
      'no-impact-ack',
      { ...ctx, impactQuote: null },
      { quote: null },
    );
    expect(without.betterPhrasing).not.toContain('patients');
    expect(without.betterPhrasing).toMatch(/I can hear how much is riding on this/);
  });

  it('uses the deadline in a promise rewrite only when the customer mentioned it', () => {
    expect(
      improvementText('unverified-promise', ctx, { quote: 'It will be fixed.' }).betterPhrasing,
    ).toContain('ten minutes ago');
    expect(
      improvementText(
        'unverified-promise',
        { ...ctx, deadlineQuote: null },
        { quote: 'It will be fixed.' },
      ).betterPhrasing,
    ).not.toContain('ten minutes ago');
    expect(improvementText('unverified-promise', ctx, { quote: 'x' }).betterPhrasing).toMatch(
      /can't promise/,
    );
  });

  it('turns a missed fact into the scenario\u2019s own better question', () => {
    const out = improvementText('missed-fact', ctx, { quote: null, fact });
    expect(out.betterPhrasing).toBe(fact.betterQuestion);
    expect(out.risk).toBe(fact.missedConsequence);
    expect(out.title).toBe('Did not find out: Phone still using the old password');
    expect(out.whyItWorks).toBe(
      'It works because it asks whether any other device or app is signed in with the account.',
    );
    const partial = improvementText('missed-fact', ctx, {
      quote: null,
      fact: { ...fact, partial: true },
    });
    expect(partial.title).toBe('Only part found: Phone still using the old password');
    expect(partial.risk).toMatch(/^Only part of this came out\./);
  });

  it('asks the next unfound question before any fix', () => {
    const out = improvementText('premature-troubleshooting', ctx, {
      quote: 'Reset your password.',
    });
    expect(out.betterPhrasing).toBe(
      'Before we try anything, Maya, can you read me exactly what the sign-in screen says when it stops you?',
    );
    const none = improvementText(
      'premature-troubleshooting',
      { ...ctx, nextQuestion: null },
      { quote: 'x' },
    );
    expect(none.betterPhrasing).toMatch(
      /^Before we try anything, Maya, can you tell me what you see/,
    );
  });

  it('chooses a blame alternative that fits who was blamed', () => {
    const customer = improvementText('blame', ctx, { quote: 'You should have read the email.' });
    expect(customer.title).toBe('Blamed the customer for what happened');
    expect(customer.betterPhrasing).toMatch(/Let's work out what happened together/);
    const other = improvementText('blame', ctx, { quote: 'That is the network team’s problem.' });
    expect(other.title).toMatch(/Pointed at someone else/);
    expect(other.betterPhrasing).toMatch(/I'll find out what happened/);
  });

  it('restates a jargon sentence in plain words, keeping the same idea', () => {
    const out = improvementText('jargon', ctx, {
      quote: 'Your cached credentials are probably out of date.',
    });
    expect(out.betterPhrasing).toBe(
      'Your saved sign-in details are probably out of date. Does that make sense so far, Maya?',
    );
    const generic = improvementText('jargon', ctx, { quote: 'The flux capacitor is misaligned.' });
    expect(generic.betterPhrasing).toMatch(/everyday words first/);
  });

  it('mentions the call stage when ownership is vague on a case that was already open or escalated', () => {
    expect(
      improvementText('vague-ownership', { ...ctx, stage: 'escalated' }, { quote: 'x' }).risk,
    ).toMatch(/already escalated/);
    expect(improvementText('vague-ownership', ctx, { quote: 'x' }).risk).not.toMatch(
      /escalated|already open/,
    );
  });

  it('keeps long suggested lines within the limit by dropping the quoted customer words first', () => {
    const long = { ...ctx, impactQuote: 'x '.repeat(280).trim() };
    const out = improvementText('no-impact-ack', long, { quote: null });
    expect(out.betterPhrasing.length).toBeLessThanOrEqual(500);
    expect(out.betterPhrasing).toMatch(
      /I can hear how much is riding on this\. I'll treat it as urgent/,
    );
  });
});

describe('plain-word rewrites', () => {
  it('swaps common technical terms for everyday words', () => {
    expect(plainVersion('Clear your cache and restart.')?.text).toBe(
      'Clear your saved page data and restart.',
    );
    expect(plainVersion('Check the DNS settings.')?.text).toBe(
      'Check the internet address lookup settings.',
    );
    expect(plainVersion('Authentication failed.')?.text).toBe('Sign-in failed.');
    expect(plainVersion('It is a lockout policy thing.')?.text).toContain(
      'rule that locks an account',
    );
  });

  it('keeps the sentence capitalised and reports which terms it swapped', () => {
    const out = plainVersion('Cached credentials expire.');
    expect(out?.text).toBe('Saved sign-in details expire.');
    expect(out?.terms).toEqual(['Cached credentials']);
  });

  it('returns null when there is nothing to swap', () => {
    expect(plainVersion('Please restart your laptop.')).toBeNull();
  });
});

describe('strength templates', () => {
  const kinds = Object.keys(STRENGTH_DIMENSION) as StrengthKind[];
  it.each(kinds)('%s: has a title and an explanation with no broken text', (kind) => {
    const out = strengthText(kind, {
      name: 'Maya',
      factLabel: 'Phone still using the old password',
      importance: 'critical',
    });
    noBrokenText(out.title);
    noBrokenText(out.because);
    expect(out.title.length).toBeLessThanOrEqual(120);
    expect(out.because).not.toMatch(/Maya (felt|was happy|was relieved)/);
  });

  it('writes "an important" for an important fact', () => {
    expect(
      strengthText('discovery', { name: 'Maya', factLabel: 'X', importance: 'important' }).title,
    ).toBe('Uncovered an important fact: X');
  });

  it('keeps acronyms in a fact label intact', () => {
    const out = strengthText('discovery', {
      name: 'Maya',
      factLabel: 'Already sent back and forth between IT and the vendor',
      importance: 'important',
    });
    expect(out.because).toContain('already sent back and forth between IT and the vendor');
  });
});

describe('guidance and recommendations', () => {
  const gaps: Record<string, string[]> = {
    'opening-rapport': [
      'straight-to-fix',
      'blame',
      'no-greeting',
      'no-introduction',
      'no-open-question',
      'no-empathy',
      'none',
    ],
    'scoping-discovery': ['missed-fact', 'few-topics', 'repeats', 'premature', 'partial', 'none'],
    'empathy-deescalation': [
      'blame',
      'dismissive',
      'no-impact',
      'no-empathy',
      'curveball',
      'temperature',
      'none',
    ],
    clarity: ['jargon', 'unclear', 'no-summary', 'none'],
    'ownership-next-steps': [
      'unverified-promise',
      'no-ownership',
      'vague-ownership',
      'no-next-steps',
      'vague-next-steps',
      'no-next-contact',
      'none',
    ],
    closing: ['no-summary', 'no-next-contact', 'no-anything-else', 'no-thanks', 'none'],
  };

  it('has specific guidance for every gap each dimension can report', () => {
    for (const id of DIMENSION_IDS) {
      for (const gap of gaps[id] ?? []) {
        const text = dimensionGuidance(id, gap, {
          ...ctx,
          fact: { betterQuestion: fact.betterQuestion },
        });
        noBrokenText(text);
        expect(text.length, `${id}:${gap}`).toBeLessThanOrEqual(500);
        expect(text, `${id}:${gap} must not be the generic dimension description`).not.toMatch(
          /^(How the call|Asking focused|Recognising|Plain language|Taking responsibility|Summarising)/,
        );
      }
    }
  });

  it('gives a concrete, achievable recommendation for each dimension', () => {
    for (const id of DIMENSION_IDS) {
      const text = practiceRecommendation(id, { betterQuestion: fact.betterQuestion });
      expect(text).toMatch(/^In your next call,/);
      expect(text.length).toBeLessThanOrEqual(500);
      expect(practiceRecommendation(id, undefined, true)).toMatch(/^Every area scored well/);
    }
  });
});

describe('small helpers', () => {
  it('lower-cases the first letter of a question unless it starts with I or an acronym', () => {
    expect(lcfirst('Can you read me the message?')).toBe('can you read me the message?');
    expect(lcfirst("I'd like to check one thing.")).toBe("I'd like to check one thing.");
    expect(lcfirst('DNS is next.')).toBe('DNS is next.');
  });

  it('picks the first variant that fits, or cuts the last one', () => {
    expect(firstFitting(10, ['this is too long', 'short', null])).toBe('short');
    expect(firstFitting(10, [null, 'this one is far too long']).length).toBeLessThanOrEqual(10);
    expect(firstFitting(10, [])).toBe('');
  });

  it('wraps quotations in typographic quotes', () => {
    expect(quoted('hello')).toBe('\u201chello\u201d');
  });
});
