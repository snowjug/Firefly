import { describe, expect, it } from 'vitest';
import type { CoachingReport } from '#shared/domain/report.ts';
import { classified, evaluate, type Line } from './testing.ts';

// Style is never scored. CARE reads what the trainee did (what was asked, offered, promised and
// acknowledged), never accent, fluency, voice, speed, spelling, capital letters or harmless
// grammar. The same call, worded with slips, must be judged the same; so must the same call put to
// a customer who writes in simpler English.

const turn = (say: string, reply = 'Okay.'): Line => ({ say, reply });

const REPLIES = [
  'It will not let me in. Three of us at the front desk are stuck, and the patients arrive at nine.',
  'Yes, only us.',
  'I changed my password this morning, and yes it is on my phone.',
  'Thank you.',
  'Yes.',
  'No, bye.',
];

const SAID = [
  'Hello Maya, this is Sam from the Microsoft support team. What happens when you try to sign in?',
  "I'm sorry you're stuck, especially with the front desk waiting on bookings. Is it only the three of you?",
  'Was anything changed shortly before it started, and is your work email signed in on a phone?',
  "I'll own this and unlock the account now. I'll call you back at nine with an update.",
  "Just to recap: three of you are locked out since this morning, I'll unlock the account, and you'll update the phone. Is that right?",
  'Is there anything else I can help with? Thank you, Maya, goodbye.',
];

const lines = (said: string[], replies: string[] = REPLIES): Line[] =>
  said.map((say, i) => turn(say, replies[i]));

/** Everything the report says about CARE and the journey, for comparing two calls. Dimension
 * scores are not included: they follow the classification of each turn, which the engine owns. */
const profile = (report: CoachingReport) => ({
  behaviours: Object.fromEntries(
    (report.care ?? []).flatMap((p) => p.behaviours).map((b) => [b.id, b.status]),
  ),
  levels: Object.fromEntries((report.care ?? []).map((p) => [p.id, p.level])),
  milestones: (report.journey.milestones ?? []).map((m) => `${m.id}:${m.status}`),
});

const reference = evaluate(classified(lines(SAID)));

describe('the reference call', () => {
  it('is a good call, so that a slip that cost credit would show', () => {
    const p = profile(reference);
    expect(p.levels).toMatchObject({
      communicate: 'strong',
      accountable: 'strong',
      empathetic: 'strong',
    });
    expect(p.milestones.filter((m) => m.endsWith(':reached'))).toHaveLength(5);
  });
});

describe('spelling, capitals and typed habits', () => {
  it('judges lower-case text with no apostrophes the same as the careful version', () => {
    const slipped = SAID.map((s) => s.toLowerCase().replace(/'/g, ''));
    expect(profile(evaluate(classified(lines(slipped))))).toEqual(profile(reference));
  });

  it('judges filler words and extra spaces the same', () => {
    const slipped = SAID.map((s) => `Um,   ${s.replace(/\. /g, '.   Uh, ')}`);
    expect(profile(evaluate(classified(lines(slipped))))).toEqual(profile(reference));
  });

  it('does not read a missing apostrophe as a missing commitment, apology or introduction', () => {
    const slipped = [
      'Hello Maya, this is Sam from the Microsoft support team.',
      'Im sorry youre stuck, with the front desk waiting on bookings.',
      'Ill own this and unlock the account now. Ill call you back at nine with an update.',
    ];
    const report = evaluate(classified(lines(slipped)));
    const p = profile(report);
    expect(p.behaviours['communicate.introduction']).toBe('shown');
    expect(p.behaviours['empathetic.concern']).toBe('shown');
    expect(p.behaviours['accountable.ownership']).toBe('shown');
    expect(p.behaviours['accountable.update-time']).toBe('shown');
  });
});

describe('grammar and non-native phrasing', () => {
  const NON_NATIVE = [
    'Hello Maya, I am Sam from the Microsoft support team. Please you tell me what happen when you try to sign in?',
    'I am very sorry you are stuck, with front desk waiting on bookings. Is it only three of you?',
    'Was anything changed shortly before it start, and is your work email signed in on phone?',
    "I'll own this and unlock the account now. I'll call you back at nine with update.",
    "To recap: three of you are locked out since this morning, I'll unlock account, and you'll update phone. Is that right?",
    'Is there anything else I can help with? Thank you Maya, goodbye.',
  ];

  it('judges the same behaviour the same when it is worded with grammar slips', () => {
    const report = evaluate(classified(lines(NON_NATIVE)));
    expect(profile(report).behaviours).toEqual(profile(reference).behaviours);
    expect(profile(report).levels).toEqual(profile(reference).levels);
    expect(profile(report).milestones).toEqual(profile(reference).milestones);
  });

  it('never mentions grammar, accent, spelling or fluency anywhere in the CARE text', () => {
    const report = evaluate(classified(lines(NON_NATIVE)));
    const text = JSON.stringify(
      (report.care ?? []).map((p) => [p.summary, p.behaviours.map((b) => [b.label, b.note])]),
    );
    expect(text).not.toMatch(/grammar|accent|spelling|fluen|pronunc|native|typo|mispell/i);
  });
});

describe('a customer who writes in simpler English', () => {
  const SIMPLE_REPLIES = [
    'I not can sign in. Three people at front desk, stuck. Patients come at nine.',
    'Yes only us.',
    'I change password this morning. Yes, my phone have the email.',
    'Thank you.',
    'Yes.',
    'No. Bye.',
  ];

  it('does not change what the engineer is credited for', () => {
    const report = evaluate(classified(lines(SAID, SIMPLE_REPLIES)));
    expect(profile(report)).toEqual(profile(reference));
  });

  it('does not make the engineer\u2019s plain language count against them', () => {
    const report = evaluate(classified(lines(SAID, SIMPLE_REPLIES), { proficiency: 'novice' }));
    const plain = (report.care ?? [])
      .flatMap((p) => p.behaviours)
      .find((b) => b.id === 'communicate.plain-language');
    expect(plain?.status).not.toBe('not-shown');
  });
});

describe('length, speed and voice', () => {
  it('credits a short, correct opening as much as a long one', () => {
    const terse = evaluate(
      classified([
        turn('Hello, Sam from Microsoft support. What happens when you sign in?', REPLIES[0]),
      ]),
    );
    const wordy = evaluate(
      classified([
        turn(
          'Hello there, Maya, and thank you very much for taking the time to call us this morning. My name is Sam and I am calling from the Microsoft support team. Could you please tell me, in your own words and taking all the time you need, what happens when you try to sign in?',
          REPLIES[0],
        ),
      ]),
    );
    for (const id of [
      'communicate.greeting',
      'communicate.introduction',
      'communicate.clear-questions',
    ]) {
      expect(profile(terse).behaviours[id], id).toBe(profile(wordy).behaviours[id]);
    }
  });

  it('is not moved by how long the call took, what voice it used or which provider ran it', () => {
    const base = classified(lines(SAID));
    const slow = {
      ...base,
      durationSeconds: 3600,
      provider: { kind: 'mock' as const, label: 'Another voice' },
    };
    const fast = { ...base, durationSeconds: 30 };
    expect(profile(evaluate(slow))).toEqual(profile(evaluate(fast)));
    expect(profile(evaluate(slow))).toEqual(profile(reference));
  });
});
