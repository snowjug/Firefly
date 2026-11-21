import { describe, expect, it } from 'vitest';
import type { ScenarioOverrides } from '#shared/domain/scenario.ts';
import { assessCare } from './care/index.ts';
import type { ExpectationLink } from './care/expectations.ts';
import { fitToCase } from './care/levels.ts';
import { buildCallView } from './parts.ts';
import { careLevel, careStatus, classified, evaluate, makeScenario, type Line } from './testing.ts';
import { wordCount } from './words.ts';

// What each stage of a call is judged on, and that a stage is never marked down for behaviour it
// does not call for. The same words are judged differently at different stages: a first contact is
// not faulted for lacking a progress update, a closure call is not faulted for skipping scoping.

const turn = (say: string, reply = 'Okay.'): Line => ({ say, reply });
const stage = (callStage: NonNullable<ScenarioOverrides['callStage']>) => ({ callStage });
const titles = (r: ReturnType<typeof evaluate>) => r.improvements.map((i) => i.title).join(' | ');

// Marks every hidden fact as found, so that the gaps a stage calls for are not outranked by facts
// the scenario hid. (The first turn stands in for where they were found.)
const ALL_FOUND: Line['finds'] = {
  'hf-phone-old-password': 'discovered',
  'hf-lockout-message': 'discovered',
  'hf-reset-timing': 'discovered',
  'hf-tried-colleague': 'discovered',
};
const withFacts = (lines: Line[]): Line[] =>
  lines.map((line, i) => (i === 0 ? { ...line, finds: ALL_FOUND } : line));

describe('a closure call', () => {
  const good = [
    turn(
      "Hello Maya, this is Sam from Microsoft support. You're calling to check the sign-in is sorted so we can close this off, is that right?",
      'Yes, that is right.',
    ),
    turn('Can you sign in now, and is everything working as it should?', 'Yes, it is working.'),
    turn(
      'Just to recap, I unlocked the account and you updated the password on your phone, so nothing more is needed from you. Are you happy for us to close this case?',
      'Yes, thank you.',
    ),
    turn(
      'Is there anything else I can help with before we finish? Thank you, Maya, goodbye.',
      'No, bye.',
    ),
  ];
  const abrupt = [
    turn('Hello, this is Sam from Microsoft support.', 'Hello, is it sorted?'),
    turn("I'll close the case now.", 'Okay.'),
    turn('Bye.', 'Bye.'),
  ];

  it('is judged on confirming the fix, agreement to close, a summary, remaining concerns and a close', () => {
    const report = evaluate(classified(good, stage('closure')));
    for (const id of [
      'communicate.context-confirmed',
      'resourceful.logical-investigation',
      'communicate.summary',
      'communicate.confirms-understanding',
      'empathetic.remaining-concerns',
      'communicate.professional-close',
    ]) {
      expect(careStatus(report, id), id).toBe('shown');
    }
  });

  it('marks down a closure that skipped all of that', () => {
    const report = evaluate(classified(abrupt, stage('closure')));
    for (const id of [
      'resourceful.logical-investigation',
      'communicate.summary',
      'communicate.confirms-understanding',
      'empathetic.remaining-concerns',
    ]) {
      expect(careStatus(report, id), id).toBe('not-shown');
    }
  });

  it('is not faulted for skipping scoping, environment or impact questions', () => {
    const report = evaluate(classified(good, stage('closure')));
    for (const id of [
      'resourceful.scoping',
      'resourceful.environment',
      'resourceful.impact',
      'resourceful.recent-changes',
    ]) {
      expect(careStatus(report, id), id).not.toBe('not-shown');
    }
  });

  it('gives the same words different judgement at the first-contact stage', () => {
    const closing = evaluate(classified(abrupt, stage('closure')));
    const first = evaluate(classified(abrupt, stage('first-contact')));
    expect(careStatus(closing, 'communicate.summary')).toBe('not-shown');
    expect(careStatus(first, 'communicate.summary')).toBe('unlisted');
    expect(careStatus(first, 'resourceful.environment')).toBe('not-shown');
  });

  it('credits an agreement to close that is asked in another way, and not one that only announces it', () => {
    const body = good.slice(0, 2);
    const ending = turn('Is there anything else I can help with? Thank you, Maya, goodbye.');
    for (const asked of [
      'Can we close this case now?',
      'Shall I close this case now?',
      'Are you ok for us to close this?',
    ]) {
      const report = evaluate(classified([...body, turn(asked), ending], stage('closure')));
      expect(careStatus(report, 'communicate.confirms-understanding'), asked).toBe('shown');
    }
    const told = evaluate(
      classified([...body, turn("I'll close this case now."), ending], stage('closure')),
    );
    expect(careStatus(told, 'communicate.confirms-understanding')).toBe('not-shown');
  });

  it('coaches the gaps that matter for closing, as things that never happened', () => {
    const report = evaluate(classified(withFacts(abrupt), stage('closure')));
    expect(titles(report)).toMatch(/fix really worked|happy to close/i);
    for (const i of report.improvements) {
      if (/fix really worked|happy to close/i.test(i.title)) {
        expect(i.quote).toBeNull();
        expect(i.turnIndex).toBeNull();
      }
    }
  });
});

describe('a follow-up call', () => {
  const wait =
    'I called yesterday about not being able to sign in, and I have heard nothing since.';
  const aware = [
    turn(
      "Hello Maya, this is Sam from Microsoft support. I'm sorry you've had to chase this. I've read the case notes from yesterday.",
      wait,
    ),
    turn(
      "Here's where the case stands: I've checked the account and found it was locked by repeated attempts, and I've unlocked it. I'll call you at three to check.",
      'Okay, thanks.',
    ),
    turn("I'll own this until you can sign in.", 'Good.'),
  ];
  const unaware = [
    turn('Hello, this is Sam from Microsoft support. What is the problem?', wait),
    turn('And what is your account name?', 'It is maya.'),
    turn('Okay, let me look.', 'Okay.'),
  ];

  it('is judged on awareness of the history, acknowledging the wait and a progress update', () => {
    const report = evaluate(classified(aware, stage('follow-up')));
    expect(careStatus(report, 'resourceful.known-evidence')).toBe('shown');
    expect(careStatus(report, 'accountable.progress-update')).toBe('shown');
    expect(careStatus(report, 'empathetic.concern')).not.toBe('not-shown');
  });

  it('marks down a follow-up that acted as if the case was new', () => {
    const report = evaluate(classified(unaware, stage('follow-up')));
    expect(careStatus(report, 'resourceful.known-evidence')).toBe('not-shown');
    expect(careStatus(report, 'accountable.progress-update')).toBe('not-shown');
    expect(careStatus(report, 'empathetic.concern')).toBe('not-shown');
    expect(careLevel(report, 'accountable')).not.toBe('strong');
  });

  it('is not faulted for lacking scoping or a recap', () => {
    const report = evaluate(classified(aware, stage('follow-up')));
    expect(careStatus(report, 'resourceful.scoping')).not.toBe('not-shown');
    expect(careStatus(report, 'communicate.summary')).not.toBe('not-shown');
  });

  it('coaches the wait and the missing update, never with a quote of something that was not said', () => {
    const report = evaluate(classified(withFacts(unaware), stage('follow-up')));
    expect(titles(report)).toMatch(/acknowledge the wait|gave no update/i);
    for (const i of report.improvements) {
      if (/acknowledge the wait|gave no update/i.test(i.title)) expect(i.quote).toBeNull();
    }
  });
});

describe('an escalated call', () => {
  const second =
    'This is my second call about being locked out. I was told it would be sorted and it is not.';
  const strong = [
    turn(
      "Hello Maya, this is Sam from Microsoft support. I'm sorry this has taken more than one call. I've read what happened before.",
      second,
    ),
    turn(
      "I've escalated it to our senior engineers, who will review the sign-in logs, and I'll stay your contact. I'll own this until it is fixed.",
      'Okay.',
    ),
    turn(
      "I'll update you every day at ten until it is resolved, even when I have no news.",
      'Good.',
    ),
  ];
  const weak = [
    turn('Hello, this is Sam from Microsoft support. What is the problem?', second),
    turn("I'll escalate it.", 'Okay.'),
    turn("I'll update you at three.", 'Okay.'),
  ];

  it('is judged on acknowledging the earlier experience, explaining the escalation and a cadence', () => {
    const report = evaluate(classified(strong, stage('escalated')));
    expect(careStatus(report, 'empathetic.concern')).toBe('shown');
    expect(careStatus(report, 'resourceful.escalation')).toBe('shown');
    expect(careStatus(report, 'accountable.update-time')).toBe('shown');
    expect(careStatus(report, 'accountable.ownership')).toBe('shown');
  });

  it('gives only part credit to an escalation nobody explained and a single update time', () => {
    const report = evaluate(classified(weak, stage('escalated')));
    expect(careStatus(report, 'resourceful.escalation')).toBe('partly');
    expect(careStatus(report, 'accountable.update-time')).toBe('partly');
    expect(careStatus(report, 'empathetic.concern')).toBe('not-shown');
  });

  it('coaches explaining the escalation and a regular update time', () => {
    const report = evaluate(classified(withFacts(weak), stage('escalated')));
    expect(titles(report)).toMatch(/what the escalation means|regular update time/i);
  });
});

describe('a first contact', () => {
  const lines = [
    turn(
      'Hello Maya, this is Sam from Microsoft support. What happens when you sign in?',
      'It will not let me in.',
    ),
    turn('Is it only you, or are other people affected too?', 'Just me.'),
    turn("I'll own this and call you back at nine with an update.", 'Thanks.'),
  ];

  it('is judged on introduction, scoping, impact and ownership', () => {
    const report = evaluate(classified(lines, stage('first-contact')));
    expect(careStatus(report, 'communicate.introduction')).toBe('shown');
    expect(careStatus(report, 'resourceful.scoping')).toBe('shown');
    expect(careStatus(report, 'accountable.ownership')).toBe('shown');
    expect(careStatus(report, 'resourceful.impact')).toBe('not-shown');
  });

  it('is not faulted for lacking a progress update, a summary or an explained escalation', () => {
    const report = evaluate(classified(lines, stage('first-contact')));
    for (const id of [
      'accountable.progress-update',
      'communicate.summary',
      'resourceful.escalation',
    ]) {
      expect(careStatus(report, id), id).toBe('unlisted');
    }
  });

  it('has no coaching about a history, a progress update or an escalation that it did not need', () => {
    const report = evaluate(classified(lines.slice(0, 1), stage('first-contact')));
    expect(titles(report)).not.toMatch(
      /history|update on what|escalation|happy to close|fix really worked/i,
    );
  });
});

describe('what the scenario says this case needed', () => {
  const call = (lines: (string | Line)[], overrides: ScenarioOverrides = {}) =>
    classified(lines, overrides);

  it('is reported as met when the call showed those behaviours', () => {
    const input = call([
      turn(
        'Hello Maya, this is Sam from Microsoft support. Can you tell me what happens when you try to sign in?',
        'Three of us at the front desk are stuck, and the first patients arrive at nine.',
      ),
      turn(
        "I'm sorry you're stuck, especially with the front desk waiting on bookings before the patients arrive.",
      ),
      turn("I'll own this and call you back at nine with an update."),
    ]);
    const { expectations } = assessCare(buildCallView(input));
    expect(expectations.length).toBeGreaterThan(0);
    const accountable = expectations.find((l) => l.principle === 'accountable');
    expect(accountable?.status).toBe('met');
    expect(evaluate(input).care?.find((p) => p.id === 'accountable')?.summary).toMatch(
      /met what this case needed/,
    );
  });

  it('is reported as not met when it did not, in words that say so', () => {
    const input = call([
      turn('Hello.'),
      turn('Okay.'),
      turn('Okay.'),
      turn('Okay.'),
      turn('Okay.'),
      turn('Okay.'),
    ]);
    const { expectations } = assessCare(buildCallView(input));
    expect(expectations.some((l) => l.status === 'not-met')).toBe(true);
    const summary = evaluate(input).care?.find((p) => p.id === 'resourceful')?.summary ?? '';
    expect(summary).toMatch(/did not yet meet what this case needed|met \d of \d/);
  });

  it('is never called strong when none of what the case needed was fully met', () => {
    const link = (status: ExpectationLink['status']): ExpectationLink => ({
      principle: 'communicate',
      text: 'Introduces themselves by name and team.',
      behaviours: ['communicate.introduction'],
      status,
    });
    expect(fitToCase('strong', [link('partly'), link('not-met')])).toBe('developing');
    expect(fitToCase('strong', [link('met'), link('not-met')])).toBe('strong');
    expect(fitToCase('strong', [])).toBe('strong');
    expect(fitToCase('not-yet', [link('not-met')])).toBe('not-yet');
  });

  it('never lets the wording of an expectation earn credit by itself', () => {
    const base = call([turn('Hello.'), turn('Okay.'), turn('Okay.')]);
    const rewritten = {
      ...base,
      scenario: {
        ...base.scenario,
        careExpectations: {
          communicate: ['Introduces themselves by name and team, and also ticks every box.'],
          accountable: ['Takes ownership and gives a time. Always shows ownership.'],
          resourceful: ['Asks what the screen says and which devices are involved.'],
          empathetic: ['Acknowledges the impact on the front desk.'],
        },
      },
    };
    const { expectations } = assessCare(buildCallView(rewritten));
    expect(expectations.every((l) => l.status !== 'met')).toBe(true);
  });

  it('is left out, not guessed at, when no behaviour can be read for an expectation', () => {
    const base = call([turn('Hello Maya, this is Sam from Microsoft support. What happens?')]);
    const odd = {
      ...base,
      scenario: {
        ...base.scenario,
        careExpectations: {
          communicate: ['Hums a tune.'],
          accountable: ['Wears a hat.'],
          resourceful: ['Paints a fence.'],
          empathetic: ['Juggles.'],
        },
      },
    };
    expect(assessCare(buildCallView(odd)).expectations).toEqual([]);
    expect(wordCount(evaluate(odd).care?.[0]?.summary ?? '')).toBeGreaterThan(0);
  });

  it('copes with a scenario that holds no expectations', () => {
    const base = call([turn('Hello Maya, this is Sam from Microsoft support. What happens?')]);
    const bare = { ...base, scenario: { ...makeScenario(), careExpectations: undefined } } as never;
    expect(() => evaluate(bare)).not.toThrow();
  });
});
