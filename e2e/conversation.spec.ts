import { DEFAULT_SCENARIO } from './support/api.ts';
import { converse, startTypedCall, textOf, type CallScreen } from './support/call-screen.ts';
import { expect, test } from './support/fixtures.ts';
import { firstSentence, libraryScenario, saysSentence } from './support/scenario-library.ts';

// How the customer behaves in the opening and in what they answer, checked in a real browser against
// the real rules engine (demo mode) and against what the scenario itself says the customer holds back
// or does not know. The customer's wording varies from call to call (the engine picks a seed for each
// call), so these tests check the behaviour and read what the scenario says; they never expect one
// exact sentence from the engine.
//
// The scenario is the Outlook shared mailbox (Marcus Bell: a starter, first-contact call with a calm,
// terse customer who has hidden facts and things he says he does not know).

test.describe.configure({ timeout: 90_000 });

const MARCUS = libraryScenario(DEFAULT_SCENARIO);
const FOLLOW_UP = 'exchange-mail-delays-follow-up';

const GREETING =
  'Hello, thanks for calling Microsoft support. My name is Sam. How can I help you today?';

/** What the customer said in the turn at `index` (0 is the greeting), without the label. */
const said = (screen: CallScreen, index: number) =>
  textOf(screen.turns.nth(index).locator('.cw-turn__text'));

/** Whether a customer's answer says the engineer is repeating themselves. Wording varies; the idea does not. */
const REPEAT_REACTION = /\b(already|a moment ago|earlier|before|mentioned)\b/i;

const fact = (id: string) => {
  const found = MARCUS.facts.find((item) => item.id === id);
  if (!found) throw new Error(`The scenario has no fact "${id}".`);
  return found;
};

/** Whether any of a fact's wordings is somewhere in `text`. */
const says = (text: string, id: string) =>
  fact(id).statements.some((statement) => saysSentence(text, statement));

test.describe('the opening', () => {
  test('the customer greets first, and says why they called only after the engineer has answered', async ({
    page,
    api,
  }) => {
    const { screen } = await startTypedCall(page, api, { scenarioId: MARCUS.id });

    await test.step('the first thing on the call is a short greeting that says nothing about the problem', async () => {
      await expect(screen.turns).toHaveCount(1);
      const greeting = await said(screen, 0);
      expect(
        greeting.split(' ').length,
        `a greeting, not a story: ${greeting}`,
      ).toBeLessThanOrEqual(12);
      expect(greeting).toMatch(/\b(hello|hi|good (morning|afternoon|evening))\b/i);
      expect(greeting).not.toMatch(/mailbox|outlook|shared|access|missing/i);
      for (const secret of MARCUS.secrets) expect(saysSentence(greeting, secret)).toBe(false);
    });

    await test.step('the engineer answers the greeting, and the customer now gives the reason', async () => {
      await converse(screen, [GREETING]);
      const reason = await said(screen, 2);
      expect(reason).toMatch(/mailbox/i);
      expect(reason).toMatch(/outlook/i);
      // Giving the reason is not giving up a hidden fact: none of them has been asked for.
      for (const item of MARCUS.facts) expect(says(reason, item.id), item.label).toBe(false);
    });
  });

  test('in a follow-up call the customer says why they are calling in their first words', async ({
    page,
    api,
  }) => {
    const { screen } = await startTypedCall(page, api, { scenarioId: FOLLOW_UP });
    const opening = await said(screen, 0);
    // They have called before, so there is no "is this Microsoft support?": the case is the reason.
    expect(opening).toMatch(/case|raised|delays|email|mail/i);
    expect(opening).not.toMatch(/^\W*(hello|hi)\W+is this microsoft support\W*$/i);
  });
});

test.describe('what the customer holds back and what they do not know', () => {
  test('a hidden fact is not said until a question asks for it, and then it is', async ({
    page,
    api,
  }) => {
    const { screen } = await startTypedCall(page, api, { scenarioId: MARCUS.id });
    await converse(screen, [GREETING, 'What do you see in your list instead of the mailbox?']);

    await test.step('after a greeting and an ordinary question, nothing that is held back has been said', async () => {
      const transcript = await textOf(screen.transcript);
      for (const item of MARCUS.facts) {
        expect(says(transcript, item.id), `"${item.label}" was said before anyone asked`).toBe(
          false,
        );
      }
    });

    await test.step('the question that asks for what changed brings out what changed, and only that', async () => {
      await converse(
        screen,
        [
          'Did anything change while you were away, for example who has access to the shared mailbox?',
        ],
        5,
      );
      const answer = await said(screen, 6);
      expect(says(answer, 'hf-access-tidy'), `the customer says what changed: ${answer}`).toBe(
        true,
      );
      for (const other of ['hf-colleague-sees', 'hf-tried-restart', 'hf-after-leave']) {
        expect(says(answer, other), `"${fact(other).label}" came out with it`).toBe(false);
      }
    });
  });

  test('the customer says they do not know what the scenario says they do not know, and says who would', async ({
    page,
    api,
  }) => {
    const unknown = MARCUS.unknownFacts.find((item) => item.id === 'uf-setup-details');
    expect(unknown?.whoKnows, 'the scenario says who would know').toBeTruthy();
    const { screen } = await startTypedCall(page, api, { scenarioId: MARCUS.id });
    await converse(screen, [
      GREETING,
      'Which version of Outlook are you using, and how is it configured?',
    ]);

    const answer = await said(screen, 4);
    expect(
      saysSentence(answer, firstSentence(unknown!.text)),
      `the customer says what the scenario says: ${answer}`,
    ).toBe(true);
    expect(answer.toLowerCase()).toContain((unknown!.whoKnows as string).toLowerCase());
    // Not knowing is not a way of finding out: nothing held back came out with it.
    for (const item of MARCUS.facts) expect(says(answer, item.id), item.label).toBe(false);
  });
});

test.describe('repeating and summarising', () => {
  test('a repeated question draws the "I already said that" reaction, and a correct summary does not', async ({
    page,
    api,
  }) => {
    const { screen } = await startTypedCall(page, api, { scenarioId: MARCUS.id });
    const question = 'What do you see in your list instead of the mailbox?';
    await converse(screen, [GREETING, question]);
    const first = await said(screen, 4);
    expect(first, 'the first time it is asked, it is just answered').not.toMatch(REPEAT_REACTION);

    await test.step('asking the same question again is noticed', async () => {
      await converse(screen, [question], 5);
      const again = await said(screen, 6);
      expect(again, `the customer notices the repeat: ${again}`).toMatch(REPEAT_REACTION);
      // They do not make up something new to say.
      for (const item of MARCUS.facts) expect(says(again, item.id), item.label).toBe(false);
    });

    await test.step('a summary of what has been said is confirmed, and not taken for a repeat', async () => {
      await converse(
        screen,
        [
          "Let me make sure I have this right: the team's shared mailbox is no longer in your Outlook list, and it was there before you went away. Is that right?",
        ],
        7,
      );
      const confirmed = await said(screen, 8);
      expect(confirmed, `a summary is not a repeated question: ${confirmed}`).not.toMatch(
        REPEAT_REACTION,
      );
      expect(confirmed).toMatch(/\b(yes|right|correct|that's it|that's about it|exactly)\b/i);
    });
  });
});
