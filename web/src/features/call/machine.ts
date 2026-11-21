import type { InputMode } from '#shared/domain/speech.ts';
import type { RedactionKind } from '#shared/domain/text.ts';
import type { CallPhase, CallProblemCode, MicrophoneState } from './contract.ts';
import { describeProblem, type ProblemContext } from './problems.ts';

// The call as a pure state machine: no React, no browser APIs, no clock. `reduce` takes the state and
// one event and returns the next state; it never throws, and an event that makes no sense in the
// current phase returns the same state object. What the world should look like for a state (the
// microphone held or released, an utterance being recorded, a customer voice playing, a request in
// flight, a timer running) is a pure function of the state: `targets`. The engine's only jobs are to
// turn what happens in the browser into events and to make the world match `targets` after each one.
// That is what makes the rules below provable with plain tests.
//
// Rules the tests hold it to:
// - Nothing records before an explicit `begin`, after the call is ending, while muted or paused, or
//   while the customer's voice is being spoken; at most one recording and one voice exist at a time.
// - One spoken or typed message is one `exchange` with one client message id, so it can never become
//   two trainee turns, and a reply is applied only to the attempt that is still waiting for it.
// - Every waiting phase has a timer, and firing it always leads somewhere the trainee can act.

export const TIMINGS = {
  /** The browser's permission prompt left unanswered. */
  permission: 60_000,
  /** The customer's voice (or the opening line) not starting. */
  speakPrepare: 15_000,
  /** Added to the estimated length of a voice before it is cut off. */
  speakGrace: 5_000,
  /** Nothing heard since the microphone opened. */
  listenIdle: 15_000,
  /** Someone speaking for longer than any utterance can be. */
  listenSpeech: 35_000,
  /** A finish request the microphone did not answer. */
  finish: 5_000,
  transcribe: 20_000,
  reply: 45_000,
  /** The pause after the customer's voice, so the microphone does not hear its tail. */
  settle: 350,
  /** The call is ready but nothing has started. */
  ready: 5_000,
  /** Waiting for a message in flight before ending the call. */
  drain: 8_000,
  end: 30_000,
} as const;

/** After this many empty listening passes in a row, hands-free listening waits for the trainee. */
export const MAX_SILENT_RETRIES = 3;

export type MicReason = 'denied' | 'missing' | 'busy' | 'unsupported';

export type HintCode =
  | 'nothing-heard'
  | 'no-words'
  | 'muted'
  | 'paused'
  | 'captions-only'
  | 'long-turn'
  | 'busy'
  | 'retry-first'
  | 'empty'
  | 'too-long'
  | 'rejected'
  | 'redacted'
  | 'discarded-muted'
  | 'discarded-paused'
  | 'no-voice'
  | 'not-started';

export interface Hint {
  code: HintCode;
  /** For `redacted`: what was removed from the message. */
  kinds?: readonly RedactionKind[];
}

export interface ProblemState {
  code: CallProblemCode;
  context: ProblemContext;
}

/** One message the trainee has said or typed that has not yet been answered. */
export interface Exchange {
  /** The client message id: it makes sending this message idempotent on the server. */
  readonly id: string;
  /** Empty until a spoken message has been turned into text. */
  readonly text: string;
  readonly inputMode: InputMode;
  readonly createdAt: string;
  readonly status: 'transcribing' | 'sending' | 'failed';
  /** How many times sending has been started; a reply only applies to the latest attempt. */
  readonly attempt: number;
  /** The server already holds the message (it was saved but the reply is missing). */
  readonly saved: boolean;
  /** The message's position in the conversation, when the server already has it. */
  readonly index: number | null;
}

/** One customer turn being spoken. */
export interface Speech {
  readonly turnIndex: number;
  /** Changes for every request, so a late report about an earlier voice can be told apart. */
  readonly token: number;
  readonly status: 'preparing' | 'playing';
  readonly estimateMs: number;
}

export type TimerKind =
  | 'permission'
  | 'ready'
  | 'speak-prepare'
  | 'speak-play'
  | 'listen-idle'
  | 'listen-speech'
  | 'finish'
  | 'transcribe'
  | 'reply'
  | 'settle'
  | 'drain'
  | 'end';

export interface Timer {
  /** Changes whenever the timer is (re)armed, so a late firing of an old timer is ignored. */
  readonly id: number;
  readonly kind: TimerKind;
  readonly ms: number;
}

export interface MachineState {
  readonly phase: CallPhase;
  /** The session has been loaded, so the call can begin. */
  readonly loaded: boolean;
  /** `begin` was accepted: nothing may use the microphone before this. */
  readonly begun: boolean;
  /** A spoken call. False for a typed call, and after the microphone is lost mid-call. */
  readonly voice: boolean;
  /** Something can speak the customer's replies. */
  readonly canSpeak: boolean;
  readonly handsFree: boolean;
  readonly muted: boolean;
  readonly paused: boolean;
  readonly speechDetected: boolean;
  /** Something was heard in this listening pass. */
  readonly heard: boolean;
  /** The trainee asked to finish the utterance now. */
  readonly finishing: boolean;
  readonly microphone: MicrophoneState;
  /** The microphone stream is held (and not released by pause or ending). */
  readonly micHeld: boolean;
  readonly exchange: Exchange | null;
  readonly speech: Speech | null;
  /** A customer turn that has not been heard and should be spoken when the voice loop can. */
  readonly pendingSpeech: number | null;
  readonly lastCustomerIndex: number | null;
  /** Customer turns whose voice was cut short by the trainee. */
  readonly interrupted: readonly number[];
  readonly silentRetries: number;
  readonly limitReached: boolean;
  readonly sessionEnded: boolean;
  readonly ending: 'draining' | 'closing' | null;
  readonly problem: ProblemState | null;
  readonly hint: Hint | null;
  readonly speechSeq: number;
  readonly timerSeq: number;
  readonly timer: Timer | null;
}

export function initialState(options: { handsFree?: boolean } = {}): MachineState {
  return {
    phase: 'idle',
    loaded: false,
    begun: false,
    voice: false,
    canSpeak: false,
    handsFree: options.handsFree ?? true,
    muted: false,
    paused: false,
    speechDetected: false,
    heard: false,
    finishing: false,
    microphone: 'unknown',
    micHeld: false,
    exchange: null,
    speech: null,
    pendingSpeech: null,
    lastCustomerIndex: null,
    interrupted: [],
    silentRetries: 0,
    limitReached: false,
    sessionEnded: false,
    ending: null,
    problem: null,
    hint: null,
    speechSeq: 0,
    timerSeq: 0,
    timer: null,
  };
}

// ---------------------------------------------------------------------------------------
// Events

export type TranscribeFailure =
  | { kind: 'microphone'; reason: MicReason }
  | { kind: 'offline' }
  | { kind: 'service-unavailable' }
  | { kind: 'rate-limited'; retryAfterSeconds?: number }
  | { kind: 'failed' };

export type SendFailure =
  /** Another message was still being processed, and the retries ran out. */
  | { kind: 'conflict'; saved: boolean }
  /** The customer's reply could not be produced. */
  | { kind: 'provider'; saved: boolean }
  /** Something else went wrong; it is not known whether the message was saved. */
  | { kind: 'unknown'; saved: boolean }
  | { kind: 'offline'; saved: boolean }
  | { kind: 'rate-limited'; saved: boolean; retryAfterSeconds?: number }
  /** The server refused the message itself; it was never stored. */
  | { kind: 'validation' }
  | { kind: 'turn-limit' }
  | { kind: 'session-ended' };

export type EndFailure = { kind: 'offline' } | { kind: 'nothing-to-review' } | { kind: 'failed' };

export type MachineEvent =
  // The session
  | {
      type: 'loaded';
      lastCustomerIndex: number | null;
      awaiting: {
        id: string;
        text: string;
        createdAt: string;
        inputMode: InputMode;
        turnIndex: number;
      } | null;
      limitReached: boolean;
      sessionEnded: boolean;
    }
  | { type: 'begin'; voice: boolean; canSpeak: boolean; opening: number | null }
  | { type: 'reset' }
  // The microphone
  | { type: 'permission-granted' }
  | { type: 'permission-denied'; reason: MicReason }
  | { type: 'mic-lost' }
  | { type: 'retry-microphone' }
  // The trainee
  | { type: 'talk' }
  | { type: 'stop-talking' }
  | { type: 'toggle-mute' }
  | { type: 'toggle-pause' }
  | { type: 'set-hands-free'; on: boolean }
  | { type: 'interrupt' }
  | { type: 'replay' }
  | { type: 'send-text'; id: string; text: string; createdAt: string }
  | { type: 'retry-send' }
  | { type: 'dismiss-problem' }
  | { type: 'hint'; hint: Hint | null }
  | { type: 'end-requested' }
  // Listening
  | { type: 'speech-start' }
  | { type: 'speech-end'; id: string; createdAt: string; reason: 'silence' | 'limit' | 'stopped' }
  | { type: 'speech-dropped' }
  | { type: 'nothing-heard' }
  // Turning speech into text. `id` is null for a failure of the listening pass itself.
  | { type: 'transcribe-done'; id: string; text: string }
  | { type: 'transcribe-empty'; id: string }
  | { type: 'transcribe-failed'; id: string | null; failure: TranscribeFailure }
  // Sending
  | {
      type: 'send-done';
      id: string;
      attempt: number;
      customerIndex: number;
      turnsRemaining: number | null;
      redactions: readonly RedactionKind[];
    }
  | { type: 'send-failed'; id: string; attempt: number; failure: SendFailure }
  // The customer's voice
  | { type: 'speak-start'; token: number; estimateMs: number }
  | { type: 'speak-duration'; token: number; ms: number }
  | { type: 'speak-end'; token: number }
  | { type: 'speak-failed'; token: number; reason: 'generation' | 'playback' | 'unavailable' }
  | { type: 'speak-blocked'; token: number }
  // Ending
  | { type: 'end-done' }
  | { type: 'end-failed'; failure: EndFailure }
  // Time
  | { type: 'timeout'; id: number };

// ---------------------------------------------------------------------------------------
// Helpers

/** Problems that stop the microphone opening on its own until the trainee has dealt with them. */
const KEEPS_LISTENING: ReadonlySet<CallProblemCode> = new Set([
  'voice-generation-failed',
  'playback-failed',
]);
const MICROPHONE_PROBLEMS: readonly CallProblemCode[] = [
  'microphone-denied',
  'microphone-missing',
  'microphone-busy',
  'microphone-unsupported',
];
const TRANSCRIPTION_PROBLEMS: readonly CallProblemCode[] = [
  'transcription-failed',
  'speech-service-unavailable',
];
const VOICE_PROBLEMS: readonly CallProblemCode[] = [
  'voice-generation-failed',
  'playback-blocked',
  'playback-failed',
];
const REPLY_PROBLEMS: readonly CallProblemCode[] = [
  'reply-failed',
  'reply-timeout',
  'save-failed',
  'rate-limited',
];

const MIC_PROBLEM_CODE: Record<MicReason, CallProblemCode> = {
  denied: 'microphone-denied',
  missing: 'microphone-missing',
  busy: 'microphone-busy',
  unsupported: 'microphone-unsupported',
};

/**
 * Clears the problem when it is one of `codes`. `offline` and `rate-limited` go with whichever step
 * they belonged to: a notice from one step is not cleared by trying another.
 */
function withoutProblems(
  state: MachineState,
  codes: readonly CallProblemCode[],
  during?: ProblemContext['during'],
): MachineState {
  const problem = state.problem;
  if (!problem) return state;
  const matches =
    codes.includes(problem.code) ||
    (during !== undefined &&
      (problem.code === 'offline' || problem.code === 'rate-limited') &&
      problem.context.during === during);
  return matches ? { ...state, problem: null } : state;
}

const problem = (code: CallProblemCode, context: ProblemContext = {}): ProblemState => ({
  code,
  context,
});

/** The trainee's turn: nothing is playing or being recorded. */
function yourTurn(state: MachineState): MachineState {
  return {
    ...state,
    phase: 'ready-for-next-turn',
    speech: null,
    speechDetected: false,
    heard: false,
    finishing: false,
  };
}

function startSpeech(state: MachineState, turnIndex: number, phase: CallPhase): MachineState {
  const token = state.speechSeq + 1;
  return {
    ...state,
    phase,
    speech: { turnIndex, token, status: 'preparing', estimateMs: 0 },
    speechSeq: token,
    pendingSpeech: null,
    speechDetected: false,
    heard: false,
    finishing: false,
    // A new request gets its own deadline, even when the one before it was still waiting.
    timer: null,
  };
}

function withInterrupted(state: MachineState, turnIndex: number): MachineState {
  return state.interrupted.includes(turnIndex)
    ? state
    : { ...state, interrupted: [...state.interrupted, turnIndex] };
}

function withoutInterrupted(state: MachineState, turnIndex: number): MachineState {
  return state.interrupted.includes(turnIndex)
    ? { ...state, interrupted: state.interrupted.filter((index) => index !== turnIndex) }
    : state;
}

/** Whether the microphone could open for the trainee right now, whatever phase it is in. */
export function mayListen(state: MachineState): boolean {
  return (
    state.begun &&
    state.voice &&
    state.micHeld &&
    !state.muted &&
    !state.paused &&
    !state.limitReached &&
    !state.sessionEnded &&
    state.exchange === null &&
    state.speech === null &&
    state.pendingSpeech === null
  );
}

/** Hands-free: the microphone opens by itself, after a short settle, in the trainee's turn. */
export function autoListens(state: MachineState): boolean {
  return (
    state.phase === 'ready-for-next-turn' &&
    state.handsFree &&
    mayListen(state) &&
    state.silentRetries <= MAX_SILENT_RETRIES &&
    (state.problem === null || KEEPS_LISTENING.has(state.problem.code))
  );
}

/** The microphone stopped being available while the call is under way: carry on by typing. */
function micLost(state: MachineState, reason: MicReason, timedOut = false): MachineState {
  let next: MachineState = {
    ...state,
    voice: false,
    micHeld: false,
    microphone: reason === 'denied' ? 'denied' : 'unavailable',
    problem: problem(MIC_PROBLEM_CODE[reason], { timedOut }),
    hint: null,
  };
  if (next.phase === 'transcribing' && next.exchange?.status === 'transcribing') {
    next = { ...next, exchange: null };
  }
  if (next.phase === 'listening' || next.phase === 'transcribing') next = yourTurn(next);
  else if (next.phase === 'ready') next = yourTurn({ ...next, pendingSpeech: null });
  return next;
}

// ---------------------------------------------------------------------------------------
// The reducer

function step(state: MachineState, event: MachineEvent): MachineState {
  const { phase } = state;
  switch (event.type) {
    case 'loaded': {
      if (phase !== 'idle' || state.begun) return state;
      const awaiting = event.awaiting;
      const exchange: Exchange | null = awaiting
        ? {
            id: awaiting.id,
            text: awaiting.text,
            inputMode: awaiting.inputMode,
            createdAt: awaiting.createdAt,
            status: 'failed',
            attempt: 0,
            saved: true,
            index: awaiting.turnIndex,
          }
        : null;
      return {
        ...state,
        loaded: true,
        lastCustomerIndex: event.lastCustomerIndex,
        exchange,
        limitReached: event.limitReached,
        sessionEnded: event.sessionEnded,
        problem: event.sessionEnded
          ? problem('session-ended')
          : event.limitReached
            ? problem('turn-limit')
            : null,
      };
    }

    case 'begin': {
      if (!state.loaded || state.sessionEnded) return state;
      if (phase === 'idle' && !state.begun) {
        // A call left waiting for a reply shows its saved message as failed, with Try again.
        const stuck = state.exchange?.status === 'failed' ? state.exchange : null;
        const kept = state.problem && !MICROPHONE_PROBLEMS.includes(state.problem.code);
        const carried: ProblemState | null =
          kept && state.problem
            ? state.problem
            : stuck
              ? problem('reply-failed', { saved: stuck.saved })
              : null;
        const common = {
          ...state,
          begun: true,
          voice: event.voice,
          canSpeak: event.canSpeak,
          hint: null,
          problem: carried,
        };
        if (!event.voice) {
          return { ...common, phase: 'ready-for-next-turn', microphone: 'unknown' };
        }
        return {
          ...common,
          phase: 'requesting-microphone',
          microphone: 'prompt',
          pendingSpeech: event.canSpeak ? event.opening : null,
        };
      }
      // A typed call can become a spoken one: the same as trying the microphone again.
      if (state.begun && !state.voice && event.voice && phase === 'ready-for-next-turn') {
        return step(state, { type: 'retry-microphone' });
      }
      return state;
    }

    case 'reset':
      return initialState({ handsFree: state.handsFree });

    case 'permission-granted': {
      if (phase === 'requesting-microphone') {
        const granted = withoutProblems(
          { ...state, micHeld: true, microphone: 'granted' },
          MICROPHONE_PROBLEMS,
        );
        if (granted.pendingSpeech !== null && granted.canSpeak) {
          return startSpeech(granted, granted.pendingSpeech, 'ready');
        }
        return yourTurn({
          ...granted,
          pendingSpeech: null,
          hint: granted.canSpeak ? null : { code: 'captions-only' },
        });
      }
      if (state.begun && state.voice && !state.micHeld && !state.paused) {
        if (phase === 'ending' || phase === 'completed' || phase === 'idle') return state;
        return withoutProblems(
          { ...state, micHeld: true, microphone: 'granted' },
          MICROPHONE_PROBLEMS,
        );
      }
      return state;
    }

    case 'permission-denied': {
      if (phase === 'requesting-microphone') {
        return {
          ...state,
          phase: 'idle',
          begun: false,
          voice: false,
          micHeld: false,
          microphone: event.reason === 'denied' ? 'denied' : 'unavailable',
          pendingSpeech: null,
          problem: problem(MIC_PROBLEM_CODE[event.reason], { beforeCall: true }),
          hint: null,
        };
      }
      if (!state.begun || !state.voice || state.micHeld) return state;
      if (phase === 'idle' || phase === 'ending' || phase === 'completed') return state;
      return micLost(state, event.reason);
    }

    case 'mic-lost': {
      if (!state.begun || !state.voice || !state.micHeld) return state;
      if (phase === 'idle' || phase === 'ending' || phase === 'completed') return state;
      return micLost(state, 'missing');
    }

    case 'retry-microphone': {
      if (!state.begun || phase !== 'ready-for-next-turn' || state.voice || state.sessionEnded) {
        return state;
      }
      return withoutProblems(
        { ...state, voice: true, paused: false, microphone: 'prompt', hint: null },
        MICROPHONE_PROBLEMS,
      );
    }

    case 'talk': {
      if (!state.begun || !state.voice || state.limitReached || state.sessionEnded) return state;
      if (phase === 'listening') return step(state, { type: 'stop-talking' });
      if (phase !== 'ready-for-next-turn' && phase !== 'customer-speaking' && phase !== 'ready') {
        return state;
      }
      if (state.paused) return { ...state, hint: { code: 'paused' } };
      if (state.muted) return { ...state, hint: { code: 'muted' } };
      if (!state.micHeld) return state;
      if (state.exchange) {
        return state.exchange.status === 'failed'
          ? { ...state, hint: { code: 'retry-first' } }
          : state;
      }
      let next = state;
      if (next.speech) next = withInterrupted(next, next.speech.turnIndex);
      next = withoutProblems(next, [...TRANSCRIPTION_PROBLEMS, ...VOICE_PROBLEMS], 'transcribe');
      return {
        ...next,
        phase: 'listening',
        speech: null,
        pendingSpeech: null,
        speechDetected: false,
        heard: false,
        finishing: false,
        silentRetries: 0,
        hint: null,
      };
    }

    case 'stop-talking':
      return phase === 'listening' && !state.finishing ? { ...state, finishing: true } : state;

    case 'toggle-mute': {
      if (!state.begun || !state.voice) return state;
      if (phase === 'idle' || phase === 'requesting-microphone') return state;
      if (phase === 'ending' || phase === 'completed') return state;
      const muted = !state.muted;
      const next: MachineState = {
        ...state,
        muted,
        hint: null,
        // Unmuting starts hands-free listening afresh.
        silentRetries: muted ? state.silentRetries : 0,
      };
      if (!muted) return next;
      if (phase === 'listening') return yourTurn(next);
      if (phase === 'transcribing' && next.exchange?.status === 'transcribing') {
        return yourTurn({ ...next, exchange: null, hint: { code: 'discarded-muted' } });
      }
      return next;
    }

    case 'toggle-pause': {
      if (!state.begun || !state.voice) return state;
      if (phase === 'idle' || phase === 'requesting-microphone') return state;
      if (phase === 'ending' || phase === 'completed') return state;
      if (state.paused) {
        const resumed: MachineState = { ...state, paused: false, hint: null, silentRetries: 0 };
        if (
          resumed.phase === 'ready-for-next-turn' &&
          resumed.pendingSpeech !== null &&
          resumed.canSpeak &&
          resumed.exchange === null
        ) {
          return startSpeech(resumed, resumed.pendingSpeech, 'customer-speaking');
        }
        return resumed;
      }
      let next: MachineState = { ...state, paused: true, micHeld: false, hint: null };
      if (next.speech) next = { ...next, pendingSpeech: next.speech.turnIndex };
      if (phase === 'transcribing' && next.exchange?.status === 'transcribing') {
        next = { ...next, exchange: null, hint: { code: 'discarded-paused' } };
      }
      if (
        phase === 'ready' ||
        phase === 'listening' ||
        phase === 'transcribing' ||
        phase === 'customer-speaking'
      ) {
        next = yourTurn(next);
      }
      return next;
    }

    case 'set-hands-free':
      return state.handsFree === event.on
        ? state
        : { ...state, handsFree: event.on, silentRetries: event.on ? 0 : state.silentRetries };

    case 'interrupt': {
      if (!state.speech) return state;
      return yourTurn(withInterrupted({ ...state, pendingSpeech: null }, state.speech.turnIndex));
    }

    case 'replay': {
      if (!state.begun || !state.canSpeak || state.sessionEnded) return state;
      if (state.paused) return { ...state, hint: { code: 'paused' } };
      if (
        phase !== 'ready-for-next-turn' &&
        phase !== 'customer-speaking' &&
        phase !== 'listening'
      ) {
        return state;
      }
      const turnIndex = state.pendingSpeech ?? state.lastCustomerIndex;
      if (turnIndex === null) return state;
      return startSpeech(
        withoutProblems(withoutInterrupted(state, turnIndex), VOICE_PROBLEMS),
        turnIndex,
        'customer-speaking',
      );
    }

    case 'send-text': {
      if (!state.begun || state.exchange || state.limitReached || state.sessionEnded) return state;
      if (
        phase !== 'ready' &&
        phase !== 'listening' &&
        phase !== 'customer-speaking' &&
        phase !== 'ready-for-next-turn'
      ) {
        return state;
      }
      let next = state;
      if (next.speech) next = withInterrupted(next, next.speech.turnIndex);
      next = withoutProblems(next, [...TRANSCRIPTION_PROBLEMS, ...VOICE_PROBLEMS], 'transcribe');
      return {
        ...next,
        phase: 'processing',
        speech: null,
        pendingSpeech: null,
        speechDetected: false,
        heard: false,
        finishing: false,
        hint: null,
        exchange: {
          id: event.id,
          text: event.text,
          inputMode: 'text',
          createdAt: event.createdAt,
          status: 'sending',
          attempt: 1,
          saved: false,
          index: null,
        },
      };
    }

    case 'retry-send': {
      const exchange = state.exchange;
      if (!exchange || exchange.status !== 'failed') return state;
      if (!state.begun || phase !== 'ready-for-next-turn') return state;
      if (state.limitReached || state.sessionEnded) return state;
      return {
        ...withoutProblems(state, REPLY_PROBLEMS, 'send'),
        phase: 'processing',
        hint: null,
        exchange: { ...exchange, status: 'sending', attempt: exchange.attempt + 1 },
      };
    }

    case 'dismiss-problem': {
      if (!state.problem) return state;
      if (describeProblem(state.problem.code, state.problem.context).severity !== 'degraded') {
        return state;
      }
      // Dismissing a blocked voice means "I do not need to hear it": the turn is no longer owed.
      return {
        ...state,
        problem: null,
        pendingSpeech: state.problem.code === 'playback-blocked' ? null : state.pendingSpeech,
      };
    }

    case 'hint':
      return phase === 'completed' ? state : { ...state, hint: event.hint };

    case 'end-requested': {
      if (phase === 'ending' || phase === 'completed') return state;
      const exchange = state.exchange?.status === 'transcribing' ? null : state.exchange;
      return {
        ...state,
        phase: 'ending',
        ending: exchange?.status === 'sending' ? 'draining' : 'closing',
        exchange,
        speech: null,
        pendingSpeech: null,
        speechDetected: false,
        heard: false,
        finishing: false,
        micHeld: false,
        hint: null,
      };
    }

    case 'end-done':
      return phase === 'ending' && state.ending === 'closing'
        ? { ...state, phase: 'completed', ending: null, problem: null, hint: null }
        : state;

    case 'end-failed': {
      if (phase !== 'ending' || state.ending !== 'closing') return state;
      const failure = event.failure;
      return {
        ...state,
        // A call that never began goes back to the start; one under way goes back to the trainee.
        phase: state.begun ? 'ready-for-next-turn' : 'idle',
        ending: null,
        // The microphone was let go of when ending began: a spoken call carries on paused.
        paused: state.voice ? true : state.paused,
        problem:
          failure.kind === 'offline'
            ? problem('offline', { during: 'end' })
            : problem('end-failed', { nothingToReview: failure.kind === 'nothing-to-review' }),
      };
    }

    case 'speech-start':
      return phase === 'listening' && !state.speechDetected
        ? { ...state, speechDetected: true, heard: true, hint: null }
        : state;

    case 'speech-end': {
      if (phase !== 'listening' || state.exchange) return state;
      // `silentRetries` is not reset here: speech that turns out to hold no words must count
      // towards the limit, or a recogniser that never produces words would be retried for ever.
      // Only words (`transcribe-done`) or the trainee's own action reset it.
      return withoutProblems(
        {
          ...state,
          phase: 'transcribing',
          speechDetected: false,
          heard: false,
          finishing: false,
          hint: event.reason === 'limit' ? { code: 'long-turn' } : null,
          exchange: {
            id: event.id,
            text: '',
            inputMode: 'voice',
            createdAt: event.createdAt,
            status: 'transcribing',
            attempt: 0,
            saved: false,
            index: null,
          },
        },
        TRANSCRIPTION_PROBLEMS,
        'transcribe',
      );
    }

    case 'speech-dropped': {
      if (phase !== 'listening') return state;
      if (state.finishing) return step(state, { type: 'nothing-heard' });
      return state.speechDetected ? { ...state, speechDetected: false } : state;
    }

    case 'nothing-heard':
      return phase === 'listening'
        ? yourTurn({
            ...state,
            silentRetries: state.silentRetries + 1,
            hint: { code: 'nothing-heard' },
          })
        : state;

    case 'transcribe-done': {
      const exchange = state.exchange;
      if (phase !== 'transcribing' || !exchange) return state;
      if (exchange.id !== event.id || exchange.status !== 'transcribing') return state;
      const text = event.text.replace(/\s+/g, ' ').trim();
      if (!text) return step(state, { type: 'transcribe-empty', id: event.id });
      return withoutProblems(
        {
          ...state,
          phase: 'processing',
          hint: null,
          silentRetries: 0,
          exchange: { ...exchange, text, status: 'sending', attempt: 1 },
        },
        TRANSCRIPTION_PROBLEMS,
        'transcribe',
      );
    }

    case 'transcribe-empty': {
      const exchange = state.exchange;
      if (phase !== 'transcribing' || exchange?.id !== event.id) return state;
      if (exchange.status !== 'transcribing') return state;
      // The microphone picked up speech, but the recogniser found no words in it (the speech
      // service's `no-speech`, or a browser that ended without a result). Never an empty message.
      return yourTurn({
        ...state,
        exchange: null,
        silentRetries: state.silentRetries + 1,
        hint: { code: 'no-words' },
      });
    }

    case 'transcribe-failed': {
      const exchange = state.exchange;
      const inExchange = phase === 'transcribing' && exchange?.id === event.id && event.id !== null;
      const inPass = phase === 'listening' && event.id === null;
      if (!inExchange && !inPass) return state;
      if (inExchange && exchange?.status !== 'transcribing') return state;
      const failure = event.failure;
      if (failure.kind === 'microphone') return micLost(state, failure.reason);
      const cleared: MachineState = {
        ...state,
        exchange: inExchange ? null : state.exchange,
        hint: null,
      };
      switch (failure.kind) {
        case 'offline':
          return yourTurn({ ...cleared, problem: problem('offline', { during: 'transcribe' }) });
        case 'service-unavailable':
          return yourTurn({ ...cleared, problem: problem('speech-service-unavailable') });
        case 'rate-limited':
          return yourTurn({
            ...cleared,
            problem: problem('rate-limited', {
              during: 'transcribe',
              ...(failure.retryAfterSeconds === undefined
                ? {}
                : { retryAfterSeconds: failure.retryAfterSeconds }),
            }),
          });
        case 'failed':
          return yourTurn({ ...cleared, problem: problem('transcription-failed') });
      }
      return state;
    }

    case 'send-done': {
      const exchange = state.exchange;
      if (!exchange || exchange.id !== event.id || exchange.status !== 'sending') return state;
      if (exchange.attempt !== event.attempt) return state;
      const draining = phase === 'ending' && state.ending === 'draining';
      if (phase !== 'processing' && !draining) return state;
      const limitReached = event.turnsRemaining !== null && event.turnsRemaining <= 0;
      let next: MachineState = withoutProblems(
        {
          ...state,
          exchange: null,
          lastCustomerIndex: event.customerIndex,
          silentRetries: 0,
          limitReached,
          hint: event.redactions.length > 0 ? { code: 'redacted', kinds: event.redactions } : null,
        },
        REPLY_PROBLEMS,
        'send',
      );
      if (limitReached) next = { ...next, problem: problem('turn-limit') };
      if (draining) return { ...next, ending: 'closing' };
      if (next.voice && next.canSpeak) {
        return next.paused
          ? yourTurn({ ...next, pendingSpeech: event.customerIndex })
          : startSpeech(next, event.customerIndex, 'customer-speaking');
      }
      return yourTurn(next);
    }

    case 'send-failed': {
      const exchange = state.exchange;
      if (!exchange || exchange.id !== event.id || exchange.status !== 'sending') return state;
      if (exchange.attempt !== event.attempt) return state;
      const draining = phase === 'ending' && state.ending === 'draining';
      if (phase !== 'processing' && !draining) return state;
      const failure = event.failure;
      let next: MachineState;
      switch (failure.kind) {
        case 'validation':
          next = { ...state, exchange: null, hint: { code: 'rejected' } };
          break;
        case 'turn-limit':
          next = { ...state, exchange: null, limitReached: true, problem: problem('turn-limit') };
          break;
        case 'session-ended':
          next = {
            ...state,
            exchange: null,
            sessionEnded: true,
            problem: problem('session-ended'),
          };
          break;
        default: {
          const kept: Exchange = {
            ...exchange,
            status: 'failed',
            saved: exchange.saved || failure.saved,
          };
          const cause: ProblemState =
            failure.kind === 'conflict' || failure.kind === 'provider'
              ? problem('reply-failed', { saved: kept.saved })
              : failure.kind === 'offline'
                ? problem('offline', { during: 'send' })
                : failure.kind === 'rate-limited'
                  ? problem('rate-limited', {
                      during: 'send',
                      ...(failure.retryAfterSeconds === undefined
                        ? {}
                        : { retryAfterSeconds: failure.retryAfterSeconds }),
                    })
                  : problem('save-failed');
          next = { ...state, exchange: kept, problem: cause, hint: null };
        }
      }
      return draining ? { ...next, ending: 'closing' } : yourTurn(next);
    }

    case 'speak-start': {
      const speech = state.speech;
      if (!speech || speech.token !== event.token || speech.status !== 'preparing') return state;
      if (phase !== 'ready' && phase !== 'customer-speaking') return state;
      return withoutProblems(
        {
          ...state,
          phase: 'customer-speaking',
          speech: { ...speech, status: 'playing', estimateMs: Math.max(0, event.estimateMs) },
        },
        VOICE_PROBLEMS,
      );
    }

    case 'speak-duration': {
      const speech = state.speech;
      if (!speech || speech.token !== event.token || speech.status !== 'playing') return state;
      return { ...state, speech: { ...speech, estimateMs: Math.max(0, event.ms) } };
    }

    case 'speak-end': {
      const speech = state.speech;
      if (!speech || speech.token !== event.token) return state;
      return yourTurn(withoutInterrupted({ ...state, pendingSpeech: null }, speech.turnIndex));
    }

    case 'speak-failed': {
      const speech = state.speech;
      if (!speech || speech.token !== event.token) return state;
      const base: MachineState = { ...state, pendingSpeech: null };
      if (event.reason === 'unavailable') {
        return yourTurn({ ...base, canSpeak: false, hint: { code: 'captions-only' } });
      }
      return yourTurn({
        ...base,
        problem: problem(
          event.reason === 'generation' ? 'voice-generation-failed' : 'playback-failed',
        ),
      });
    }

    case 'speak-blocked': {
      const speech = state.speech;
      if (!speech || speech.token !== event.token) return state;
      return yourTurn({
        ...state,
        pendingSpeech: speech.turnIndex,
        problem: problem('playback-blocked'),
      });
    }

    case 'timeout':
      return onTimeout(state, event.id);
  }
}

function onTimeout(state: MachineState, id: number): MachineState {
  const timer = state.timer;
  if (!timer || timer.id !== id) return state;
  switch (timer.kind) {
    case 'permission':
      return {
        ...state,
        phase: 'idle',
        begun: false,
        voice: false,
        micHeld: false,
        microphone: 'unavailable',
        pendingSpeech: null,
        problem: problem('microphone-busy', { beforeCall: true, timedOut: true }),
      };
    case 'ready':
      return yourTurn({ ...state, pendingSpeech: null });
    case 'speak-prepare':
      return yourTurn({
        ...state,
        pendingSpeech: null,
        problem: problem('voice-generation-failed'),
      });
    case 'speak-play':
      // A voice that never reports its end: hand the turn to the trainee.
      return yourTurn({ ...state, pendingSpeech: null });
    case 'listen-idle':
    case 'finish':
      return step({ ...state, finishing: false }, { type: 'nothing-heard' });
    case 'listen-speech':
      return { ...state, finishing: true };
    case 'transcribe':
      if (state.exchange?.status !== 'transcribing') return state;
      return yourTurn({
        ...state,
        exchange: null,
        hint: null,
        problem: problem('transcription-failed', { timedOut: true }),
      });
    case 'reply': {
      const exchange = state.exchange;
      if (exchange?.status !== 'sending') return state;
      return yourTurn({
        ...state,
        exchange: { ...exchange, status: 'failed' },
        problem: problem('reply-timeout'),
      });
    }
    case 'settle':
      return autoListens(state)
        ? {
            ...state,
            phase: 'listening',
            speechDetected: false,
            heard: false,
            finishing: false,
          }
        : state;
    case 'drain': {
      const exchange = state.exchange;
      return {
        ...state,
        ending: 'closing',
        exchange: exchange?.status === 'sending' ? { ...exchange, status: 'failed' } : exchange,
      };
    }
    case 'end':
      return step(state, { type: 'end-failed', failure: { kind: 'failed' } });
  }
}

// ---------------------------------------------------------------------------------------
// Timers

/** The one timer a state needs, or null. Waiting phases always have one. */
export function timerFor(state: MachineState): { kind: TimerKind; ms: number } | null {
  switch (state.phase) {
    case 'idle':
    case 'completed':
      return null;
    case 'requesting-microphone':
      return { kind: 'permission', ms: TIMINGS.permission };
    case 'ready':
    case 'customer-speaking':
      if (state.speech?.status === 'preparing') {
        return { kind: 'speak-prepare', ms: TIMINGS.speakPrepare };
      }
      if (state.speech?.status === 'playing') {
        return {
          kind: 'speak-play',
          ms: Math.round(state.speech.estimateMs) + TIMINGS.speakGrace,
        };
      }
      return state.phase === 'ready' ? { kind: 'ready', ms: TIMINGS.ready } : null;
    case 'listening':
      if (state.finishing) return { kind: 'finish', ms: TIMINGS.finish };
      return state.speechDetected
        ? { kind: 'listen-speech', ms: TIMINGS.listenSpeech }
        : { kind: 'listen-idle', ms: TIMINGS.listenIdle };
    case 'transcribing':
      return { kind: 'transcribe', ms: TIMINGS.transcribe };
    case 'processing':
      return { kind: 'reply', ms: TIMINGS.reply };
    case 'ready-for-next-turn':
      return autoListens(state) ? { kind: 'settle', ms: TIMINGS.settle } : null;
    case 'ending':
      return state.ending === 'draining'
        ? { kind: 'drain', ms: TIMINGS.drain }
        : { kind: 'end', ms: TIMINGS.end };
  }
}

function withTimer(previous: MachineState, next: MachineState): MachineState {
  const wanted = timerFor(next);
  const current = next.timer;
  if (!wanted) return current ? { ...next, timer: null } : next;
  if (current && current.kind === wanted.kind && current.ms === wanted.ms) return next;
  const id = Math.max(next.timerSeq, previous.timerSeq) + 1;
  return { ...next, timerSeq: id, timer: { id, kind: wanted.kind, ms: wanted.ms } };
}

/** The next state. Never throws; returns `state` itself when the event does nothing. */
export function reduce(state: MachineState, event: MachineEvent): MachineState {
  const next = step(state, event);
  return next === state ? state : withTimer(state, next);
}

// ---------------------------------------------------------------------------------------
// What the world should look like

export interface Targets {
  /** Hold the microphone stream. */
  microphone: boolean;
  /** The microphone track is enabled (false while muted). */
  trackEnabled: boolean;
  /** `listen`: record an utterance. `finish`: stop recording but let a pending result arrive. */
  capture: 'off' | 'listen' | 'finish';
  /** The customer's voice that should be playing, if any. */
  playback: { token: number; turnIndex: number } | null;
  /** The id of the utterance whose speech is being turned into text. */
  transcribe: string | null;
  /** The message that should be being sent. */
  send: { id: string; attempt: number } | null;
  /** The call should be being closed on the server. */
  end: boolean;
  timer: Timer | null;
}

export function targets(state: MachineState): Targets {
  const live = state.begun && state.phase !== 'ending' && state.phase !== 'completed';
  const exchange = state.exchange;
  const draining = state.phase === 'ending' && state.ending === 'draining';
  // The microphone only records in `listening` (and finishes a recording in `transcribing`), never
  // while the customer speaks, so it cannot hear the customer's own voice. Speaking over the
  // customer (barge-in by voice) is NOT implemented: echo cancellation cannot be relied on (it does
  // not cover the browser's own speech synthesis or its recogniser). The trainee takes the turn
  // with `interrupt()` or by pressing Talk instead.
  const recording =
    state.phase === 'listening'
      ? state.finishing
        ? 'finish'
        : 'listen'
      : state.phase === 'transcribing' &&
          exchange?.status === 'transcribing' &&
          exchange.inputMode === 'voice'
        ? 'finish'
        : 'off';
  return {
    microphone: live && state.voice && !state.paused && state.phase !== 'idle',
    trackEnabled: !state.muted,
    capture: recording,
    playback: state.speech
      ? { token: state.speech.token, turnIndex: state.speech.turnIndex }
      : null,
    transcribe:
      state.phase === 'transcribing' && exchange?.status === 'transcribing' ? exchange.id : null,
    send:
      exchange?.status === 'sending' && (state.phase === 'processing' || draining)
        ? { id: exchange.id, attempt: exchange.attempt }
        : null,
    end: state.phase === 'ending' && state.ending === 'closing',
    timer: state.timer,
  };
}

// ---------------------------------------------------------------------------------------
// Questions the engine asks before it acts

export type SendCheck = 'ok' | 'not-started' | 'busy' | 'retry-first' | 'limit' | 'ended';

/** Whether a typed message would be accepted right now, and if not, why. */
export function checkSend(state: MachineState): SendCheck {
  if (state.sessionEnded) return 'ended';
  if (!state.begun) return 'not-started';
  if (state.limitReached) return 'limit';
  if (state.exchange?.status === 'failed') return 'retry-first';
  if (state.exchange) return 'busy';
  switch (state.phase) {
    case 'ready':
    case 'listening':
    case 'customer-speaking':
    case 'ready-for-next-turn':
      return 'ok';
    default:
      return 'busy';
  }
}

export function isCurrentSend(state: MachineState, id: string, attempt: number): boolean {
  const exchange = state.exchange;
  return (
    exchange?.id === id &&
    exchange.status === 'sending' &&
    exchange.attempt === attempt &&
    (state.phase === 'processing' || (state.phase === 'ending' && state.ending === 'draining'))
  );
}

export function isCurrentTranscription(state: MachineState, id: string): boolean {
  return (
    state.phase === 'transcribing' &&
    state.exchange?.id === id &&
    state.exchange.status === 'transcribing'
  );
}

/** The phases in which something is being waited for, and so a timer must be running. */
export const WAITING_PHASES: readonly CallPhase[] = [
  'requesting-microphone',
  'ready',
  'listening',
  'transcribing',
  'processing',
  'customer-speaking',
  'ending',
];
