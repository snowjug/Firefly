import type { MicrophoneFailure } from './capture/types.ts';
import type { VoiceError } from './errors.ts';

// The visible states of a spoken call, and what in the voice layer moves a call between them. The
// call machine (web/src/features/call/machine.ts) keeps its own phases and flags; this is the
// vocabulary the screen is built from, with the signal each of the first ten states comes from, and
// the words each one is announced with. It is plain data and a pure function, so the screen can use
// it as it is and the tests can prove every state is reachable from a real capture or playback event.
//
// Where each state comes from:
//
//   microphone-not-requested    nothing has asked yet (`acquireMicrophone` has not been called)
//   requesting-permission       `acquireMicrophone` is pending: the browser's prompt is open
//   permission-denied           `acquireMicrophone` rejected with `MicrophoneError('denied')`, or a pass
//                               failed with `CaptureFailure { kind: 'microphone', reason: 'denied' }`
//                               (`unsupported` goes to text-fallback; `missing` and `busy` to retry-required)
//   microphone-ready            `acquireMicrophone` resolved, or a customer reply ended
//   listening                   `CaptureHandlers.onListening` (the microphone is open and recording)
//   speech-detected             `CaptureHandlers.onSpeechStart`
//   processing-speech           `CaptureHandlers.onSpeechEnd`, then `onAudio` (sent to the server) or the
//                               browser still finishing its words
//   transcript-available        a `Transcriber` outcome of `transcript`, or `CaptureHandlers.onText`
//   generating-customer-reply   the text was sent as a message (the call machine's `processing` phase)
//   customer-speaking           `PlaybackHandlers.onStart` (ends with `onEnd`, or `stop`)
//   paused, muted               the trainee's own controls
//   retry-required              any `VoiceError` that offers Retry or Replay; it is left by retrying,
//                               by `use-text`, or by `continue-without-audio` (a customer voice that failed)
//   text-fallback               typing instead: a `VoiceError` that only offers Use text, or the
//                               trainee's choice
//   ending-call, evaluating, completed   the call machine's own phases

export const VOICE_STATES = [
  'microphone-not-requested',
  'requesting-permission',
  'permission-denied',
  'microphone-ready',
  'listening',
  'speech-detected',
  'processing-speech',
  'transcript-available',
  'generating-customer-reply',
  'customer-speaking',
  'paused',
  'muted',
  'retry-required',
  'text-fallback',
  'ending-call',
  'evaluating',
  'completed',
] as const;
export type VoiceState = (typeof VOICE_STATES)[number];

export interface VoiceStateText {
  /** Short, for the status line beside the controls. */
  label: string;
  /**
   * A whole sentence for a screen reader, or null when the state must not be announced. Speech
   * detection flips many times a call and is visual only: announcing it would talk over the trainee.
   */
  announcement: string | null;
  /** How the announcement should be made. `off` for states that are not announced. */
  politeness: 'polite' | 'assertive' | 'off';
}

export const VOICE_STATE_TEXT: Record<VoiceState, VoiceStateText> = {
  'microphone-not-requested': {
    label: 'Microphone off',
    announcement: null,
    politeness: 'off',
  },
  'requesting-permission': {
    label: 'Waiting for permission',
    announcement: 'Waiting for you to allow the microphone.',
    politeness: 'polite',
  },
  'permission-denied': {
    label: 'Microphone blocked',
    announcement: 'The microphone is blocked. You can type your replies instead.',
    politeness: 'assertive',
  },
  'microphone-ready': {
    label: 'Microphone ready',
    announcement: 'Microphone ready.',
    politeness: 'polite',
  },
  listening: {
    label: 'Listening',
    announcement: 'Listening. Speak when you are ready.',
    politeness: 'polite',
  },
  'speech-detected': { label: 'Hearing you', announcement: null, politeness: 'off' },
  'processing-speech': {
    label: 'Processing speech',
    announcement: 'Turning your speech into text.',
    politeness: 'polite',
  },
  'transcript-available': {
    label: 'Transcript ready',
    announcement: 'Your words are in the transcript.',
    politeness: 'polite',
  },
  'generating-customer-reply': {
    label: 'Customer is replying',
    announcement: 'The customer is preparing a reply.',
    politeness: 'polite',
  },
  'customer-speaking': {
    label: 'Customer speaking',
    announcement: 'The customer is speaking. You can stop the customer audio at any time.',
    politeness: 'polite',
  },
  paused: { label: 'Paused', announcement: 'The call is paused.', politeness: 'polite' },
  muted: { label: 'Muted', announcement: 'Your microphone is muted.', politeness: 'polite' },
  'retry-required': {
    label: 'Try again',
    announcement: 'Something needs another try.',
    politeness: 'polite',
  },
  'text-fallback': {
    label: 'Typing',
    announcement: 'You are typing your replies.',
    politeness: 'polite',
  },
  'ending-call': { label: 'Ending call', announcement: 'Ending the call.', politeness: 'polite' },
  evaluating: {
    label: 'Preparing your review',
    announcement: 'Preparing your review.',
    politeness: 'polite',
  },
  completed: {
    label: 'Call complete',
    announcement: 'The call is complete.',
    politeness: 'polite',
  },
};

/** What happened, in the voice layer's own terms. */
export type VoiceSignal =
  /** The trainee started the call (`voice: false` for a typed call) or asked to use the microphone again. */
  | { type: 'begin'; voice: boolean }
  | { type: 'microphone-granted' }
  | { type: 'microphone-failed'; reason: MicrophoneFailure }
  | { type: 'listening' }
  | { type: 'speech-start' }
  /** A burst too short or too quiet to be speech was ignored. */
  | { type: 'speech-dropped' }
  | { type: 'speech-end' }
  | { type: 'transcript' }
  /** Nothing usable was heard (`onNothing`, or a `no-speech` outcome). */
  | { type: 'nothing-heard' }
  | { type: 'error'; error: VoiceError }
  | { type: 'reply-requested' }
  | { type: 'customer-start' }
  /** The customer's voice ended, was stopped, or could not play. */
  | { type: 'customer-end' }
  | { type: 'use-text' }
  /** After the customer's voice failed: the transcript is enough, and the trainee's turn begins. */
  | { type: 'continue-without-audio' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'mute' }
  | { type: 'unmute' }
  | { type: 'end-requested' }
  | { type: 'evaluation-started' }
  | { type: 'completed' };

export interface VoiceStatus {
  state: VoiceState;
  /** The call is being held by typing: after a reply, the trainee types again rather than speaks. */
  typed: boolean;
  /** Where to go back to when a pause or a mute is lifted. */
  resumeTo: VoiceState | null;
}

export const INITIAL_VOICE_STATUS: VoiceStatus = {
  state: 'microphone-not-requested',
  typed: false,
  resumeTo: null,
};

const ENDING: readonly VoiceState[] = ['ending-call', 'evaluating', 'completed'];
// The states in which the call is under way and the voice loop is running.
const RUNNING: readonly VoiceState[] = [
  'microphone-ready',
  'listening',
  'speech-detected',
  'processing-speech',
  'transcript-available',
  'generating-customer-reply',
  'customer-speaking',
  'retry-required',
];

const move = (status: VoiceStatus, state: VoiceState, typed = status.typed): VoiceStatus => ({
  state,
  typed,
  resumeTo: null,
});

/** Where a call rests between exchanges: typing, or a microphone that is ready. */
const resting = (status: VoiceStatus): VoiceState =>
  status.typed ? 'text-fallback' : 'microphone-ready';

/**
 * The next status after a signal. A signal that makes no sense where the call is (speech detected
 * while paused, a reply while ending) changes nothing, and the very same status object comes back.
 * Typing always works: a typed call is only ever taken out of typing by the trainee asking for the
 * microphone again, and by ending.
 */
export function nextVoiceStatus(status: VoiceStatus, signal: VoiceSignal): VoiceStatus {
  const { state } = status;
  if (state === 'completed') return status;
  if (signal.type === 'completed') return move(status, 'completed');
  if (signal.type === 'evaluation-started') {
    return state === 'ending-call' ? move(status, 'evaluating') : status;
  }
  if (signal.type === 'end-requested') {
    return ENDING.includes(state) ? status : move(status, 'ending-call');
  }
  if (ENDING.includes(state)) return status;

  switch (signal.type) {
    case 'begin': {
      if (!signal.voice) {
        return state === 'microphone-not-requested' ? move(status, 'text-fallback', true) : status;
      }
      // The first request for the microphone, or another go after it failed or was refused.
      const mayAsk: readonly VoiceState[] = [
        'microphone-not-requested',
        'permission-denied',
        'retry-required',
        'text-fallback',
      ];
      return mayAsk.includes(state) ? move(status, 'requesting-permission', false) : status;
    }
    case 'microphone-granted':
      return state === 'requesting-permission' ? move(status, 'microphone-ready', false) : status;
    case 'microphone-failed': {
      if (state !== 'requesting-permission' && !RUNNING.includes(state)) return status;
      // A blocked microphone is its own state, and a browser that cannot record at all has nothing
      // to try again: the call is typed. Anything else (unplugged, busy) is something to try again.
      if (signal.reason === 'denied') return move(status, 'permission-denied');
      if (signal.reason === 'unsupported') return move(status, 'text-fallback', true);
      return move(status, 'retry-required');
    }
    case 'listening':
      return state === 'microphone-ready' ||
        state === 'retry-required' ||
        state === 'transcript-available'
        ? move(status, 'listening')
        : status;
    case 'speech-start':
      return state === 'listening' ? move(status, 'speech-detected') : status;
    case 'speech-dropped':
      return state === 'speech-detected' ? move(status, 'listening') : status;
    case 'speech-end':
      return state === 'speech-detected' || state === 'listening'
        ? move(status, 'processing-speech')
        : status;
    case 'transcript':
      return state === 'processing-speech' ? move(status, 'transcript-available') : status;
    case 'nothing-heard':
      return state === 'listening' || state === 'speech-detected' || state === 'processing-speech'
        ? move(status, 'retry-required')
        : status;
    case 'reply-requested':
      return state === 'transcript-available' ||
        state === 'retry-required' ||
        state === 'text-fallback' ||
        state === 'microphone-ready'
        ? move(status, 'generating-customer-reply')
        : status;
    case 'customer-start':
      return state === 'generating-customer-reply' ||
        state === 'microphone-ready' ||
        state === 'text-fallback'
        ? move(status, 'customer-speaking')
        : status;
    case 'customer-end':
      return state === 'customer-speaking' || state === 'generating-customer-reply'
        ? move(status, resting(status))
        : status;
    case 'error': {
      // An error that offers only typing is the typed call; any other is a try again.
      const { recovery } = signal.error;
      const canTry = recovery.includes('retry') || recovery.includes('replay');
      if (canTry) return move(status, 'retry-required');
      return recovery.includes('use-text')
        ? move(status, 'text-fallback', true)
        : move(status, resting(status));
    }
    case 'use-text':
      return move(status, 'text-fallback', true);
    case 'continue-without-audio':
      return state === 'retry-required' ? move(status, resting(status)) : status;
    case 'pause':
      return RUNNING.includes(state)
        ? { state: 'paused', typed: status.typed, resumeTo: resting(status) }
        : status;
    case 'mute':
      return RUNNING.includes(state)
        ? { state: 'muted', typed: status.typed, resumeTo: resting(status) }
        : status;
    case 'resume':
      return state === 'paused' ? move(status, status.resumeTo ?? resting(status)) : status;
    case 'unmute':
      return state === 'muted' ? move(status, status.resumeTo ?? resting(status)) : status;
  }
}
