import { describe, expect, it } from 'vitest';
import type { EvaluationInput } from '#server/engine/types.ts';
import { closingCheck, customerStance } from './closingCheck.ts';
import { classified, evaluate, careStatus, type Line } from './testing.ts';

// The neutral completion check at End call: a plan, an owner and an update time stated, and the
// customer's agreement. The three statements are the evaluator's own accountable behaviours, so
// these tests also pin that the check and the coaching report read the same words the same way.

const HELLO =
  'Hello Maya, this is Sam from the Microsoft support team. What happens when you sign in?';
const turn = (say: string, reply = 'Okay, thank you.'): Line => ({ say, reply });
const checksOf = (lines: (string | Line)[], overrides = {}) =>
  closingCheck(classified(lines, overrides)).checks;

describe('what has been stated', () => {
  it('passes a call that states a plan, an owner and a time, and the customer accepts', () => {
    const lines = [
      turn(HELLO, 'It just says my password is wrong.'),
      turn('When did it start?', 'This morning, after I changed it.'),
      turn(
        "I'll own this and update you by 3 PM today, even if I'm still working on it. Does that work?",
        'That works for me, thank you.',
      ),
    ];
    expect(closingCheck(classified(lines))).toEqual({
      traineeTurns: 3,
      checks: { plan: true, owner: true, updateTime: true, agreement: true },
    });
  });

  it('counts "I\'ll own this and update you by 3 PM" as a plan, an owner and a time, introduced or not', () => {
    const said = "I'll own this and update you by 3 PM.";
    for (const lines of [[turn(said)], [turn(HELLO), turn(said)]]) {
      expect(checksOf(lines)).toMatchObject({ plan: true, owner: true, updateTime: true });
    }
  });

  it('fails a call that stated nothing, and a call nobody has spoken in yet', () => {
    expect(checksOf([turn(HELLO), turn('What does it say?'), turn('When did it start?')])).toEqual({
      plan: false,
      owner: false,
      updateTime: false,
      agreement: false,
    });
    expect(closingCheck(classified([]))).toEqual({
      traineeTurns: 0,
      checks: { plan: false, owner: false, updateTime: false, agreement: false },
    });
  });

  it('does not count a vague "I\'ll look into it" as a plan, an owner or a time', () => {
    for (const said of [
      "I'll look into it.",
      'Let me look into that for you.',
      "I'll check on it now.",
    ]) {
      for (const lines of [[turn(said)], [turn(HELLO), turn(said)]]) {
        expect(checksOf(lines), said).toEqual({
          plan: false,
          owner: false,
          updateTime: false,
          agreement: false,
        });
      }
    }
  });

  it('still counts a commitment that says what will be looked into, and when', () => {
    expect(
      checksOf([turn(HELLO), turn("I'll look into the account lock and call you back at nine.")]),
    ).toMatchObject({ plan: true, updateTime: true });
  });

  it('does not count a hedged next step, or a promise to update with no time', () => {
    const hedged = checksOf([turn(HELLO), turn("I'll try to get back to you at some point.")]);
    expect(hedged).toMatchObject({ plan: false, updateTime: false });
    const untimed = checksOf([turn(HELLO), turn("I'll update you soon.")]);
    expect(untimed.updateTime).toBe(false);
  });

  it('counts a time without an owner, and an owner without a time', () => {
    const timed = checksOf([turn("I'll call you back at nine.")]);
    expect(timed).toMatchObject({ plan: true, updateTime: true, owner: false });
    const owner = checksOf([turn("I'll be your point of contact until this is closed.")]);
    expect(owner).toMatchObject({ owner: true, updateTime: false });
  });

  it('counts a time on an escalated call, where the report also asks for a regular cadence', () => {
    const lines = [turn(HELLO), turn("I'll own this and update you by 3 PM.")];
    expect(checksOf(lines, { callStage: 'escalated' }).updateTime).toBe(true);
  });

  it('agrees with the coaching report about what was stated', () => {
    const input = classified([turn(HELLO), turn("I'll own this and update you by 3 PM.")]);
    const report = evaluate(input);
    expect(careStatus(report, 'accountable.next-action')).toBe('shown');
    expect(careStatus(report, 'accountable.update-time')).toBe('shown');
    expect(closingCheck(input).checks).toMatchObject({ plan: true, updateTime: true });
  });

  it('is only booleans and a count, with no words from the call', () => {
    const result = closingCheck(
      classified([turn(HELLO), turn("I'll own this and update you by 3 PM.")]),
    );
    expect(Object.keys(result).sort()).toEqual(['checks', 'traineeTurns']);
    expect(Object.keys(result.checks).sort()).toEqual(['agreement', 'owner', 'plan', 'updateTime']);
    expect(Object.values(result.checks).every((v) => typeof v === 'boolean')).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/own this|3 PM|Maya/);
  });

  it('gives the same answer every time and leaves the call as it was', () => {
    const input = classified([turn(HELLO), turn("I'll own this and update you by 3 PM.")]);
    const before = JSON.stringify(input);
    expect(closingCheck(input)).toEqual(closingCheck(input));
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe('whether the customer agreed', () => {
  const STATE = "I'll own this and update you by 3 PM today. Does that work?";
  const after = (...replies: string[]) =>
    checksOf([
      turn(HELLO),
      turn(STATE, replies[0] ?? 'Okay.'),
      ...replies.slice(1).map((r) => turn('Anything else I can help with?', r)),
    ]);

  it('is confirmed when the customer accepts, even if they ask something else as well', () => {
    expect(after('That works for me, thank you.').agreement).toBe(true);
    expect(
      after('That works for me. Is there anything you need from our side before then?').agreement,
    ).toBe(true);
  });

  it('is not confirmed when the customer pushes back, doubts it or asks for it again', () => {
    for (const reply of [
      "That's not very specific. When will I hear from you?",
      'Okay, but when should I expect to hear back?',
      "That's too late for us.",
      'Okay, I hope so.',
      'Not until I understand what changed.',
    ]) {
      expect(after(reply).agreement, reply).toBe(false);
    }
  });

  it('is confirmed when the customer asks for it back, is told yes, and then accepts', () => {
    const result = checksOf([
      turn(HELLO),
      turn(STATE, 'Okay, so you will own this and update me by 3 PM?'),
      turn('Yes, that is right.', "Good, that's what I wanted to hear."),
    ]);
    expect(result.agreement).toBe(true);
  });

  it('is not confirmed while the customer is still asking for it back', () => {
    expect(
      after('Okay, so you will own this and update me by 3 PM, is that right?').agreement,
    ).toBe(false);
  });

  it('is not confirmed when the customer has not replied yet, or said nothing about it', () => {
    const waiting = classified([turn(HELLO), turn(STATE)]);
    const unanswered: EvaluationInput = { ...waiting, turns: waiting.turns.slice(0, -1) };
    expect(closingCheck(unanswered).checks).toMatchObject({ plan: true, agreement: false });
    expect(after('Hmm.').agreement).toBe(false);
  });

  it('holds when a later, unrelated question gets an unhelpful answer', () => {
    expect(after('That works for me.', "I'm not sure, sorry.").agreement).toBe(true);
  });

  it('is not confirmed when the first reply pushed back, even if the customer gave in afterwards', () => {
    const result = checksOf([
      turn(HELLO),
      turn(STATE, "That's too late for us."),
      turn('I understand, and I am sorry about that.', 'Okay, fine. Thank you.'),
    ]);
    expect(result).toMatchObject({ updateTime: true, agreement: false });
  });

  it('is read against the latest thing the trainee stated', () => {
    const result = checksOf([
      turn(HELLO),
      turn(STATE, 'That works for me.'),
      turn("Actually, I'll update you at 1 PM instead.", "That's too late. I need it sooner."),
    ]);
    expect(result).toMatchObject({ updateTime: true, agreement: false });
  });

  it('is not confirmed when nothing was stated, whatever the customer says', () => {
    expect(
      checksOf([turn(HELLO, 'That works for me.'), turn('What does it say?', 'Okay.')]),
    ).toMatchObject({ plan: false, agreement: false });
  });
});

describe('how a customer reply reads', () => {
  it.each([
    // The demo customer's own words when it accepts.
    ['That works for me, thank you.', 'accept'],
    ["Okay. I'll expect to hear from you then.", 'accept'],
    ["Okay. If I don't hear from you then, I'll call back.", 'accept'],
    ["Good. That's what I wanted to hear.", 'accept'],
    ["That's everything, thanks. So you'll own the case and update me by 3 PM.", 'accept'],
    ['No, that is everything.', 'accept'],
    ["Yes, I think that's fine to close. Thank you.", 'accept'],
    ['Okay.', 'accept'],
    ['Understood. Thank you.', 'accept'],
    ['Yes, please do.', 'accept'],
    ['That would be great, thank you.', 'accept'],
    // Asking for it again.
    ['Okay. So you will own it and update me by 3 PM, is that right?', 'ask'],
    ['Okay. When exactly will I hear from you?', 'ask'],
    ["Who's actually going to own this?", 'ask'],
    ['I need a time. When exactly will I hear from you?', 'ask'],
    ['How often will I hear from you?', 'ask'],
    ['Sorry, was it 3 PM or 4 PM? I am a bit confused.', 'ask'],
    // Pushing back or doubting.
    ["That's not good enough. Who exactly is doing this, and by when?", 'object'],
    ["You can't promise that yet. You don't know what's wrong.", 'object'],
    ["I'd just like to understand what changed first, if that's okay.", 'object'],
    ["Oh, that would be wonderful. I really hope that's right.", 'object'],
    // Not about it at all.
    ['Can you tell me where things stand with the case?', 'none'],
    ["I'm not sure which policy changed.", 'none'],
    ['Hmm.', 'none'],
    ['', 'none'],
  ] as const)('%s -> %s', (reply, stance) => {
    expect(customerStance(reply)).toBe(stance);
  });

  it('lets an acceptance stand when a question about something else follows it', () => {
    expect(customerStance('That works for me. Is there anything you need from our side?')).toBe(
      'accept',
    );
    expect(customerStance('Okay, but when should I expect to hear back?')).toBe('ask');
  });
});
