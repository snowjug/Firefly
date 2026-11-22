import type { Page } from '@playwright/test';
import { expect, test } from './support/fixtures.ts';
import type { FireflyApi } from './support/api.ts';
import {
  HINT,
  STATUS,
  startSpokenCall,
  turnHandsFreeOff,
  type CallScreen,
} from './support/call-screen.ts';
import { installBrowserSpeech, type BrowserSpeech } from './support/fake-browser-speech.ts';
import { containsInOrder, readProbe, resetProbe, statusLabels } from './support/page-probes.ts';
import { expectNoRawFailureText } from './support/raw-text.ts';

// The spoken call on the browser's own speech: no speech service on the server, so the browser's
// recogniser hears the trainee and the browser's voice speaks for the customer. This is the set-up of
// a Firefly run with FIREFLY_SPEECH_PROVIDER=none, which voice-call.spec.ts (fake microphone, the
// server's mock speech provider) never takes.
//
// What these prove, in a real browser engine with the real page, the real call screen and the real
// server: the microphone opens by itself when the customer has finished; quiet, however long, does not
// stop the listening and is said once; a pause inside a sentence does not split the turn and a longer
// one ends it once; a session the browser ends by itself, or ends with "no speech", is invisible and
// loses nothing; Done speaking asks the browser to stop and keeps the words that come back; a service
// that keeps failing says so with Retry and Use text; Mute and Pause let go of the recogniser, and
// Unmute and Resume open it again; ten minutes of quiet pause the call; and push to talk is as it was.
//
// What they do NOT prove: that a real recogniser behaves like the scripted one. The recogniser here
// (support/fake-browser-speech.ts) says what the journey tells it to, when the journey tells it: how
// long a real Chrome or Edge session lives, what its results look like, how fast `stop()` hands back
// the last words and whether `speechstart` and `speechend` arrive in continuous mode are all unchecked,
// and no speech is understood anywhere in this file. The page clock is stopped and moved by hand, so
// the timings are the call's own, not a real room's.

test.describe.configure({ timeout: 90_000 });

/** What a muted hands-free call says in the guidance line (it has no Talk to press to be told). */
const MUTED = 'You are muted.';
/** The words the screen reader is told when the microphone is muted, and when it is back on. */
const MUTED_SAID = 'Your microphone is muted.';
const UNMUTED_SAID = 'Microphone on.';

// The call takes a turn to be over after 1.4 s of quiet (CAPTURE_TUNING.endpointSilenceMs). The pauses
// below keep well clear of it on both sides, because the point is the relation, not the number.
const SHORT_PAUSE_MS = 900;
const LONG_PAUSE_MS = 2_000;

/** A spoken call on the browser's speech, listening, with the page's clock stopped. */
async function startBrowserCall(page: Page, api: FireflyApi) {
  const speech = await installBrowserSpeech(page);
  const { call, screen } = await startSpokenCall(page, api);
  await expect(screen.status).toHaveText(STATUS.listening, { timeout: 20_000 });
  await speech.watchAnnouncements();
  await speech.freeze();
  return { call, screen, speech };
}

/** The customer's reply has been written; let their voice end and the microphone open again. */
async function customerFinishes(screen: CallScreen, speech: BrowserSpeech): Promise<void> {
  await speech.until(() => expect(screen.status).toHaveText(STATUS.listening, { timeout: 250 }));
}

/** What the trainee said, as the server holds it: one entry for each turn, with how it arrived. */
async function traineeTurns(api: FireflyApi, id: string) {
  const session = await api.session(id);
  return session.turns
    .filter((turn) => turn.role === 'trainee')
    .map((turn) => ({ text: turn.text, inputMode: turn.inputMode }));
}

const wordsOf = (text: string): string =>
  (text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []).join(' ');

test.describe('a hands-free call on the browser’s own speech', () => {
  test('the microphone opens by itself when the customer has finished, with nothing to press, and no audio goes to the server', async ({
    page,
    api,
  }) => {
    const speech = await installBrowserSpeech(page);
    const { call, screen } = await startSpokenCall(page, api);

    await test.step('the browser’s voice speaks the greeting, and the microphone opens with nothing pressed', async () => {
      await expect(screen.status).toHaveText(STATUS.listening, { timeout: 20_000 });
      await expect(screen.presence).toHaveAttribute('data-presence', 'listening');
      // There is no Talk to press, and nothing else in the first row either: it is the call's turn to wait.
      await expect(screen.talk).toHaveCount(0);
      await expect(screen.slot.getByRole('button')).toHaveCount(0);
      const probe = await readProbe(page);
      expect(containsInOrder(statusLabels(probe), [STATUS.speaking, STATUS.listening])).toBe(true);
      const { spoken } = await speech.voice();
      const greeting = (await api.session(call.id)).turns[0]?.text ?? '';
      expect(spoken.length, 'the browser was asked to speak').toBeGreaterThan(0);
      expect(wordsOf(spoken.join(' '))).toContain(
        wordsOf(greeting).split(' ').slice(0, 4).join(' '),
      );
    });

    await test.step('the call is listening through the browser’s recogniser, set up for a conversation', async () => {
      const recogniser = await speech.recogniser();
      expect(recogniser).toMatchObject({ created: 1, running: 1, starts: 1, aborts: 0 });
      expect(recogniser.latest).toMatchObject({ continuous: true, interimResults: true });
      expect(recogniser.latest?.lang).toMatch(/^en-/);
    });

    await test.step('and nothing was sent to the server’s speech service, which this page was told is not there', async () => {
      expect(speech.serverSpeechRequests).toBe(0);
    });
  });

  test('minutes of silence do not stop the listening: it is said once, softly, and sessions the browser ends for want of speech are started again unseen', async ({
    page,
    api,
  }) => {
    const { screen, speech } = await startBrowserCall(page, api);
    await resetProbe(page);

    await test.step('five quiet minutes in one session: the microphone stays open and the call says so, once', async () => {
      await speech.quiet(5 * 60_000);
      await expect(screen.hint).toHaveText(HINT.stillListening);
      await expect(screen.status).toHaveText(STATUS.listening);
      await expect(screen.presence).toHaveAttribute('data-presence', 'listening');
      await expect(screen.problem.card).toHaveCount(0);
      expect(await speech.recogniser()).toMatchObject({ created: 1, running: 1 });
      await speech.untilAnnounced(HINT.stillListening);
      // Twenty quiet stretches have passed, and the sentence was said once.
      const said = await speech.announced();
      expect(said.filter((sentence) => sentence === HINT.stillListening)).toHaveLength(1);
    });

    await speech.advance(3_000);
    const before = await speech.announced();

    await test.step('then the browser ends its session for want of speech, again and again, and nothing shows', async () => {
      for (let session = 0; session < 12; session += 1) {
        await speech.advance(8_000);
        await speech.fail('no-speech');
        await speech.advance(300);
      }
      await expect(screen.status).toHaveText(STATUS.listening);
      await expect(screen.hint).toHaveText(HINT.stillListening);
      await expect(screen.problem.card).toHaveCount(0);
      expect(await speech.recogniser()).toMatchObject({ created: 13, running: 1 });
      // Not one change of the status line, and not one more sentence for a screen reader.
      expect([...new Set(statusLabels(await readProbe(page)))]).toEqual([STATUS.listening]);
      expect(await speech.announced()).toEqual(before);
    });

    await test.step('the next words are heard as if nothing had happened, and the guidance goes', async () => {
      await speech.hear('Hello, are you still there?', { final: true });
      await expect(screen.hint).toHaveCount(0);
      await speech.advance(LONG_PAUSE_MS);
      await expect(screen.turns).toHaveCount(3);
      await expect(screen.turns.nth(1)).toContainText('Hello, are you still there?');
    });
  });

  test('a pause inside a sentence does not split the turn, a longer one ends it once, and the microphone opens again for the next', async ({
    page,
    api,
  }) => {
    const { call, screen, speech } = await startBrowserCall(page, api);

    await test.step('words, a short pause, more words, another short pause: still one turn in progress', async () => {
      await speech.hear('I would like to cancel', { final: true });
      await expect(screen.status).toHaveText(STATUS.hearing);
      await speech.pause(SHORT_PAUSE_MS);
      await speech.hear('my subscription please', { final: true });
      await speech.pause(SHORT_PAUSE_MS);
      // The whole sentence took longer than the quiet that ends a turn, but no pause in it did.
      await expect(screen.turns).toHaveCount(1);
      await expect(screen.status).toHaveText(STATUS.hearing);
    });

    await test.step('a longer pause ends the turn, once, with the whole sentence', async () => {
      await speech.advance(LONG_PAUSE_MS);
      await expect(screen.turns).toHaveCount(3);
      await expect(screen.turns.nth(1)).toContainText(
        'I would like to cancel my subscription please',
      );
      expect(await traineeTurns(api, call.id)).toEqual([
        { text: 'I would like to cancel my subscription please', inputMode: 'voice' },
      ]);
    });

    await test.step('the customer’s voice ends, the microphone opens again by itself, and a second turn is taken', async () => {
      await customerFinishes(screen, speech);
      expect(await speech.recogniser()).toMatchObject({ created: 2, running: 1 });
      await speech.hear('Thanks, that is all I needed.', { final: true });
      await speech.pause(LONG_PAUSE_MS);
      await expect(screen.turns).toHaveCount(5);
      expect((await traineeTurns(api, call.id)).map((turn) => turn.text)).toEqual([
        'I would like to cancel my subscription please',
        'Thanks, that is all I needed.',
      ]);
    });
  });

  test('a session the browser ends in the middle of a sentence is started again, and the words from both are one turn', async ({
    page,
    api,
  }) => {
    const { call, screen, speech } = await startBrowserCall(page, api);

    await speech.hear('I would like to', { final: false });
    await expect(screen.status).toHaveText(STATUS.hearing);
    await speech.endSession();
    await speech.advance(300);
    await test.step('nothing shows: no card, no change of status, and a new session is already listening', async () => {
      await expect(screen.problem.card).toHaveCount(0);
      await expect(screen.status).toHaveText(STATUS.hearing);
      expect(await speech.recogniser()).toMatchObject({ created: 2, running: 1 });
    });

    await speech.hear('cancel my subscription', { final: true });
    await speech.advance(LONG_PAUSE_MS);
    await expect(screen.turns).toHaveCount(3);
    await expect(screen.turns.nth(1)).toContainText('I would like to cancel my subscription');
    expect((await traineeTurns(api, call.id)).map((turn) => turn.text)).toEqual([
      'I would like to cancel my subscription',
    ]);
  });
});

test.describe('Done speaking, on the browser’s own speech', () => {
  test('asks the browser to stop, and sends the words it hands back, the end of the sentence included', async ({
    page,
    api,
  }) => {
    const { call, screen, speech } = await startBrowserCall(page, api);

    await speech.hear("I'd like to cancel my", { final: false });
    await expect(screen.done).toBeVisible();
    await screen.done.click();

    await test.step('the session is stopped, not abandoned, and nothing is sent yet', async () => {
      await expect.poll(async () => (await speech.recogniser()).stops).toBe(1);
      expect(await speech.recogniser()).toMatchObject({ aborts: 0, running: 1 });
      await expect(screen.turns).toHaveCount(1);
    });

    await test.step('the browser hands back the rest as it stops, and the whole sentence is sent', async () => {
      await speech.hear("I'd like to cancel my subscription", { final: true });
      await speech.endSession();
      await expect(screen.turns).toHaveCount(3);
      await expect(screen.turns.nth(1)).toContainText("I'd like to cancel my subscription");
      expect(await traineeTurns(api, call.id)).toEqual([
        { text: "I'd like to cancel my subscription", inputMode: 'voice' },
      ]);
    });
  });

  test('does not wait for a browser that never answers: what was heard is sent after a short wait', async ({
    page,
    api,
  }) => {
    const { call, screen, speech } = await startBrowserCall(page, api);

    await speech.hear("I'd like to cancel my", { final: false });
    await screen.done.click();
    await expect.poll(async () => (await speech.recogniser()).stops).toBe(1);

    await speech.advance(1_500);
    await expect(screen.turns).toHaveCount(1);
    await speech.advance(1_000);
    await expect(screen.turns).toHaveCount(3);
    await expect(screen.turns.nth(1)).toContainText("I'd like to cancel my");
    expect(await traineeTurns(api, call.id)).toEqual([
      { text: "I'd like to cancel my", inputMode: 'voice' },
    ]);
    // Nothing starts again behind it while the customer answers.
    expect((await speech.recogniser()).created).toBe(1);
  });
});

test.describe('when the browser’s speech service fails', () => {
  test('a service that keeps failing shows the usual card with Retry and Use text, and Retry listens again', async ({
    page,
    api,
  }) => {
    const { call, screen, speech } = await startBrowserCall(page, api);

    await test.step('one failure is a hiccup: the session starts again and nothing shows', async () => {
      await speech.fail('network');
      await speech.advance(300);
      await expect(screen.problem.card).toHaveCount(0);
      await expect(screen.status).toHaveText(STATUS.listening);
      expect(await speech.recogniser()).toMatchObject({ created: 2, running: 1 });
    });

    await test.step('failures in a row end the listening with a card that says what happened, with Retry and Use text', async () => {
      for (let failure = 0; failure < 3; failure += 1) {
        await speech.fail('network');
        await speech.advance(300);
      }
      await expect(screen.problem.card).toBeVisible();
      await expect(screen.problem.retry).toBeVisible();
      await expect(screen.problem.useText).toBeVisible();
      await expectNoRawFailureText(page);
      expect(await speech.recogniser()).toMatchObject({ created: 4, running: 0 });
      // The call does not try again by itself, however long it waits.
      await speech.advance(60_000);
      expect((await speech.recogniser()).created).toBe(4);
      await expect(screen.turns).toHaveCount(1);
    });

    await test.step('Retry listens again, and what is said afterwards is heard', async () => {
      await screen.problem.retry.click();
      await speech.until(() =>
        expect(screen.status).toHaveText(STATUS.listening, { timeout: 250 }),
      );
      await expect(screen.problem.card).toHaveCount(0);
      expect(await speech.recogniser()).toMatchObject({ created: 5, running: 1 });
      await speech.hear('Can you hear me now?', { final: true });
      await speech.advance(LONG_PAUSE_MS);
      await expect(screen.turns).toHaveCount(3);
      expect((await traineeTurns(api, call.id)).map((turn) => turn.text)).toEqual([
        'Can you hear me now?',
      ]);
    });
  });
});

test.describe('Mute, Pause and quiet, on the browser’s own speech', () => {
  test('Mute lets go of the recogniser and says so, and Unmute opens it again; Pause lets go of the microphone too, and Resume takes it again', async ({
    page,
    api,
  }) => {
    const { screen, speech } = await startBrowserCall(page, api);

    await test.step('Mute: the recogniser is aborted, the status and the guidance say so, and nothing starts again', async () => {
      await screen.mute.click();
      await expect(screen.mute).toHaveAttribute('aria-pressed', 'true');
      await expect(screen.status).toHaveText(STATUS.muted);
      // A hands-free call has no Talk to press, so the guidance line is where it says so.
      await expect(screen.hint).toHaveText(MUTED);
      expect(await speech.recogniser()).toMatchObject({ created: 1, running: 0, aborts: 1 });
      // The mute is said once, in its own sentence, and the guidance is not said as well.
      await speech.untilAnnounced(MUTED_SAID);
      await speech.advance(3_000);
      expect(await speech.announced()).not.toContain(MUTED);
      await speech.advance(10_000);
      expect(await speech.recogniser()).toMatchObject({ created: 1, running: 0 });
      await expect(screen.status).toHaveText(STATUS.muted);
    });

    await test.step('Unmute: the guidance goes and the call listens again', async () => {
      await screen.mute.click();
      await speech.until(() =>
        expect(screen.status).toHaveText(STATUS.listening, { timeout: 250 }),
      );
      await expect(screen.hint).toHaveCount(0);
      expect(await speech.recogniser()).toMatchObject({ created: 2, running: 1 });
      await speech.untilAnnounced(UNMUTED_SAID);
    });

    await test.step('Pause: the recogniser and the microphone are let go of', async () => {
      await screen.pause.click();
      await expect(screen.status).toHaveText(STATUS.paused);
      await expect(screen.resume).toBeVisible();
      expect(await speech.recogniser()).toMatchObject({ created: 2, running: 0 });
      const probe = await readProbe(page);
      expect(probe.micTracks.length).toBeGreaterThan(0);
      expect(probe.micTracks.every((track) => track === 'ended')).toBe(true);
    });

    await test.step('Resume: the microphone is asked for again and the call listens', async () => {
      await screen.resume.click();
      await speech.until(() =>
        expect(screen.status).toHaveText(STATUS.listening, { timeout: 250 }),
      );
      const probe = await readProbe(page);
      expect(probe.mediaRequests).toBe(2);
      expect(probe.micTracks.filter((track) => track === 'live')).toHaveLength(1);
      expect(await speech.recogniser()).toMatchObject({ created: 3, running: 1 });
    });
  });

  test('ten minutes of quiet pause the call and say why, and Resume carries on', async ({
    page,
    api,
  }) => {
    const { call, screen, speech } = await startBrowserCall(page, api);

    await test.step('thirty-nine stretches of quiet: still listening, one session, one soft line', async () => {
      await speech.quiet(39 * 15_500);
      await expect(screen.status).toHaveText(STATUS.listening);
      await expect(screen.hint).toHaveText(HINT.stillListening);
      expect(await speech.recogniser()).toMatchObject({ created: 1, running: 1 });
    });

    await test.step('the fortieth pauses the call, says why, and lets go of the recogniser and the microphone', async () => {
      await speech.quiet(15_500);
      await expect(screen.status).toHaveText(STATUS.paused);
      await expect(screen.hint).toHaveText(HINT.idlePaused);
      await expect(screen.resume).toBeVisible();
      expect(await speech.recogniser()).toMatchObject({ running: 0 });
      const probe = await readProbe(page);
      expect(probe.micTracks.every((track) => track === 'ended')).toBe(true);
      await speech.untilAnnounced(HINT.idlePaused);
    });

    await test.step('Resume opens the microphone and the recogniser again, and a turn is heard', async () => {
      await screen.resume.click();
      await speech.until(() =>
        expect(screen.status).toHaveText(STATUS.listening, { timeout: 250 }),
      );
      await expect(screen.hint).toHaveCount(0);
      expect(await speech.recogniser()).toMatchObject({ created: 2, running: 1 });
      await speech.hear('Sorry, I stepped away for a moment.', { final: true });
      await speech.advance(LONG_PAUSE_MS);
      await expect(screen.turns).toHaveCount(3);
      expect((await traineeTurns(api, call.id)).map((turn) => turn.text)).toEqual([
        'Sorry, I stepped away for a moment.',
      ]);
    });
  });
});

test.describe('push to talk, on the browser’s own speech', () => {
  test('is as it was: Talk opens the recogniser, Done speaking sends, nothing opens it by itself, and a quiet pass ends with its old hint', async ({
    page,
    api,
  }) => {
    // A long voice, so that there is a customer to stop and a screen to switch while it speaks.
    const speech = await installBrowserSpeech(page, { voiceMs: 20_000 });
    const { call, screen } = await startSpokenCall(page, api);
    await expect(screen.status).toHaveText(STATUS.speaking, { timeout: 20_000 });

    await test.step('with hands-free off, the screen is the push-to-talk one, and stopping the customer opens nothing', async () => {
      await turnHandsFreeOff(screen);
      await expect(screen.talk).toBeVisible();
      await screen.stopAudio.click();
      await expect(screen.status).toHaveText(STATUS.micReady);
      await speech.setVoiceMs(80);
      await speech.freeze();
      await speech.advance(10_000);
      await expect(screen.talk).toBeEnabled();
      expect((await speech.recogniser()).created, 'nothing opened the microphone').toBe(0);
    });

    await test.step('Talk opens the recogniser, and Done speaking sends what was heard, with the late words', async () => {
      await screen.talk.click();
      await expect(screen.status).toHaveText(STATUS.listening);
      expect(await speech.recogniser()).toMatchObject({ created: 1, running: 1 });
      await speech.hear('Push to talk still', { final: false });
      await expect(screen.done).toBeVisible();
      await screen.done.click();
      await expect.poll(async () => (await speech.recogniser()).stops).toBe(1);
      await speech.hear('Push to talk still works', { final: true });
      await speech.endSession();
      await expect(screen.turns).toHaveCount(3);
      expect(await traineeTurns(api, call.id)).toEqual([
        { text: 'Push to talk still works', inputMode: 'voice' },
      ]);
    });

    await test.step('after the customer’s reply the microphone stays shut until Talk is pressed again', async () => {
      await speech.until(() => expect(screen.talk).toBeEnabled({ timeout: 250 }));
      await speech.advance(10_000);
      expect(await speech.recogniser()).toMatchObject({ created: 1, running: 0 });
      await expect(screen.status).toHaveText(STATUS.micReady);
    });

    await test.step('a pass nobody speaks into ends after fifteen seconds, with the old hint', async () => {
      await screen.talk.click();
      await expect(screen.status).toHaveText(STATUS.listening);
      await speech.advance(16_000);
      await expect(screen.hint).toHaveText(/^Nothing was heard\./);
      expect(await speech.recogniser()).toMatchObject({ created: 2, running: 0 });
      await expect(screen.talk).toBeVisible();
    });
  });
});
