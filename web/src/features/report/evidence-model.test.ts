import { describe, expect, it } from 'vitest';
import {
  customerReplyTo,
  evidenceTurns,
  isVerifiedQuote,
  quoteMatchesTurn,
  turnContext,
  turnLookup,
  verifiedEvidence,
} from './evidence-model.ts';
import { CALLS } from './fixtures.ts';

const strong = turnLookup(evidenceTurns(CALLS.strong.session));

describe('evidenceTurns', () => {
  it('names the speakers (You, and the customer by name) and reads the clock from the start of the call', () => {
    const turns = evidenceTurns(CALLS.strong.session);
    expect(turns).toHaveLength(CALLS.strong.session.turns.length);
    expect(turns[0]).toMatchObject({
      index: 1,
      role: 'customer',
      speaker: 'Priya Nair',
      clock: '0:00',
    });
    expect(turns[1]).toMatchObject({ index: 2, role: 'trainee', speaker: 'You' });
    expect(turns[1]?.text).toBe(CALLS.strong.session.turns[1]?.text);
  });
});

describe('quoteMatchesTurn', () => {
  it('accepts the words the turn says, ignoring case, punctuation and spacing', () => {
    expect(
      quoteMatchesTurn(
        'Hello Priya, this is Sam from Microsoft support.',
        'this is sam from microsoft support',
      ),
    ).toBe(true);
    expect(quoteMatchesTurn('Is that right?\nYes it is', 'right? yes')).toBe(true);
  });

  it('rejects words the turn does not say', () => {
    expect(quoteMatchesTurn('Hello Priya', 'Goodbye Priya')).toBe(false);
    expect(quoteMatchesTurn('Hello Priya', 'Hello Priya and the whole team')).toBe(false);
  });

  it('accepts a very short reply only when it is the whole turn', () => {
    expect(quoteMatchesTurn('ok', 'ok')).toBe(true);
    expect(quoteMatchesTurn('OK.', 'ok')).toBe(true);
    expect(quoteMatchesTurn('Is that ok with you', 'ok')).toBe(false);
  });

  it('rejects an empty quote and a quote of nothing but punctuation', () => {
    expect(quoteMatchesTurn('Hello', '')).toBe(false);
    expect(quoteMatchesTurn('Hello', '...')).toBe(false);
  });
});

describe('isVerifiedQuote', () => {
  it('is true only for a quote of the trainee, in the turn it names', () => {
    expect(isVerifiedQuote(strong, 2, 'Hello Priya, this is Sam from Microsoft support.')).toBe(
      true,
    );
    expect(isVerifiedQuote(strong, 2, 'this is Sam from Microsoft support')).toBe(true);
  });

  it('is false when the turn says something else, even if another turn says it', () => {
    expect(isVerifiedQuote(strong, 4, 'this is Sam from Microsoft support')).toBe(false);
  });

  it('is false for the customer’s words, for a turn the call does not have and for no turn or no quote', () => {
    expect(isVerifiedQuote(strong, 1, 'Our sales team has been recording customer meetings')).toBe(
      false,
    );
    expect(isVerifiedQuote(strong, 99, 'Hello Priya')).toBe(false);
    expect(isVerifiedQuote(strong, null, 'Hello Priya')).toBe(false);
    expect(isVerifiedQuote(strong, 2, null)).toBe(false);
    expect(isVerifiedQuote(strong, 2, '')).toBe(false);
  });

  it('confirms every quote of every fixture report, which were all checked when they were made', () => {
    for (const name of ['strong', 'weak', 'short', 'curveball', 'legacy', 'long'] as const) {
      const lookup = turnLookup(evidenceTurns(CALLS[name].session));
      for (const d of CALLS[name].report.dimensions) {
        for (const e of d.evidence) {
          expect(isVerifiedQuote(lookup, e.turnIndex, e.quote), `${name} ${d.id}: ${e.quote}`).toBe(
            true,
          );
        }
      }
    }
  });
});

describe('verifiedEvidence', () => {
  it('keeps the evidence that holds up, in order, and drops the rest', () => {
    const items = [
      { turnIndex: 2, quote: 'this is Sam from Microsoft support' },
      { turnIndex: 2, quote: 'something nobody said' },
      { turnIndex: 4, quote: 'only for some organisers' },
      { turnIndex: 77, quote: 'Hello Priya' },
    ];
    expect(verifiedEvidence(strong, items)).toEqual([items[0], items[2]]);
  });
});

describe('turnContext and customerReplyTo', () => {
  it('gives a turn with the one before and the one after, and null at the ends', () => {
    const middle = turnContext(strong, 6);
    expect(middle?.previous?.index).toBe(5);
    expect(middle?.turn.index).toBe(6);
    expect(middle?.next?.index).toBe(7);
    expect(turnContext(strong, 1)?.previous).toBeNull();
    expect(turnContext(strong, 15)?.next).toBeNull();
    expect(turnContext(strong, 99)).toBeNull();
  });

  it('finds the customer’s reply to a trainee turn, the opening line for the start, and nothing after the last', () => {
    expect(customerReplyTo(strong, 4)?.index).toBe(5);
    expect(customerReplyTo(strong, 0)?.index).toBe(1);
    expect(customerReplyTo(strong, 5)?.index).toBe(5);
    const endsOnTrainee = turnLookup(evidenceTurns(CALLS.strong.session).slice(0, 14));
    expect(customerReplyTo(endsOnTrainee, 14)).toBeNull();
  });
});
