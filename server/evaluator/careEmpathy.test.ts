import { describe, expect, it } from 'vitest';
import type { CareLevel } from '#shared/domain/report.ts';
import {
  careBehaviour,
  careLevel,
  careStatus,
  classified,
  evaluate,
  type Line,
} from './testing.ts';

// EMPATHETIC read from behaviour. Empathy is credited for what it is about and what follows it, not
// for the words "sorry" or "I understand": repeated with nothing behind it, those earn nothing and
// the same apology said again lowers the result. The reverse also holds: a real acknowledgement
// that is worded in an unusual way still counts.

const turn = (say: string, reply = 'Okay.'): Line => ({ say, reply });
const STUCK =
  'Three of us at the front desk cannot sign in, and the first patients arrive at nine.';
const HELLO = 'Hello Maya, this is Sam from the Microsoft support team. What is happening?';
const opening = turn(HELLO, STUCK);

const call = (...said: string[]) => evaluate(classified([opening, ...said.map((s) => turn(s))]));

const RANK: Record<CareLevel, number> = {
  'limited-evidence': -1,
  'not-yet': 0,
  developing: 1,
  strong: 2,
};

describe('acknowledging the concern', () => {
  it('credits sympathy that is about what the customer actually said', () => {
    const report = call(
      "I'm sorry you're stuck, especially with the front desk waiting on bookings before the patients arrive.",
    );
    expect(careStatus(report, 'empathetic.concern')).toBe('shown');
    expect(careStatus(report, 'empathetic.business-impact')).toBe('shown');
  });

  it.each([
    'That sounds like a stressful start to the day for the whole front desk.',
    "No wonder you're worried, with the patients arriving at nine and nobody able to check them in.",
    'I can only imagine how stuck you feel with three people at the front desk locked out.',
  ])('credits an acknowledgement worded in an unusual way: %s', (said) => {
    expect(careStatus(call(said), 'empathetic.concern')).toBe('shown');
  });

  it('does not credit "I understand" said again and again with nothing behind it', () => {
    const report = call('I understand.', 'I understand. I understand.');
    expect(careStatus(report, 'empathetic.concern')).toBe('not-shown');
    expect(careBehaviour(report, 'empathetic.concern')?.note).toMatch(
      /repeated with nothing useful/,
    );
    expect(careStatus(report, 'empathetic.no-robotic-apology')).toBe('not-shown');
  });

  it('credits a single "I understand" only in part, and only when something useful follows it', () => {
    const withAction = call(
      "I understand. I'll unlock the account now and email you once it is done.",
    );
    expect(careStatus(withAction, 'empathetic.concern')).toBe('partly');
    const bare = call('I understand. Someone will look at it soon.');
    expect(careStatus(bare, 'empathetic.concern')).toBe('not-shown');
  });

  it('counts the same apology repeated word for word against the engineer, not for', () => {
    const apology = "I'm so sorry about this.";
    const once = call(apology, 'What does the sign-in screen say?', 'And when did it start?');
    const repeated = call(
      apology,
      'What does the sign-in screen say?',
      apology,
      'When did it start?',
      apology,
    );
    expect(careStatus(once, 'empathetic.no-robotic-apology')).toBe('shown');
    expect(careStatus(repeated, 'empathetic.no-robotic-apology')).toBe('not-shown');
    expect(careBehaviour(repeated, 'empathetic.no-robotic-apology')?.note).toMatch(/scripted/);
    expect(RANK[careLevel(repeated, 'empathetic')]).toBeLessThanOrEqual(
      RANK[careLevel(once, 'empathetic')],
    );
    expect(careLevel(repeated, 'empathetic')).not.toBe('strong');
  });

  it('gives only part credit to a specific apology that is then repeated', () => {
    const wait = "I'm sorry about the wait, you've had to chase this.";
    const report = evaluate(
      classified(
        [
          turn(HELLO, 'I called yesterday and I have been waiting since then.'),
          turn(wait),
          turn('Let me look.'),
          turn(wait),
        ],
        { callStage: 'follow-up' },
      ),
    );
    expect(careStatus(report, 'empathetic.concern')).toBe('partly');
    expect(careStatus(report, 'empathetic.no-robotic-apology')).toBe('not-shown');
  });
});

describe('the business impact', () => {
  it('credits an acknowledgement that names what is at stake', () => {
    const report = call(
      "I can see three of you are stuck with the patients arriving at nine, so I'll treat this as urgent.",
    );
    expect(careStatus(report, 'empathetic.business-impact')).toBe('shown');
  });

  it('gives part credit for "this is important" without naming what is at stake', () => {
    const report = call('I know this is important.');
    expect(careStatus(report, 'empathetic.business-impact')).toBe('partly');
    expect(careBehaviour(report, 'empathetic.business-impact')?.note).toMatch(
      /did not name what was at stake/,
    );
  });

  it('credits nothing when the impact was never acknowledged', () => {
    expect(
      careStatus(call('What does the sign-in screen say?'), 'empathetic.business-impact'),
    ).toBe('not-shown');
  });

  it('credits asking about the impact as scoping, separately from acknowledging it', () => {
    const report = call(
      'How is this affecting your work, and is there a deadline you have to meet?',
    );
    expect(careStatus(report, 'resourceful.impact')).toBe('shown');
    expect(careStatus(report, 'empathetic.business-impact')).toBe('not-shown');
  });
});

describe('empathy and action are read separately', () => {
  const sympathyOnly = evaluate(
    classified([
      turn('Hello Maya, this is Sam from the Microsoft support team.', STUCK),
      turn(
        "I'm so sorry you're stuck, with the front desk waiting on bookings.",
        'It is stressful.',
      ),
      turn('That sounds really stressful with the patients arriving at nine.', 'Yes.'),
      turn('I can imagine how worrying this is for the whole front desk.', 'Yes.'),
      turn('Thank you for your patience, Maya.', 'Okay.'),
    ]),
  );
  const actionOnly = evaluate(
    classified([
      turn('Hello, this is Sam from Microsoft support. What does the sign-in screen say?', STUCK),
      turn(
        "I'll unlock the account now and call you back at nine. Is your work email signed in on a phone?",
        'Yes it is.',
      ),
      turn("Remove the old password from the phone. I'll own this until you are back in.", 'Done.'),
      turn(
        "Just to recap, I've unlocked the account, you'll update the phone, and I'll call you at nine. Is that right?",
        'Yes.',
      ),
      turn('Goodbye.', 'Bye.'),
    ]),
  );

  it('does not let empathy with no action pass for accountability', () => {
    expect(careStatus(sympathyOnly, 'empathetic.concern')).toBe('shown');
    expect(careBehaviour(sympathyOnly, 'empathetic.concern')?.note).toMatch(
      /not followed by an action/,
    );
    expect(careLevel(sympathyOnly, 'empathetic')).toBe('strong');
    expect(careLevel(sympathyOnly, 'accountable')).toBe('not-yet');
  });

  it('does not let action with no empathy pass for empathy', () => {
    expect(careStatus(actionOnly, 'empathetic.concern')).toBe('not-shown');
    expect(careBehaviour(actionOnly, 'empathetic.concern')?.note).toMatch(/straight to action/);
    expect(careLevel(actionOnly, 'accountable')).toBe('strong');
    expect(RANK[careLevel(actionOnly, 'empathetic')]).toBeLessThan(RANK.strong);
  });
});

describe('dismissive and impatient wording', () => {
  it('is quoted against the engineer and keeps the principal from reaching strong', () => {
    const report = call("Don't worry about it, it's not a big deal.");
    expect(careStatus(report, 'empathetic.no-dismissive')).toBe('not-shown');
    expect(careBehaviour(report, 'empathetic.no-dismissive')?.evidence[0]?.quote).toMatch(
      /not a big deal/,
    );
    expect(careStatus(report, 'empathetic.respectful-tone')).toBe('not-shown');
  });

  it('is not triggered by plain reassurance that something will be done', () => {
    const report = call("Don't worry, I'll look into it and call you back at nine.");
    expect(careStatus(report, 'empathetic.no-dismissive')).not.toBe('not-shown');
  });

  it('counts impatience against the tone of the call', () => {
    const report = call('As I said, I already told you that. Just answer the question.');
    expect(careStatus(report, 'empathetic.respectful-tone')).toBe('not-shown');
  });

  it('keeps one harmful reply from being outweighed by otherwise good empathy', () => {
    const good = evaluate(
      classified([
        turn('Hello Maya, this is Sam from the Microsoft support team.', STUCK),
        turn("I'm so sorry you're stuck, with the front desk waiting on bookings."),
        turn('That sounds really stressful with the patients arriving at nine.'),
        turn('I can imagine how worrying this is for the whole front desk.'),
        turn("I'll own this and call you back at nine."),
      ]),
    );
    const spoiled = evaluate(
      classified([
        turn('Hello Maya, this is Sam from the Microsoft support team.', STUCK),
        turn("I'm so sorry you're stuck, with the front desk waiting on bookings."),
        turn('That sounds really stressful with the patients arriving at nine.'),
        turn("Don't worry about it, it's not a big deal."),
        turn("I'll own this and call you back at nine."),
      ]),
    );
    expect(careLevel(good, 'empathetic')).toBe('strong');
    expect(careLevel(spoiled, 'empathetic')).toBe('developing');
  });
});
