import { describe, expect, it } from 'vitest';
import {
  careBehaviour,
  careLevel,
  careStatus,
  classified,
  evaluate,
  type Line,
} from './testing.ts';

// ACCOUNTABLE read from behaviour: ownership, honest expectations, a time for the next update, and
// no blame. The traps are the ones a keyword count falls into: "someone will look" is not
// ownership, a vague "soon" is not a time, and a promise nobody can keep is not accountability.

const turn = (say: string, reply = 'Okay.'): Line => ({ say, reply });
const HELLO =
  'Hello Maya, this is Sam from the Microsoft support team. What happens when you sign in?';

/** A call whose second turn is `say`, after a proper opening. */
const call = (say: string, ...more: string[]) =>
  evaluate(classified([turn(HELLO), turn(say), ...more.map((m) => turn(m))]));

describe('ownership', () => {
  it.each([
    "I'll own this and stay with it until you're back in.",
    "Leave this with me. I'll get your account unlocked and see it through.",
    "This is mine now, and I'll make sure it gets resolved.",
  ])('is clear when the engineer commits themselves to the outcome: %s', (said) => {
    expect(careStatus(call(said), 'accountable.ownership')).toBe('shown');
  });

  it('is not ownership when someone else is going to look', () => {
    const report = call('Someone will look at it soon.');
    expect(careStatus(report, 'accountable.ownership')).toBe('not-shown');
    expect(careBehaviour(report, 'accountable.ownership')?.note).toMatch(/someone else would look/);
  });

  it('is only part ownership when the engineer commits to an action but not to the outcome', () => {
    expect(careStatus(call("I'll look into it."), 'accountable.ownership')).toBe('partly');
  });

  it('is only part ownership when "we" will do it, not the engineer', () => {
    expect(careStatus(call('We will get this sorted.'), 'accountable.ownership')).toBe('partly');
  });

  it('is not shown when the engineer never said they would take it on', () => {
    expect(careStatus(call('Okay, thanks for that.'), 'accountable.ownership')).toBe('not-shown');
  });

  it('is credited for a commitment worded in an unusual way', () => {
    expect(
      careStatus(
        call("Consider it handled on my side; I'll personally chase this until it's fixed."),
        'accountable.ownership',
      ),
    ).toBe('shown');
  });
});

describe('the time of the next update', () => {
  it('credits a named time', () => {
    const report = call("I'll call you back at 9:30 with an update, even if I have no fix yet.");
    expect(careStatus(report, 'accountable.update-time')).toBe('shown');
  });

  it('gives only part credit to a vague timeline', () => {
    for (const vague of [
      "I'll update you soon.",
      "I'll send you the next update.",
      "I'll get back to you shortly.",
    ]) {
      const report = call(vague);
      expect(careStatus(report, 'accountable.update-time'), vague).toBe('partly');
      expect(careBehaviour(report, 'accountable.update-time')?.note).toMatch(/gave no time/);
    }
  });

  it('credits no update time when none was given', () => {
    expect(careStatus(call("I'll look into it."), 'accountable.update-time')).toBe('not-shown');
  });

  it('credits a time given in other words than a clock time', () => {
    expect(
      careStatus(call("I'll ring you in thirty minutes either way."), 'accountable.update-time'),
    ).toBe('shown');
  });
});

describe('promises that cannot be kept', () => {
  it('marks down "I guarantee it will be fixed by tonight" and never credits honest expectations', () => {
    const report = call('I guarantee it will be fixed by tonight.');
    expect(careStatus(report, 'accountable.no-unsupported-promise')).toBe('not-shown');
    expect(careStatus(report, 'accountable.expectations')).toBe('not-shown');
    expect(careBehaviour(report, 'accountable.no-unsupported-promise')?.evidence[0]?.quote).toMatch(
      /guarantee it will be fixed by tonight/,
    );
  });

  it('credits an honest expectation that names what is not yet known', () => {
    const report = call(
      "I can't promise a fix time yet, but I'll call you at three with an update.",
    );
    expect(careStatus(report, 'accountable.expectations')).toBe('shown');
    expect(careStatus(report, 'accountable.no-unsupported-promise')).toBe('shown');
  });

  it('does not read a promise to check as a promise of an outcome', () => {
    const report = call("I'll check whether it is fixed and call you back at nine.");
    expect(careStatus(report, 'accountable.no-unsupported-promise')).not.toBe('not-shown');
  });

  it('keeps the principal from reaching "strong" however well the rest went', () => {
    const base = [
      turn(HELLO),
      turn("I'll own this and stay with it until you're back in."),
      turn("I'll call you back at nine with an update. Does that work?"),
      turn(
        "To recap, I'll unlock the account, you'll update your phone, and I'll call you at nine.",
      ),
      turn('Thanks, goodbye.'),
    ];
    const promised = [...base];
    promised[1] = turn(
      "I'll own this and stay with it until you're back in. I guarantee it will be fixed by tonight.",
    );
    expect(careLevel(evaluate(classified(base)), 'accountable')).toBe('strong');
    expect(careLevel(evaluate(classified(promised)), 'accountable')).toBe('developing');
  });
});

describe('blaming the customer', () => {
  const blamed = call('You should have read the reminder email before changing your password.');

  it('is recorded against the engineer, with the words quoted', () => {
    expect(careStatus(blamed, 'accountable.no-blame')).toBe('not-shown');
    expect(careBehaviour(blamed, 'accountable.no-blame')?.evidence[0]?.quote).toMatch(
      /should have read the reminder email/,
    );
  });

  it('also costs the empathetic principal its respectful tone', () => {
    expect(careStatus(blamed, 'empathetic.respectful-tone')).toBe('not-shown');
  });

  it('is credited as absent only when the engineer took the problem on, with that moment as the quote', () => {
    const report = call("I'll own this and stay with it until you're back in.", 'Okay, thanks.');
    expect(careStatus(report, 'accountable.no-blame')).toBe('shown');
    expect(careBehaviour(report, 'accountable.no-blame')?.evidence[0]?.quote).toMatch(
      /I'll own this/,
    );
  });
});

describe('next action, named owner and tracking commitments', () => {
  it('credits a next action the engineer commits to', () => {
    expect(
      careStatus(
        call("I'll unlock the account now and call you back at nine."),
        'accountable.next-action',
      ),
    ).toBe('shown');
  });

  it('gives part credit when the next step is hedged or left to someone else', () => {
    expect(
      careStatus(
        call('Hopefully someone can look at it at some point.'),
        'accountable.next-action',
      ),
    ).toBe('partly');
  });

  it('credits a named owner', () => {
    expect(
      careStatus(
        call("I'll be your point of contact until this is closed."),
        'accountable.named-owner',
      ),
    ).toBe('shown');
  });

  it('credits a recap that says who does what and by when', () => {
    const report = call(
      "Just to recap, I'll unlock the account now, you'll update the password on your phone, and I'll call you at nine to check.",
    );
    expect(careStatus(report, 'accountable.tracks-commitments')).toBe('shown');
  });

  it('gives part credit for commitments that were never pulled together', () => {
    const report = call(
      "I'll unlock the account now.",
      "I'll call you at nine to check it worked.",
    );
    expect(careStatus(report, 'accountable.tracks-commitments')).toBe('partly');
  });
});
