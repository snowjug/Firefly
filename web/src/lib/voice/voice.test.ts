import { act, cleanup, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEMPERATURE_BANDS } from '#shared/domain/vocab.ts';
import {
  createRecognizer,
  normalizeRecognitionError,
  type RecognitionMode,
  type RecognizerState,
} from './recognizer.ts';
import {
  cleanForSpeech,
  createSpeaker,
  deliveryFor,
  pickVoice,
  splitForSpeech,
} from './speaker.ts';
import {
  getVoiceSupport,
  type OnDeviceAvailability,
  type OnDeviceOptions,
  type RecognitionErrorEventLike,
  type RecognitionLike,
  type RecognitionResultEventLike,
} from './support.ts';
import { playCallTone, stopCallTones } from './tones.ts';
import { useVoiceCall, type VoiceCallOptions } from './useVoiceCall.ts';

// The browser's speech features do not exist in jsdom, so these tests install small fakes on
// `globalThis` and drive them the way a browser would.

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Expected something at position ${index}`);
  return item;
}

// ---------------------------------------------------------------------------------------
// Fake speech recognition

class FakeRecognition implements RecognitionLike {
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  processLocally?: boolean;
  onstart: (() => void) | null = null;
  onaudiostart: (() => void) | null = null;
  onspeechstart: (() => void) | null = null;
  onspeechend: (() => void) | null = null;
  onaudioend: (() => void) | null = null;
  onresult: ((event: RecognitionResultEventLike) => void) | null = null;
  onerror: ((event: RecognitionErrorEventLike) => void) | null = null;
  onend: (() => void) | null = null;
  running = false;
  stops = 0;
  aborts = 0;

  start() {
    if (this.running) throw new DOMException('already started', 'InvalidStateError');
    this.running = true;
  }
  stop() {
    this.stops++;
  }
  abort() {
    this.aborts++;
    this.running = false;
  }

  // What the browser does
  open() {
    this.onstart?.();
    this.onaudiostart?.();
  }
  say(text: string, final = true, confidence = 0.9) {
    const result = Object.assign([{ transcript: text, confidence }], { isFinal: final });
    this.onresult?.({ resultIndex: 0, results: [result] });
  }
  fail(code: string) {
    this.onerror?.({ error: code });
  }
  close() {
    this.running = false;
    this.onend?.();
  }
}

interface OnDeviceFake {
  availability: OnDeviceAvailability;
  install?: () => Promise<boolean>;
}

function installRecognition(onDevice?: OnDeviceFake) {
  const instances: FakeRecognition[] = [];
  const install = onDevice?.install;
  class Recognition extends FakeRecognition {
    static available = onDevice
      ? vi.fn(async (_options: OnDeviceOptions) => onDevice.availability)
      : undefined;
    static install = install ? vi.fn(async (_options: OnDeviceOptions) => install()) : undefined;
    constructor() {
      super();
      instances.push(this);
    }
  }
  vi.stubGlobal('SpeechRecognition', Recognition);
  return { Recognition, instances };
}

// ---------------------------------------------------------------------------------------
// Fake speech synthesis

const voice = (name: string, lang: string, localService = true): SpeechSynthesisVoice =>
  ({ name, lang, voiceURI: name, localService, default: false }) as SpeechSynthesisVoice;

const VOICES = [
  voice('Microsoft David - English (United States)', 'en-US'),
  voice('Microsoft Zira - English (United States)', 'en-US'),
  voice('Microsoft Hazel - English (United Kingdom)', 'en-GB'),
  voice('Microsoft George - English (United Kingdom)', 'en-GB'),
  voice('Google UK English Female', 'en-GB', false),
  voice('Zarvox', 'en-US'),
  voice('Microsoft Denise - French (France)', 'fr-FR'),
];

// Long enough to be spoken in more than one part.
const LONG_REPLY =
  'I have been waiting for my replacement card for almost three weeks and nobody has told me why. Every time I call, someone says it is on its way, and then nothing arrives at all. Please just tell me exactly when I can expect it.';

class FakeUtterance {
  text: string;
  lang = '';
  voice: unknown = null;
  rate = 1;
  pitch = 1;
  volume = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onboundary: ((event: { name: string; charIndex: number }) => void) | null = null;
  constructor(text = '') {
    this.text = text;
  }
}

function installSynthesis(voices: SpeechSynthesisVoice[] = VOICES) {
  const spoken: FakeUtterance[] = [];
  class Synthesis extends EventTarget {
    voices = voices;
    speaking = false;
    pending = false;
    paused = false;
    getVoices = vi.fn(() => this.voices);
    // An empty utterance only unlocks speech; it is not something the customer said.
    speak = vi.fn((utterance: FakeUtterance) => {
      if (utterance.text === '') return;
      spoken.push(utterance);
      this.speaking = true;
    });
    cancel = vi.fn(() => {
      this.speaking = false;
      this.pending = false;
    });
    pause = vi.fn(() => {
      this.paused = true;
    });
    resume = vi.fn(() => {
      this.paused = false;
    });
  }
  const synth = new Synthesis();
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  return {
    synth,
    spoken,
    /** The most recent utterance starts and finishes. `during` runs in between. */
    finishLatest(during?: (utterance: FakeUtterance) => void) {
      const utterance = at(spoken, spoken.length - 1);
      utterance.onstart?.();
      during?.(utterance);
      synth.speaking = false;
      utterance.onend?.();
    },
  };
}

// ---------------------------------------------------------------------------------------
// Fake Web Audio

class FakeParam {
  value = 0;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  cancelScheduledValues = vi.fn();
}
class FakeNode {
  connect = vi.fn((node: unknown) => node);
  disconnect = vi.fn();
}
class FakeOscillator extends FakeNode {
  type = 'sine';
  frequency = new FakeParam();
  start = vi.fn();
  stop = vi.fn();
}
class FakeGain extends FakeNode {
  gain = new FakeParam();
}

function installAudio(options: { state?: 'running' | 'suspended' } = {}) {
  const contexts: AudioContextFake[] = [];
  class AudioContextFake {
    state: 'running' | 'suspended' | 'closed' = options.state ?? 'running';
    currentTime = 0;
    destination = {};
    oscillators: FakeOscillator[] = [];
    gains: FakeGain[] = [];
    // Never allowed: it takes a real tap or click, which these tests do not have.
    resume = vi.fn(() => new Promise<void>(() => undefined));
    constructor() {
      contexts.push(this);
    }
    createOscillator() {
      const oscillator = new FakeOscillator();
      this.oscillators.push(oscillator);
      return oscillator;
    }
    createGain() {
      const gain = new FakeGain();
      this.gains.push(gain);
      return gain;
    }
  }
  vi.stubGlobal('AudioContext', AudioContextFake);
  return { contexts };
}

// ---------------------------------------------------------------------------------------

const CHROME_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0';

describe('feature detection', () => {
  it('reports voice as unavailable, with a plain reason, and stays safe with no speech API at all', async () => {
    expect(getVoiceSupport()).toEqual({
      recognition: false,
      synthesis: false,
      secureContext: true,
      reason: 'Voice input needs Chrome or Edge.',
    });

    const errors: string[] = [];
    const recognizer = createRecognizer({ onError: (error) => errors.push(error.code) });
    recognizer.prepare();
    recognizer.start();
    recognizer.stop();
    recognizer.abort();
    recognizer.dispose();
    expect(errors).toEqual(['unsupported']);

    const speaker = createSpeaker();
    const ended = vi.fn();
    const failed = vi.fn();
    speaker.speak('Hello.', { voiceSeed: 'a', mood: 'calm', onEnd: ended, onError: failed });
    await vi.advanceTimersByTimeAsync(0);
    expect(failed).toHaveBeenCalledWith(expect.objectContaining({ code: 'unsupported' }));
    expect(ended).toHaveBeenCalledTimes(1);
    expect(speaker.isSpeaking()).toBe(false);
    speaker.cancel();
    speaker.pause();
    speaker.resume();
    speaker.prime();
    speaker.dispose();

    await expect(playCallTone('connect')).resolves.toBeUndefined();
    expect(() => stopCallTones()).not.toThrow();
  });

  it('finds the prefixed recognition API and speech output, and explains an insecure page', () => {
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
    installSynthesis();
    expect(getVoiceSupport()).toEqual({
      recognition: true,
      synthesis: true,
      secureContext: true,
      reason: null,
    });
    vi.stubGlobal('isSecureContext', false);
    expect(getVoiceSupport()).toMatchObject({
      secureContext: false,
      reason: expect.stringContaining('secure'),
    });
  });
});

describe('recognizer', () => {
  it('reports live text and then the sentence, moving through its states', () => {
    const { instances } = installRecognition();
    const states: RecognizerState[] = [];
    const live: string[] = [];
    const sentences: Array<[string, number | null]> = [];
    const recognizer = createRecognizer({
      lang: 'en-GB',
      onStateChange: (state) => states.push(state),
      onInterim: (text) => live.push(text),
      onFinal: (text, confidence) => sentences.push([text, confidence]),
    });
    recognizer.start();
    const rec = at(instances, 0);
    expect(rec).toMatchObject({
      lang: 'en-GB',
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
    });
    rec.open();
    rec.say('my order', false);
    rec.say('my order has not arrived', true, 0.82);
    rec.close();
    expect(states).toEqual(['starting', 'listening', 'processing', 'idle']);
    expect(live).toEqual(['my order']);
    expect(sentences).toEqual([['my order has not arrived', 0.82]]);
  });

  it('turns each browser error code into a plain-English outcome', () => {
    const expected: Array<[string, string]> = [
      ['not-allowed', 'mic-denied'],
      ['service-not-allowed', 'mic-denied'],
      ['audio-capture', 'no-mic'],
      ['network', 'network'],
      ['no-speech', 'no-speech'],
      ['aborted', 'aborted'],
      ['language-not-supported', 'unsupported'],
      ['bad-grammar', 'unknown'],
      ['something-new', 'unknown'],
    ];
    for (const [code, outcome] of expected) {
      const error = normalizeRecognitionError(code);
      expect(error.code).toBe(outcome);
      expect(error.message).toMatch(/^[A-Z].*\.$/);
    }
  });

  it('reports an error once, ignores a second start, and stays silent about its own abort', () => {
    const { instances } = installRecognition();
    const errors: string[] = [];
    const recognizer = createRecognizer({ onError: (error) => errors.push(error.code) });
    recognizer.start();
    recognizer.start();
    expect(instances).toHaveLength(1);
    const first = at(instances, 0);
    first.open();
    first.fail('not-allowed');
    first.close();
    expect(errors).toEqual(['mic-denied']);

    recognizer.start();
    const second = at(instances, 1);
    second.open();
    recognizer.abort();
    second.fail('aborted');
    second.close();
    expect(errors).toEqual(['mic-denied']);
    expect(recognizer.state).toBe('idle');
  });

  it('treats a session that ends with nothing as silence, and keeps text heard without a final flag', () => {
    const { instances } = installRecognition();
    const errors: string[] = [];
    const sentences: string[] = [];
    const recognizer = createRecognizer({
      onError: (error) => errors.push(error.code),
      onFinal: (text) => sentences.push(text),
    });
    recognizer.start();
    at(instances, 0).open();
    at(instances, 0).close();
    expect(errors).toEqual(['no-speech']);

    recognizer.start();
    const second = at(instances, 1);
    second.open();
    second.say('refund please', false);
    second.close();
    expect(sentences).toEqual(['refund please']);
    expect(errors).toEqual(['no-speech']);
  });

  it('ignores late events after an abort, and detaches completely when disposed', () => {
    const { instances } = installRecognition();
    const events: string[] = [];
    const recognizer = createRecognizer({
      onInterim: (text) => events.push(`interim:${text}`),
      onFinal: (text) => events.push(`final:${text}`),
      onError: (error) => events.push(`error:${error.code}`),
    });
    recognizer.start();
    const aborted = at(instances, 0);
    aborted.open();
    recognizer.abort();
    aborted.say('late', true);
    aborted.fail('network');
    aborted.close();
    expect(events).toEqual([]);
    expect(aborted.aborts).toBe(1);

    recognizer.start();
    const disposed = at(instances, 1);
    disposed.open();
    recognizer.dispose();
    const handlers = [
      disposed.onstart,
      disposed.onaudiostart,
      disposed.onspeechstart,
      disposed.onspeechend,
      disposed.onaudioend,
      disposed.onresult,
      disposed.onerror,
      disposed.onend,
    ];
    expect(handlers.every((handler) => handler === null)).toBe(true);
    disposed.say('ignored', true);
    recognizer.start();
    expect(instances).toHaveLength(2);
    expect(events).toEqual([]);
  });

  it('starts at once with the default engine when the browser has no on-device option, and names it honestly', () => {
    const { instances } = installRecognition();
    const recognizer = createRecognizer();
    recognizer.start();
    // Nothing to wait for, so it begins inside the click or tap that asked for it.
    expect(instances).toHaveLength(1);
    expect(recognizer.mode).toBe('unknown');

    recognizer.abort();
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(CHROME_AGENT);
    recognizer.start();
    expect(recognizer.mode).toBe('browser-service');
  });

  it('prefers on-device recognition when the browser offers it, and says so', async () => {
    const { Recognition, instances } = installRecognition({ availability: 'available' });
    const modes: RecognitionMode[] = [];
    const recognizer = createRecognizer({
      lang: 'en-GB',
      onModeChange: (mode) => modes.push(mode),
    });
    recognizer.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(at(instances, 0).processLocally).toBe(true);
    expect(modes).toEqual(['on-device']);
    expect(recognizer.mode).toBe('on-device');
    expect(Recognition.available).toHaveBeenCalledWith({ langs: ['en-GB'], processLocally: true });
  });

  it('installs the speech pack but never waits long for it: the first sentence uses the default engine', async () => {
    let finishInstall: (installed: boolean) => void = () => undefined;
    const { Recognition, instances } = installRecognition({
      availability: 'downloadable',
      install: () =>
        new Promise<boolean>((resolve) => {
          finishInstall = resolve;
        }),
    });
    const recognizer = createRecognizer();
    recognizer.prepare();
    recognizer.start();
    await vi.advanceTimersByTimeAsync(1400);
    expect(instances).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(instances).toHaveLength(1);
    expect(at(instances, 0).processLocally).not.toBe(true);
    expect(Recognition.install).toHaveBeenCalledTimes(1);

    // Once the browser has the pack, the next sentence is recognised on the device, straight away.
    finishInstall(true);
    await vi.advanceTimersByTimeAsync(0);
    recognizer.abort();
    recognizer.start();
    expect(at(instances, 1).processLocally).toBe(true);
    expect(recognizer.mode).toBe('on-device');
    expect(Recognition.install).toHaveBeenCalledTimes(1);
  });

  it('falls back to the default engine, without an error, when on-device recognition is refused', async () => {
    const { Recognition, instances } = installRecognition({ availability: 'available' });
    const errors: string[] = [];
    const modes: RecognitionMode[] = [];
    const recognizer = createRecognizer({
      onError: (error) => errors.push(error.code),
      onModeChange: (mode) => modes.push(mode),
    });
    recognizer.start();
    await vi.advanceTimersByTimeAsync(0);
    const refused = at(instances, 0);
    expect(refused.processLocally).toBe(true);
    refused.open();
    refused.fail('service-not-allowed');
    expect(errors).toEqual([]);
    expect(at(instances, 1).processLocally).not.toBe(true);
    expect(modes).toEqual(['on-device', 'unknown']);

    // It remembers, and does not ask the browser again.
    recognizer.abort();
    recognizer.start();
    expect(instances).toHaveLength(3);
    expect(Recognition.available).toHaveBeenCalledTimes(1);
  });
});

describe('speaker', () => {
  it('gives each customer one voice: same language, on-device first, independent of list order', () => {
    const pick = (list: SpeechSynthesisVoice[], seed: string) =>
      pickVoice(list, seed, 'en-GB')?.name;
    const seeds = ['Alex Morgan', 'Sam Patel', 'Dana Wu', 'Marcus Reid', 'Priya Nair', 'Lee Chen'];
    const chosen = seeds.map((seed) => pick(VOICES, seed));
    // The two on-device British voices: never a novelty voice, another language or an online voice.
    expect(new Set(chosen)).toEqual(
      new Set([
        'Microsoft Hazel - English (United Kingdom)',
        'Microsoft George - English (United Kingdom)',
      ]),
    );
    expect(seeds.map((seed) => pick([...VOICES].reverse(), seed))).toEqual(chosen);

    // Better-sounding voices rank first, even when they are online.
    const natural = voice(
      'Microsoft Libby Online (Natural) - English (United Kingdom)',
      'en-GB',
      false,
    );
    expect(pick([...VOICES, natural], 'Alex Morgan')).toBe(natural.name);
    // Android writes en_GB, and a language with no voice gets none (the browser's default is used).
    expect(pick([voice('English United Kingdom', 'en_GB')], 'x')).toBe('English United Kingdom');
    expect(pick([voice('Microsoft Denise', 'fr-FR')], 'x')).toBeUndefined();
  });

  it('waits for voices that load late, then uses the one chosen for this customer', async () => {
    const speech = installSynthesis([]);
    const speaker = createSpeaker();
    speaker.speak('Hello there.', { voiceSeed: 'Alex Morgan', mood: 'calm' });
    await vi.advanceTimersByTimeAsync(300);
    expect(speech.spoken).toHaveLength(0);

    speech.synth.voices = VOICES;
    speech.synth.dispatchEvent(new Event('voiceschanged'));
    await vi.advanceTimersByTimeAsync(0);
    const utterance = at(speech.spoken, 0);
    expect(utterance.voice).toBe(pickVoice(VOICES, 'Alex Morgan', 'en-GB'));
    expect(utterance.lang).toBe(pickVoice(VOICES, 'Alex Morgan', 'en-GB')?.lang);

    // If the browser never lists any voice, speech still happens, with its default one.
    const bare = installSynthesis([]);
    createSpeaker().speak('Hello there.', { voiceSeed: 'Alex Morgan', mood: 'calm' });
    await vi.advanceTimersByTimeAsync(1600);
    expect(at(bare.spoken, 0).voice).toBeNull();
    expect(at(bare.spoken, 0).lang).toBe('en-GB');
  });

  it('delivers a tenser mood a little faster and higher, within safe limits', () => {
    const rates = TEMPERATURE_BANDS.map((band) => deliveryFor(band.id, 'Alex Morgan').rate);
    expect(rates).toEqual([0.96, 1, 1.05, 1.1, 1.14]);
    for (const seed of ['Alex Morgan', 'Sam Patel', 'Dana Wu', 'Marcus Reid']) {
      const pitches = TEMPERATURE_BANDS.map((band) => deliveryFor(band.id, seed).pitch);
      expect(at(pitches, 0)).toBeGreaterThanOrEqual(0.92);
      expect(at(pitches, 0)).toBeLessThanOrEqual(1.1 + 1e-9);
      expect(pitches).toEqual([...pitches].sort((a, b) => a - b));
      expect(Math.max(...pitches)).toBeLessThanOrEqual(1.2);
      expect(deliveryFor('calm', seed)).toEqual(deliveryFor('calm', seed));
    }

    const speech = installSynthesis();
    createSpeaker().speak('Hello there.', { voiceSeed: 'Alex Morgan', mood: 'angry' });
    const utterance = at(speech.spoken, 0);
    expect(utterance.rate).toBe(1.1);
    expect(utterance.pitch).toBe(deliveryFor('angry', 'Alex Morgan').pitch);
  });

  it('strips markdown and stage directions, and splits long text at sentence ends', () => {
    expect(
      cleanForSpeech(
        '*sighs* Hello **there**, this is _really_ bad. [More](http://x.test) \u{1F621} ',
      ),
    ).toBe('Hello there, this is really bad. More');

    const text = cleanForSpeech(LONG_REPLY);
    const chunks = splitForSpeech(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(140);
      expect(chunk.text).toMatch(/[.!?]$/);
      expect(text.slice(chunk.start, chunk.start + chunk.text.length)).toBe(chunk.text);
    }
    expect(chunks.map((chunk) => chunk.text).join(' ')).toBe(text);
    // Short sentences share a chunk, "Mr." does not end a sentence, and a very long one is cut at spaces.
    expect(splitForSpeech('Hi. How are you? Fine.')).toHaveLength(1);
    expect(splitForSpeech('Mr. Hall called. He was upset.', 20).map((c) => c.text)).toEqual([
      'Mr. Hall called.',
      'He was upset.',
    ]);
    const runOn = splitForSpeech('word '.repeat(80).trim());
    expect(runOn.length).toBeGreaterThan(2);
    expect(runOn.every((chunk) => chunk.text.length <= 140)).toBe(true);
  });

  it('speaks one part at a time, calls onStart and onEnd once, and queues the next reply', () => {
    const speech = installSynthesis();
    const speaker = createSpeaker();
    const log: string[] = [];
    const chunks = splitForSpeech(cleanForSpeech(LONG_REPLY));
    speaker.speak(LONG_REPLY, {
      voiceSeed: 'Alex Morgan',
      mood: 'calm',
      onStart: () => log.push('start'),
      onEnd: () => log.push('end'),
      onBoundary: (boundary) => log.push(`${boundary.name}@${boundary.charIndex}`),
    });
    speaker.speak('A second reply.', {
      voiceSeed: 'Alex Morgan',
      mood: 'calm',
      onStart: () => log.push('start2'),
      onEnd: () => log.push('end2'),
    });
    expect(speaker.isSpeaking()).toBe(true);
    chunks.forEach((chunk, index) => {
      expect(speech.spoken).toHaveLength(index + 1);
      expect(at(speech.spoken, index).text).toBe(chunk.text);
      speech.finishLatest(
        index === 1
          ? (utterance) => utterance.onboundary?.({ name: 'word', charIndex: 3 })
          : undefined,
      );
    });
    expect(log).toEqual(['start', `word@${at(chunks, 1).start + 3}`, 'end']);
    speech.finishLatest();
    expect(log).toEqual(['start', `word@${at(chunks, 1).start + 3}`, 'end', 'start2', 'end2']);
    expect(speaker.isSpeaking()).toBe(false);
  });

  it('stops at once on cancel(), never reports an end for what was cancelled, and can speak again', async () => {
    const speech = installSynthesis();
    const speaker = createSpeaker();
    const ended = vi.fn();
    speaker.speak(LONG_REPLY, { voiceSeed: 'Alex Morgan', mood: 'calm', onEnd: ended });
    speech.finishLatest();
    const interrupted = at(speech.spoken, 1);
    speaker.cancel();
    expect(speech.synth.cancel).toHaveBeenCalled();
    expect(speaker.isSpeaking()).toBe(false);
    interrupted.onerror?.({ error: 'canceled' });
    interrupted.onend?.();
    expect(ended).not.toHaveBeenCalled();
    expect(speech.spoken).toHaveLength(2);

    speaker.speak('Starting again.', { voiceSeed: 'Alex Morgan', mood: 'calm', onEnd: ended });
    expect(speech.spoken).toHaveLength(2); // some browsers need a moment after a cancel
    await vi.advanceTimersByTimeAsync(60);
    expect(speech.spoken).toHaveLength(3);
    speech.finishLatest();
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('clears a stuck "speaking" state before speaking, and gives up on an utterance the browser never starts', async () => {
    const speech = installSynthesis();
    speech.synth.speaking = true; // Chromium's stuck state
    speech.synth.paused = true;
    const speaker = createSpeaker();
    const ended = vi.fn();
    const failed = vi.fn();
    speaker.speak('Hello.', {
      voiceSeed: 'Alex Morgan',
      mood: 'calm',
      onEnd: ended,
      onError: failed,
    });
    expect(speech.synth.cancel).toHaveBeenCalled();
    expect(speech.synth.resume).toHaveBeenCalled();
    expect(speech.spoken).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(60);
    expect(speech.spoken).toHaveLength(1);

    // The browser never says it started, so the speaker does not hang for ever.
    await vi.advanceTimersByTimeAsync(6000);
    expect(failed).toHaveBeenCalledWith(expect.objectContaining({ code: 'stalled' }));
    expect(ended).toHaveBeenCalledTimes(1);
    expect(speaker.isSpeaking()).toBe(false);
  });
});

describe('call tones', () => {
  it('plays gentle tones, each with the right notes and a master volume of at most 0.2', async () => {
    const audio = installAudio();
    const notes = { ring: 4, connect: 2, hangup: 2, listening: 1 } as const;
    for (const kind of ['ring', 'connect', 'hangup', 'listening'] as const) {
      const before = audio.contexts.length === 0 ? 0 : at(audio.contexts, 0).oscillators.length;
      void playCallTone(kind, { volume: 5 });
      await vi.advanceTimersByTimeAsync(0);
      const context = at(audio.contexts, 0);
      expect(context.oscillators.length - before).toBe(notes[kind]);
      await vi.advanceTimersByTimeAsync(2100);
    }
    const context = at(audio.contexts, 0);
    expect(audio.contexts).toHaveLength(1);
    expect(
      context.gains
        .filter((gain) => gain.connect.mock.calls.some(([to]) => to === context.destination))
        .every((master) => master.gain.value === 0.2),
    ).toBe(true);
    expect(context.oscillators.slice(0, 4).map((oscillator) => oscillator.frequency.value)).toEqual(
      [440, 480, 440, 480],
    );

    // It resolves when the tone is over.
    let finished = false;
    void playCallTone('connect').then(() => {
      finished = true;
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(finished).toBe(false);
    await vi.advanceTimersByTimeAsync(400);
    expect(finished).toBe(true);
  });

  it('can be cut off, and stays silent when the browser has not allowed sound yet', async () => {
    const audio = installAudio();
    const ringing = playCallTone('ring');
    await vi.advanceTimersByTimeAsync(100);
    const oscillators = at(audio.contexts, 0).oscillators;
    expect(oscillators.length).toBeGreaterThan(0);
    stopCallTones();
    await ringing;
    expect(oscillators.every((oscillator) => oscillator.stop.mock.calls.length === 2)).toBe(true);
  });

  it('makes no sound before a tap or click allows audio, and resumes on the first one', async () => {
    const audio = installAudio({ state: 'suspended' });
    const quiet = playCallTone('connect');
    await vi.advanceTimersByTimeAsync(300);
    await quiet;
    const context = at(audio.contexts, 0);
    expect(context.oscillators).toHaveLength(0);
    const attempts = context.resume.mock.calls.length;
    document.dispatchEvent(new Event('pointerdown'));
    expect(context.resume.mock.calls.length).toBe(attempts + 1);
  });
});

// ---------------------------------------------------------------------------------------
// The call

const later = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

function mount(overrides: Partial<VoiceCallOptions> = {}, strict = false) {
  const sent: string[] = [];
  let props: VoiceCallOptions = {
    enabled: true,
    speakCustomer: true,
    handsFree: true,
    voiceSeed: 'Alex Morgan',
    mood: 'calm',
    busy: false,
    playTones: false,
    onUtterance: (text) => {
      sent.push(text);
    },
    ...overrides,
  };
  const view = renderHook((current: VoiceCallOptions) => useVoiceCall(current), {
    initialProps: props,
    ...(strict ? { wrapper: StrictMode } : {}),
  });
  return {
    sent,
    view,
    get call() {
      return view.result.current;
    },
    set(patch: Partial<VoiceCallOptions>) {
      props = { ...props, ...patch };
      view.rerender(props);
    },
  };
}

// The learner says one sentence and the browser finishes with it.
function say(rec: FakeRecognition, text: string) {
  act(() => {
    rec.open();
    rec.say(text, true);
  });
  act(() => {
    rec.close();
  });
}

describe('useVoiceCall', () => {
  it('listens, sends what was said, waits for the reply, speaks it, then listens again', async () => {
    const { instances } = installRecognition();
    const speech = installSynthesis();
    const h = mount();
    expect(h.call.status).toBe('off');
    expect(h.call.support).toMatchObject({ recognition: true, synthesis: true, reason: null });

    await act(async () => {
      await h.call.start();
    });
    expect(h.call.status).toBe('listening');
    const first = at(instances, 0);
    act(() => {
      first.open();
      first.say('i would like to reset my password', false);
    });
    expect(h.call.interim).toBe('i would like to reset my password');
    act(() => {
      first.say('I would like to reset my password', true);
    });
    expect(h.sent).toEqual(['I would like to reset my password']);
    expect(h.call.status).toBe('thinking');
    expect(h.call.interim).toBe('');
    act(() => first.close());

    // The page sends the message, then the customer's reply arrives.
    h.set({ busy: true });
    h.set({ busy: false });
    expect(h.call.status).toBe('thinking');
    act(() => h.call.speakCustomerReply('turn-2', 'Thanks for calling. How can I help you today?'));
    expect(h.call.status).toBe('customer-speaking');
    expect(h.call.customerSpeaking).toBe(true);
    expect(speech.spoken).toHaveLength(1);
    expect(instances).toHaveLength(1);

    act(() => speech.finishLatest());
    expect(h.call.customerSpeaking).toBe(false);
    // A short pause first, so the microphone does not hear the end of the reply.
    expect(h.call.status).toBe('idle');
    expect(instances).toHaveLength(1);
    await later(400);
    expect(instances).toHaveLength(2);
    expect(h.call.status).toBe('listening');

    // With replies not spoken, the turn comes back as soon as the page has finished with the message.
    h.set({ speakCustomer: false });
    say(at(instances, 1), 'And one more thing');
    expect(h.sent).toHaveLength(2);
    h.set({ busy: true });
    expect(h.call.status).toBe('thinking');
    expect(instances).toHaveLength(2);
    h.set({ busy: false });
    expect(instances).toHaveLength(3);
    expect(h.call.status).toBe('listening');
  });

  it('ignores filler and one-letter transcripts and keeps listening', async () => {
    const { instances } = installRecognition();
    const h = mount();
    await act(async () => {
      await h.call.start();
    });
    for (const noise of ['um', 'a', 'Uh,']) say(at(instances, instances.length - 1), noise);
    expect(h.sent).toEqual([]);
    expect(instances).toHaveLength(4);
    say(at(instances, 3), 'ok thanks');
    expect(h.sent).toEqual(['ok thanks']);
    expect(h.call.hint).toBeNull();
  });

  it('shows an error when the microphone is blocked, and starts again on retry', async () => {
    const { instances } = installRecognition();
    const h = mount();
    await act(async () => {
      await h.call.start();
    });
    act(() => {
      at(instances, 0).open();
      at(instances, 0).fail('not-allowed');
    });
    expect(h.call.status).toBe('error');
    expect(h.call.error?.code).toBe('mic-denied');
    expect(h.call.error?.message).toMatch(/microphone/i);
    await later(5000);
    expect(instances).toHaveLength(1);

    await act(async () => {
      await h.call.start();
    });
    expect(h.call.error).toBeNull();
    expect(instances).toHaveLength(2);
    expect(h.call.status).toBe('listening');
  });

  it('mutes the microphone without ending the call', async () => {
    const { instances } = installRecognition();
    const h = mount();
    await act(async () => {
      await h.call.start();
    });
    const first = at(instances, 0);
    act(() => h.call.toggleMute());
    expect(h.call.muted).toBe(true);
    expect(h.call.status).toBe('muted');
    expect(first.aborts).toBe(1);
    await later(5000);
    expect(instances).toHaveLength(1);

    act(() => h.call.toggleMute());
    expect(h.call.muted).toBe(false);
    expect(instances).toHaveLength(2);
    expect(h.call.status).toBe('listening');
  });

  it('listens again after silence up to three times, then waits quietly with a hint', async () => {
    const { instances } = installRecognition();
    const h = mount();
    await act(async () => {
      await h.call.start();
    });
    for (let i = 0; i < 4; i++) {
      const rec = at(instances, i);
      act(() => {
        rec.open();
        rec.fail('no-speech');
      });
      act(() => rec.close());
    }
    expect(instances).toHaveLength(4);
    expect(h.call.status).toBe('idle');
    expect(h.call.error).toBeNull();
    expect(h.call.hint).toMatch(/nothing was heard/i);
    await later(5000);
    expect(instances).toHaveLength(4);

    act(() => h.call.talk());
    expect(instances).toHaveLength(5);
    expect(h.call.hint).toBeNull();
  });

  it('never listens while a message is in flight or the customer is speaking', async () => {
    const { instances } = installRecognition();
    const speech = installSynthesis();
    const h = mount();
    await act(async () => {
      await h.call.start();
    });
    // A typed message goes out while the microphone is open.
    h.set({ busy: true });
    expect(at(instances, 0).aborts).toBe(1);
    expect(h.call.status).toBe('thinking');
    h.set({ busy: false });
    expect(instances).toHaveLength(1);
    // The reply never arrives (the send failed): after a moment the learner's turn comes back.
    await later(1600);
    expect(instances).toHaveLength(2);
    expect(h.call.status).toBe('listening');

    // A reply that arrives while listening cuts the microphone off, so it cannot hear itself.
    act(() => h.call.speakCustomerReply('turn-3', 'Hello? Are you still there?'));
    expect(at(instances, 1).aborts).toBe(1);
    expect(h.call.status).toBe('customer-speaking');
    await later(2000);
    expect(instances).toHaveLength(2);
    act(() => speech.finishLatest());
    await later(400);
    expect(instances).toHaveLength(3);
  });

  it('waits for the learner to press talk when it is not hands-free', async () => {
    const { instances } = installRecognition();
    const speech = installSynthesis();
    const h = mount({ handsFree: false });
    await act(async () => {
      await h.call.start();
    });
    say(at(instances, 0), 'hello there');
    expect(h.sent).toEqual(['hello there']);
    h.set({ busy: true });
    h.set({ busy: false });
    act(() => h.call.speakCustomerReply('turn-2', 'Hi, thanks for calling.'));
    act(() => speech.finishLatest());
    await later(5000);
    expect(h.call.status).toBe('idle');
    expect(instances).toHaveLength(1);

    act(() => h.call.talk());
    expect(instances).toHaveLength(2);
    expect(h.call.status).toBe('listening');
    act(() => at(instances, 1).open());
    act(() => h.call.talk()); // pressing again finishes the sentence
    expect(at(instances, 1).stops).toBe(1);
  });

  it('cleans up when it unmounts, mid-tone or mid-call, and ignores anything that comes later', async () => {
    const { instances } = installRecognition();
    const speech = installSynthesis();
    const audio = installAudio();

    const early = mount({ playTones: true });
    let started: Promise<void> = Promise.resolve();
    act(() => {
      started = early.call.start();
    });
    await later(100);
    early.view.unmount();
    await later(1000);
    await started;
    expect(instances).toHaveLength(0);
    const tone = at(at(audio.contexts, 0).oscillators, 0);
    expect(tone.stop).toHaveBeenCalledTimes(2); // its scheduled end, and the cut-off

    const h = mount();
    await act(async () => {
      await h.call.start();
    });
    const rec = at(instances, 0);
    expect(rec.running).toBe(true);
    h.view.unmount();
    expect(rec.aborts).toBe(1);
    expect(rec.onresult).toBeNull();
    expect(rec.onend).toBeNull();
    expect(speech.synth.cancel).toHaveBeenCalled();
    act(() => {
      rec.say('too late', true);
      rec.close();
    });
    await later(5000);
    expect(h.sent).toEqual([]);
  });

  it('hangs up with a single tone however often stop() is called', async () => {
    installRecognition();
    installSynthesis();
    const audio = installAudio();
    const h = mount({ playTones: true });
    let started: Promise<void> = Promise.resolve();
    act(() => {
      started = h.call.start();
    });
    await later(100);
    expect(h.call.status).toBe('connecting');
    await later(800);
    await started;
    expect(h.call.status).toBe('listening');
    const context = at(audio.contexts, 0);
    expect(context.oscillators).toHaveLength(2); // the connect chime

    act(() => h.call.stop());
    act(() => h.call.stop());
    await later(50);
    expect(h.call.status).toBe('off');
    expect(context.oscillators.slice(2).map((oscillator) => oscillator.frequency.value)).toEqual([
      330, 330,
    ]);
  });

  it('speaks each customer message once, never one offered before the call or while speech is off, and says so when the voice fails', async () => {
    const { instances } = installRecognition();
    const speech = installSynthesis();
    const h = mount();
    act(() => h.call.speakCustomerReply('earlier', 'An earlier message.'));
    await act(async () => {
      await h.call.start();
    });
    act(() => h.call.speakCustomerReply('earlier', 'An earlier message.'));
    expect(speech.spoken).toHaveLength(0);

    act(() => {
      h.call.speakCustomerReply('new', 'A new reply.');
      h.call.speakCustomerReply('new', 'A new reply.');
    });
    expect(speech.spoken).toHaveLength(1);

    // The browser cannot play it: the call carries on, and says so until the learner speaks again.
    act(() =>
      speech.finishLatest((utterance) => utterance.onerror?.({ error: 'synthesis-failed' })),
    );
    expect(h.call.hint).toMatch(/could not be played/i);
    await later(400);
    expect(instances).toHaveLength(2);
    expect(h.call.hint).toMatch(/could not be played/i);
    say(at(instances, 1), 'That is fine, thanks');
    expect(h.call.hint).toBeNull();

    h.set({ speakCustomer: false });
    act(() => h.call.speakCustomerReply('quiet', 'Not spoken.'));
    h.set({ speakCustomer: true });
    act(() => h.call.speakCustomerReply('quiet', 'Not spoken.'));
    expect(speech.spoken).toHaveLength(1);
  });

  it('reads a single message aloud without any call, and can be stopped', async () => {
    const { instances } = installRecognition();
    const speech = installSynthesis();
    const h = mount({ enabled: false });
    act(() => h.call.replay('Could you hold on a moment? I am looking now.'));
    expect(speech.spoken).toHaveLength(1);
    expect(h.call.customerSpeaking).toBe(true);
    expect(h.call.status).toBe('off');
    act(() => speech.finishLatest());
    expect(h.call.customerSpeaking).toBe(false);

    act(() => h.call.replay('Again, please.'));
    expect(h.call.customerSpeaking).toBe(true);
    act(() => h.call.stopSpeaking());
    expect(h.call.customerSpeaking).toBe(false);
    expect(speech.synth.cancel).toHaveBeenCalled();
    await later(1000);
    expect(instances).toHaveLength(0);
  });

  it('says plainly that voice input is unsupported, and recovers cleanly', async () => {
    const h = mount();
    expect(h.call.support.recognition).toBe(false);
    await act(async () => {
      await h.call.start();
    });
    expect(h.call.status).toBe('error');
    expect(h.call.error).toEqual({
      code: 'unsupported',
      message: 'Voice input needs Chrome or Edge.',
    });
    act(() => h.call.replay('Hello.'));
    act(() => h.call.talk());
    act(() => h.call.stop());
    expect(h.call.status).toBe('off');
    expect(h.call.error).toBeNull();
  });

  it('is safe when React mounts it twice (StrictMode)', async () => {
    const { instances } = installRecognition();
    installSynthesis();
    const h = mount({}, true);
    await act(async () => {
      await h.call.start();
    });
    expect(instances).toHaveLength(1);
    expect(h.call.status).toBe('listening');
    h.view.unmount();
    expect(at(instances, 0).aborts).toBe(1);
  });

  it('says where recognition happens once it is listening', async () => {
    installRecognition({ availability: 'available' });
    const h = mount();
    expect(h.call.recognitionMode).toBe('unknown');
    await act(async () => {
      await h.call.start();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(h.call.recognitionMode).toBe('on-device');
    act(() => h.call.stop());
    expect(h.call.recognitionMode).toBe('unknown');
  });
});
