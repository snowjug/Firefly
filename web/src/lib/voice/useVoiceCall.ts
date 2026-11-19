import { useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { TemperatureBandId } from '#shared/domain/vocab.ts';
import {
  createRecognizer,
  type RecognitionMode,
  type Recognizer,
  type RecognizerState,
  type VoiceError,
} from './recognizer.ts';
import { createSpeaker, type Speaker } from './speaker.ts';
import { DEFAULT_VOICE_LANG, getVoiceSupport } from './support.ts';
import { playCallTone, stopCallTones } from './tones.ts';

// A phone-call style voice conversation: the learner speaks, the simulated customer's replies are
// spoken aloud. It is a small state machine around the browser's speech features and never records or
// uploads audio itself. Only the recognised text goes to `onUtterance`, and the page sends it through
// the same path as typed text, so the typed transcript stays the source of truth.

export type VoiceStatus =
  | 'off'
  | 'connecting'
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'customer-speaking'
  | 'muted'
  | 'error';

export interface VoiceErrorInfo {
  code: 'mic-denied' | 'no-mic' | 'network' | 'unsupported' | 'unknown';
  /** A plain-English sentence for the learner. */
  message: string;
}

export interface VoiceCallOptions {
  /** The learner has turned voice on and started a voice call. Turning it off hangs up quietly. */
  enabled: boolean;
  /** Speak the customer's replies aloud. */
  speakCustomer: boolean;
  /** Listen again automatically after the customer has finished. Otherwise the learner uses talk(). */
  handsFree: boolean;
  /** Keeps one customer's voice the same for the whole call (the persona's name, for example). */
  voiceSeed: string;
  /** The customer's current mood sets how the voice sounds. */
  mood: TemperatureBandId;
  /** A message is being sent or the customer is replying: do not listen. */
  busy: boolean;
  /** Defaults to 'en-GB'. */
  lang?: string;
  /** Play the connect, "your turn" and hang-up tones (default true). */
  playTones?: boolean;
  /** The learner finished a sentence. The page sends it as their message. */
  onUtterance(text: string): Promise<void> | void;
}

export interface VoiceCall {
  support: ReturnType<typeof getVoiceSupport>;
  /** Where recognition happens (see RecognitionMode). 'unknown' until listening has started. */
  recognitionMode: RecognitionMode;
  status: VoiceStatus;
  /** Live caption while the learner is speaking. */
  interim: string;
  error: VoiceErrorInfo | null;
  /** Guidance that is not an error, such as "nothing was heard". Null when there is none. */
  hint: string | null;
  muted: boolean;
  /** True while the customer's voice is playing, for the avatar's mouth. */
  customerSpeaking: boolean;
  /** Begins the call: connect tone, then listening. Call it from a click or tap. Retries after an error. */
  start(): Promise<void>;
  /** Hangs up: stops speech and listening, plays the hang-up tone. Safe to call again. */
  stop(): void;
  /** Mic off or on without ending the call. */
  toggleMute(): void;
  /**
   * Push to talk. Listens for one sentence now (the customer's voice is cut off if it is playing).
   * While listening, it finishes the sentence early. Also a way to retry after an error.
   */
  talk(): void;
  /** Hands over each NEW customer message. Each id is spoken at most once; ids offered earlier are skipped. */
  speakCustomerReply(messageId: string, text: string): void;
  /** Reads one message aloud. Works without a voice call (needs speech output only). */
  replay(text: string): void;
  stopSpeaking(): void;
}

interface Snapshot {
  status: VoiceStatus;
  interim: string;
  error: VoiceErrorInfo | null;
  hint: string | null;
  muted: boolean;
  customerSpeaking: boolean;
  recognitionMode: RecognitionMode;
}

type Actions = Pick<
  VoiceCall,
  'start' | 'stop' | 'toggleMute' | 'talk' | 'speakCustomerReply' | 'replay' | 'stopSpeaking'
>;

interface Controller {
  support: ReturnType<typeof getVoiceSupport>;
  actions: Actions;
  subscribe(listener: () => void): () => void;
  getSnapshot(): Snapshot;
  setOptions(next: VoiceCallOptions): void;
  reset(): void;
}

// After the first listen, an empty or silent turn is tried again this many times before the call
// goes quiet and waits for the learner.
const MAX_SILENT_RETRIES = 3;
// How long to wait for the page to hand over a reply once it is no longer busy.
const REPLY_GRACE_MS = 1500;
// A short pause after the customer's voice ends, so the microphone does not hear its tail.
const LISTEN_SETTLE_MS = 350;
const MIN_UTTERANCE_CHARS = 2;
const FILLER_WORDS = new Set([
  'um',
  'umm',
  'uh',
  'uhh',
  'er',
  'erm',
  'hmm',
  'hmmm',
  'mm',
  'mmm',
  'ah',
  'eh',
]);

const NOTHING_HEARD_HINT = 'Nothing was heard. Check your microphone, then try again.';
const SPEECH_FAILED_HINT =
  "The customer's voice could not be played. You can read the reply in the transcript.";

const NO_OPTIONS: VoiceCallOptions = {
  enabled: false,
  speakCustomer: false,
  handsFree: false,
  voiceSeed: '',
  mood: 'calm',
  busy: false,
  onUtterance: () => undefined,
};

function isIgnorable(text: string): boolean {
  if (text.length < MIN_UTTERANCE_CHARS) return true;
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return words.length === 0 || words.every((word) => FILLER_WORDS.has(word));
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as { then?: unknown } | null | undefined)?.then === 'function';
}

function sameSnapshot(a: Snapshot, b: Snapshot): boolean {
  return (
    a.status === b.status &&
    a.interim === b.interim &&
    a.error === b.error &&
    a.hint === b.hint &&
    a.muted === b.muted &&
    a.customerSpeaking === b.customerSpeaking &&
    a.recognitionMode === b.recognitionMode
  );
}

function createController(): Controller {
  const support = getVoiceSupport();
  const listeners = new Set<() => void>();
  let options: VoiceCallOptions = NO_OPTIONS;

  // The call
  let live = false;
  let connecting = false;
  let muted = false;
  let error: VoiceErrorInfo | null = null;
  let hint: string | null = null;
  let interim = '';
  let mode: RecognitionMode = 'unknown';
  let recState: RecognizerState = 'idle';
  // Whose turn it is. The learner's turn is open while `wantListen` is set; the customer's turn runs
  // from a delivered message until the reply has been heard (or turned out not to be coming).
  let wantListen = false;
  let awaitingReply = false;
  let pending = 0;
  let silentTurns = 0;
  // The customer's voice
  let speaking = false;
  let speechCount = 0;
  let speechGeneration = 0;
  let replyHeard = false;
  let settling = false;
  // The next time listening begins it is the learner's turn after the customer: play the cue.
  let cueListening = false;
  // Late callbacks from an earlier call carry an older epoch and are ignored.
  let epoch = 0;
  let graceTimer: ReturnType<typeof setTimeout> | undefined;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  let recognizer: Recognizer | null = null;
  let recognizerLang = '';
  let speaker: Speaker | null = null;
  // Messages already offered to speakCustomerReply, spoken or not: never spoken later.
  const seen = new Set<string>();

  const status = (): VoiceStatus => {
    if (error) return 'error';
    if (!live) return 'off';
    if (connecting) return 'connecting';
    if (speaking) return 'customer-speaking';
    if (options.busy || pending > 0 || awaitingReply) return 'thinking';
    if (muted) return 'muted';
    return recState === 'idle' ? 'idle' : 'listening';
  };

  let snapshot: Snapshot = {
    status: 'off',
    interim: '',
    error: null,
    hint: null,
    muted: false,
    customerSpeaking: false,
    recognitionMode: 'unknown',
  };

  const emit = () => {
    const next: Snapshot = {
      status: status(),
      interim,
      error,
      hint,
      muted,
      customerSpeaking: speaking,
      recognitionMode: mode,
    };
    if (sameSnapshot(snapshot, next)) return;
    snapshot = next;
    for (const listener of [...listeners]) listener();
  };

  const clearGrace = () => {
    clearTimeout(graceTimer);
    graceTimer = undefined;
  };
  const clearSettle = () => {
    clearTimeout(settleTimer);
    settleTimer = undefined;
    settling = false;
  };
  const startSettle = () => {
    clearSettle();
    settling = true;
    const mine = epoch;
    settleTimer = setTimeout(() => {
      settleTimer = undefined;
      if (mine !== epoch) return;
      settling = false;
      reconcile();
    }, LISTEN_SETTLE_MS);
  };

  // Makes the microphone match the state: listening exactly when it is the learner's turn, and never
  // while the customer is speaking (it would hear itself) or a message is in flight.
  function reconcile(): void {
    const listenNow =
      live &&
      !connecting &&
      !error &&
      !muted &&
      !options.busy &&
      pending === 0 &&
      !awaitingReply &&
      !speaking &&
      !settling &&
      wantListen;
    if (listenNow) {
      if (recState === 'idle') beginListening();
    } else if (recState !== 'idle') {
      recognizer?.abort();
    }
    emit();
  }

  function fail(info: VoiceErrorInfo): void {
    error = info;
    wantListen = false;
    cueListening = false;
    interim = '';
    hint = null;
    reconcile();
  }

  // Hands the turn back to the learner. Hands-free calls start listening again.
  function handBack(afterSpeech: boolean): void {
    clearGrace();
    awaitingReply = false;
    replyHeard = false;
    silentTurns = 0;
    wantListen = options.handsFree;
    if (afterSpeech && wantListen) {
      cueListening = true;
      startSettle();
    }
    reconcile();
  }

  // A message went out and nothing is in flight any more: wait briefly for the reply to be handed over.
  function armGrace(): void {
    if (graceTimer) return;
    const mine = epoch;
    graceTimer = setTimeout(() => {
      graceTimer = undefined;
      if (mine === epoch) handBack(false);
    }, REPLY_GRACE_MS);
  }

  // The page is no longer busy with a message. If the reply will be spoken, give it a moment to arrive;
  // otherwise there is nothing to wait for.
  function settleTurn(): void {
    if (!live || !awaitingReply || options.busy || pending > 0 || speaking || graceTimer) return;
    if (!options.speakCustomer || !support.synthesis) handBack(false);
    else armGrace();
  }

  function silentTurn(): void {
    interim = '';
    silentTurns++;
    if (!options.handsFree || silentTurns > MAX_SILENT_RETRIES) {
      wantListen = false;
      hint = NOTHING_HEARD_HINT;
    }
    reconcile();
  }

  function deliver(text: string): void {
    const mine = epoch;
    let result: Promise<void> | void;
    try {
      result = options.onUtterance(text);
    } catch {
      // The page could not take the message; there is no reply to wait for.
      awaitingReply = false;
      wantListen = options.handsFree;
      return;
    }
    if (isPromiseLike(result)) {
      pending++;
      const settled = () => {
        if (mine !== epoch) return;
        pending = Math.max(0, pending - 1);
        settleTurn();
        reconcile();
      };
      result.then(settled, settled);
    } else if (!options.busy) {
      // The page has not shown that it is busy yet (it does so on its next render). If it never does,
      // the turn still comes back to the learner after a moment instead of waiting for ever.
      armGrace();
    }
  }

  function heard(raw: string): void {
    const text = raw.replace(/\s+/g, ' ').trim();
    interim = '';
    if (isIgnorable(text)) {
      silentTurn();
      return;
    }
    silentTurns = 0;
    hint = null;
    wantListen = false;
    awaitingReply = true;
    deliver(text);
    reconcile();
  }

  function recognizerFailed(failure: VoiceError): void {
    if (failure.code === 'no-speech' || failure.code === 'aborted') silentTurn();
    else fail({ code: failure.code, message: failure.message });
  }

  function ensureRecognizer(): Recognizer | null {
    const lang = options.lang ?? DEFAULT_VOICE_LANG;
    if (recognizer && recognizerLang === lang) return recognizer;
    if (!support.recognition || !support.secureContext) {
      fail({
        code: 'unsupported',
        message: support.reason ?? 'Voice input is not available in this browser.',
      });
      return null;
    }
    recognizer?.dispose();
    const mine = epoch;
    recognizerLang = lang;
    recognizer = createRecognizer({
      lang,
      onInterim: (text) => {
        if (mine !== epoch) return;
        interim = text;
        emit();
      },
      onFinal: (text) => {
        if (mine === epoch) heard(text);
      },
      onStateChange: (state) => {
        if (mine !== epoch) return;
        if (state === 'listening' && recState !== 'listening' && cueListening) {
          cueListening = false;
          if (options.playTones !== false) void playCallTone('listening');
        }
        recState = state;
        if (state === 'idle') interim = '';
        reconcile();
      },
      onError: (failure) => {
        if (mine === epoch) recognizerFailed(failure);
      },
      onModeChange: (next) => {
        if (mine !== epoch) return;
        mode = next;
        emit();
      },
    });
    return recognizer;
  }

  function beginListening(): void {
    const rec = ensureRecognizer();
    if (rec) rec.start();
  }

  function ensureSpeaker(): Speaker | null {
    if (!support.synthesis) return null;
    speaker ??= createSpeaker();
    return speaker;
  }

  // Stops the voice without handing the turn on.
  function interruptSpeech(): void {
    speechGeneration++;
    speechCount = 0;
    if (speaker?.isSpeaking()) speaker.cancel();
  }

  function speechFinished(): void {
    if (!live) {
      emit();
      return;
    }
    if (replyHeard) {
      handBack(true);
      return;
    }
    if (options.handsFree && !awaitingReply && !error) {
      wantListen = true;
      cueListening = true;
      startSettle();
    }
    reconcile();
  }

  function say(text: string, kind: 'reply' | 'replay'): void {
    const spk = ensureSpeaker();
    if (!spk) return;
    clearGrace();
    clearSettle();
    hint = null; // a new customer turn: any earlier guidance is out of date
    const mine = epoch;
    const generation = speechGeneration;
    speechCount++;
    speaking = true;
    if (kind === 'reply') replyHeard = true;
    spk.speak(text, {
      voiceSeed: options.voiceSeed,
      mood: options.mood,
      lang: options.lang ?? DEFAULT_VOICE_LANG,
      onError: () => {
        if (mine === epoch && generation === speechGeneration) hint = SPEECH_FAILED_HINT;
      },
      onEnd: () => {
        if (mine !== epoch || generation !== speechGeneration) return;
        speechCount = Math.max(0, speechCount - 1);
        if (speechCount > 0) return;
        speaking = false;
        speechFinished();
      },
    });
    reconcile();
  }

  function disposeRecognizer(): void {
    recognizer?.dispose();
    recognizer = null;
    recognizerLang = '';
    recState = 'idle';
    interim = '';
    mode = 'unknown';
  }

  function hangUp(withTone: boolean): void {
    const wasLive = live;
    epoch++;
    clearGrace();
    clearSettle();
    stopCallTones();
    disposeRecognizer();
    speechGeneration++;
    speechCount = 0;
    speaker?.cancel();
    live = false;
    connecting = false;
    muted = false;
    error = null;
    hint = null;
    wantListen = false;
    cueListening = false;
    awaitingReply = false;
    pending = 0;
    silentTurns = 0;
    speaking = false;
    replyHeard = false;
    emit();
    if (withTone && wasLive) void playCallTone('hangup');
  }

  async function start(): Promise<void> {
    if (live && !error) return;
    if (live) {
      // Retry after an error: the call is still up, so there is no new connect tone.
      error = null;
      hint = null;
      silentTurns = 0;
      wantListen = true;
      reconcile();
      return;
    }
    if (!support.recognition || !support.secureContext) {
      error = {
        code: 'unsupported',
        message: support.reason ?? 'Voice input is not available in this browser.',
      };
      emit();
      return;
    }
    const mine = ++epoch;
    error = null;
    hint = null;
    live = true;
    connecting = true;
    muted = false;
    wantListen = false;
    awaitingReply = false;
    silentTurns = 0;
    emit();
    // Inside the click or tap that started the call: allow speech output, and let the browser
    // prepare on-device recognition (which needs a gesture).
    ensureSpeaker()?.prime();
    ensureRecognizer()?.prepare();
    stopCallTones(); // a hang-up tone from a call that just ended should not overlap the new one
    if (options.playTones !== false) await playCallTone('connect');
    if (mine !== epoch) return;
    connecting = false;
    wantListen = true;
    reconcile();
  }

  function talk(): void {
    if (!live || muted || connecting) return;
    if (recState === 'listening') {
      recognizer?.stop();
      return;
    }
    if (recState !== 'idle' || options.busy || pending > 0) return;
    if (speaking) {
      interruptSpeech();
      speaking = false;
    }
    clearGrace();
    clearSettle();
    error = null;
    hint = null;
    silentTurns = 0;
    awaitingReply = false;
    replyHeard = false;
    wantListen = true;
    cueListening = true;
    reconcile();
  }

  function toggleMute(): void {
    if (!live) return;
    muted = !muted;
    interim = '';
    if (muted) {
      cueListening = false;
    } else {
      silentTurns = 0;
      hint = null;
      if (options.handsFree && !awaitingReply) wantListen = true;
    }
    reconcile();
  }

  function speakCustomerReply(messageId: string, text: string): void {
    if (seen.has(messageId)) return;
    seen.add(messageId);
    if (!live || !options.speakCustomer || !support.synthesis) return;
    say(text, 'reply');
  }

  function replay(text: string): void {
    if (!support.synthesis || !ensureSpeaker()) return;
    interruptSpeech();
    say(text, 'replay');
  }

  function stopSpeaking(): void {
    if (!speaking) return;
    interruptSpeech();
    speaking = false;
    speechFinished();
  }

  function setOptions(next: VoiceCallOptions): void {
    const previous = options;
    options = next;
    if (live && !next.enabled) {
      hangUp(false);
      return;
    }
    if (live) {
      if (!previous.busy && next.busy) {
        // A message is going out (typed or spoken): it is the customer's turn.
        clearGrace();
        awaitingReply = true;
        wantListen = false;
      } else if (previous.busy && !next.busy) {
        settleTurn();
      }
      if (!previous.handsFree && next.handsFree && !awaitingReply && !speaking && !error) {
        wantListen = true;
      }
    }
    reconcile();
  }

  return {
    support,
    actions: {
      start,
      stop() {
        // Nothing left to hang up: leave the hang-up tone that the first stop() started alone.
        if (!live && !error && !speaking) return;
        hangUp(options.playTones !== false);
      },
      toggleMute,
      talk,
      speakCustomerReply,
      replay,
      stopSpeaking,
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    setOptions,
    reset() {
      hangUp(false);
      speaker?.dispose();
      speaker = null;
    },
  };
}

export function useVoiceCall(options: VoiceCallOptions): VoiceCall {
  const [controller] = useState(createController);
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  // A layout effect, so the controller has the latest options before the page's own effects run
  // (the effect that hands over a new customer reply, for example).
  useLayoutEffect(() => {
    controller.setOptions(options);
  });
  useEffect(() => () => controller.reset(), [controller]);
  return useMemo(
    () => ({ support: controller.support, ...snapshot, ...controller.actions }),
    [controller, snapshot],
  );
}
