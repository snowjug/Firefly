import { isApiError } from '../../lib/api.ts';
import type { CaptureFailure, MicrophoneFailure } from './capture/types.ts';

// Everything that can go wrong with the voice of a call, as one typed error the call machine can act
// on and the screen can show. Each error says, in plain language, what happened, what was kept and
// what to do next, and carries as data which recovery actions the screen should offer: Retry, Use
// text, Replay and Continue without audio. Typing a reply always works, so every error says so.
//
// An error never carries audio, a transcript, a key, an address or anything a provider said: its
// words are fixed sentences chosen here, and the only thing that can vary is a number of seconds.

export const VOICE_ERROR_CODES = [
  // The microphone
  'microphone-denied',
  'microphone-missing',
  'microphone-busy',
  'microphone-unsupported',
  // Turning the trainee's speech into text
  'no-speech',
  'poor-transcription',
  'transcription-timeout',
  'transcription-failed',
  // The customer's voice
  'voice-timeout',
  'voice-failed',
  'playback-blocked',
  'playback-failed',
  // Either
  'speech-unavailable',
  'offline',
  'rate-limited',
  // The voice preview
  'preview-unavailable',
] as const;
export type VoiceErrorCode = (typeof VOICE_ERROR_CODES)[number];

/** Which part of the voice failed. */
export type VoiceStage = 'microphone' | 'transcription' | 'voice' | 'playback';

/** What the screen may offer. They are named for the buttons: Retry, Use text, Replay, Continue without audio. */
export type VoiceRecovery = 'retry' | 'use-text' | 'replay' | 'continue-without-audio';

/** What "Retry" (or "Replay") does for this error, so the engine can do it. */
export type VoiceRetryAction =
  'open-microphone' | 'record-again' | 'resend-recording' | 'regenerate-voice' | 'replay-voice';

export interface VoiceError {
  code: VoiceErrorCode;
  stage: VoiceStage;
  /** One plain sentence saying what happened. Safe to show and to read aloud. */
  message: string;
  /** What was kept, for example "Your transcript so far is saved." */
  kept: string;
  /** What to do next, in a sentence. */
  advice: string;
  /** What to offer, in the order to offer it. Never empty. */
  recovery: readonly VoiceRecovery[];
  /** What Retry or Replay does, or null when neither is offered. */
  retryAction: VoiceRetryAction | null;
  /** Trying again can help. */
  retryable: boolean;
  /** Typing a reply still works. Always true: the typed fallback never depends on any of this. */
  textFallback: true;
  /**
   * How a screen reader should hear it. `assertive` only for what stops the trainee being heard;
   * a customer voice that failed is `polite`, because the words are on the screen.
   */
  announce: 'assertive' | 'polite';
  /** For `rate-limited`: how many seconds to wait, when the server said. */
  retryAfterSeconds?: number;
}

const SAFE = 'Your call and its transcript are safe.';

interface Spec {
  stage: VoiceStage;
  message: string;
  kept?: string;
  advice: string;
  recovery: readonly VoiceRecovery[];
  retryAction: VoiceRetryAction | null;
  announce?: VoiceError['announce'];
}

const SPECS: Record<VoiceErrorCode, Spec> = {
  'microphone-denied': {
    stage: 'microphone',
    message: 'The microphone is blocked, so Firefly cannot hear you.',
    advice: 'Allow the microphone in the address bar and try again, or type your replies.',
    recovery: ['retry', 'use-text'],
    retryAction: 'open-microphone',
    announce: 'assertive',
  },
  'microphone-missing': {
    stage: 'microphone',
    message: 'No microphone was found.',
    advice: 'Plug one in and try again, or type your replies.',
    recovery: ['retry', 'use-text'],
    retryAction: 'open-microphone',
    announce: 'assertive',
  },
  'microphone-busy': {
    stage: 'microphone',
    message: 'The microphone is in use by something else or did not start.',
    advice: 'Close anything else that uses it and try again, or type your replies.',
    recovery: ['retry', 'use-text'],
    retryAction: 'open-microphone',
    announce: 'assertive',
  },
  'microphone-unsupported': {
    stage: 'microphone',
    message: 'This browser cannot record from a microphone here.',
    advice: 'Type your replies, or open Firefly in a current version of Edge or Chrome.',
    recovery: ['use-text'],
    retryAction: null,
    announce: 'assertive',
  },
  'no-speech': {
    stage: 'transcription',
    message: 'No speech was detected.',
    advice: 'Speak when it says Listening, a little closer to the microphone, or type your reply.',
    recovery: ['retry', 'use-text'],
    retryAction: 'record-again',
    announce: 'polite',
  },
  'poor-transcription': {
    stage: 'transcription',
    message: 'Firefly could not make out any words.',
    advice: 'Try again a little slower and closer to the microphone, or type your reply.',
    recovery: ['retry', 'use-text'],
    retryAction: 'record-again',
    announce: 'polite',
  },
  'transcription-timeout': {
    stage: 'transcription',
    message: 'Turning your speech into text took too long.',
    advice: 'Try again, or type your reply.',
    recovery: ['retry', 'use-text'],
    retryAction: 'resend-recording',
    announce: 'polite',
  },
  'transcription-failed': {
    stage: 'transcription',
    message: 'Your speech could not be turned into text.',
    advice: 'Try again, or type your reply.',
    recovery: ['retry', 'use-text'],
    retryAction: 'resend-recording',
    announce: 'polite',
  },
  'voice-timeout': {
    stage: 'voice',
    message: "The customer's voice took too long to start.",
    kept: "The customer's words are in the transcript.",
    advice: 'Try again, or carry on reading the transcript.',
    recovery: ['retry', 'continue-without-audio'],
    retryAction: 'regenerate-voice',
    announce: 'polite',
  },
  'voice-failed': {
    stage: 'voice',
    message: "The customer's voice could not be made.",
    kept: "The customer's words are in the transcript.",
    advice: 'Try again, or carry on reading the transcript.',
    recovery: ['retry', 'continue-without-audio'],
    retryAction: 'regenerate-voice',
    announce: 'polite',
  },
  'playback-blocked': {
    stage: 'playback',
    message: 'The browser is waiting for a tap before it will play sound.',
    kept: "The customer's words are in the transcript.",
    advice: 'Choose Replay to hear the customer, or carry on reading the transcript.',
    recovery: ['replay', 'continue-without-audio'],
    retryAction: 'replay-voice',
    announce: 'polite',
  },
  'playback-failed': {
    stage: 'playback',
    message: "The customer's voice could not be played.",
    kept: "The customer's words are in the transcript.",
    advice: 'Choose Replay to try again, or carry on reading the transcript.',
    recovery: ['replay', 'continue-without-audio'],
    retryAction: 'replay-voice',
    announce: 'polite',
  },
  'speech-unavailable': {
    stage: 'transcription',
    message: 'Spoken calls are not available on this server right now.',
    advice: 'Type your replies instead.',
    recovery: ['use-text'],
    retryAction: null,
    announce: 'polite',
  },
  offline: {
    stage: 'transcription',
    message: 'Firefly could not reach the speech service.',
    advice: 'Check your connection and try again, or type your reply.',
    recovery: ['retry', 'use-text'],
    retryAction: 'resend-recording',
    announce: 'polite',
  },
  'rate-limited': {
    stage: 'transcription',
    message: 'Too many speech requests in a short time.',
    advice: 'Wait a moment and try again, or type your reply.',
    recovery: ['retry', 'use-text'],
    retryAction: 'resend-recording',
    announce: 'polite',
  },
  'preview-unavailable': {
    stage: 'voice',
    message: 'The voice preview could not play.',
    advice: 'Your choice is kept. Try the preview again, or start the call.',
    recovery: ['retry', 'continue-without-audio'],
    retryAction: 'regenerate-voice',
    announce: 'polite',
  },
};

/** The failures speech to text and the customer's voice share, in the customer's voice's own words. */
const VOICE_VARIANTS: Partial<
  Record<VoiceErrorCode, Pick<Spec, 'message' | 'advice' | 'recovery' | 'retryAction'>>
> = {
  offline: {
    message: "Firefly could not reach the customer's voice.",
    advice: 'Check your connection and try again, or carry on reading the transcript.',
    recovery: ['retry', 'continue-without-audio'],
    retryAction: 'regenerate-voice',
  },
  'rate-limited': {
    message: 'Too many speech requests in a short time.',
    advice: 'Wait a moment and try again, or carry on reading the transcript.',
    recovery: ['retry', 'continue-without-audio'],
    retryAction: 'regenerate-voice',
  },
  'speech-unavailable': {
    message: "The customer's voice is not available on this server right now.",
    advice: 'Carry on reading the transcript.',
    recovery: ['continue-without-audio'],
    retryAction: null,
  },
};

/**
 * The error with this code. `stage` says whether a failure that both halves share (offline, too many
 * requests, speech not available) happened in speech to text or in the customer's voice, and the
 * words and the recovery actions follow it.
 */
export function voiceError(
  code: VoiceErrorCode,
  options: {
    stage?: VoiceStage;
    retryAfterSeconds?: number;
    /** The recording is still held, so Retry can send it again (otherwise the trainee speaks again). */
    recordingKept?: boolean;
  } = {},
): VoiceError {
  const stage = options.stage ?? SPECS[code].stage;
  const voice = stage === 'voice' || stage === 'playback';
  const spec: Spec = { ...SPECS[code], ...(voice ? VOICE_VARIANTS[code] : {}) };
  // Without the recording there is nothing to send again: the trainee speaks again.
  const retryAction =
    spec.retryAction === 'resend-recording' && options.recordingKept === false
      ? 'record-again'
      : spec.retryAction;
  const error: VoiceError = {
    code,
    stage,
    message: spec.message,
    kept: spec.kept ?? (voice ? "The customer's words are in the transcript." : SAFE),
    advice: spec.advice,
    recovery: spec.recovery,
    retryAction,
    retryable: spec.recovery.includes('retry') || spec.recovery.includes('replay'),
    textFallback: true,
    announce: spec.announce ?? 'polite',
  };
  if (options.retryAfterSeconds !== undefined && code === 'rate-limited') {
    error.retryAfterSeconds = options.retryAfterSeconds;
  }
  return error;
}

// ---------------------------------------------------------------------------------------
// Where errors come from

const MICROPHONE_CODES: Record<MicrophoneFailure, VoiceErrorCode> = {
  denied: 'microphone-denied',
  missing: 'microphone-missing',
  busy: 'microphone-busy',
  unsupported: 'microphone-unsupported',
};

/** The microphone could not be opened, or was lost. */
export const microphoneError = (reason: MicrophoneFailure): VoiceError =>
  voiceError(MICROPHONE_CODES[reason]);

/** A listening pass failed (from `CaptureHandlers.onFailure`). */
export function captureError(failure: CaptureFailure): VoiceError {
  if (failure.kind === 'microphone') return microphoneError(failure.reason);
  if (failure.reason === 'network') return voiceError('offline');
  // A language the browser's recogniser does not do cannot be fixed by trying again.
  if (failure.reason === 'language') return voiceError('speech-unavailable');
  return voiceError('transcription-failed');
}

/** The recording held no speech. */
export const noSpeechError = (): VoiceError => voiceError('no-speech');

/** The recogniser answered, but with nothing a person said (only filler sounds, or no words). */
export const poorTranscriptionError = (): VoiceError => voiceError('poor-transcription');

/** The customer's voice failed (from `PlaybackHandlers.onFailure`, or `onBlocked`). */
export function playbackError(kind: 'generation' | 'playback' | 'blocked'): VoiceError {
  if (kind === 'generation') return voiceError('voice-failed');
  return voiceError(kind === 'blocked' ? 'playback-blocked' : 'playback-failed');
}

const isTimeout = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'TimeoutError';

const waitSeconds = (error: unknown): number | undefined => {
  const value = (error as { details?: { retryAfterSeconds?: unknown } } | null)?.details
    ?.retryAfterSeconds;
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.ceil(value)
    : undefined;
};

/**
 * A failed call to the speech endpoints, as the web app's API client reports it (an `ApiError`), or
 * a timeout the caller raised itself. `stage` says whether it was speech to text or the customer's
 * voice. Anything unrecognised is the plain, retryable failure of that stage.
 */
export function apiError(
  error: unknown,
  stage: 'transcription' | 'voice',
  options: { recordingKept?: boolean } = {},
): VoiceError {
  const settings = { stage, ...(options.recordingKept === undefined ? {} : options) };
  if (isTimeout(error)) {
    return voiceError(stage === 'voice' ? 'voice-timeout' : 'transcription-timeout', settings);
  }
  if (!isApiError(error)) {
    return voiceError(stage === 'voice' ? 'voice-failed' : 'transcription-failed', settings);
  }
  if (error.status === 0 || error.code === 'network') return voiceError('offline', settings);
  switch (error.code) {
    case 'speech_timeout':
      return voiceError(stage === 'voice' ? 'voice-timeout' : 'transcription-timeout', settings);
    case 'speech_unavailable':
    case 'provider_not_configured':
      return voiceError('speech-unavailable', settings);
    case 'speech_rate_limited':
    case 'rate_limited': {
      const retryAfterSeconds = waitSeconds(error);
      return voiceError('rate-limited', {
        ...settings,
        ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
      });
    }
    default:
      return voiceError(stage === 'voice' ? 'voice-failed' : 'transcription-failed', settings);
  }
}

/**
 * Words with nothing in them: filler sounds and single letters. A transcript made only of these is
 * not something the trainee said, and is never sent as a message. A number is something they said,
 * however short: browsers write spoken numbers as digits ("5", "4729").
 */
const FILLERS = new Set(['uh', 'um', 'er', 'erm', 'ah', 'eh', 'hm', 'hmm', 'mm', 'mhm', 'huh']);

/** True when a transcript holds at least one real word. */
export function isUsableTranscript(text: string): boolean {
  const words = text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
  return words.some((word) => /\p{N}/u.test(word) || (word.length >= 2 && !FILLERS.has(word)));
}
