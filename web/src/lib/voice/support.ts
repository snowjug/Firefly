// Feature detection for the browser's speech features. Everything is looked up on `globalThis` at the
// moment it is needed (never when this file is imported), so a missing API is simply `null` and tests
// can install fakes.

/** The language used for listening and speaking unless a caller asks for another. */
export const DEFAULT_VOICE_LANG = 'en-GB';

export type OnDeviceAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

// TypeScript's DOM library has no speech *recognition* types, so the small part used here is described
// below. Speech synthesis is typed by the DOM library.
export interface RecognitionAlternativeLike {
  readonly transcript: string;
  readonly confidence: number;
}

export interface RecognitionResultLike {
  readonly length: number;
  readonly isFinal: boolean;
  readonly [index: number]: RecognitionAlternativeLike | undefined;
}

export interface RecognitionResultEventLike {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    readonly [index: number]: RecognitionResultLike | undefined;
  };
}

export interface RecognitionErrorEventLike {
  readonly error: string;
  readonly message?: string;
}

export interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  /** Only present in browsers that can recognise speech on the device. */
  processLocally?: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onaudioend: (() => void) | null;
  onresult: ((event: RecognitionResultEventLike) => void) | null;
  onerror: ((event: RecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

export interface OnDeviceOptions {
  langs: string[];
  processLocally?: boolean;
}

export interface RecognitionConstructor {
  new (): RecognitionLike;
  /** Recent Chromium only: whether on-device recognition can be used for these languages. */
  available?: (options: OnDeviceOptions) => Promise<OnDeviceAvailability>;
  /** Recent Chromium only: asks the browser to fetch the on-device speech pack (needs a user gesture). */
  install?: (options: OnDeviceOptions) => Promise<boolean>;
}

type UtteranceConstructor = new (text?: string) => SpeechSynthesisUtterance;
type AudioContextConstructor = new () => AudioContext;

interface SpeechGlobals {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
  speechSynthesis?: SpeechSynthesis;
  SpeechSynthesisUtterance?: UtteranceConstructor;
  AudioContext?: AudioContextConstructor;
  webkitAudioContext?: AudioContextConstructor;
  isSecureContext?: boolean;
}

const globals = () => globalThis as unknown as SpeechGlobals;

// Reading a global can throw in a locked-down frame; that counts as "not there".
function lookup<T>(read: (g: SpeechGlobals) => T | undefined): T | null {
  try {
    return read(globals()) ?? null;
  } catch {
    return null;
  }
}

export function getRecognitionConstructor(): RecognitionConstructor | null {
  const ctor = lookup((g) => g.SpeechRecognition ?? g.webkitSpeechRecognition);
  return typeof ctor === 'function' ? ctor : null;
}

export function getSynthesis(): SpeechSynthesis | null {
  const synth = lookup((g) => g.speechSynthesis);
  return synth && typeof synth.speak === 'function' ? synth : null;
}

export function getUtteranceConstructor(): UtteranceConstructor | null {
  const ctor = lookup((g) => g.SpeechSynthesisUtterance);
  return typeof ctor === 'function' ? ctor : null;
}

export function getAudioContextConstructor(): AudioContextConstructor | null {
  const ctor = lookup((g) => g.AudioContext ?? g.webkitAudioContext);
  return typeof ctor === 'function' ? ctor : null;
}

function inSecureContext(): boolean {
  return lookup((g) => g.isSecureContext) !== false;
}

/**
 * True for Chromium-based browsers (Chrome, Edge and friends), where recognition is normally done by
 * the browser vendor's online speech service. Other engines say nothing reliable about it.
 */
export function isChromiumBrowser(): boolean {
  try {
    const nav = globalThis.navigator as
      (Navigator & { userAgentData?: { brands?: ReadonlyArray<{ brand: string }> } }) | undefined;
    if (nav?.userAgentData?.brands?.some(({ brand }) => /chromium/i.test(brand))) return true;
    return /\b(?:Chrome|Chromium)\//.test(nav?.userAgent ?? '');
  } catch {
    return false;
  }
}

export interface VoiceSupport {
  /** The browser can turn speech into text. */
  recognition: boolean;
  /** The browser can speak text aloud. When false, replies cannot be read out. */
  synthesis: boolean;
  /** Speech input only works on https (or localhost). */
  secureContext: boolean;
  /** One plain sentence saying why a voice call cannot be used, or null when it can. */
  reason: string | null;
}

export function getVoiceSupport(): VoiceSupport {
  const recognition = getRecognitionConstructor() !== null;
  const synthesis = getSynthesis() !== null && getUtteranceConstructor() !== null;
  const secureContext = inSecureContext();
  let reason: string | null = null;
  if (!secureContext) {
    reason = recognition
      ? 'Voice input needs a secure (https) connection.'
      : 'Voice input needs Chrome or Edge on a secure (https) connection.';
  } else if (!recognition) {
    reason = 'Voice input needs Chrome or Edge.';
  }
  return { recognition, synthesis, secureContext, reason };
}
