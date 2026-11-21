import { expect, test } from './support/fixtures.ts';
import type { Page } from '@playwright/test';
import { callScreen, sendTyped, startSpokenCall, startTypedCall } from './support/call-screen.ts';
import { readProbe } from './support/page-probes.ts';
import { expectNoRawFailureText } from './support/raw-text.ts';
import { leakedSecrets, libraryScenario, libraryScenarios } from './support/scenario-library.ts';

// Journeys 8 to 11 and 13: typing instead of speaking, the customer's state and what is found, the
// curveball, and ending the call. These run against the real rules engine (demo mode), so the
// customer's words are the engine's, and the moods and counts are the engine's own.

test.describe.configure({ timeout: 90_000 });

const LOCKED_OUT = 'locked-out-after-password-reset';
const SHARED_WORKSPACE = 'team-cannot-open-shared-workspace';
const SPEAKING = 'The customer is speaking';

/** The label of the customer's state and its trend word, as the call shows them. */
async function customerMood(page: Page) {
  const state = callScreen(page).state;
  const text = (await state.innerText()).replace(/\s+/g, ' ');
  return text;
}

test.describe('typing instead of speaking', () => {
  test('Enter sends, Shift+Enter makes a new line, and the customer replies', async ({
    page,
    api,
  }) => {
    const { screen } = await startSpokenCall(page, api);
    await expect(screen.status).toHaveText(SPEAKING);
    await screen.interrupt.click();
    await screen.typeInstead.click();
    await expect(screen.reply).toBeFocused();

    await test.step('Shift+Enter adds a line and sends nothing', async () => {
      await screen.reply.fill('Hello, my name is Sam.');
      await screen.reply.press('Shift+Enter');
      await screen.reply.pressSequentially('Can you tell me what is happening?');
      await expect(screen.reply).toHaveValue(
        'Hello, my name is Sam.\nCan you tell me what is happening?',
      );
      await expect(screen.turns).toHaveCount(1);
    });

    await test.step('Enter sends it, the box is emptied, and the customer replies', async () => {
      await screen.reply.press('Enter');
      await expect(screen.reply).toHaveValue('');
      await expect(screen.turns).toHaveCount(3);
      await expect(screen.turns.nth(1)).toContainText('Hello, my name is Sam.');
      await expect(screen.turns.nth(1)).toContainText('Can you tell me what is happening?');
      await expect(screen.turns.nth(1)).not.toContainText('Spoken');
    });
  });

  test('works with the microphone muted: nothing listens, and a typed reply is answered', async ({
    page,
    api,
  }) => {
    const { screen } = await startSpokenCall(page, api);
    await expect(screen.status).toHaveText(SPEAKING);
    await screen.interrupt.click();

    await screen.mute.click();
    await expect(screen.mute).toHaveAttribute('aria-pressed', 'true');
    await expect(screen.status).toHaveText('Microphone muted');
    await expect(page.getByText('Muted', { exact: true })).toBeVisible();

    await screen.typeInstead.click();
    await sendTyped(screen, 'Hello, my name is Sam. What is happening?');
    await expect(screen.turns).toHaveCount(3);
    // The microphone track was switched off for the whole time, and no spoken turn was made.
    const probe = await readProbe(page);
    expect(probe.mediaRequests).toBe(1);
    await expect(screen.turns.nth(1)).not.toContainText('Spoken');
  });

  test('a text-only call never asks for the microphone, and says so', async ({ page, api }) => {
    const { screen } = await startTypedCall(page, api);
    await expect(screen.status).toHaveText('Text-only call. Type your reply.');
    await expect(
      page.getByText('This call is text-only. The microphone is off, nothing is recorded'),
    ).toBeVisible();
    await expect(page.getByText('Text-only call', { exact: true })).toBeVisible();
    await expect(screen.talk).toHaveCount(0);

    await sendTyped(screen, 'Hello, my name is Sam. Can you tell me what is happening?');
    await expect(screen.turns).toHaveCount(3);
    await sendTyped(
      screen,
      'Thanks. When did it last work, and did anything change before it stopped?',
    );
    await expect(screen.turns).toHaveCount(5);

    const probe = await readProbe(page);
    expect(probe.mediaRequests).toBe(0);
    expect(probe.playCalls).toEqual([]);
    expect(probe.synthesisCalls).toBe(0);
  });
});

test.describe('what is found, and how the customer feels', () => {
  test('in guided practice the count of context found goes up without showing any of it', async ({
    page,
    api,
  }) => {
    const library = libraryScenario(LOCKED_OUT);
    const { screen } = await startTypedCall(page, api, { scenarioId: LOCKED_OUT, mode: 'guided' });
    const context = page.getByRole('region', { name: 'Call context' });
    await expect(screen.state).toContainText('Context found: 0');
    await expect(context).toContainText('Areas worth exploring');

    await test.step('a greeting finds nothing', async () => {
      await sendTyped(screen, 'Hello, my name is Sam. Thanks for calling.');
      await expect(screen.turns).toHaveCount(3);
      await expect(screen.state).toContainText('Context found: 0');
    });

    await test.step('a question about the message on screen finds one thing', async () => {
      await sendTyped(screen, 'Can you read me exactly what the sign-in message says?');
      await expect(screen.turns).toHaveCount(5);
      await expect(screen.state).toContainText('Context found: 1');
    });

    await test.step('the count is the only thing shown: none of what was found is in the hint, the context or the panel', async () => {
      const outsideTranscript = [
        await screen.state.innerText(),
        await context.innerText(),
        await page.getByRole('region', { name: 'Customer and voice' }).innerText(),
      ].join('\n');
      expect(leakedSecrets(outsideTranscript, library.secrets)).toEqual([]);
      // The customer said it, so it is in the transcript, which is the only place it is.
      await expect(screen.transcript).toContainText('temporarily locked');
    });
  });

  test('in a standard call no hint, count or area to explore is shown at all', async ({
    page,
    api,
  }) => {
    const { screen } = await startTypedCall(page, api, {
      scenarioId: LOCKED_OUT,
      mode: 'immersive',
    });
    await expect(screen.state).toBeVisible();
    await sendTyped(screen, 'Can you read me exactly what the sign-in message says?');
    await expect(screen.turns).toHaveCount(3);
    await sendTyped(screen, 'Is your work email signed in on another device, like a phone?');
    await expect(screen.turns).toHaveCount(5);

    await expect(page.getByText(/Context found/)).toHaveCount(0);
    await expect(page.getByText('Areas worth exploring')).toHaveCount(0);
    await expect(
      page.getByText('This is a standard call, so no hints are shown while you talk.'),
    ).toBeVisible();
    // The customer's mood is always shown; it is not a hint.
    await expect(screen.state).toContainText('Calm');
  });

  test("a dismissive reply raises the customer's state, and a calming one eases it", async ({
    page,
    api,
  }) => {
    const { screen } = await startTypedCall(page, api, {
      scenarioId: SHARED_WORKSPACE,
      overrides: { curveballs: [] },
    });
    expect(await customerMood(page)).toContain('Frustrated');

    await test.step('being blamed raises the state and its trend, in words', async () => {
      await sendTyped(
        screen,
        "That's not my problem, it's your fault for not reading the manual. Just try again.",
      );
      await expect(screen.turns).toHaveCount(3);
      await expect(screen.state).toContainText('Angry');
      await expect(screen.state).toContainText('rising');
      await expect(screen.state).toContainText('Getting angrier');
    });

    await test.step('taking ownership and showing empathy eases it, and it is called recovering', async () => {
      await sendTyped(
        screen,
        "I'm really sorry about this, I can hear how frustrating the morning has been. I'll take ownership of this and I'll call you back by three o'clock with an update.",
      );
      await expect(screen.turns).toHaveCount(5);
      await expect(screen.state).toContainText('Recovering');
      await expect(screen.state).toContainText('easing');
    });

    await test.step('the temperature trace lists the points, and never says why', async () => {
      await expect(
        page.getByRole('img', { name: /Customer temperature over 3 points/ }),
      ).toBeVisible();
      const text = await page.getByRole('region', { name: 'Customer and voice' }).innerText();
      expect(text).not.toMatch(/blame|dismissive|empathy|ownership/i);
    });
  });

  test("a curveball arrives in the customer's own words, with no dialog or alert", async ({
    page,
    api,
  }) => {
    const dialogs: string[] = [];
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });
    const { screen } = await startTypedCall(page, api, {
      scenarioId: SHARED_WORKSPACE,
      overrides: { curveballs: ['ask-manager'] },
    });

    const lines = [
      'Hello, my name is Sam. Can you tell me what is happening?',
      'When did it last work?',
      'What does the message say exactly?',
    ];
    await test.step('nothing about a manager before the fourth reply', async () => {
      let turns = 1;
      for (const line of lines) {
        await sendTyped(screen, line);
        turns += 2;
        await expect(screen.turns).toHaveCount(turns);
      }
      await expect(screen.transcript).not.toContainText(/manager/i);
    });

    await test.step('the fourth reply carries it, as a line of the transcript', async () => {
      await sendTyped(screen, 'Who else is affected?');
      await expect(screen.turns).toHaveCount(9);
      await expect(screen.turns.last()).toContainText(/manager/i);
      await expect(screen.turns.last()).toContainText("I'd like to speak to your manager");
    });

    await test.step('and nothing else on the page announces it', async () => {
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByRole('alertdialog')).toHaveCount(0);
      await expect(page.getByRole('alert')).toHaveCount(0);
      expect(dialogs).toEqual([]);
      const outside = [
        await screen.state.innerText(),
        await page.getByRole('region', { name: 'Call context' }).innerText(),
      ].join('\n');
      expect(outside).not.toMatch(/manager|curveball|complication/i);
    });
  });
});

test.describe('ending the call', () => {
  test('the end dialog shows the facts, Continue call returns to the call, End and review stops the microphone and opens the report', async ({
    page,
    api,
  }) => {
    const { call, screen } = await startSpokenCall(page, api);
    await expect(screen.status).toHaveText(SPEAKING);
    await screen.interrupt.click();
    await screen.typeInstead.click();
    await sendTyped(screen, 'Hello, my name is Sam. What is happening?');
    await expect(screen.turns).toHaveCount(3);
    await screen.interrupt.click();

    await test.step('the question shows how long, how much, and how the customer is', async () => {
      await screen.endCall.click();
      await expect(screen.endDialog).toBeVisible();
      await expect(
        screen.endDialog.getByRole('term').filter({ hasText: 'Call length' }),
      ).toBeVisible();
      await expect(screen.endDialog.getByText(/^\d+:\d{2}$/)).toBeVisible();
      await expect(screen.endDialog).toContainText('You have spoken');
      await expect(screen.endDialog).toContainText('once');
      await expect(screen.endDialog).toContainText("Customer's state");
      await expect(screen.endDialog).toContainText(
        'This call is short, so the report will say its scores rest on limited evidence.',
      );
      await expect(screen.endDialog).toContainText('the microphone and any customer audio stop');
    });

    await test.step('Continue call closes it, the call is as it was, and focus goes back to End call', async () => {
      await screen.endDialog.getByRole('button', { name: 'Continue call' }).click();
      await expect(screen.endDialog).toBeHidden();
      await expect(screen.endCall).toBeFocused();
      expect((await readProbe(page)).micTracks).toEqual(['live']);
      expect((await api.session(call.id)).status).toBe('active');
    });

    await test.step('End and review shows the ending state, stops the microphone and opens the report', async () => {
      // A little delay on the server, so the "Ending the call" state can be seen at all.
      await page.route('**/api/sessions/*/end', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 700));
        await route.continue();
      });
      await screen.endCall.click();
      await screen.endDialog.getByRole('button', { name: 'End and review' }).click();
      await expect(screen.endingDialog).toBeVisible();
      await expect(screen.endingDialog).toContainText(
        'We are stopping the microphone, saving the transcript and preparing your report.',
      );
      await expect(page).toHaveURL(new RegExp(`/sessions/${call.id}/report$`));
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: /Coaching report|Building your coaching report/,
        }),
      ).toBeVisible();
      const probe = await readProbe(page);
      expect(probe.micTracks).toEqual(['ended']);
    });

    await test.step('the call is closed on the server', async () => {
      await expect(page.getByRole('heading', { level: 1, name: 'Coaching report' })).toBeVisible();
      const saved = await api.session(call.id);
      expect(['completing', 'completed']).toContain(saved.status);
      expect(saved.turns.filter((turn) => turn.role === 'trainee')).toHaveLength(1);
    });
  });

  test('a call with nothing said cannot be reported: the dialog says so and can leave without a report', async ({
    page,
    api,
    problems,
  }) => {
    problems.allow({ url: '/end' });
    const { call, screen } = await startTypedCall(page, api);

    await screen.endCall.click();
    await screen.endDialog.getByRole('button', { name: 'End and review' }).click();

    await expect(screen.endDialog).toContainText('There is nothing to review yet.');
    await expect(screen.endDialog).toContainText(
      'No message has been sent, so there is no transcript.',
    );
    await expectNoRawFailureText(page);
    await expect(screen.endDialog.getByRole('button', { name: 'End and review' })).toHaveCount(0);

    await screen.endDialog.getByRole('button', { name: 'Leave without a report' }).click();
    await expect(page).toHaveURL(/\/scenarios/);
    await expect(page.getByRole('heading', { level: 1, name: 'Choose a scenario' })).toBeVisible();
    // The empty call is gone.
    await expect
      .poll(async () => (await page.request.get(`/api/sessions/${call.id}`)).status())
      .toBe(404);
  });
});

test.describe('before anything has been asked', () => {
  test('no scenario shows anything the customer keeps back on its call page, from the pre-flight to the first turn', async ({
    page,
    api,
  }) => {
    test.setTimeout(180_000);
    for (const scenario of libraryScenarios()) {
      await test.step(scenario.title, async () => {
        // Guided practice shows the most on screen (hints and areas to explore).
        const call = await api.createCall({ scenarioId: scenario.id, mode: 'guided' });
        await page.goto(`/calls/${call.id}?input=text`);
        const screen = callScreen(page);
        await expect(screen.preflight.heading).toBeVisible();
        const preflight = await page.locator('body').innerText();
        await screen.preflight.textOnly.click();
        await expect(screen.reply).toBeVisible();
        await expect(screen.turns).toHaveCount(1);
        const started = await page.locator('body').innerText();
        expect(scenario.secrets.length, 'the library has nothing to look for').toBeGreaterThan(0);
        expect(
          leakedSecrets(`${preflight}\n${started}`, scenario.secrets),
          `The call page of "${scenario.title}" shows something the customer keeps back`,
        ).toEqual([]);
      });
    }
  });
});
