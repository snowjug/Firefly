import { expect, test } from './support/fixtures.ts';
import {
  callIdOf,
  callScreen,
  openPreflight,
  sendTyped,
  startSpokenCall,
} from './support/call-screen.ts';
import { isMockUtterance, MOCK_SENTENCES } from './support/mock-speech.ts';
import {
  allowMicrophone,
  containsInOrder,
  readProbe,
  refuseMicrophone,
  resetProbe,
  statusLabels,
} from './support/page-probes.ts';
import { expectNoRawFailureText } from './support/raw-text.ts';

// Journeys 5, 6, 7 and 12: the spoken call, in a real browser, with a fake microphone and the
// server's mock speech provider.
//
// What these prove: the call asks for the microphone only when told to, records an utterance with
// the real voice-activity detector and the real worklet, uploads it, puts what the speech service
// returned into the transcript, plays the customer's reply from the server's audio through one
// audio element, and falls back gracefully when speech fails.
//
// What they do NOT prove: that any speech was understood. The mock provider ignores the audio and
// answers with one of eight scripted sentences, and its "voice" is a short soft noise. The browser's
// own speech recognition is not exercised at all (it returns no words under automation).

test.describe.configure({ timeout: 90_000 });

const OPENING_VOICE = 'The customer is speaking';

test.describe('a spoken call', () => {
  test('asks for the microphone only when "Allow microphone and start" is pressed, then the customer opens the call', async ({
    page,
    api,
  }) => {
    await page.goto('/scenarios/locked-out-after-password-reset/brief');
    await page.getByRole('button', { name: 'Start voice call' }).click();
    await expect(page).toHaveURL(/\/calls\/[^/?]+\?input=voice$/);
    const screen = callScreen(page);

    await test.step('the pre-flight says what is ready and what happens to speech, and has asked for nothing', async () => {
      await expect(screen.preflight.heading).toBeVisible();
      await expect(screen.preflight.checks).toContainText('Not requested yet');
      await expect(screen.preflight.checks).toContainText(
        /Speech recognition\s*Demo speech \(scripted\)/,
      );
      await expect(screen.preflight.checks).toContainText(
        /Customer voice\s*Demo speech \(scripted\)/,
      );
      await expect(screen.preflight.checks).toContainText(
        "Demo mode: Firefly's built-in rules engine",
      );
      // Where speech goes, said plainly: through Firefly's server to a scripted demo that does not
      // understand audio, and nothing is stored.
      const privacy = page.getByText(/^Firefly opens your microphone only during the call/);
      await expect(privacy).toContainText('does not store audio');
      await expect(privacy).toContainText("Your speech goes to Firefly's server");
      await expect(privacy).toContainText(/scripted/);
      await expect(privacy).toContainText('does not understand audio');
      await expect(privacy).toContainText('Firefly does not keep the audio');
      const before = await readProbe(page);
      expect(before.mediaRequests).toBe(0);
      expect(before.playCalls).toEqual([]);
      await expect(page.getByRole('log', { name: 'Call transcript' })).toHaveCount(0);
    });

    const call = await api.session(callIdOf(page));
    const opening = call.turns[0]!.text;

    await test.step('pressing the button asks for the microphone once and the customer starts talking', async () => {
      await screen.preflight.allow.click();
      await expect(screen.status).toHaveText(OPENING_VOICE);
      await expect(screen.turns).toHaveCount(1);
      await expect(screen.turns.first()).toContainText(opening.slice(0, 60));
      const during = await readProbe(page);
      expect(during.mediaRequests).toBe(1);
      expect(during.micTracks).toEqual(['live']);
      expect(during.playCalls.some((play) => play.src.startsWith('blob:'))).toBe(true);
    });

    await test.step("the customer finishes, and it is the trainee's turn: the microphone opens by itself", async () => {
      await expect(screen.status).toHaveText(/^(Your turn|Listening|Hearing you)$/, {
        timeout: 20_000,
      });
      const after = await readProbe(page);
      expect(after.mediaElements).toBe(1);
      expect(after.endedDurations.length).toBeGreaterThanOrEqual(1);
      expect(after.endedDurations[0]).toBeGreaterThan(1);
      // The server's voice was played; the browser's own text-to-speech was not used.
      expect(after.synthesisCalls).toBe(0);
    });

    await test.step('Voice settings names the speech provider and gives focus back', async () => {
      await screen.voiceSettings.click();
      const dialog = page.getByRole('dialog', { name: 'Voice settings' });
      await expect(dialog).toContainText('Demo speech (scripted)');
      await expect(dialog.getByRole('switch', { name: /Hands-free/ })).toBeChecked();
      await dialog.getByRole('button', { name: 'Done' }).click();
      await expect(dialog).toBeHidden();
      await expect(screen.voiceSettings).toBeFocused();
    });
  });

  test("a spoken turn moves through listening, hearing, transcribing, thinking and speaking, and ends at the trainee's turn", async ({
    page,
    api,
  }) => {
    const { call, screen } = await startSpokenCall(page, api);
    await expect(screen.status).toHaveText(OPENING_VOICE);
    await resetProbe(page);

    await test.step('interrupt the opening to save the eight seconds it takes to play', async () => {
      await screen.interrupt.click();
      await expect(screen.turns.first()).toContainText('You interrupted. The full reply is above.');
    });

    await test.step('the microphone opens, the burst of sound is heard, and the words arrive in the transcript', async () => {
      await expect(screen.status).toHaveText('Hearing you', { timeout: 20_000 });
      await expect(screen.turns).toHaveCount(3, { timeout: 20_000 });
    });

    const spoken = screen.turns.nth(1);
    await test.step('the spoken turn carries the "Spoken" cue and the words the speech service returned', async () => {
      await expect(spoken).toContainText('Spoken');
      const text = (await spoken.locator('p').last().innerText()).trim();
      expect(isMockUtterance(text), `"${text}" is not one of the mock provider's sentences`).toBe(
        true,
      );
    });

    await test.step('the customer replies, and its voice plays to the end', async () => {
      await expect(screen.status).toHaveText(OPENING_VOICE, { timeout: 15_000 });
      await expect(screen.status).toHaveText(/^(Your turn|Listening)$/, { timeout: 20_000 });
    });

    await test.step('the stages came one after another, in this order', async () => {
      const probe = await readProbe(page);
      expect(
        containsInOrder(statusLabels(probe), [
          'Your turn',
          'Listening',
          'Hearing you',
          'Transcribing what you said',
          'The customer is thinking',
          OPENING_VOICE,
          'Your turn',
        ]),
        `the status line showed: ${statusLabels(probe).join(' > ')}`,
      ).toBe(true);
    });

    await test.step('the reply was in the transcript before its voice began, and one voice played at a time', async () => {
      const probe = await readProbe(page);
      const speaking = probe.statuses.filter((change) => change.label === OPENING_VOICE);
      expect(speaking.length).toBeGreaterThanOrEqual(1);
      // Opening (3 turns shown once the reply is in): the reply is there when its voice starts.
      expect(speaking.at(-1)!.turns).toBeGreaterThanOrEqual(3);
      const replyPlays = probe.playCalls.filter((play) => play.src.startsWith('blob:'));
      expect(replyPlays).toHaveLength(1);
      expect(replyPlays[0]!.turns).toBeGreaterThanOrEqual(3);
      expect(probe.mediaElements).toBe(1);
      expect(probe.maxPlayingAtOnce).toBe(1);
      expect(probe.synthesisCalls).toBe(0);
    });

    await test.step('the server holds exactly what the page shows: two turns of ours, one spoken', async () => {
      const saved = await api.session(call.id);
      const trainee = saved.turns.filter((turn) => turn.role === 'trainee');
      expect(trainee).toHaveLength(1);
      expect(trainee[0]!.inputMode).toBe('voice');
      expect(MOCK_SENTENCES).toContain(trainee[0]!.text);
      expect(saved.status).toBe('active');
    });
  });
});

test.describe('when the microphone is refused', () => {
  test('the pre-flight says what happened and offers Try again and a text-only call', async ({
    page,
    api,
    context,
  }) => {
    await refuseMicrophone(context);
    await openPreflight(page, api, { input: 'voice' });
    const screen = callScreen(page);

    await screen.preflight.allow.click();

    await test.step('what happened, what was kept, what to do', async () => {
      await expect(page.getByText('The microphone is blocked for this site.')).toBeVisible();
      await expect(page.getByText('Nothing has been recorded or sent.')).toBeVisible();
      await expect(
        page.getByText(/choose Try again\. You can also carry on by typing\./),
      ).toBeVisible();
      await expect(screen.preflight.checks).toContainText('Blocked in this browser');
    });

    await test.step('the two ways on are offered, and the first button is gone', async () => {
      await expect(screen.preflight.tryAgain).toBeVisible();
      await expect(page.getByRole('button', { name: 'Start a text-only call' })).toBeVisible();
      await expect(screen.preflight.allow).toHaveCount(0);
      await expectNoRawFailureText(page);
      expect((await readProbe(page)).mediaRequests).toBe(1);
    });
  });

  test('Try again starts the spoken call once the microphone is allowed', async ({
    page,
    api,
    context,
  }) => {
    await refuseMicrophone(context);
    await openPreflight(page, api, { input: 'voice' });
    const screen = callScreen(page);
    await screen.preflight.allow.click();
    await expect(page.getByText('The microphone is blocked for this site.')).toBeVisible();

    await test.step('still blocked: it says so again and stays on the pre-flight', async () => {
      await screen.preflight.tryAgain.click();
      await expect(page.getByText('The microphone is blocked for this site.')).toBeVisible();
      await expect(screen.preflight.heading).toBeVisible();
    });

    await test.step('allowed now: the call starts', async () => {
      await allowMicrophone(page);
      await screen.preflight.tryAgain.click();
      await expect(screen.status).toHaveText(OPENING_VOICE);
      await expect(screen.turns).toHaveCount(1);
      const probe = await readProbe(page);
      expect(probe.mediaRequests).toBe(3);
      expect(probe.micTracks).toEqual(['live']);
    });
  });

  test('Start a text-only call works without the microphone', async ({ page, api, context }) => {
    await refuseMicrophone(context);
    await openPreflight(page, api, { input: 'voice' });
    const screen = callScreen(page);
    await screen.preflight.allow.click();
    await expect(page.getByText('The microphone is blocked for this site.')).toBeVisible();

    await page.getByRole('button', { name: 'Start a text-only call' }).click();
    await expect(screen.reply).toBeVisible();
    await expect(screen.turns).toHaveCount(1);
    await sendTyped(screen, 'Hello, my name is Sam. Can you tell me what is happening?');
    await expect(screen.turns).toHaveCount(3);
    await expect(screen.turns.nth(1)).toContainText('Hello, my name is Sam.');
    // No second request for the microphone, and nothing was played.
    const probe = await readProbe(page);
    expect(probe.mediaRequests).toBe(1);
    expect(probe.micTracks).toEqual([]);
  });
});

test.describe('when speech fails', () => {
  test('a failed transcription says what happened, keeps the call, and Try again succeeds', async ({
    page,
    api,
    problems,
  }) => {
    problems.allow({ status: 502, url: '/api/speech/transcribe' });
    const { call, screen } = await startSpokenCall(page, api);
    await expect(screen.status).toHaveText(OPENING_VOICE);
    await screen.interrupt.click();
    await api.failNext('transcribe', 1);

    await test.step('the failure is explained in the call, not as an error page', async () => {
      await expect(page.getByText('We could not turn your speech into text.')).toBeVisible({
        timeout: 25_000,
      });
      await expect(page.getByText(/Nothing was sent\. Your recording was not kept/)).toBeVisible();
      await expect(
        page.getByText('Choose Try again to say it again, or type your reply instead.'),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Continue by typing' })).toBeVisible();
      await expectNoRawFailureText(page);
      // Nothing was added to the call.
      await expect(screen.turns).toHaveCount(1);
      expect((await api.session(call.id)).traineeTurns).toBe(0);
    });

    await test.step('Try again listens again, and this time the words arrive', async () => {
      await page.getByRole('button', { name: 'Try again' }).click();
      await expect(screen.turns).toHaveCount(3, { timeout: 25_000 });
      await expect(screen.turns.nth(1)).toContainText('Spoken');
      await expect(page.getByText('We could not turn your speech into text.')).toBeHidden();
    });
  });

  test('"Continue by typing" after a failed transcription carries on as a typed reply', async ({
    page,
    api,
    problems,
  }) => {
    problems.allow({ status: 502, url: '/api/speech/transcribe' });
    const { screen } = await startSpokenCall(page, api);
    await expect(screen.status).toHaveText(OPENING_VOICE);
    await screen.interrupt.click();
    await api.failNext('transcribe', 1);
    await expect(page.getByText('We could not turn your speech into text.')).toBeVisible({
      timeout: 25_000,
    });

    await page.getByRole('button', { name: 'Continue by typing' }).click();
    await expect(screen.reply).toBeFocused();
    await sendTyped(screen, 'Sorry, the line was bad. Can you tell me what is happening?');
    await expect(screen.turns).toHaveCount(3);
    await expect(screen.turns.nth(1)).toContainText('Sorry, the line was bad.');
    await expect(screen.turns.nth(1)).not.toContainText('Spoken');
  });

  test('a failed customer voice never blocks the call: the line is in the transcript and typing works', async ({
    page,
    api,
    problems,
  }) => {
    problems.allow({ status: 502, url: /\/api\/sessions\/[^/]+\/turns\/\d+\/speech/ });
    await api.failNext('synthesize', 1);
    const { call, screen } = await startSpokenCall(page, api);

    await test.step('the opening line is shown anyway, with what happened and what to do', async () => {
      await expect(screen.turns.first()).toContainText(
        (await api.session(call.id)).turns[0]!.text.slice(0, 60),
      );
      await expect(
        page.getByText("The customer's voice could not be made this time."),
      ).toBeVisible();
      await expect(page.getByText('Their reply is in the transcript.')).toBeVisible();
      await expectNoRawFailureText(page);
    });

    await test.step("the call goes on: it is the trainee's turn, and a typed reply is answered", async () => {
      await expect(screen.status).toHaveText(/^(Your turn|Listening|Hearing you)$/);
      await screen.typeInstead.click();
      await sendTyped(screen, 'Hello, my name is Sam. Can you tell me what is happening?');
      await expect(screen.turns).toHaveCount(3);
    });
  });
});
