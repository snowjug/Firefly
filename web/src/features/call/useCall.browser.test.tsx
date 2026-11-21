import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../lib/api.ts';
import { pickVoice } from '../voice/playback/voices.ts';
import { fakeVoice, type FakeRecognition } from '../voice/testing/fakes.ts';
import type { UseCallOptions } from './contract.ts';
import { advance, flush, Harness, NO_SERVER_SPEECH } from './testing.ts';

vi.mock('../../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    api: {
      getSession: vi.fn(),
      sendMessage: vi.fn(),
      endSession: vi.fn(),
      transcribe: vi.fn(),
      speakTurn: vi.fn(),
    },
  };
});

// A call where the server has no speech service, so the browser does both the listening (its own
// speech recognition) and the speaking (its own voices). The fakes prove the call's logic; they
// say nothing about how Chrome or Edge really behave.

const mocked = vi.mocked(api);
const h = new Harness(mocked);

const EDGE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0';
const SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-02T10:00:30.000Z'));
  vi.clearAllMocks();
  // A new call: the customer has said their opening line and the trainee has said nothing yet.
  h.setup();
});

afterEach(() => {
  h.teardown();
  vi.useRealTimers();
});

const phase = () => h.snap().phase;

async function mountBrowser(options: { userAgent?: string; call?: Partial<UseCallOptions> } = {}) {
  await h.mount({
    fakes: { recognition: true, synthesis: true, userAgent: options.userAgent ?? EDGE },
    call: { serverSpeech: NO_SERVER_SPEECH, ...options.call },
  });
}

/** The customer's voice finishes, and the trainee's microphone opens after its short settle. */
async function customerFinishes() {
  await act(async () => {
    h.env.speech.finishLatest();
  });
  await advance(400);
}

/** A started call: the opening line has been spoken and the browser is listening. */
async function openCall() {
  await h.begin(true);
  await customerFinishes();
}

/** The browser hears a sentence: interim words first, then the final text. */
async function hears(text: string) {
  const recognition = h.env.recognition.latest();
  await act(async () => {
    recognition.open();
    recognition.speechStart();
    recognition.say(text.split(' ').slice(0, 2).join(' '), false);
    recognition.say(text, true);
  });
  await flush();
}

/** The browser's recogniser and the customer's voice are never active together. */
function expectNoOverlap() {
  const recognising = h.env.recognition.instances.filter((instance) => instance.running);
  expect(recognising.length).toBeLessThanOrEqual(1);
  if (h.env.speech.speaking) expect(recognising).toHaveLength(0);
}

const sentTexts = () =>
  mocked.sendMessage.mock.calls.map((call) => (call[1] as { text: string }).text);

describe('the customer’s voice, spoken by the browser', () => {
  it('is a browser voice chosen for the language, and the call says what spoke', async () => {
    await mountBrowser();
    // Before anything is spoken the label only says whose voice it will be.
    expect(h.snap().support.playbackLabel).toBe('Browser voice');
    expect(h.snap().voiceDetails.voice).toBeNull();
    await h.begin(true);

    const utterance = h.env.speech.latest();
    expect(utterance.text).toMatch(/thanks for calling/);
    expect(utterance.voice).toMatchObject({ name: 'Online Natural English (United Kingdom)' });
    expect(utterance.rate).toBe(0.96);
    // Speech is unlocked inside the click, and nothing is asked of the server's speech service.
    expect(h.env.speech.primes).toBe(1);
    expect(mocked.speakTurn).not.toHaveBeenCalled();
    expect(h.env.elements).toHaveLength(0);
    expect(h.snap().voiceDetails).toEqual({
      voice: 'Online Natural English (United Kingdom)',
      style: 'none',
      language: 'en-GB',
    });
    expect(h.snap().support).toMatchObject({
      capture: 'browser-recognition',
      playback: 'browser-synthesis',
      playbackLabel: 'Browser voice (online): Online Natural English (United Kingdom)',
    });
  });

  describe('on a browser with no voice for the language chosen (a Windows laptop has five, none British)', () => {
    const WINDOWS_VOICES = [
      fakeVoice('Microsoft David - English (United States)', 'en-US', true),
      fakeVoice('Microsoft Ravi - English (India)', 'en-IN', true),
      fakeVoice('Microsoft Heera - English (India)', 'en-IN', true),
      fakeVoice('Microsoft Mark - English (United States)', 'en-US', true),
      fakeVoice('Microsoft Zira - English (United States)', 'en-US', true),
    ];

    it('waits for the list, speaks with another English voice, and the label says it is the browser’s and which one', async () => {
      await h.mount({
        fakes: { recognition: true, synthesis: [], userAgent: EDGE },
        call: { serverSpeech: NO_SERVER_SPEECH },
      });
      await h.begin(true);
      // The list is empty until the browser reports its voices, so nothing is spoken yet.
      await advance(43);
      expect(h.env.speech.spoken).toHaveLength(0);
      expect(phase()).toBe('ready');

      h.env.speech.voices = WINDOWS_VOICES;
      await act(async () => h.env.speech.emit('voiceschanged'));
      await flush();
      expect(h.env.speech.spoken).toHaveLength(1);
      const voice = h.env.speech.latest().voice as SpeechSynthesisVoice;
      expect(WINDOWS_VOICES).toContain(voice);
      // The persona's voice is the one the adapter's own choice gives for them.
      expect(voice).toBe(
        pickVoice(WINDOWS_VOICES, h.snap().session?.scenario.persona.name ?? '', 'en-GB'),
      );
      expect(h.snap().voiceDetails).toEqual({
        voice: voice.name,
        style: 'none',
        language: 'en-GB',
      });
      const short = voice.name.split(' - ')[0];
      expect(h.snap().support.playbackLabel).toBe(
        `Browser voice (on this device): ${short}, ${voice.lang}`,
      );
      // The chosen language is still British English: the label says what really spoke.
      expect(h.snap().support.playbackLabel).not.toMatch(/en-GB/);
      expect(h.snap().problem).toBeNull();

      await customerFinishes();
      expect(phase()).toBe('listening');
    });

    it('speaks anyway with the browser’s own default voice when none of its voices is English', async () => {
      await h.mount({
        fakes: {
          recognition: true,
          synthesis: [fakeVoice('Microsoft Hortense - French (France)', 'fr-FR', true, true)],
          userAgent: EDGE,
        },
        call: { serverSpeech: NO_SERVER_SPEECH },
      });
      await h.begin(true);
      const utterance = h.env.speech.latest();
      expect(utterance.voice).toBeNull();
      expect(utterance.lang).toBe('en-GB');
      expect(h.snap().voiceDetails.voice).toBeNull();
      expect(h.snap().support.playbackLabel).toBe('Browser voice (default voice)');
      await customerFinishes();
      expect(phase()).toBe('listening');
    });

    it('speaks anyway, after a short wait, when the browser never reports any voices', async () => {
      await h.mount({
        fakes: { recognition: true, synthesis: [], userAgent: EDGE },
        call: { serverSpeech: NO_SERVER_SPEECH },
      });
      await h.begin(true);
      await advance(1000);
      expect(h.env.speech.spoken).toHaveLength(0);
      await advance(1000);
      expect(h.env.speech.spoken).toHaveLength(1);
      expect(h.env.speech.latest().voice).toBeNull();
      expect(h.snap().support.playbackLabel).toBe('Browser voice (default voice)');
      expect(h.snap().problem).toBeNull();
      await customerFinishes();
      expect(phase()).toBe('listening');
    });
  });

  it('follows the customer’s mood with its rate and pitch, as the browser has no mood to apply', async () => {
    await mountBrowser();
    await openCall();
    const first = h.env.speech.latest();
    h.server.mood = 'angry';
    await hears('Hello Priya, how can I help?');
    const second = h.env.speech.latest();
    expect(second).not.toBe(first);
    expect(second.rate).toBeGreaterThan(first.rate);
    expect(second.pitch).toBeGreaterThan(first.pitch);
    expect(h.snap().voiceDetails.style).toBe('none');
    expect(h.snap().stateHistory.map((point) => point.band)).toEqual(['calm', 'angry']);
  });

  it('shapes the customer’s level from the words while it speaks, and is silent after', async () => {
    await mountBrowser();
    await h.begin(true);
    expect(h.snap().customerLevel).toBe(0);
    act(() => void h.env.speech.startLatest());
    await advance(1500);
    expect(h.snap().customerLevel).toBeGreaterThan(0);
    await customerFinishes();
    expect(h.snap().customerLevel).toBe(0);
  });

  it('keeps the microphone closed while it speaks, so the customer cannot hear themselves', async () => {
    await mountBrowser();
    await h.begin(true);
    expect(h.env.recognition.instances).toHaveLength(0);
    expectNoOverlap();
    act(() => void h.env.speech.startLatest());
    await advance(5000);
    expect(phase()).toBe('customer-speaking');
    expect(h.env.recognition.instances).toHaveLength(0);

    await customerFinishes();
    await hears('Hello Priya, how can I help?');
    // The reply is speaking: nothing recognises.
    expect(phase()).toBe('customer-speaking');
    expect(h.env.recognition.instances.filter((instance) => instance.running)).toHaveLength(0);
    expectNoOverlap();
    await customerFinishes();
    expect(phase()).toBe('listening');
    expectNoOverlap();
  });

  it('stops at once when the trainee interrupts, marks the turn, and opens the microphone', async () => {
    await mountBrowser();
    await openCall();
    await hears('Hello Priya, how can I help?');
    act(() => void h.env.speech.startLatest());
    const cancels = h.env.speech.cancels;
    const before = h.snap().turns.map((turn) => turn.text);

    act(() => h.actions().interrupt());
    expect(h.env.speech.cancels).toBeGreaterThan(cancels);
    expect(h.env.speech.speaking).toBe(false);
    expect(phase()).toBe('ready-for-next-turn');
    // The transcript is untouched; only the turn that was cut short is marked.
    expect(h.snap().turns.map((turn) => turn.text)).toEqual(before);
    expect(h.snap().turns.map((turn) => turn.interrupted)).toEqual([false, false, true]);
    await advance(400);
    expect(phase()).toBe('listening');
    expectNoOverlap();
  });

  it('offers Play when the browser refuses to speak, and speaks when it is pressed', async () => {
    await mountBrowser();
    await h.begin(true);
    await act(async () => {
      h.env.speech.latest().onerror?.({ error: 'not-allowed' });
    });
    expect(h.snap().problem).toMatchObject({
      code: 'playback-blocked',
      retry: 'speak',
      severity: 'degraded',
      textFallback: true,
    });
    // The customer's words are already in the transcript.
    expect(h.snap().turns[0]?.text).toMatch(/thanks for calling/);
    await advance(2000);
    expect(h.env.recognition.instances).toHaveLength(0);

    act(() => h.actions().retry());
    // A browser that failed may still say it is speaking: that is cleared first, with a short settle.
    await advance(100);
    expect(h.env.speech.spoken).toHaveLength(2);
    await customerFinishes();
    expect(h.snap().problem).toBeNull();
    expect(phase()).toBe('listening');
  });

  it('carries on when the browser’s voice fails part-way, with the words still on the screen', async () => {
    await mountBrowser();
    await h.begin(true);
    await act(async () => {
      h.env.speech.latest().onerror?.({ error: 'synthesis-failed' });
    });
    expect(h.snap().problem).toMatchObject({ code: 'playback-failed', severity: 'degraded' });
    expect(h.snap().turns[0]?.text).toMatch(/thanks for calling/);
    // The failure does not stop the trainee's turn.
    await advance(400);
    expect(phase()).toBe('listening');
  });

  it('hands the turn to the trainee when a voice never reports that it finished', async () => {
    await mountBrowser();
    await h.begin(true);
    act(() => void h.env.speech.startLatest());
    await advance(60_000);
    expect(phase()).toBe('listening');
    expect(h.snap().problem).toBeNull();
    expect(h.env.speech.speaking).toBe(false);
    expect(h.env.speech.cancels).toBeGreaterThan(0);
  });

  it('speaks a replay on request, never over the trainee’s open microphone', async () => {
    await mountBrowser();
    await openCall();
    const listening = h.env.recognition.latest();
    expect(listening.running).toBe(true);

    act(() => h.actions().replay());
    await flush();
    expect(phase()).toBe('customer-speaking');
    expect(listening.running).toBe(false);
    expect(h.env.speech.spoken).toHaveLength(2);
    expect(h.env.speech.latest().text).toBe(h.env.speech.spoken[0]?.text);
    expectNoOverlap();
    await customerFinishes();
    expect(phase()).toBe('listening');
  });
});

describe('the trainee’s voice, recognised by the browser', () => {
  it('listens for one sentence in the chosen language, shows captions, and sends the final words as voice with no audio going to the server', async () => {
    await mountBrowser();
    await openCall();
    expect(phase()).toBe('listening');
    const recognition = h.env.recognition.latest();
    expect(recognition).toMatchObject({
      lang: 'en-GB',
      interimResults: true,
      continuous: false,
      running: true,
    });
    expect(h.snap().speechDetected).toBe(false);
    expect(h.snap().interim).toBe('');

    await act(async () => {
      recognition.open();
      recognition.speechStart();
    });
    expect(h.snap().speechDetected).toBe(true);
    await act(async () => recognition.say('Hello Pri', false));
    expect(h.snap().interim).toBe('Hello Pri');
    expect(h.snap().phase).toBe('listening');

    await act(async () => recognition.say('Hello Priya, how can I help?', true));
    await flush();
    expect(mocked.transcribe).not.toHaveBeenCalled();
    expect(mocked.sendMessage).toHaveBeenCalledTimes(1);
    expect(mocked.sendMessage.mock.calls[0]?.[1]).toMatchObject({
      text: 'Hello Priya, how can I help?',
      inputMode: 'voice',
    });
    expect(h.snap().turns.map((turn) => [turn.role, turn.status, turn.inputMode])).toEqual([
      ['customer', 'sent', 'text'],
      ['trainee', 'sent', 'voice'],
      ['customer', 'sent', 'text'],
    ]);
    expect(h.snap().speechDetected).toBe(false);
    expect(h.snap().interim).toBe('');
    expect(phase()).toBe('customer-speaking');
    expect(recognition.running).toBe(false);

    await customerFinishes();
    expect(phase()).toBe('listening');
    expect(h.env.recognition.instances).toHaveLength(2);
  });

  it('moves the level meter while the trainee speaks, and holds it at zero otherwise', async () => {
    await mountBrowser();
    await openCall();
    expect(h.snap().micLevel).toBe(0);
    h.env.audio.analyserRms = 0.1;
    await advance(300);
    expect(h.snap().micLevel).toBeGreaterThan(0.4);

    await hears('Hello Priya, how can I help?');
    expect(h.snap().micLevel).toBe(0);
    await advance(300);
    expect(h.snap().micLevel).toBe(0);
  });

  it('shows what was heard so far while the browser finishes, and uses it if the final words never come', async () => {
    await mountBrowser();
    await openCall();
    const recognition = h.env.recognition.latest();
    await act(async () => {
      recognition.open();
      recognition.speechStart();
      recognition.say('I will check your account', false);
      recognition.speechEnd();
    });
    expect(phase()).toBe('transcribing');
    expect(h.snap().turns.at(-1)).toMatchObject({
      role: 'trainee',
      status: 'transcribing',
      text: 'I will check your account',
      inputMode: 'voice',
    });

    // The browser ends its session without a final result: what it heard is used.
    await act(async () => recognition.close());
    await flush();
    expect(sentTexts()).toEqual(['I will check your account']);
    expect(phase()).toBe('customer-speaking');
  });

  it('gives up, with a way to try again, when the browser never reports the words', async () => {
    await mountBrowser();
    await openCall();
    const recognition = h.env.recognition.latest();
    await act(async () => {
      recognition.open();
      recognition.speechStart();
      recognition.speechEnd();
    });
    expect(phase()).toBe('transcribing');
    await advance(10_000);
    expect(phase()).toBe('ready-for-next-turn');
    // The browser's own service never answered: it is the same as not being able to reach it.
    expect(h.snap().problem).toMatchObject({ code: 'offline', retry: 'transcribe' });
    expect(h.snap().turns).toHaveLength(1);
    expect(mocked.sendMessage).not.toHaveBeenCalled();
    expect(recognition.running).toBe(false);
  });

  // Recorded with a real Edge 158 and Chrome 157 fed clean synthetic speech: both heard it (speech
  // started and ended) and neither produced any words.
  describe('when the browser hears speech but makes no words of it', () => {
    const shapes: Array<[string, (recognition: FakeRecognition) => void]> = [
      [
        'Edge: one final result with an empty transcript, then the end',
        (recognition) => {
          recognition.say('', true, 1);
          recognition.close();
        },
      ],
      ['Chrome: the end, with no result and no error', (recognition) => recognition.close()],
    ];

    it.each(shapes)(
      '%s: nothing is sent, no empty message appears, hands-free tries again a few times, and typing is offered',
      async (_label, finish) => {
        await mountBrowser();
        await openCall();
        for (let pass = 1; pass <= 4; pass++) {
          expect(h.env.recognition.instances).toHaveLength(pass);
          const recognition = h.env.recognition.latest();
          await act(async () => {
            recognition.open();
            recognition.speechStart();
            recognition.speechEnd();
            finish(recognition);
          });
          expect(h.snap().hint).toMatch(/no words could be made out/i);
          expect(h.snap().hint).toMatch(/use text/);
          expect(h.snap().announcement?.text).toBe(h.snap().hint);
          expect(h.snap().turns).toHaveLength(1);
          expect(h.snap().problem).toBeNull();
          expect(h.snap().speechDetected).toBe(false);
          expect(recognition.running).toBe(false);
          await advance(400);
        }
        expect(mocked.sendMessage).not.toHaveBeenCalled();
        expect(mocked.transcribe).not.toHaveBeenCalled();

        // The retries are used up: the call waits for the trainee, and typing still works.
        expect(phase()).toBe('ready-for-next-turn');
        expect(h.env.recognition.instances).toHaveLength(4);
        await advance(60_000);
        expect(h.env.recognition.instances).toHaveLength(4);
        let accepted = false;
        await act(async () => {
          accepted = await h.actions().sendText('I will type instead.');
        });
        await flush();
        expect(accepted).toBe(true);
        expect(sentTexts()).toEqual(['I will type instead.']);
      },
    );

    it('says that nothing was heard, not that no words were made out, when no sound was picked up', async () => {
      await mountBrowser();
      await openCall();
      await act(async () => {
        h.env.recognition.latest().open();
        h.env.recognition.latest().close();
      });
      expect(h.snap().hint).toMatch(/^Nothing was heard\./);
      expect(h.snap().hint).toMatch(/Check your microphone/);
    });
  });

  it('never makes a second message from a repeated or late result', async () => {
    await mountBrowser();
    await openCall();
    const recognition = h.env.recognition.latest();
    await hears('Hello Priya, how can I help?');
    await act(async () => {
      recognition.say('Hello Priya, how can I help?', true);
      recognition.say('Hello Priya, how can I help? Extra', true);
      recognition.close();
    });
    await flush();
    expect(mocked.sendMessage).toHaveBeenCalledTimes(1);
    expect(recognition.onresult).toBeNull();
    expect(recognition.onend).toBeNull();
    expect(h.snap().turns).toHaveLength(3);
    expect(phase()).toBe('customer-speaking');
  });

  it.each([
    ['not-allowed', 'microphone-denied', 'denied', 'text'],
    ['service-not-allowed', 'microphone-denied', 'denied', 'text'],
    ['audio-capture', 'microphone-missing', 'unavailable', 'text'],
    ['network', 'offline', 'granted', 'voice'],
    ['language-not-supported', 'speech-service-unavailable', 'granted', 'voice'],
    ['bad-grammar', 'transcription-failed', 'granted', 'voice'],
  ] as const)(
    'shows the browser’s "%s" as %s, and keeps the call usable',
    async (error, code, microphone, mode) => {
      await mountBrowser();
      await openCall();
      await act(async () => h.env.recognition.latest().fail(error));
      await flush();
      expect(h.snap().problem).toMatchObject({ code, textFallback: true });
      expect(h.snap().microphone).toBe(microphone);
      expect(h.snap().mode).toBe(mode);
      expect(phase()).toBe('ready-for-next-turn');
      expect(h.snap().turns).toHaveLength(1);
      // A microphone that cannot be used is let go of; no problem leaves a recogniser running.
      if (mode === 'text') expect(h.env.mic.openTracks()).toHaveLength(0);
      expect(h.env.recognition.instances.filter((instance) => instance.running)).toHaveLength(0);
      // Typing carries on whatever happened to the voice.
      let accepted = false;
      await act(async () => {
        accepted = await h.actions().sendText('I can still type.');
      });
      await flush();
      expect(accepted).toBe(true);
      expect(sentTexts()).toEqual(['I can still type.']);
    },
  );

  it('listens again from Try again after the browser’s service fails, and the problem clears', async () => {
    await mountBrowser();
    await openCall();
    await act(async () => h.env.recognition.latest().fail('network'));
    await flush();
    // Hands-free does not retry a failing service by itself.
    await advance(5000);
    expect(phase()).toBe('ready-for-next-turn');
    expect(h.env.recognition.instances).toHaveLength(1);

    act(() => h.actions().retry());
    await flush();
    expect(phase()).toBe('listening');
    expect(h.env.recognition.instances).toHaveLength(2);
    await hears('Hello again, can you hear me?');
    expect(sentTexts()).toEqual(['Hello again, can you hear me?']);
    expect(h.snap().problem).toBeNull();
  });

  it('treats the browser hearing nothing as silence: a hint, a few quiet retries, then it waits', async () => {
    await mountBrowser();
    await openCall();
    for (let pass = 1; pass <= 4; pass++) {
      expect(h.env.recognition.instances).toHaveLength(pass);
      await act(async () => {
        h.env.recognition.latest().fail('no-speech');
        h.env.recognition.latest().close();
      });
      expect(h.snap().hint).toMatch(/Nothing was heard/);
      expect(h.snap().problem).toBeNull();
      await advance(400);
    }
    // After the retries are used up the microphone stays closed until the trainee asks for it.
    expect(phase()).toBe('ready-for-next-turn');
    expect(h.env.recognition.instances).toHaveLength(4);
    await advance(60_000);
    expect(h.env.recognition.instances).toHaveLength(4);

    act(() => h.actions().talk());
    await flush();
    expect(phase()).toBe('listening');
    expect(h.env.recognition.instances).toHaveLength(5);
  });

  it('uses on-device recognition when the browser offers it, and says so', async () => {
    await mountBrowser();
    h.env.recognition.setOnDevice('available');
    await h.begin(true);
    await customerFinishes();
    expect(h.env.recognition.latest().processLocally).toBe(true);
    expect(h.snap().support.captureLabel).toBe('Browser speech recognition (on this device)');
  });

  it('says the speech goes online in Chromium, and says nothing about where it goes elsewhere', async () => {
    await mountBrowser({ userAgent: EDGE });
    expect(h.snap().support.captureLabel).toBe('Browser speech recognition (online)');
    await mountBrowser({ userAgent: SAFARI });
    expect(h.snap().support.captureLabel).toBe('Browser speech recognition');
  });

  it('starts listening again in the new language when it is changed', async () => {
    await mountBrowser();
    await openCall();
    const before = h.env.recognition.latest();
    expect(before.lang).toBe('en-GB');
    act(() => h.actions().setLanguage('en-IE'));
    await flush();
    expect(before.running).toBe(false);
    const after = h.env.recognition.latest();
    expect(after).not.toBe(before);
    expect(after).toMatchObject({ lang: 'en-IE', running: true });
    expect(h.snap().voiceDetails.language).toBe('en-IE');
    expect(phase()).toBe('listening');
  });

  it('is push to talk when hands-free is off: Talk opens the recogniser and Stop finishes the sentence', async () => {
    await mountBrowser();
    h.do(() => h.actions().setHandsFree(false));
    await openCall();
    expect(phase()).toBe('ready-for-next-turn');
    await advance(10_000);
    expect(h.env.recognition.instances).toHaveLength(0);

    act(() => h.actions().talk());
    await flush();
    expect(phase()).toBe('listening');
    const recognition = h.env.recognition.latest();
    await act(async () => {
      recognition.open();
      recognition.speechStart();
      recognition.say('Push to talk works', false);
    });
    act(() => h.actions().stopTalking());
    expect(recognition.stops).toBe(1);
    expect(phase()).toBe('transcribing');
    await act(async () => recognition.say('Push to talk works', true));
    await flush();
    expect(sentTexts()).toEqual(['Push to talk works']);
  });

  it('stops the recogniser when muted, and listens again when unmuted', async () => {
    await mountBrowser();
    await openCall();
    const first = h.env.recognition.latest();
    h.env.audio.analyserRms = 0.1;
    await advance(300);
    expect(h.snap().micLevel).toBeGreaterThan(0);

    act(() => h.actions().toggleMute());
    await flush();
    expect(first.running).toBe(false);
    expect(h.snap().muted).toBe(true);
    expect(h.snap().micLevel).toBe(0);
    expect(h.env.mic.tracks[0]?.enabled).toBe(false);
    await advance(10_000);
    expect(h.env.recognition.instances).toHaveLength(1);

    act(() => h.actions().toggleMute());
    await advance(400);
    expect(phase()).toBe('listening');
    expect(h.env.recognition.latest()).not.toBe(first);
    expect(h.env.recognition.latest().running).toBe(true);
    expect(h.env.mic.tracks[0]?.enabled).toBe(true);
  });

  it('lets go of the microphone when paused, and takes it again without a new prompt when resumed', async () => {
    await mountBrowser();
    await openCall();
    const first = h.env.recognition.latest();
    act(() => h.actions().togglePause());
    await flush();
    expect(first.running).toBe(false);
    expect(h.env.mic.openTracks()).toHaveLength(0);
    expect(h.env.audio.openContexts()).toHaveLength(0);
    expect(h.snap().paused).toBe(true);

    act(() => h.actions().togglePause());
    await advance(400);
    expect(h.env.mic.openTracks()).toHaveLength(1);
    expect(h.env.mic.getUserMedia).toHaveBeenCalledTimes(2);
    expect(phase()).toBe('listening');
    expect(h.env.recognition.latest().running).toBe(true);
  });
});

describe('a long call with the browser’s speech', () => {
  it('leaves nothing behind: one microphone, one recogniser, and no growth in listeners or timers', async () => {
    await mountBrowser();
    await openCall();
    const baseline = {
      listeners: h.env.listenerCount(),
      edges: h.env.edgeCount(),
      timers: vi.getTimerCount(),
    };

    for (let i = 1; i <= 25; i++) {
      await hears(`Message number ${i} for the customer`);
      expectNoOverlap();
      await customerFinishes();
      expect(phase()).toBe('listening');
    }

    expect(mocked.sendMessage).toHaveBeenCalledTimes(25);
    expect(h.snap().turns).toHaveLength(51);
    expect(new Set(h.snap().turns.map((turn) => turn.key)).size).toBe(51);
    expect(h.env.mic.openTracks()).toHaveLength(1);
    expect(h.env.recognition.instances.filter((instance) => instance.running)).toHaveLength(1);
    // Every pass that finished let go of its handlers.
    for (const finished of h.env.recognition.instances.slice(0, -1)) {
      expect(finished.running).toBe(false);
      expect(finished.onresult).toBeNull();
      expect(finished.onerror).toBeNull();
      expect(finished.onend).toBeNull();
    }
    expect(h.env.listenerCount()).toBe(baseline.listeners);
    expect(h.env.edgeCount()).toBe(baseline.edges);
    expect(vi.getTimerCount()).toBe(baseline.timers);

    h.call.unmount();
    await flush();
    expect(h.env.mic.openTracks()).toHaveLength(0);
    expect(h.env.audio.openContexts()).toHaveLength(0);
    expect(h.env.recognition.instances.filter((instance) => instance.running)).toHaveLength(0);
    expect(h.env.speech.speaking).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
