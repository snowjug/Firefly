import { describe, expect, it } from 'vitest';
import type { CoachingReport } from '#shared/domain/report.ts';
import { BLAME, IMPATIENT, norm } from './care/lexicon.ts';
import { careBehaviour, careStatus, classified, evaluate, type Line } from './testing.ts';

// Tone read from what was said. Some sentences hold the words of blame or impatience and say the
// opposite: "you shouldn't have to chase us" is sympathy, "does the screen come on?" is a question
// about a screen. They must not cost the engineer the "no blame" or "respectful tone" credit, and
// genuine blame and impatience must still be caught.
//
// Each sentence is run two ways: as the product runs it in demo mode, where the engine's rules
// classifier flags the turn, and as a live model would classify it, with no flag raised.

const turn = (say: string, reply = 'Okay.'): Line => ({ say, reply });
const HELLO = 'Hello Maya, this is Sam from the Microsoft support team. How can I help?';

function modes(say: string): [string, CoachingReport][] {
  const call = (line: Line) =>
    evaluate(classified([turn(HELLO), line, turn('Okay.')], { callStage: 'follow-up' }));
  return [
    ['rules classifier', call(turn(say))],
    ['live classifier', call({ ...turn(say), cls: { blame: false, dismissive: false } })],
  ];
}

const harmed = (report: CoachingReport) => ({
  noBlame: careStatus(report, 'accountable.no-blame'),
  tone: careStatus(report, 'empathetic.respectful-tone'),
  noDismissive: careStatus(report, 'empathetic.no-dismissive'),
});

describe('the word lists', () => {
  it.each([
    "You shouldn't have to chase us.",
    'You must have been waiting a long time.',
    'You were supposed to hear from us.',
    'You should have had an update.',
  ])('BLAME does not match what takes the customer\u2019s side: %s', (said) => {
    expect(BLAME.test(norm(said))).toBe(false);
  });

  it.each([
    'You should have restarted it.',
    'You should have had a backup.',
    "You shouldn't have changed it.",
    'You were supposed to read the email.',
    'You were supposed to have backed it up.',
    'You must have clicked the wrong link.',
    'That was your mistake.',
    'You forgot to restart it.',
  ])('BLAME matches what scolds: %s', (said) => {
    expect(BLAME.test(norm(said))).toBe(true);
  });

  it.each([
    'Does the screen come on?',
    'The light should come on.',
    "I'll ring at 3 as I said.",
    'Whatever the screen shows, read it to me.',
    "I'll ask the engineers to hurry up.",
  ])('IMPATIENT does not match ordinary uses of the same words: %s', (said) => {
    expect(IMPATIENT.test(norm(said))).toBe(false);
  });

  it.each([
    'As I already told you, restart it.',
    'I already told you that.',
    'Whatever.',
    'Oh, come on.',
    'Hurry up and tell me.',
    'Just answer the question.',
    "You're not listening.",
  ])('IMPATIENT matches what is impatient: %s', (said) => {
    expect(IMPATIENT.test(norm(said))).toBe(true);
  });
});

describe('kind sentences that hold the words of blame or impatience', () => {
  it.each([
    "I'm sorry, you shouldn't have to chase us for an update.",
    "You shouldn't have to chase us for an update.",
    'You must have been waiting a long time.',
    'You were supposed to hear from us yesterday.',
    'You were supposed to have heard from us by now.',
    'You should have had an update by now.',
    'You should have received a call back yesterday.',
    "I'm sorry, you shouldn't have gone through all that.",
    'Does the screen come on?',
    'The light should come on when it connects.',
    "I'll ring at 3 as I said.",
    'Whatever the screen shows, please read it to me.',
    "I'll ask the engineers to hurry up on this.",
    'Could you just tell me what the screen says?',
  ])('does not count as blame, dismissal or impatience: %s', (said) => {
    for (const [mode, report] of modes(said)) {
      const status = harmed(report);
      expect(status.noBlame, `${mode}: no-blame`).not.toBe('not-shown');
      expect(status.tone, `${mode}: respectful tone`).not.toBe('not-shown');
      expect(status.noDismissive, `${mode}: no-dismissive`).not.toBe('not-shown');
    }
  });

  it('is not counted from an event the engine recorded for the same kind sentence', () => {
    const said = "You shouldn't have to chase us for an update.";
    const report = evaluate(
      classified(
        [
          turn(HELLO),
          {
            say: said,
            cls: { blame: false },
            events: [['blame', 'temperature', 50, 60, 'Blamed the customer or another team', said]],
          },
          turn('Okay.'),
        ],
        { callStage: 'follow-up' },
      ),
    );
    expect(harmed(report).noBlame).not.toBe('not-shown');
    expect(harmed(report).tone).not.toBe('not-shown');
  });
});

describe('genuine blame and impatience are still caught', () => {
  it.each([
    ['You should have restarted it.', /should have restarted it/],
    ['You should have had a backup.', /should have had a backup/],
    ['That was your mistake.', /your mistake/],
    ["I'm sorry, but you should have restarted it first.", /should have restarted it first/],
    ["You shouldn't have changed the settings.", /shouldn't have changed the settings/],
    ['You were supposed to read the email first.', /supposed to read the email/],
    ['You were supposed to have backed it up.', /supposed to have backed it up/],
    ['You must have clicked the wrong link.', /must have clicked the wrong link/],
    ["I'm sorry, you forgot to restart it.", /forgot to restart it/],
  ])('is blame, quoted from the call: %s', (said, quote) => {
    for (const [mode, report] of modes(said)) {
      expect(careStatus(report, 'accountable.no-blame'), `${mode}: no-blame`).toBe('not-shown');
      expect(
        careBehaviour(report, 'accountable.no-blame')?.evidence[0]?.quote,
        `${mode}: quote`,
      ).toMatch(quote);
      expect(careStatus(report, 'empathetic.respectful-tone'), `${mode}: tone`).toBe('not-shown');
    }
  });

  it.each([
    'As I already told you, restart it.',
    'I already told you that.',
    'Just answer the question.',
    'Hurry up and tell me.',
    "You're not listening.",
    'Whatever.',
  ])('is impatience, which costs the respectful tone: %s', (said) => {
    for (const [mode, report] of modes(said)) {
      expect(careStatus(report, 'empathetic.respectful-tone'), mode).toBe('not-shown');
    }
  });

  it('still takes blame that only the engine\u2019s classification recognised', () => {
    const report = evaluate(
      classified([turn(HELLO), turn('That is a problem on your side.'), turn('Okay.')], {
        callStage: 'follow-up',
      }),
    );
    expect(careStatus(report, 'accountable.no-blame')).toBe('not-shown');
  });
});
