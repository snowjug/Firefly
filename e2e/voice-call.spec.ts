import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures.ts';
import {
  expectAccessible,
  expectStatus,
  hasDesignFont,
  holdTone,
  lengthenCustomerVoice,
  speak,
  startSpokenCall as startControlledCall,
  tabTo,
} from './support/a11y.ts';
import {
  HINT,
  STATUS,
  callIdOf,
  callScreen,
  openPreflight,
  sendTyped,
  startSpokenCall,
  turnHandsFreeOff,
} from './support/call-screen.ts';
import { isMockUtterance, MOCK_SENTENCES } from './support/mock-speech.ts';
import {
  allowMicrophone,
  containsInOrder,
  readProbe,
  refuseMicrophone,
  resetProbe,
  settled,
  statusLabels,
} from './support/page-probes.ts';
import { expectNoRawFailureText } from './support/raw-text.ts';

// The spoken call, in a real browser, with a fake microphone and the server's mock speech provider.
//
// What these prove: the call asks for the microphone only when told to, records an utterance with the
// real voice-activity detector and the real worklet, uploads it, puts what the speech service returned
// into the transcript, plays the customer's reply from the server's audio through one audio element,
// takes turns without barge-in (the customer is never cut off by the trainee's voice; "Stop customer
// audio" is how the trainee takes the turn), and falls back gracefully when speech fails. A call is
// hands-free by default, and is a call, not a walkie-talkie: the microphone opens by itself, nothing
// is pressed to be heard, quiet does not stop the listening, and the customer is a presence (a ring
// round their initials, and live captions) and not a button. Push to talk is one switch away.
//
// What they do NOT prove: that any speech was understood. The mock provider ignores the audio and
// answers with one of eight scripted sentences, and its "voice" is a short soft noise. The browser's
// own speech recognition is not exercised at all (it returns no words under automation). The ring's
// levels follow a steady fake tone, so how it feels with a real voice is not checked here.

test.describe.configure({ timeout: 90_000 });

/** A voice that lasts long enough to be stopped by a script, however short the scripted reply is. */
const HOLD_THE_CUSTOMER = 30;

/**
 * From now on, counts every moment a Talk button is drawn in the call's controls. A hands-free call
 * has none to press, because the microphone opens by itself, so a journey through it counts zero.
 */
async function watchForTalk(page: Page): Promise<() => Promise<number>> {
  type Watched = { __talkSeen?: { count: number } };
  await page.evaluate(() => {
    const seen = { count: 0 };
    (window as unknown as Watched).__talkSeen = seen;
    const look = () => {
      const drawn = [...document.querySelectorAll('#cw-controls button')].some(
        (button) => button.textContent?.trim() === 'Talk',
      );
      if (drawn) seen.count += 1;
    };
    new MutationObserver(look).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    look();
  });
  return () => page.evaluate(() => (window as unknown as Watched).__talkSeen?.count ?? -1);
}

/** How many endless animations are running on the presence ring: a breath, a turning arc. */
const ringMotion = (page: Page) =>
  page.evaluate(
    () =>
      document.getAnimations().filter((animation) => {
        const effect = animation.effect as KeyframeEffect | null;
        return (
          Boolean(effect?.target?.closest('.cw-presence')) &&
          effect?.getComputedTiming().endTime === Infinity
        );
      }).length,
  );

/** The level the ring is being drawn at, 0 to 1: it follows the microphone, and is 0 at rest. */
const ringLevel = (page: Page) =>
  page
    .locator('.cw-presence')
    .evaluate((ring) => Number((ring as HTMLElement).style.getPropertyValue('--cw-level') || 0));

test.describe('a spoken call', () => {
  test('asks for the microphone only when "Start voice call" is pressed on the call page, then the customer greets', async ({
    page,
    api,
  }) => {
    await page.goto('/scenarios/outlook-shared-mailbox-missing/brief');
    await page.getByRole('button', { name: 'Start voice call' }).click();
    await expect(page).toHaveURL(/\/calls\/[^/?]+\?input=voice&voice=voice-[a-d]$/);
    const screen = callScreen(page);

    await test.step('the pre-flight says what is ready and what happens to speech, and has asked for nothing', async () => {
      await expect(screen.preflight.heading).toBeVisible();
      await expect(screen.preflight.checks).toContainText(/Microphone\s*Not requested/);
      await expect(screen.preflight.checks).toContainText(/Speech\s*Demo speech \(scripted\)/);
      await expect(screen.preflight.checks).toContainText(
        /Customer voice\s*A demo sound, not a voice/,
      );
      await expect(screen.preflight.checks).toContainText(
        "Demo mode: Firefly's built-in rules engine",
      );
      // The one sentence about the microphone, and where speech goes, one press away.
      await expect(
        page.getByText(
          'Firefly uses your microphone to transcribe this simulated call. Do not share real customer information.',
        ),
      ).toBeVisible();
      await screen.preflight.voiceDetails.click();
      await expect(page.getByText(/Your recording is held in memory only/)).toBeVisible();
      await expect(page.getByText(/No audio is saved/)).toBeVisible();
      const before = await readProbe(page);
      expect(
        before.mediaRequests,
        'the brief and the pre-flight never ask for the microphone',
      ).toBe(0);
      expect(before.playCalls).toEqual([]);
      await expect(page.getByRole('log', { name: 'Call transcript' })).toHaveCount(0);
    });

    const call = await api.session(callIdOf(page));
    const greeting = call.turns[0]!.text;

    await test.step('pressing the button asks for the microphone once and the customer starts talking', async () => {
      await screen.preflight.startVoice.click();
      await expect(screen.status).toHaveText(STATUS.speaking);
      await expect(screen.turns).toHaveCount(1);
      await expect(screen.turns.first()).toContainText(greeting);
      const during = await readProbe(page);
      expect(during.mediaRequests).toBe(1);
      expect(during.micTracks).toEqual(['live']);
      expect(during.playCalls.some((play) => play.src.startsWith('blob:'))).toBe(true);
    });

    await test.step("the customer finishes, and it is the trainee's turn: the microphone opens by itself", async () => {
      await expect(screen.status).toHaveText(
        new RegExp(`^(${STATUS.micReady}|${STATUS.listening}|${STATUS.hearing})$`),
        { timeout: 20_000 },
      );
      const after = await readProbe(page);
      expect(after.mediaElements).toBe(1);
      expect(after.endedDurations.length).toBeGreaterThanOrEqual(1);
      // The server's voice was played; the browser's own text-to-speech was not used.
      expect(after.synthesisCalls).toBe(0);
      // Nothing is pressed to be heard: there is no Talk, and the customer is a ring, not a button.
      await expect(screen.talk).toHaveCount(0);
      await expect(screen.presence).toBeAttached();
    });

    await test.step('Settings names the speech provider, and gives focus back', async () => {
      await screen.settings.click();
      await expect(screen.settingsDialog).toContainText('Demo speech (scripted)');
      await expect(screen.settingsDialog).toContainText('Scripted demo');
      await expect(screen.settingsDialog.getByRole('switch', { name: /Hands-free/ })).toBeChecked();
      await screen.settingsDialog.getByRole('button', { name: 'Done' }).click();
      await expect(screen.settingsDialog).toBeHidden();
      await expect(screen.settings).toBeFocused();
    });
  });

  test('a spoken turn moves through listening, hearing, processing, replying and speaking, and the customer is never cut off by it', async ({
    page,
    api,
  }) => {
    await lengthenCustomerVoice(page, HOLD_THE_CUSTOMER);
    const { call, screen } = await startSpokenCall(page, api);
    await expect(screen.status).toHaveText(STATUS.speaking);
    await resetProbe(page);

    await test.step('"Stop customer audio" takes the turn at once, and the transcript says the audio was stopped', async () => {
      await screen.stopAudio.click();
      await expect(screen.turns.first()).toContainText('Audio stopped');
      // The words stay in the transcript in full: only the sound was stopped.
      await expect(screen.turns.first()).toContainText((await api.session(call.id)).turns[0]!.text);
    });

    await test.step('the microphone opens, the burst of sound is heard, and the words arrive in the transcript', async () => {
      await expect(screen.status).toHaveText(STATUS.hearing, { timeout: 20_000 });
      await expect(screen.turns).toHaveCount(3, { timeout: 20_000 });
    });

    await test.step('the words are the ones the speech service returned', async () => {
      const text = (await screen.turns.nth(1).locator('.cw-turn__text').innerText()).trim();
      expect(isMockUtterance(text), `"${text}" is not one of the mock provider's sentences`).toBe(
        true,
      );
      // A spoken turn is not marked in the transcript: there is no "Spoken" tag for a trainee to read.
      await expect(screen.turns.nth(1)).not.toContainText('Spoken');
    });

    await test.step('the customer replies, and its voice plays', async () => {
      await expect(screen.status).toHaveText(STATUS.speaking, { timeout: 15_000 });
    });

    await test.step('the stages came one after another, in this order', async () => {
      const probe = await readProbe(page);
      expect(
        containsInOrder(statusLabels(probe), [
          STATUS.listening,
          STATUS.hearing,
          STATUS.processing,
          STATUS.replying,
          STATUS.speaking,
        ]),
        `the status line showed: ${statusLabels(probe).join(' > ')}`,
      ).toBe(true);
    });

    await test.step('the reply was in the transcript before its voice began, and one voice played at a time', async () => {
      const probe = await readProbe(page);
      const speaking = probe.statuses.filter((change) => change.label === STATUS.speaking);
      expect(speaking.length).toBeGreaterThanOrEqual(1);
      // The greeting, the spoken turn and the reply: the reply is there when its voice starts.
      expect(speaking.at(-1)!.turns).toBeGreaterThanOrEqual(3);
      const replyPlays = probe.playCalls.filter((play) => play.src.startsWith('blob:'));
      expect(replyPlays).toHaveLength(1);
      expect(replyPlays[0]!.turns).toBeGreaterThanOrEqual(3);
      expect(probe.mediaElements).toBe(1);
      expect(probe.maxPlayingAtOnce).toBe(1);
      expect(probe.synthesisCalls).toBe(0);
    });

    await test.step('the server holds exactly what the page shows: one turn of ours, and it was spoken', async () => {
      const saved = await api.session(call.id);
      const trainee = saved.turns.filter((turn) => turn.role === 'trainee');
      expect(trainee).toHaveLength(1);
      expect(trainee[0]!.inputMode).toBe('voice');
      expect(MOCK_SENTENCES).toContain(trainee[0]!.text);
      expect(saved.status).toBe('active');
    });
  });

  test('each stage of a spoken turn looks like itself: a ring that breathes, follows the voice and turns, bars that follow the microphone, a place in the transcript for the words before they arrive, three points while the customer works out a reply, and a strip that settles', async ({
    page,
  }) => {
    const { delays } = await startControlledCall(page);
    const screen = callScreen(page);
    const wave = page.locator('svg.cw-wave');
    const heights = () =>
      wave.evaluate((svg) =>
        [...svg.querySelectorAll('rect.cw-wave__bar')].map((bar) =>
          Number(bar.getAttribute('height')),
        ),
      );

    await test.step('the customer’s voice is drawn from the sound that plays, or as a calm fixed pattern, never as a meter that is only guessed', async () => {
      await expect(screen.stopAudio).toBeVisible();
      await expect(wave).toHaveAttribute('data-mode', 'customer');
      await expect(wave).toHaveAttribute('data-shape', /^(?:bars|pattern)$/);
      test.info().annotations.push({
        type: 'the customer’s strip',
        description: (await wave.getAttribute('data-shape')) ?? 'none',
      });
    });

    await test.step('the customer is a presence: a ring that is theirs, with their words captioned under them, and no Talk', async () => {
      await expect(screen.presence).toHaveAttribute('data-presence', 'speaking');
      await expect(screen.talk).toHaveCount(0);
      // The captions are for the eye: the transcript is the record and the status line is the words.
      await expect(screen.captions).toHaveAttribute('data-live', 'true');
      await expect(screen.captions).toHaveAttribute('aria-hidden', 'true');
      const greeting = (await screen.turns.first().locator('.cw-turn__text').innerText()).trim();
      await expect(screen.captions).toContainText(greeting.split(/\s+/).slice(0, 4).join(' '));
    });

    await test.step('listening, then hearing: the ring breathes, then follows the microphone, and the bars rise with it, the newest at the right', async () => {
      await screen.stopAudio.click();
      await expectStatus(page, 'listening');
      await expect(wave).toHaveAttribute('data-mode', 'trainee');
      await expect(screen.presence).toHaveAttribute('data-presence', 'listening');
      expect(await ringMotion(page), 'a breath is going').toBeGreaterThan(0);
      // Nothing is waiting to be pressed: no Talk, and no Done speaking until there is speech to end.
      await expect(screen.talk).toHaveCount(0);
      await expect(screen.done).toHaveCount(0);
      await speak(page, true);
      await expectStatus(page, 'speech-detected');
      await expect(screen.presence).toHaveAttribute('data-presence', 'hearing');
      await expect.poll(() => ringLevel(page), 'the ring follows the voice').toBeGreaterThan(0);
      // A small way out appears, and does not take the keyboard from where it was.
      await expect(screen.done).toBeVisible();
      await expect(screen.done).not.toBeFocused();
      await expect(wave).toHaveAttribute('data-shape', 'bars');
      await expect
        .poll(async () => {
          const bars = await heights();
          return (bars.at(-1) ?? 0) - (bars[0] ?? 0);
        })
        .toBeGreaterThan(2);
      await holdTone(page);
    });

    await test.step('processing: the ring turns quietly, the words have a place in the transcript, with a shimmer there and on the strip, and no percentage', async () => {
      delays.transcribe = 2_000;
      delays.reply = 2_000;
      await speak(page, false);
      await expectStatus(page, 'processing-speech', 30_000);
      await expect(screen.presence).toHaveAttribute('data-presence', 'working');
      expect(await ringMotion(page), 'the arc is turning').toBeGreaterThan(0);
      // The turn has been sent, so the way out of it has gone.
      await expect(screen.done).toHaveCount(0);
      const row = screen.turns.last();
      await expect(row.locator('.cw-turn__placeholder')).toBeVisible();
      await expect(row.locator('.cw-turn__tag')).toHaveText('Transcribing');
      await expect(row.locator('.cw-turn__text')).toHaveCount(0);
      await expect(
        screen.customer.getByRole('progressbar', { name: 'Processing speech' }),
      ).toBeVisible();
      expect(await page.locator('body').innerText()).not.toMatch(/\d\s?%/);
    });

    await test.step('replying: the words are in the place that was kept for them, and three points show the customer working', async () => {
      await expectStatus(page, 'generating-reply', 30_000);
      await expect(screen.presence).toHaveAttribute('data-presence', 'working');
      await expect(screen.turns).toHaveCount(2);
      await expect(screen.turns.last().locator('.cw-turn__placeholder')).toHaveCount(0);
      await expect(screen.turns.last().locator('.cw-turn__text')).not.toHaveText('');
      await expect(page.locator('.cw-think__dot')).toHaveCount(3);
      // A screen reader hears what the three points mean, once.
      await expect(screen.customer.getByText('Customer is responding')).toHaveCount(1);
      const running = await page
        .locator('.cw-think__dot')
        .first()
        .evaluate((dot) => getComputedStyle(dot).animationName);
      expect(running).not.toBe('none');
    });

    await test.step('speaking: the reply is in the transcript and captioned, the ring is the customer’s, and the strip is theirs', async () => {
      await expectStatus(page, 'customer-speaking', 30_000);
      await expect(screen.turns).toHaveCount(3);
      await expect(wave).toHaveAttribute('data-mode', 'customer');
      await expect(page.locator('.cw-think__dot')).toHaveCount(0);
      await expect(screen.turns.last()).toHaveAttribute('aria-current', 'true');
      await expect(screen.presence).toHaveAttribute('data-presence', 'speaking');
      const reply = (await screen.turns.last().locator('.cw-turn__text').innerText()).trim();
      await expect(screen.captions).toHaveAttribute('data-live', 'true');
      await expect(screen.captions).toContainText(reply.split(/\s+/).slice(0, 4).join(' '));
    });

    await test.step('finished: stopping the voice gives the turn back, and a pause holds the ring still, with Resume in its place', async () => {
      delays.transcribe = 0;
      delays.reply = 0;
      await screen.stopAudio.click();
      await expectStatus(page, 'listening');
      await expect(screen.turns.last()).not.toHaveAttribute('aria-current', 'true');
      // The captions fade away between turns, and keep their place.
      await expect(screen.captions).toHaveAttribute('data-live', 'false');
      await screen.pause.click();
      await expectStatus(page, 'paused');
      // Nothing is drawn for a silence: no flat line that would look like a meter that has stopped.
      await expect(wave).toHaveCount(0, { timeout: 3_000 });
      await expect(screen.status).toHaveText(STATUS.paused);
      await expect(screen.presence).toHaveAttribute('data-presence', 'held');
      await expect(screen.resume).toBeVisible();
      await expect(screen.pause).toHaveCount(0);
      // A call on hold is still: nothing repeats on the ring.
      await expect.poll(() => ringMotion(page)).toBe(0);
    });
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('the strip is a still level meter, the three points and the ring are still, and the words are the same', async ({
      page,
    }) => {
      const { delays } = await startControlledCall(page);
      const screen = callScreen(page);
      const wave = page.locator('svg.cw-wave');
      await screen.stopAudio.click();
      await expectStatus(page, 'listening');
      // Listening is a steady halo and not a breath: nothing on the ring repeats.
      await expect(screen.presence).toHaveAttribute('data-presence', 'listening');
      expect(await ringMotion(page)).toBe(0);
      await speak(page, true);
      await expectStatus(page, 'speech-detected');
      await expect(screen.presence).toHaveAttribute('data-presence', 'hearing');
      // The ring is not drawn to the voice: its level stays at rest while the strip shows a still meter.
      expect(await ringLevel(page)).toBe(0);
      await expect(wave).toHaveAttribute('data-shape', 'meter');
      await holdTone(page);
      delays.reply = 2_000;
      await speak(page, false);
      await expectStatus(page, 'generating-reply', 30_000);
      await expect(screen.presence).toHaveAttribute('data-presence', 'working');
      // The arc that turns while something is worked out is a whole ring that stays where it is.
      expect(await ringMotion(page)).toBe(0);
      await expect(page.locator('.cw-think__dot')).toHaveCount(3);
      await expect(screen.customer.getByText('Customer is responding')).toHaveCount(1);
      const animations = await page
        .locator('.cw-think__dot')
        .evaluateAll((dots) => dots.map((dot) => getComputedStyle(dot).animationName));
      expect(animations).toEqual(['none', 'none', 'none']);
    });
  });

  test('speaking over the customer interrupts nothing: the microphone stays closed until the customer has finished or been stopped', async ({
    page,
  }) => {
    await startControlledCall(page);
    const screen = callScreen(page);
    await expect(screen.status).toHaveText(STATUS.speaking);
    await resetProbe(page);

    await test.step('the trainee speaks while the customer is speaking', async () => {
      // The call's own detector would hear a tone this loud and long as speech if the microphone
      // were open. The helper holds the tone for 700 ms, which is far longer than the detector needs.
      await speak(page, true);
      await speak(page, false);
    });

    await test.step('the customer is still speaking, nothing was heard, and no turn was taken', async () => {
      await expect(screen.status).toHaveText(STATUS.speaking);
      await expect(screen.turns).toHaveCount(1);
      await expect(screen.turns.first()).not.toContainText('Audio stopped');
      // A hands-free call has no Talk to press, and no Done speaking: nothing was heard to end.
      await expect(screen.talk).toHaveCount(0);
      await expect(screen.done).toHaveCount(0);
      const probe = await readProbe(page);
      expect(statusLabels(probe)).not.toContain(STATUS.hearing);
      expect(statusLabels(probe)).not.toContain(STATUS.listening);
    });

    await test.step('after "Stop customer audio" the same tone is heard', async () => {
      await screen.stopAudio.click();
      await expectStatus(page, 'listening');
      await speak(page, true);
      await expectStatus(page, 'speech-detected');
      await speak(page, false);
    });
  });

  test('with hands-free off, Talk opens the microphone and the same control becomes Done speaking, which ends the turn at once', async ({
    page,
  }) => {
    const { delays } = await startControlledCall(page);
    const screen = callScreen(page);

    await test.step('turn hands-free off in Settings: the screen is the push-to-talk one it always was, with Talk waiting for the customer', async () => {
      await turnHandsFreeOff(screen);
      await expect(screen.talk).toBeVisible();
      await expect(screen.talk).toHaveAttribute('aria-disabled', 'true');
    });

    await test.step('stop the customer: the microphone stays closed until the trainee says Talk', async () => {
      await screen.stopAudio.click();
      await expectStatus(page, 'mic-ready');
      await expect(screen.talk).toBeEnabled();
      await expect(screen.talk).not.toHaveAttribute('aria-disabled', 'true');
    });

    await test.step('Talk opens the microphone; the control keeps focus and is now "Done speaking"', async () => {
      await screen.talk.focus();
      await page.keyboard.press('Enter');
      await expectStatus(page, 'listening');
      await expect(screen.done).toBeFocused();
      await expect(screen.talk).toHaveCount(0);
    });

    await test.step('speech is heard, and Done speaking sends it without waiting for silence', async () => {
      // The speech service answers at once, so hold it for a moment to be able to see the stage.
      delays.transcribe = 2000;
      await speak(page, true);
      await expectStatus(page, 'speech-detected');
      // A click is not speech: let the tone last before ending the turn.
      await holdTone(page);
      await screen.done.click();
      await expectStatus(page, 'processing-speech');
      await speak(page, false);
      delays.transcribe = 0;
      await expect(screen.turns).toHaveCount(3, { timeout: 20_000 });
      const heard = await screen.turns.nth(1).locator('.cw-turn__text').innerText();
      expect(
        isMockUtterance(heard.trim()),
        `the transcript has what the speech service returned: ${heard}`,
      ).toBe(true);
    });
  });

  test('Mute and Pause stop the microphone from listening, say so in words, and can be undone', async ({
    page,
  }) => {
    await startControlledCall(page);
    const screen = callScreen(page);
    const asked = () => page.evaluate(() => window.__fireflyMic?.requests ?? 0);
    await screen.stopAudio.click();
    await expectStatus(page, 'listening');
    const asked0 = await asked();
    expect(asked0, 'the microphone was asked for at the start').toBeGreaterThan(0);

    await test.step('Mute is a toggle: it says it is pressed, the status says Muted, and a voice is not heard until it is undone', async () => {
      await screen.mute.click();
      await expect(screen.mute).toHaveAttribute('aria-pressed', 'true');
      await expect(screen.status).toHaveText(STATUS.muted);
      // There is no Talk to press: the status says Muted, the ring is still, and Mute is the way back.
      await expect(screen.talk).toHaveCount(0);
      await expect(screen.presence).toHaveAttribute('data-presence', 'still');
      await speak(page, true);
      await speak(page, false);
      await expect(screen.status).toHaveText(STATUS.muted);
      await expect(screen.turns).toHaveCount(1);
      await screen.mute.click();
      await expect(screen.mute).toHaveAttribute('aria-pressed', 'false');
      await expectStatus(page, 'listening');
      await expect(screen.hint).toHaveCount(0);
      expect(await asked(), 'muting silences the microphone and keeps it').toBe(asked0);
    });

    await test.step('Pause lets go of the microphone and turns into Resume, in the first row, and the keyboard goes with it', async () => {
      await screen.pause.focus();
      await page.keyboard.press('Enter');
      await expect(screen.status).toHaveText(STATUS.paused);
      await expect(screen.resume).toBeVisible();
      await expect(screen.pause).toHaveCount(0);
      // The key that paused the call was on Pause, which has gone: the keyboard is on Resume, not lost.
      await expect(screen.resume).toBeFocused();
      await speak(page, true);
      await speak(page, false);
      await expect(screen.status).toHaveText(STATUS.paused);
      await expect(screen.turns).toHaveCount(1);
      expect(await asked(), 'nothing asks for the microphone while the call is held').toBe(asked0);
    });

    await test.step('Resume asks for the microphone again, the call listens, and the keyboard is back on Pause', async () => {
      await page.keyboard.press('Enter');
      await expect(screen.pause).toBeVisible();
      await expect(screen.pause).toBeFocused();
      await expectStatus(page, 'listening');
      expect(await asked(), 'the microphone was opened again').toBe(asked0 + 1);
    });

    await test.step('and a voice is heard again', async () => {
      await speak(page, true);
      await expectStatus(page, 'speech-detected');
      await speak(page, false);
    });
  });

  test('on a phone the call keeps its controls whole, the quiet ones a full 44 px, and room to read at 320 by 640', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await startControlledCall(page);
    const screen = callScreen(page);
    await screen.stopAudio.click();
    await expectStatus(page, 'listening');
    const transcript = page.locator('#cw-transcript');
    let room = 0;

    await test.step('the bar is two rows, and the transcript has the room', async () => {
      expect((await page.locator('.cw-bar').boundingBox())!.height).toBeLessThanOrEqual(112);
      // 250 px in the design's own font. A wider one (DejaVu Sans, which the Linux CI runner uses) wraps
      // the two dock buttons onto more lines, so the floor here is 230 px: three lines of the transcript.
      room = (await transcript.boundingBox())!.height;
      expect(room).toBeGreaterThanOrEqual(230);
    });

    await test.step('every control is whole inside the window, and a full 44 px target, Done speaking too while there is speech to end', async () => {
      // The tone stays on to the end of the test, so that Done speaking is there to be measured.
      await speak(page, true);
      await expectStatus(page, 'speech-detected');
      await expect(screen.done).toBeVisible();
      await settled(page);
      // The first row is kept for what a press is for, so a button arriving in it moves nothing.
      expect(
        Math.abs((await transcript.boundingBox())!.height - room),
        'the transcript did not move when Done speaking arrived',
      ).toBeLessThanOrEqual(1);
      for (const control of [screen.done, screen.mute, screen.text, screen.pause, screen.replay]) {
        const box = (await control.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(321);
        expect(box.y + box.height).toBeLessThanOrEqual(641);
        expect(box.height).toBeGreaterThanOrEqual(43.5);
      }
      const settings = (await screen.settings.boundingBox())!;
      expect(settings.height).toBeGreaterThanOrEqual(43.5);
      expect(settings.y + settings.height).toBeLessThanOrEqual(641);
    });

    await test.step('the "Demo mode" label is not on the bar below 360 px: Voice settings says it in words', async () => {
      await expect(page.locator('.cw-bar').getByText('Demo mode', { exact: true })).toBeHidden();
      await screen.settings.click();
      await expect(screen.settingsDialog).toContainText(
        "Demo mode: Firefly's built-in rules engine",
      );
      await screen.settingsDialog.getByRole('button', { name: 'Done' }).click();
      await expect(screen.settingsDialog).toBeHidden();
    });

    await test.step('"Done speaking" fits on one line wherever there is the room for it', async () => {
      await page.setViewportSize({ width: 1440, height: 900 });
      // The room is measured in the design's own font. A wider one (DejaVu Sans, on the Linux CI runner)
      // needs more than the button has, and wrapping there is not a fault.
      if (await hasDesignFont(page)) {
        const lines = await screen.done.evaluate((button) => {
          const label = button.querySelector('.ff-button__label') ?? button;
          const style = getComputedStyle(label);
          return Math.round(label.getBoundingClientRect().height / parseFloat(style.lineHeight));
        });
        expect(lines).toBe(1);
      }
      // And the label of who plays the customer is on the bar again (it is only out of it below 360 px).
      await expect(page.locator('.cw-bar').getByText('Demo mode', { exact: true })).toBeVisible();
    });
  });

  test('the disabled controls stay readable (3:1 or better), and keep their fill', async ({
    page,
  }) => {
    await startControlledCall(page);
    const screen = callScreen(page);
    // Talk and a waiting Stop customer audio are the push-to-talk screen's: a hands-free call has neither.
    await turnHandsFreeOff(screen);
    await expect(screen.stopAudio).toBeVisible();
    const read = (control: typeof screen.talk) =>
      control.evaluate((element) => {
        const style = getComputedStyle(element);
        const channels = (colour: string) => {
          const numbers = (colour.match(/[\d.]+/g) ?? []).map(Number);
          // A mixed colour comes back as color(srgb 0.7 0.8 0.9), each part from 0 to 1.
          return colour.startsWith('color(')
            ? numbers.map((value, i) => (i < 3 ? value * 255 : value))
            : numbers;
        };
        const luminance = ([r = 0, g = 0, b = 0]: number[]) => {
          const [lr = 0, lg = 0, lb = 0] = [r, g, b].map((value) => {
            const c = value / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
        };
        const ratio = (a: number[], b: number[]) => {
          const [high = 0, low = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
          return (high + 0.05) / (low + 0.05);
        };
        const fill = channels(style.backgroundColor);
        // A button with no fill of its own sits on its dock or its panel, which is opaque.
        const behind = channels(
          getComputedStyle(element.closest('.cw-dock, .cw-stage__zone') ?? document.body)
            .backgroundColor,
        );
        const base = fill.length === 4 && fill[3] === 0 ? behind : fill;
        return { fill: style.backgroundColor, contrast: ratio(channels(style.color), base) };
      });

    // While the customer speaks Talk waits: dimmed, not washed out.
    await expect(screen.talk).toHaveAttribute('aria-disabled', 'true');
    const talk = await read(screen.talk);
    expect(talk.contrast, 'Talk, disabled').toBeGreaterThanOrEqual(3);
    // The fill is the primary button's own: not the grey of a button that has been washed out.
    expect(talk.fill).not.toBe('rgb(240, 240, 240)');

    // Once the customer has been stopped it is Stop customer audio that waits.
    await screen.stopAudio.click();
    await expectStatus(page, 'mic-ready');
    await expect(screen.stopAudio).toHaveAttribute('aria-disabled', 'true');
    expect(
      (await read(screen.stopAudio)).contrast,
      'Stop customer audio, disabled',
    ).toBeGreaterThanOrEqual(3);
  });
});

test.describe('a hands-free call', () => {
  const seconds = (clock: string) => {
    const [minutes = 0, rest = 0] = clock.trim().split(':').map(Number);
    return minutes * 60 + rest;
  };

  test('is a call and not a walkie-talkie: two turns in a row, and nothing is pressed to take either', async ({
    page,
    api,
  }) => {
    // A short customer voice, so that each reply ends by itself and the microphone opens again by itself.
    const { id } = await startControlledCall(page, { voiceSeconds: 2 });
    const screen = callScreen(page);
    const talkDrawn = await watchForTalk(page);

    await test.step('the greeting ends, and the microphone opens by itself, with nothing to press', async () => {
      await expectStatus(page, 'listening', 30_000);
      await expect(screen.presence).toHaveAttribute('data-presence', 'listening');
      await expect(screen.slot.getByRole('button')).toHaveCount(0);
    });

    for (const turn of [1, 2]) {
      await test.step(`turn ${turn}: a voice is heard, the turn ends by itself after a pause, the customer replies, and the microphone is open again`, async () => {
        await speak(page, true);
        await expectStatus(page, 'speech-detected');
        await holdTone(page);
        await speak(page, false);
        await expect(screen.turns).toHaveCount(1 + 2 * turn, { timeout: 30_000 });
        await expectStatus(page, 'listening', 30_000);
      });
    }

    await test.step('Talk was never drawn, and the server holds the two spoken turns', async () => {
      expect(await talkDrawn(), 'a Talk button was drawn').toBe(0);
      const trainee = (await api.session(id)).turns.filter((turn) => turn.role === 'trainee');
      expect(trainee).toHaveLength(2);
      for (const turn of trainee) {
        expect(turn.inputMode).toBe('voice');
        expect(MOCK_SENTENCES).toContain(turn.text);
      }
    });
  });

  test('Done speaking is a small way out: there only while the trainee is heard, never taking the keyboard, ending the turn at once, and gone', async ({
    page,
  }) => {
    const { delays } = await startControlledCall(page);
    const screen = callScreen(page);
    await screen.stopAudio.click();
    await expectStatus(page, 'listening');

    await test.step('while nothing is said there is nothing to end', async () => {
      await expect(screen.done).toHaveCount(0);
    });

    await test.step('speech is heard: Done speaking appears in the first row, and the keyboard stays where it was', async () => {
      await speak(page, true);
      await expectStatus(page, 'speech-detected');
      await expect(screen.slot.getByRole('button', { name: 'Done speaking' })).toBeVisible();
      await expect(screen.done).toBeEnabled();
      await expect(screen.done).not.toBeFocused();
    });

    await test.step('pressing it sends what was said at once, without waiting for a silence, and it goes', async () => {
      // The voice is still on: a turn that ended by itself would have to wait for it to stop.
      delays.transcribe = 1_500;
      await holdTone(page);
      await screen.done.click();
      await expectStatus(page, 'processing-speech');
      await expect(screen.done).toHaveCount(0);
      await speak(page, false);
      delays.transcribe = 0;
      await expect(screen.turns).toHaveCount(3, { timeout: 30_000 });
    });
  });

  test('from the keyboard: Done speaking is one Tab stop from the controls, and the keyboard is never dropped when it, or Stop customer audio, leaves', async ({
    page,
  }) => {
    const { delays } = await startControlledCall(page);
    const screen = callScreen(page);
    const keyboard = () =>
      page.evaluate(() => {
        const active = document.activeElement;
        return {
          onPage: active === document.body || active === document.documentElement,
          inControls: Boolean(active?.closest('#cw-controls')),
          name: active?.textContent?.trim() ?? '',
        };
      });

    await test.step('Stop customer audio takes the turn from the keyboard, and the keyboard stays among the controls', async () => {
      await screen.stopAudio.focus();
      await page.keyboard.press('Enter');
      await expectStatus(page, 'listening');
      await expect(screen.stopAudio).toHaveCount(0);
      expect(await keyboard()).toMatchObject({ onPage: false, inControls: true });
    });

    await test.step('Done speaking is the next Tab stop, with a focus ring, and ends the turn', async () => {
      await speak(page, true);
      await expectStatus(page, 'speech-detected');
      await expect(screen.done).toBeVisible();
      expect((await keyboard()).name, 'it did not take the keyboard by itself').not.toBe(
        'Done speaking',
      );
      expect(await tabTo(page, /^Done speaking$/, 6)).toBeLessThanOrEqual(2);
      await expect(screen.done).toBeFocused();
      // The speech service answers at once, so hold it for a moment to be able to see the stage.
      delays.transcribe = 1_500;
      await holdTone(page);
      await page.keyboard.press('Enter');
      await expectStatus(page, 'processing-speech');
      await speak(page, false);
      delays.transcribe = 0;
      await expect(screen.done).toHaveCount(0);
      expect(await keyboard(), 'the keyboard did not fall to the page').toMatchObject({
        onPage: false,
        inControls: true,
      });
    });
  });

  test('quiet does not stop the listening: the microphone stays open, nothing is pressed, and the call says so, softly', async ({
    page,
  }, testInfo) => {
    // The page's clock runs as usual until it is moved, so that a long quiet need not be waited for.
    await page.clock.install();
    await startControlledCall(page);
    const screen = callScreen(page);
    const asked = () => page.evaluate(() => window.__fireflyMic?.requests ?? 0);
    await screen.stopAudio.click();
    await expectStatus(page, 'listening');
    await expect(screen.hint).toHaveCount(0);
    const asked0 = await asked();

    await test.step('after a quiet longer than the idle time, it is still listening, with nothing to press, and says so', async () => {
      await page.clock.fastForward(16_000);
      await expect(screen.hint).toHaveText(HINT.stillListening);
      await expectStatus(page, 'listening');
      await expect(screen.presence).toHaveAttribute('data-presence', 'listening');
      await expect(screen.talk).toHaveCount(0);
      await expect(screen.slot.getByRole('button')).toHaveCount(0);
      expect(await asked(), 'the microphone was not closed and opened again').toBe(asked0);
      await expectAccessible(page, testInfo, 'a hands-free call, still listening');
    });

    await test.step('a voice is then heard as if nothing had happened, and the guidance goes', async () => {
      await speak(page, true);
      await expectStatus(page, 'speech-detected');
      await expect(screen.hint).toHaveCount(0);
      await holdTone(page);
      await speak(page, false);
      await expect(screen.turns).toHaveCount(3, { timeout: 30_000 });
    });
  });

  test('ten minutes of quiet pause the call and say so, with Resume in the first row, and Resume carries on', async ({
    page,
  }, testInfo) => {
    await page.clock.install();
    await startControlledCall(page);
    const screen = callScreen(page);
    await screen.stopAudio.click();
    await expectStatus(page, 'listening');

    await test.step('forty stretches of quiet in a row; the call listens through all but the last', async () => {
      // Each jump fires the idle timer once, and the call sets the next.
      for (let stretch = 1; stretch < 40; stretch += 1) await page.clock.fastForward(15_500);
      await expectStatus(page, 'listening');
      await expect(screen.hint).toHaveText(HINT.stillListening);
    });

    await test.step('the last one pauses the call, says why, and offers Resume', async () => {
      await page.clock.fastForward(15_500);
      await expectStatus(page, 'paused');
      await expect(screen.hint).toHaveText(HINT.idlePaused);
      await expect(screen.slot.getByRole('button', { name: 'Resume' })).toBeVisible();
      await expect(screen.pause).toHaveCount(0);
      await expect(screen.presence).toHaveAttribute('data-presence', 'held');
      await expectAccessible(page, testInfo, 'a hands-free call, paused after ten quiet minutes');
    });

    await test.step('Resume opens the microphone again', async () => {
      await screen.resume.click();
      await expectStatus(page, 'listening');
      await expect(screen.hint).toHaveCount(0);
      await expect(screen.pause).toBeVisible();
    });
  });

  test('the stage passes an accessible scan in its main states: listening, hearing with Done speaking, and the customer speaking with captions', async ({
    page,
  }, testInfo) => {
    const { delays } = await startControlledCall(page);
    const screen = callScreen(page);
    await screen.stopAudio.click();
    await expectStatus(page, 'listening');
    await expectAccessible(page, testInfo, 'a hands-free call, listening');

    await speak(page, true);
    await expectStatus(page, 'speech-detected');
    await expect(screen.done).toBeVisible();
    await expectAccessible(page, testInfo, 'a hands-free call, hearing you, with Done speaking');

    delays.transcribe = 2_000;
    delays.reply = 1_000;
    await holdTone(page);
    await speak(page, false);
    await expectStatus(page, 'customer-speaking', 30_000);
    await expect(screen.captions).toHaveAttribute('data-live', 'true');
    await expectAccessible(page, testInfo, 'a hands-free call, the customer speaking, captioned');
  });

  test('ending the call is a moment, not a flash: "Call ended", how long it was, the review being prepared, and then the report', async ({
    page,
  }, testInfo) => {
    // The server's answer is held, so that the moment can be looked at as well as seen.
    await page.route('**/api/sessions/*/end', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 4_000));
      await route.continue();
    });
    const { id } = await startControlledCall(page);
    const screen = callScreen(page);
    await screen.stopAudio.click();
    await expectStatus(page, 'listening');
    // One spoken turn, so that there is something to review.
    await speak(page, true);
    await expectStatus(page, 'speech-detected');
    await holdTone(page);
    await speak(page, false);
    await expect(screen.turns).toHaveCount(3, { timeout: 30_000 });

    await screen.endCall.click();
    await expect(screen.endDialog).toBeVisible();
    const asked = seconds(await screen.endDialog.locator('.cw-end__clock').innerText());
    await screen.endDialog.getByRole('button', { name: 'End and review' }).click();

    await test.step('the dialog becomes the moment: the call has ended, here is how long it was, and the review is being prepared', async () => {
      await expect(screen.endingDialog).toBeVisible();
      await expect(screen.ended.title).toBeVisible();
      await expect(screen.ended.time).toHaveText(/^Call length \d+:\d{2}$/);
      const shown = seconds((await screen.ended.time.innerText()).replace('Call length', ''));
      expect(shown, 'the length the question showed, or a little more').toBeGreaterThanOrEqual(
        asked,
      );
      expect(shown - asked, 'and not much more').toBeLessThan(30);
      await expect(screen.ended.progress).toBeVisible();
      // How long the review takes is not known, so no number is shown.
      await expect(screen.ended.progress).not.toHaveAttribute('aria-valuenow', /.*/);
      await expect(screen.endingDialog).not.toContainText('%');
    });

    await test.step('it is still the dialog it was: the keyboard is inside it, and it can be scanned', async () => {
      await expect
        .poll(() => page.evaluate(() => document.activeElement?.className))
        .toMatch(/cw-end__heading/);
      await expectAccessible(page, testInfo, 'the call-ended moment');
    });

    await test.step('then the report opens', async () => {
      await expect(page).toHaveURL(new RegExp(`/sessions/${id}/report$`), { timeout: 30_000 });
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: /Coaching report|Building your coaching report/,
        }),
      ).toBeVisible({ timeout: 30_000 });
    });
  });

  test('a quick ending still gets its moment: about a second, counted from the press, and then the report', async ({
    page,
  }) => {
    const { id } = await startControlledCall(page);
    const screen = callScreen(page);
    await screen.stopAudio.click();
    await expectStatus(page, 'listening');
    await speak(page, true);
    await expectStatus(page, 'speech-detected');
    await holdTone(page);
    await speak(page, false);
    await expect(screen.turns).toHaveCount(3, { timeout: 30_000 });

    await screen.endCall.click();
    await expect(screen.endDialog).toBeVisible();
    const button = screen.endDialog.getByRole('button', { name: 'End and review' });
    const pressed = Date.now();
    await button.click();
    await expect(page).toHaveURL(new RegExp(`/sessions/${id}/report$`), { timeout: 30_000 });
    const took = Date.now() - pressed;
    // The moment is held for 0.8 s from the press (a little under, allowing for the press itself), and
    // the report waits for nothing else but the real work.
    expect(took, 'the report opened before the moment had its time').toBeGreaterThanOrEqual(700);
    expect(took, 'the moment held the report back for far too long').toBeLessThan(6_000);
  });
});

test.describe('when the microphone is refused', () => {
  test('the pre-flight says what happened, keeps the focus on Retry, and offers Use text', async ({
    page,
    api,
    context,
  }) => {
    await refuseMicrophone(context);
    await openPreflight(page, api, { input: 'voice' });
    const screen = callScreen(page);

    await screen.preflight.startVoice.click();

    await test.step('what happened and what was kept, in words, with no raw error', async () => {
      await expect(screen.problem.title).toHaveText(
        'The microphone is blocked, so Firefly cannot hear you.',
      );
      await expect(screen.problem.card).toContainText('Nothing was recorded.');
      await expect(screen.preflight.checks).toContainText(/Microphone\s*Blocked/);
      await expectNoRawFailureText(page);
      expect((await readProbe(page)).mediaRequests).toBe(1);
    });

    await test.step('the two ways on are offered, the first is focused, and the start buttons are gone', async () => {
      await expect(screen.problem.retry).toBeVisible();
      await expect(screen.problem.useText).toBeVisible();
      await expect(screen.problem.retry).toBeFocused();
      await expect(screen.preflight.startVoice).toHaveCount(0);
      await expect(screen.preflight.startText).toHaveCount(0);
    });
  });

  test('Retry starts the spoken call once the microphone is allowed, and asks again each time it is pressed', async ({
    page,
    api,
    context,
  }) => {
    await refuseMicrophone(context);
    await openPreflight(page, api, { input: 'voice' });
    const screen = callScreen(page);
    await screen.preflight.startVoice.click();
    await expect(screen.problem.retry).toBeVisible();

    await test.step('still blocked: it says so again and stays on the pre-flight', async () => {
      await screen.problem.retry.click();
      await expect.poll(async () => (await readProbe(page)).mediaRequests).toBe(2);
      await expect(screen.problem.title).toHaveText(
        'The microphone is blocked, so Firefly cannot hear you.',
      );
      await expect(screen.preflight.heading).toBeVisible();
    });

    await test.step('allowed now: the call starts', async () => {
      await allowMicrophone(page);
      await screen.problem.retry.click();
      await expect(screen.status).toHaveText(STATUS.speaking);
      await expect(screen.turns).toHaveCount(1);
      const probe = await readProbe(page);
      expect(probe.mediaRequests).toBe(3);
      expect(probe.micTracks).toEqual(['live']);
    });
  });

  test('"Use text" works without the microphone, and never asks for it again', async ({
    page,
    api,
    context,
  }) => {
    await refuseMicrophone(context);
    await openPreflight(page, api, { input: 'voice' });
    const screen = callScreen(page);
    await screen.preflight.startVoice.click();
    await expect(screen.problem.useText).toBeVisible();

    await screen.problem.useText.click();
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
  test('a failed transcription says what happened, keeps the call, and Retry sends the words once', async ({
    page,
    api,
    problems,
  }) => {
    problems.allow({ status: 502, url: '/api/speech/transcribe' });
    await lengthenCustomerVoice(page, HOLD_THE_CUSTOMER);
    const { call, screen } = await startSpokenCall(page, api);
    await expect(screen.status).toHaveText(STATUS.speaking);
    await screen.stopAudio.click();
    await api.failNext('transcribe', 1);

    await test.step('the failure is explained in the call, in words, not as an error page', async () => {
      await expect(screen.problem.title).toHaveText('Your speech could not be turned into text.', {
        timeout: 30_000,
      });
      await expect(screen.problem.card).toContainText('Your call and its transcript are safe.');
      await expect(screen.status).toHaveText(STATUS.tryAgain);
      await expectNoRawFailureText(page);
      // Nothing was added to the call, and there is one Retry, on the card.
      await expect(screen.turns).toHaveCount(1);
      await expect(screen.problem.retry).toHaveCount(1);
      await expect(screen.problem.useText).toBeVisible();
      expect((await api.session(call.id)).traineeTurns).toBe(0);
    });

    await test.step('Retry sends what was recorded, and this time the words arrive, once', async () => {
      await screen.problem.retry.click();
      await expect(screen.turns).toHaveCount(3, { timeout: 30_000 });
      await expect(screen.problem.card).toHaveCount(0);
      const saved = await api.session(call.id);
      expect(saved.turns.filter((turn) => turn.role === 'trainee')).toHaveLength(1);
      expect(saved.turns.filter((turn) => turn.role === 'trainee')[0]!.inputMode).toBe('voice');
    });
  });

  test('"Use text" after a failed transcription carries on as a typed reply, with no duplicate turn', async ({
    page,
    api,
    problems,
  }) => {
    problems.allow({ status: 502, url: '/api/speech/transcribe' });
    await lengthenCustomerVoice(page, HOLD_THE_CUSTOMER);
    const { call, screen } = await startSpokenCall(page, api);
    await expect(screen.status).toHaveText(STATUS.speaking);
    await screen.stopAudio.click();
    await api.failNext('transcribe', 1);
    await expect(screen.problem.title).toHaveText('Your speech could not be turned into text.', {
      timeout: 30_000,
    });

    await screen.problem.useText.click();
    await expect(screen.reply).toBeFocused();
    await expect(screen.problem.card).toHaveCount(0);
    await sendTyped(screen, 'Sorry, the line was bad. Can you tell me what is happening?');
    await expect(screen.turns).toHaveCount(3);
    await expect(screen.turns.nth(1)).toContainText('Sorry, the line was bad.');
    const saved = await api.session(call.id);
    expect(saved.turns.filter((turn) => turn.role === 'trainee')).toHaveLength(1);
    expect(saved.turns.filter((turn) => turn.role === 'trainee')[0]!.inputMode).toBe('text');
  });

  test('a failed customer reply keeps the recognised words in the transcript, and Retry sends them once', async ({
    page,
    api,
    problems,
  }) => {
    problems.allow({ status: 502, url: '/messages' });
    await lengthenCustomerVoice(page, HOLD_THE_CUSTOMER);
    const { call, screen } = await startSpokenCall(page, api);
    await expect(screen.status).toHaveText(STATUS.speaking);
    await api.failNext('customer', 1);
    await screen.stopAudio.click();

    await test.step('the words are in the transcript, marked as not sent, with what was kept', async () => {
      await expect(screen.problem.title).toHaveText('The customer could not reply.', {
        timeout: 30_000,
      });
      await expect(screen.problem.card).toContainText('Your message was saved.');
      await expect(screen.turns).toHaveCount(2);
      await expect(screen.turns.last()).toContainText('Not sent');
      const text = (await screen.turns.last().locator('.cw-turn__text').innerText()).trim();
      expect(isMockUtterance(text)).toBe(true);
      await expectNoRawFailureText(page);
    });

    await test.step('Retry sends the same message once, and the customer replies', async () => {
      await screen.problem.retry.click();
      await expect(screen.turns).toHaveCount(3, { timeout: 30_000 });
      await expect(screen.turns.last()).not.toContainText('Not sent');
      const saved = await api.session(call.id);
      expect(saved.turns.filter((turn) => turn.role === 'trainee')).toHaveLength(1);
      expect(saved.awaitingReply).toBeNull();
    });
  });

  test('a failed customer voice never blocks the call: the line is in the transcript, Retry plays it, and typing works', async ({
    page,
    api,
    problems,
  }) => {
    problems.allow({ status: 502, url: /\/api\/sessions\/[^/]+\/turns\/\d+\/speech/ });
    await api.failNext('synthesize', 1);
    const { call, screen } = await startSpokenCall(page, api);

    await test.step('the greeting is shown anyway, with what happened and what to do', async () => {
      await expect(screen.turns.first()).toContainText((await api.session(call.id)).turns[0]!.text);
      await expect(screen.problem.title).toHaveText("The customer's voice could not be made.");
      await expect(screen.problem.card).toContainText(
        "The customer's words are in the transcript.",
      );
      await expect(screen.problem.retry).toBeVisible();
      await expect(screen.problem.continueWithoutAudio).toBeVisible();
      await expectNoRawFailureText(page);
    });

    await test.step('Retry plays it, and the card goes', async () => {
      await screen.problem.retry.click();
      await expect(screen.status).toHaveText(
        new RegExp(`^(${STATUS.speaking}|${STATUS.micReady}|${STATUS.listening})$`),
      );
      await expect(screen.problem.card).toHaveCount(0);
      const probe = await readProbe(page);
      expect(probe.playCalls.some((play) => play.src.startsWith('blob:'))).toBe(true);
    });

    await test.step("the call goes on: it is the trainee's turn, and a typed reply is answered", async () => {
      await screen.text.click();
      await sendTyped(screen, 'Hello, my name is Sam. Can you tell me what is happening?');
      await expect(screen.turns).toHaveCount(3);
    });
  });

  test('"Continue without audio" turns the customer\'s voice off for the call, and the transcript carries it', async ({
    page,
    api,
    problems,
  }) => {
    problems.allow({ status: 502, url: /\/api\/sessions\/[^/]+\/turns\/\d+\/speech/ });
    await api.failNext('synthesize', 1);
    const { screen } = await startSpokenCall(page, api);
    await expect(screen.problem.continueWithoutAudio).toBeVisible();
    await screen.problem.continueWithoutAudio.click();
    await expect(screen.problem.card).toHaveCount(0);
    // Without the customer's voice there is nothing to replay, and the call stays usable.
    await expect(screen.replay).toHaveCount(0);
    await expect(screen.status).toHaveText(
      new RegExp(`^(${STATUS.micReady}|${STATUS.listening}|${STATUS.hearing})$`),
    );
    await screen.settings.click();
    await expect(
      screen.settingsDialog.getByRole('switch', { name: /Customer audio/ }),
    ).not.toBeChecked();
  });
});
