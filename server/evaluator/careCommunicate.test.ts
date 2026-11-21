import { describe, expect, it } from 'vitest';
import { careBehaviour, careStatus, classified, evaluate, type Line } from './testing.ts';

// COMMUNICATE read from behaviour: the opening, questions, summaries, language and checks. Each
// call runs through the real rules classifier, so the flags are the ones the product records, and
// the customer's replies are scripted. Traps are tested next to the behaviour they guard.

const ASK = 'What happens when you try to sign in?';
const turn = (say: string, reply = 'Okay.'): Line => ({ say, reply });

describe('the greeting and the introduction', () => {
  const opening = (text: string) => evaluate(classified([text]));

  it('credits a greeting that gives a name and a team', () => {
    const report = opening(`Hello Maya, this is Sam from the Microsoft support team. ${ASK}`);
    expect(careStatus(report, 'communicate.greeting')).toBe('shown');
    expect(careStatus(report, 'communicate.introduction')).toBe('shown');
  });

  it('does not take "hello" for an introduction', () => {
    const report = opening(`Hello Maya. ${ASK}`);
    expect(careStatus(report, 'communicate.greeting')).toBe('shown');
    expect(careStatus(report, 'communicate.introduction')).toBe('not-shown');
    expect(careBehaviour(report, 'communicate.introduction')?.note).toMatch(
      /never gave a name or team/,
    );
  });

  it('gives part credit for a name with no team or role, and for a team with no name', () => {
    expect(careStatus(opening(`Hi, I'm Sam. ${ASK}`), 'communicate.introduction')).toBe('partly');
    expect(
      careStatus(
        opening(`Hello, you've reached Microsoft support. ${ASK}`),
        'communicate.introduction',
      ),
    ).toBe('partly');
  });

  it.each([
    'Thanks for calling Microsoft support, my name is Sam.',
    "Good morning, you're speaking with Sam from the Microsoft support team.",
    'Sam here from Microsoft support.',
    "Hi Maya, I'm Sam, a support engineer at Microsoft.",
  ])('credits an introduction that is worded another way: %s', (introduction) => {
    expect(careStatus(opening(`${introduction} ${ASK}`), 'communicate.introduction')).toBe('shown');
  });

  it('does not read "I\'m sorry ... you\'ve got ... the front desk" as someone introducing themselves', () => {
    const report = opening(
      `I'm sorry you're stuck, and I know you've got three people at the front desk waiting. ${ASK}`,
    );
    expect(careStatus(report, 'communicate.introduction')).toBe('not-shown');
  });

  it('finds neither in a call that goes straight to the questions', () => {
    const report = opening(ASK);
    expect(careStatus(report, 'communicate.greeting')).toBe('not-shown');
    expect(careStatus(report, 'communicate.introduction')).toBe('not-shown');
  });

  it('does not count an introduction made only late in the call as a full one', () => {
    const report = evaluate(
      classified([
        turn(ASK),
        turn('And when did it start?'),
        turn('Okay.'),
        turn("By the way, I'm Sam from the support team."),
      ]),
    );
    expect(careStatus(report, 'communicate.introduction')).toBe('partly');
  });
});

describe('questions and scoping', () => {
  it('credits focused questions about what happens and who is affected', () => {
    const report = evaluate(
      classified([
        turn(
          'Hello Maya, this is Sam from the Microsoft support team. What exactly happens when you try to sign in?',
        ),
        turn('Is it only you, or are other people affected as well?'),
      ]),
    );
    expect(careStatus(report, 'communicate.clear-questions')).toBe('shown');
    expect(careStatus(report, 'resourceful.scoping')).toBe('shown');
  });

  it('gives part credit for asking what happens without asking who else is affected', () => {
    const report = evaluate(classified([turn(`Hello, this is Sam from support. ${ASK}`)]));
    expect(careStatus(report, 'resourceful.scoping')).toBe('partly');
    expect(careBehaviour(report, 'resourceful.scoping')?.note).toMatch(/not who or what else/);
  });

  it('credits no scoping when nothing was asked', () => {
    const report = evaluate(
      classified([turn('Hello, this is Sam from support.'), turn('Okay, noted.')]),
    );
    expect(careStatus(report, 'resourceful.scoping')).toBe('not-shown');
    expect(careStatus(report, 'communicate.clear-questions')).toBe('not-shown');
  });
});

describe('summaries', () => {
  const said = 'Three of us at the front desk cannot sign in since this morning.';
  const opening = turn('Hello Maya, this is Sam from Microsoft support. What is happening?', said);

  it('credits a recap built from what the customer said', () => {
    const report = evaluate(
      classified([
        opening,
        turn(
          "So to recap: three of you at the front desk can't sign in since this morning. Is that right?",
          'Yes.',
        ),
      ]),
    );
    expect(careStatus(report, 'communicate.summary')).toBe('shown');
  });

  it('does not mark a first contact down for skipping a recap, but a closure call needs one', () => {
    const lines = [opening, turn('Okay, let me check.')];
    expect(careStatus(evaluate(classified(lines)), 'communicate.summary')).toBe('unlisted');
    const closure = evaluate(classified(lines, { callStage: 'closure' }));
    expect(careStatus(closure, 'communicate.summary')).toBe('not-shown');
  });

  it('never fully credits a recap that the customer had to correct', () => {
    const report = evaluate(
      classified([
        opening,
        turn(
          'So to recap: five of you are locked out since yesterday, is that right?',
          'No, that is not right. It is three of us, and since this morning.',
        ),
      ]),
    );
    expect(careStatus(report, 'communicate.summary')).toBe('partly');
    expect(careBehaviour(report, 'communicate.summary')?.note).toMatch(/corrected/);
  });

  it('never fully credits a recap with counts or days that were never said', () => {
    const report = evaluate(
      classified([
        opening,
        turn("So to recap: five of you can't sign in since yesterday. Is that right?", 'Hmm.'),
      ]),
    );
    expect(careStatus(report, 'communicate.summary')).toBe('partly');
    expect(careBehaviour(report, 'communicate.summary')?.note).toMatch(/had not given/);
  });

  it('does not take "is that right?" on its own for a summary', () => {
    const report = evaluate(classified([opening, turn('Is that right?')]));
    expect(careStatus(report, 'communicate.summary')).not.toBe('shown');
  });
});

describe('plain language', () => {
  const JARGON =
    'The cached credentials on your other device keep sending the old authentication token, so the lockout policy kicked in.';
  const PLAIN =
    'Your phone kept trying the old password, so the account locked itself. That just means it stops accepting sign-ins for a few minutes.';
  const call = (say: string, overrides: Parameters<typeof classified>[1] = {}) =>
    evaluate(
      classified(
        [
          turn('Hello, this is Sam from Microsoft support. What happens?'),
          turn(say),
          turn('Okay.'),
        ],
        overrides,
      ),
    );

  it('counts unexplained technical terms against the engineer when the customer is a novice', () => {
    const report = call(JARGON, { proficiency: 'novice' });
    expect(careStatus(report, 'communicate.plain-language')).toBe('not-shown');
    expect(careBehaviour(report, 'communicate.plain-language')?.note).toMatch(
      /could not be expected to follow/,
    );
  });

  it('does not count the same words against the engineer when the customer is an expert', () => {
    const report = call(JARGON, { proficiency: 'expert' });
    expect(careStatus(report, 'communicate.plain-language')).toBe('shown');
    expect(careBehaviour(report, 'communicate.plain-language')?.note).toMatch(
      /suited this customer/,
    );
  });

  it('counts them against the engineer for an intermediate customer only once several turns do it', () => {
    const once = evaluate(
      classified(
        [turn('Hello, this is Sam from support. What happens?'), turn(JARGON), turn('Okay.')],
        { proficiency: 'intermediate' },
      ),
    );
    expect(careStatus(once, 'communicate.plain-language')).not.toBe('not-shown');
    const often = evaluate(
      classified(
        [
          turn('Hello, this is Sam from support. What happens?'),
          turn(JARGON),
          turn(JARGON.replace('lockout policy', 'DNS cache')),
        ],
        { proficiency: 'intermediate' },
      ),
    );
    expect(careStatus(often, 'communicate.plain-language')).toBe('not-shown');
  });

  it('credits a technical term that was put into plain words', () => {
    const report = call(
      'The account hit a lockout policy, which means it stops accepting sign-ins for a few minutes.',
      { proficiency: 'novice' },
    );
    expect(careStatus(report, 'communicate.plain-language')).toBe('shown');
  });

  it('credits an explanation in everyday words for a novice', () => {
    expect(careStatus(call(PLAIN, { proficiency: 'novice' }), 'communicate.plain-language')).toBe(
      'shown',
    );
  });
});

describe('checking understanding and pacing', () => {
  const opening = turn(
    'Hello Maya, this is Sam from Microsoft support. What is happening?',
    'We are locked out.',
  );

  it('credits a check that follows an explanation', () => {
    const report = evaluate(
      classified([
        opening,
        turn(
          'Your phone kept trying the old password, so the account locked itself. Does that make sense?',
        ),
      ]),
    );
    expect(careStatus(report, 'communicate.confirms-understanding')).toBe('shown');
  });

  it('gives only part credit to "does that make sense?" with nothing explained before it', () => {
    const report = evaluate(classified([opening, turn('Does that make sense?')]));
    expect(careStatus(report, 'communicate.confirms-understanding')).toBe('partly');
  });

  it('marks down a turn that stacks several questions and steps, never how fast anyone speaks', () => {
    const stacked = turn(
      'What does it say, when did it start, who else is affected, and have you restarted it or tried another browser or another device?',
    );
    const report = evaluate(classified([opening, stacked, stacked, turn('Okay.')]));
    expect(careStatus(report, 'communicate.pacing')).toBe('not-shown');
    expect(careBehaviour(report, 'communicate.pacing')?.note).toMatch(
      /more than one question or step/,
    );
  });

  it('credits a call that takes one question at a time', () => {
    const report = evaluate(
      classified([
        opening,
        turn('When did it start?'),
        turn('What does the screen say?'),
        turn('Okay.'),
      ]),
    );
    expect(careStatus(report, 'communicate.pacing')).toBe('shown');
  });
});
