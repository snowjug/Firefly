import { describe, expect, it } from 'vitest';
import { careBehaviour, careStatus, classified, evaluate, type Line } from './testing.ts';

// RESOURCEFUL read from behaviour: what was asked about, in what order, whether what the customer
// had already said was used, and whether help was brought in when it was warranted.

const turn = (say: string, reply = 'Okay.'): Line => ({ say, reply });
const HELLO =
  'Hello Maya, this is Sam from the Microsoft support team. What happens when you sign in?';
const SAID =
  'It will not let me in. My work email is on my personal phone too, and it keeps asking me to re-enter my password.';
const opening = turn(HELLO, SAID);

const call = (...said: (string | Line)[]) =>
  evaluate(classified([opening, ...said.map((s) => (typeof s === 'string' ? turn(s) : s))]));

describe('the topics a call explores', () => {
  it('credits asking about the environment, recent changes and what was already tried', () => {
    const report = call(
      'Is your work email signed in on any other device, like a phone or a tablet?',
      'Was anything changed or updated shortly before it started?',
      'What have you already tried so far?',
    );
    expect(careStatus(report, 'resourceful.environment')).toBe('shown');
    expect(careStatus(report, 'resourceful.recent-changes')).toBe('shown');
    expect(careStatus(report, 'resourceful.prior-troubleshooting')).toBe('shown');
  });

  it('gives only part credit for asking when it started without asking what changed', () => {
    const report = call('When did it start?');
    expect(careStatus(report, 'resourceful.recent-changes')).toBe('partly');
    expect(careBehaviour(report, 'resourceful.recent-changes')?.note).toMatch(
      /not what had changed/,
    );
  });

  it('credits no environment, change or history question when none was asked', () => {
    const report = call('Okay, let me look at that.');
    for (const id of ['environment', 'recent-changes', 'prior-troubleshooting', 'impact']) {
      expect(careStatus(report, `resourceful.${id}`), id).toBe('not-shown');
    }
  });

  it('credits asking about the business impact and the deadline', () => {
    const report = call(
      'How is this affecting your work, and is there a deadline you need to meet?',
    );
    expect(careStatus(report, 'resourceful.impact')).toBe('shown');
  });
});

describe('the order of an investigation', () => {
  it('credits questions about several areas before any fix', () => {
    const report = call(
      'What does the screen say exactly?',
      'When did it start?',
      'Is your work email signed in on another device?',
      'Please remove the old password from the phone.',
    );
    expect(careStatus(report, 'resourceful.logical-investigation')).toBe('shown');
  });

  it('gives only part credit when a fix came before the problem was scoped', () => {
    const report = evaluate(
      classified([
        turn(
          'Hello Maya, this is Sam from support. Reset your password again and clear your cache.',
          SAID,
        ),
        turn('What does the screen say?'),
        turn('Is it only you?'),
        turn('When did it start?'),
      ]),
    );
    expect(careStatus(report, 'resourceful.logical-investigation')).toBe('partly');
    expect(careBehaviour(report, 'resourceful.logical-investigation')?.note).toMatch(
      /before the problem was scoped/,
    );
  });

  it('credits nothing when only fixes were offered', () => {
    const report = evaluate(
      classified([
        turn('Reset your password again and clear your cache.', SAID),
        turn('Now restart your laptop and try a different browser.'),
      ]),
    );
    expect(careStatus(report, 'resourceful.logical-investigation')).toBe('not-shown');
  });
});

describe('using what the customer already said', () => {
  it('credits building on the customer\u2019s own words rather than starting again', () => {
    const report = call(
      'You said your phone keeps asking for the password. Is that the work email account?',
    );
    expect(careStatus(report, 'resourceful.known-evidence')).toBe('shown');
  });

  it('marks down a question asked a second time, quoting the repeat', () => {
    const again = 'What does the sign-in screen say exactly?';
    const report = call(again, 'When did it start?', again);
    expect(careStatus(report, 'resourceful.no-repeat-questions')).toBe('not-shown');
    expect(careBehaviour(report, 'resourceful.no-repeat-questions')?.evidence[0]?.quote).toMatch(
      /sign-in screen say exactly/,
    );
  });

  it('counts a repetition the engine recorded from the customer\u2019s reaction', () => {
    const asked = 'Can you tell me again which laptop you are using?';
    const report = call({
      say: asked,
      events: [
        ['repetition', 'patience', 58, 51, 'Asked again about something already answered.', asked],
      ],
    });
    expect(careStatus(report, 'resourceful.no-repeat-questions')).toBe('not-shown');
  });

  it('credits a call that explored three or more areas without repeating itself', () => {
    const report = call(
      'What does the screen say exactly?',
      'When did it start?',
      'Is your work email signed in on another device?',
    );
    expect(careStatus(report, 'resourceful.no-repeat-questions')).toBe('shown');
  });
});

describe('bringing in help when it is warranted', () => {
  const asked = turn(HELLO, 'I want to speak to your manager. This is not good enough.');

  it('credits an escalation that says who will pick it up and what they will do', () => {
    const report = evaluate(
      classified([
        asked,
        turn(
          'I can bring in a senior engineer, who will review the sign-in logs while I stay your contact.',
        ),
      ]),
    );
    expect(careStatus(report, 'resourceful.escalation')).toBe('shown');
  });

  it('gives only part credit for "I\'ll escalate it" with nothing said about what that does', () => {
    const report = evaluate(classified([asked, turn("I'll escalate it.")]));
    expect(careStatus(report, 'resourceful.escalation')).toBe('partly');
  });

  it('faults a call that was asked for a manager and never explained what escalating would do', () => {
    const report = evaluate(classified([asked, turn('What does the screen say?')]));
    expect(careStatus(report, 'resourceful.escalation')).toBe('not-shown');
  });

  it('does not list escalation for a call that did not need it', () => {
    expect(careStatus(call('What does the screen say?'), 'resourceful.escalation')).toBe(
      'unlisted',
    );
  });
});
