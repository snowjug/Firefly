import type { SpeechCapabilitiesDTO } from '#shared/domain/speech.ts';

// Feature detection for the browser's audio and speech features. Everything is looked up on
// `globalThis` at the moment it is needed (never when this file is imported), so a missing feature
// is simply `null` and tests can install fakes. Nothing here opens a microphone or plays a sound.

// TypeScript's DOM library has no speech *recognition* types, so the small part used here is
// described below. Speech synthesis and Web Audio are typed by the DOM library.
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

export type OnDeviceAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

export interface OnDeviceOptions {
  langs: string[];
  processLocally?: boolean;
}

export interface RecognitionConstructor {
  new (): RecognitionLike;
  /** Recent Chromium only: whether on-device recognition can be used for these languages. */
  available?: (options: OnDeviceOptions) => Promise<OnDeviceAvailability>;
  /** Recent Chromium only: asks the browser to fetch the on-device speech pack (needs a gesture). */
  install?: (options: OnDeviceOptions) => Promise<boolean>;
}

export type UtteranceConstructor = new (text?: string) => SpeechSynthesisUtterance;
export type AudioContextConstructor = new (options?: AudioContextOptions) => AudioContext;
export type AudioWorkletNodeConstructor = new (
  context: BaseAudioContext,
  name: string,
  options?: AudioWorkletNodeOptions,
) => AudioWorkletNode;
export type AudioElementConstructor = new (src?: string) => HTMLAudioElement;

interface Globals {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
  speechSynthesis?: SpeechSynthesis;
  SpeechSynthesisUtterance?: UtteranceConstructor;
  AudioContext?: AudioContextConstructor;
  webkitAudioContext?: AudioContextConstructor;
  AudioWorkletNode?: AudioWorkletNodeConstructor;
  Audio?: AudioElementConstructor;
  URL?: { createObjectURL?(blob: Blob): string; revokeObjectURL?(url: string): void };
  isSecureContext?: boolean;
  navigator?: Navigator & {
    userAgentData?: { brands?: ReadonlyArray<{ brand: string }> };
  };
}

const globals = () => globalThis as unknown as Globals;

// Reading a global can throw in a locked-down frame; that counts as "not there".
function lookup<T>(read: (g: Globals) => T | undefined): T | null {
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

export function getAudioWorkletNodeConstructor(): AudioWorkletNodeConstructor | null {
  const ctor = lookup((g) => g.AudioWorkletNode);
  return typeof ctor === 'function' ? ctor : null;
}

/** `navigator.mediaDevices`, when this page may ask for a microphone at all. */
export function getMediaDevices(): MediaDevices | null {
  const devices = lookup((g) => g.navigator?.mediaDevices);
  return devices && typeof devices.getUserMedia === 'function' ? devices : null;
}

/** A new `<audio>` element that is not in the page. */
export function createAudioElement(): HTMLAudioElement | null {
  const ctor = lookup((g) => g.Audio);
  if (typeof ctor !== 'function') return null;
  try {
    return new ctor();
  } catch {
    return null;
  }
}

export function hasObjectUrls(): boolean {
  const url = lookup((g) => g.URL);
  return typeof url?.createObjectURL === 'function' && typeof url.revokeObjectURL === 'function';
}

export function createObjectUrl(blob: Blob): string | null {
  try {
    return lookup((g) => g.URL)?.createObjectURL?.(blob) ?? null;
  } catch {
    return null;
  }
}

export function revokeObjectUrl(url: string): void {
  try {
    lookup((g) => g.URL)?.revokeObjectURL?.(url);
  } catch {
    // Nothing to undo.
  }
}

export function isSecureContext(): boolean {
  return lookup((g) => g.isSecureContext) !== false;
}

export type BrowserFamily = 'edge' | 'chrome' | 'firefox' | 'safari' | 'other';

/** Which browser this is, for instructions that differ between them. Never used to block anything. */
export function browserFamily(): BrowserFamily {
  const agent = lookup((g) => g.navigator?.userAgent) ?? '';
  if (/\bEdg(?:e|A|iOS)?\//.test(agent)) return 'edge';
  if (/\bFirefox\//.test(agent)) return 'firefox';
  if (/\b(?:Chrome|Chromium|CriOS)\//.test(agent)) return 'chrome';
  if (/\bSafari\//.test(agent)) return 'safari';
  return 'other';
}

/**
 * True for Chromium-based browsers (Chrome, Edge and friends), where recognition is normally done
 * by the browser vendor's online speech service. Other engines say nothing reliable about it.
 */
export function isChromiumBrowser(): boolean {
  try {
    const brands = lookup((g) => g.navigator?.userAgentData?.brands);
    if (brands?.some(({ brand }) => /chromium/i.test(brand))) return true;
  } catch {
    // Fall through to the user agent.
  }
  const family = browserFamily();
  return family === 'edge' || family === 'chrome';
}

export interface VoiceFeatures {
  secureContext: boolean;
  /** The page can ask for a microphone. */
  microphone: boolean;
  audioContext: boolean;
  /** Audio worklets exist (the module itself is only known to load once it has been tried). */
  worklet: boolean;
  /** The browser's own speech recognition. */
  recognition: boolean;
  /** The browser's own speech synthesis. */
  synthesis: boolean;
  /** An audio element and object URLs, which playing the server's audio needs. */
  audioElement: boolean;
}

export function detectFeatures(): VoiceFeatures {
  return {
    secureContext: isSecureContext(),
    microphone: getMediaDevices() !== null,
    audioContext: getAudioContextConstructor() !== null,
    worklet: getAudioWorkletNodeConstructor() !== null,
    recognition: getRecognitionConstructor() !== null,
    synthesis: getSynthesis() !== null && getUtteranceConstructor() !== null,
    audioElement: typeof globals().Audio === 'function' && hasObjectUrls(),
  };
}

export type CaptureKind = 'server-speech' | 'browser-recognition' | 'none';
export type PlaybackKind = 'server-speech' | 'browser-synthesis' | 'none';

/**
 * Who turns the trainee's speech into text. The server's speech service is preferred when it can do
 * it and this browser can record and hand it audio; otherwise the browser's own recognition; and
 * if neither is possible the call is typed.
 */
export function chooseCapture(
  speech: Pick<SpeechCapabilitiesDTO, 'transcribe'>,
  features: VoiceFeatures,
): CaptureKind {
  if (!features.secureContext) return 'none';
  if (speech.transcribe && features.microphone && features.audioContext && features.worklet) {
    return 'server-speech';
  }
  return features.recognition ? 'browser-recognition' : 'none';
}

/** Who speaks the customer's replies: the server's speech service, the browser's voices, or nobody. */
export function choosePlayback(
  speech: Pick<SpeechCapabilitiesDTO, 'synthesize'>,
  features: VoiceFeatures,
): PlaybackKind {
  if (speech.synthesize && features.audioElement) return 'server-speech';
  return features.synthesis ? 'browser-synthesis' : 'none';
}
