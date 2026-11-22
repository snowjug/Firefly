import { LEVEL_INTERVAL_MS, smoothLevel } from '../capture/levels.ts';
import { getSynthesis, getUtteranceConstructor } from '../support.ts';
import {
  cleanForSpeech,
  createLevelShaper,
  estimateSpeechMs,
  splitForSpeech,
  type SpeechChunk,
} from './speech-text.ts';
import type {
  Playback,
  PlaybackHandlers,
  PlaybackJob,
  PlaybackStop,
  PlayRequest,
} from './types.ts';
import { deliveryFor, pickVoice, pickVoiceForChoice } from './voices.ts';

// Playback with the browser's own voices. Nothing here is sent anywhere by Firefly; which voice
// speaks, and whether it runs on this device or online, is up to the browser. The browser cannot
// say how loud it is, so the customer's level is shaped from the words.
//
// The hard-won parts: Chromium stops an utterance after about fifteen seconds (so text is spoken a
// sentence or two at a time); it can ignore a speak() straight after a cancel() (so there is a short
// settle); it can leave `speaking` stuck after an interruption (so a stuck state is cleared first);
// it never reports an utterance that was garbage collected (so the current one is kept); and some
// voices never report that they started or ended (so each part has a watchdog).

const VOICE_WAIT_MS = 1500;
const VOICE_POLL_MS = 150;
const CANCEL_SETTLE_MS = 60;
const START_WAIT_MS = 6000;
const END_BASE_MS = 6000;
const END_PER_CHAR_MS = 160;

interface Chain {
  request: PlayRequest;
  handlers: PlaybackHandlers;
  chunks: SpeechChunk[];
  index: number;
  started: boolean;
  startedAt: number;
  /** How much was heard when the chain ended, was stopped or failed; null while it is running. */
  playedMs: number | null;
  /** What the first `stop` said, so a second one says the same. */
  stopResult: PlaybackStop | null;
  voice: SpeechSynthesisVoice | null;
  rate: number;
  pitch: number;
  lang: string;
  meter: ReturnType<typeof setInterval> | undefined;
}

const NOT_CUT_OFF: PlaybackStop = { interrupted: false, playedMs: 0 };

function inertPlayback(): Playback {
  return {
    engine: 'browser-synthesis',
    prime() {},
    play(_request, handlers) {
      let stopped = false;
      queueMicrotask(() => {
        if (!stopped) handlers.onFailure('playback');
      });
      return {
        stop() {
          stopped = true;
          return NOT_CUT_OFF;
        },
      };
    },
    dispose() {},
  };
}

export function createBrowserPlayback(): Playback {
  const synth = getSynthesis();
  const Utterance = getUtteranceConstructor();
  if (!synth || !Utterance) return inertPlayback();

  // Anything queued, started or timed before a stop carries an older epoch and is ignored.
  let epoch = 0;
  let active: Chain | null = null;
  // Kept so the utterance cannot be garbage collected while it is spoken (Chromium then never
  // reports that it ended).
  let spoken: SpeechSynthesisUtterance | null = null;
  let startTimer: ReturnType<typeof setTimeout> | undefined;
  let endTimer: ReturnType<typeof setTimeout> | undefined;
  let delayTimer: ReturnType<typeof setTimeout> | undefined;
  // Ends the wait for the browser's voices (its poll and its time limit) as soon as it is not needed.
  let cancelVoiceWait: (() => void) | null = null;
  let lastCancel = Number.NEGATIVE_INFINITY;
  let gaveUpWaitingForVoices = false;
  const choices = new Map<string, SpeechSynthesisVoice | null>();

  const readVoices = (): SpeechSynthesisVoice[] => {
    try {
      return Array.from(synth.getVoices());
    } catch {
      return [];
    }
  };
  readVoices(); // Chromium only starts loading its voices when asked.

  const clearTimers = () => {
    clearTimeout(startTimer);
    clearTimeout(endTimer);
    clearTimeout(delayTimer);
    startTimer = endTimer = delayTimer = undefined;
  };

  // The same customer keeps one voice for the whole call, even if the browser's list changes.
  const voiceFor = (request: PlayRequest, lang: string) => {
    const key = `${lang}|${request.voice ?? request.voiceSeed}`;
    if (choices.has(key)) return choices.get(key) ?? null;
    const voices = readVoices();
    const voice = request.voice
      ? pickVoiceForChoice(voices, request.voice, lang)
      : pickVoice(voices, request.voiceSeed, lang);
    if (voices.length > 0) choices.set(key, voice);
    return voice;
  };

  const whenVoicesReady = (): Promise<void> => {
    if (gaveUpWaitingForVoices || readVoices().length > 0) return Promise.resolve();
    return new Promise((resolve) => {
      // Chromium starts with no voices and announces them later, but not always, so also poll.
      const poll = setInterval(check, VOICE_POLL_MS);
      const limit = setTimeout(() => done(true), VOICE_WAIT_MS);
      function check() {
        if (readVoices().length > 0) done(false);
      }
      function done(timedOut: boolean) {
        clearInterval(poll);
        clearTimeout(limit);
        try {
          synth?.removeEventListener('voiceschanged', check);
        } catch {
          // Not every browser lets listeners come and go.
        }
        if (cancelVoiceWait === cancel) cancelVoiceWait = null;
        if (timedOut) gaveUpWaitingForVoices = true;
        resolve();
      }
      // A stop ends the wait now, so no poll or time limit outlives the reply it was for.
      function cancel() {
        done(false);
      }
      cancelVoiceWait = cancel;
      try {
        synth.addEventListener('voiceschanged', check);
      } catch {
        // Polling still works.
      }
    });
  };

  // Chromium sometimes leaves `speaking` true (or the engine paused) after an utterance was
  // interrupted, and then queues new speech behind the phantom one for ever.
  const clearPhantomSpeech = (): boolean => {
    let cancelled = false;
    try {
      if (synth.speaking || synth.pending) {
        synth.cancel();
        lastCancel = Date.now();
        cancelled = true;
      }
      if (synth.paused) synth.resume();
    } catch {
      // Best effort.
    }
    return cancelled;
  };

  /** How much of the voice has played so far, taken at the moment a chain ends or is stopped. */
  const playedSoFar = (chain: Chain): number =>
    chain.started ? Math.max(0, Date.now() - chain.startedAt) : 0;

  const endChain = (chain: Chain) => {
    if (chain.playedMs === null) chain.playedMs = playedSoFar(chain);
    clearTimers();
    clearInterval(chain.meter);
    chain.meter = undefined;
    spoken = null;
    if (active === chain) active = null;
  };

  const finish = (chain: Chain) => {
    if (active !== chain) return;
    endChain(chain);
    chain.handlers.onEnd();
  };

  const fail = (chain: Chain, kind: 'playback' | 'blocked') => {
    if (active !== chain) return;
    endChain(chain);
    if (kind === 'blocked') chain.handlers.onBlocked();
    else chain.handlers.onFailure('playback');
  };

  const stall = (chain: Chain, mine: number) => {
    if (epoch !== mine || active !== chain) return;
    try {
      synth.cancel();
      lastCancel = Date.now();
    } catch {
      // Best effort.
    }
    fail(chain, 'playback');
  };

  const armStart = (chain: Chain, mine: number) => {
    clearTimeout(startTimer);
    startTimer = setTimeout(() => stall(chain, mine), START_WAIT_MS);
  };

  const armEnd = (chain: Chain, mine: number) => {
    clearTimeout(endTimer);
    const chunk = chain.chunks[chain.index];
    if (!chunk) return;
    const ms = END_BASE_MS + (chunk.text.length * END_PER_CHAR_MS) / Math.max(chain.rate, 0.5);
    endTimer = setTimeout(() => stall(chain, mine), ms);
  };

  const startMeter = (chain: Chain) => {
    const shaped = createLevelShaper(chain.request.text, chain.rate);
    let level = 0;
    chain.meter = setInterval(() => {
      level = smoothLevel(level, shaped(Date.now() - chain.startedAt));
      // The page cannot hear a browser voice, so this level is shaped from the words and says so.
      chain.handlers.onLevel(level, false);
    }, LEVEL_INTERVAL_MS);
  };

  const speakChunk = (chain: Chain, mine: number) => {
    const chunk = chain.chunks[chain.index];
    if (!chunk) {
      finish(chain);
      return;
    }
    const utterance = new Utterance(chunk.text);
    if (chain.voice) {
      utterance.voice = chain.voice;
      utterance.lang = chain.voice.lang;
    } else {
      utterance.lang = chain.lang;
    }
    utterance.rate = chain.rate;
    utterance.pitch = chain.pitch;
    utterance.volume = 1;
    const isCurrent = () => epoch === mine && active === chain && spoken === utterance;
    utterance.onstart = () => {
      if (!isCurrent()) return;
      clearTimeout(startTimer);
      armEnd(chain, mine);
      if (!chain.started) {
        chain.started = true;
        chain.startedAt = Date.now();
        chain.handlers.onStart({ estimateMs: estimateSpeechMs(chain.request.text, chain.rate) });
        startMeter(chain);
      }
    };
    utterance.onend = () => {
      if (!isCurrent()) return;
      clearTimers();
      chain.index++;
      if (chain.index < chain.chunks.length) speakChunk(chain, mine);
      else finish(chain);
    };
    utterance.onerror = (event) => {
      if (!isCurrent()) return;
      clearTimers();
      // Cancelled by something other than this player (a cancel() here makes isCurrent() false).
      if (event.error === 'canceled' || event.error === 'interrupted') {
        finish(chain);
        return;
      }
      fail(chain, event.error === 'not-allowed' ? 'blocked' : 'playback');
    };
    spoken = utterance;
    armStart(chain, mine);
    try {
      synth.speak(utterance);
    } catch {
      fail(chain, 'playback');
    }
  };

  const begin = (chain: Chain, mine: number) => {
    const go = () => {
      if (epoch !== mine || active !== chain) return;
      chain.voice = voiceFor(chain.request, chain.lang);
      chain.handlers.onDetails({
        voice: chain.voice?.name ?? null,
        style: 'none',
        local: chain.voice ? chain.voice.localService : null,
        lang: chain.voice?.lang ?? null,
      });
      const cleared = clearPhantomSpeech();
      const wait = cleared
        ? CANCEL_SETTLE_MS
        : Math.max(0, CANCEL_SETTLE_MS - (Date.now() - lastCancel));
      if (wait > 0) delayTimer = setTimeout(() => speakChunk(chain, mine), wait);
      else speakChunk(chain, mine);
    };
    if (gaveUpWaitingForVoices || readVoices().length > 0) go();
    else void whenVoicesReady().then(go);
  };

  /** Stops whatever is speaking and says whether it was cut off and how far in. */
  const stopActive = (): PlaybackStop => {
    epoch++;
    const chain = active;
    active = null;
    spoken = null;
    clearTimers();
    cancelVoiceWait?.();
    let result = NOT_CUT_OFF;
    if (chain) {
      chain.playedMs ??= playedSoFar(chain);
      clearInterval(chain.meter);
      chain.meter = undefined;
      result = { interrupted: chain.started, playedMs: chain.playedMs };
      chain.stopResult = result;
    }
    lastCancel = Date.now();
    try {
      synth.cancel();
    } catch {
      // Best effort.
    }
    return result;
  };

  return {
    engine: 'browser-synthesis',
    prime() {
      if (active) return;
      try {
        const silent = new Utterance('');
        silent.volume = 0;
        synth.speak(silent);
      } catch {
        // Best effort.
      }
    },
    play(request, handlers): PlaybackJob {
      if (active) stopActive();
      const { rate, pitch } = deliveryFor(request.mood, request.voiceSeed, request.voice);
      const chain: Chain = {
        request,
        handlers,
        chunks: splitForSpeech(cleanForSpeech(request.text)),
        index: 0,
        started: false,
        startedAt: 0,
        playedMs: null,
        stopResult: null,
        voice: null,
        rate,
        pitch,
        lang: request.language,
        meter: undefined,
      };
      active = chain;
      const mine = epoch;
      if (chain.chunks.length === 0) {
        queueMicrotask(() => {
          if (epoch === mine && active === chain) finish(chain);
        });
      } else {
        begin(chain, mine);
      }
      return {
        stop() {
          if (active === chain) return stopActive();
          // Already over, or already stopped: say what happened, and cut off nothing more.
          return chain.stopResult ?? { interrupted: false, playedMs: chain.playedMs ?? 0 };
        },
      };
    },
    dispose() {
      stopActive();
    },
  };
}
