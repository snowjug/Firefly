import type { PublicStateDTO, SessionDTO } from '#shared/domain/api.ts';
import type { InputMode, SpeechCapabilitiesDTO, SpeechLanguage } from '#shared/domain/speech.ts';
import type { TemperatureBandId } from '#shared/domain/vocab.ts';

// The contract between the call engine (`useCall`, the turn machine and the audio adapters) and the
// call screen. The screen only ever reads a `CallSnapshot` and calls `CallActions`: it never touches
// the microphone, audio elements or the speech APIs itself. Additive changes are fine; a change to a
// name or a meaning needs the screen and the tests updated in the same commit.

/**
 * Where the call is. Exactly one phase at a time, and every phase has a way out (a watchdog moves a
 * phase that stops making progress to a recoverable state with a visible reason).
 */
export const CALL_PHASES = [
  /** Pre-flight. Nothing has started and the microphone has not been asked for. */
  'idle',
  /** The browser's permission prompt is open. */
  'requesting-microphone',
  /** Microphone granted and audio primed; the customer's opening line is about to play. */
  'ready',
  /** The microphone is open: waiting for the trainee, or hearing them (see `speechDetected`). */
  'listening',
  /** The trainee stopped speaking; their speech is being turned into text. */
  'transcribing',
  /** The text was sent; the customer's reply is being produced. */
  'processing',
  /** The customer's synthetic voice is playing (their words are already in the transcript). */
  'customer-speaking',
  /** The customer finished. It is the trainee's turn, but the microphone is not open yet. */
  'ready-for-next-turn',
  /** End and review was confirmed: capture stopped, audio stopped, the call is being closed. */
  'ending',
  /** The call is closed on the server. The screen moves on to the report. */
  'completed',
] as const;
export type CallPhase = (typeof CALL_PHASES)[number];

/** A problem the trainee can see. Every one says what happened, what was kept and what to do. */
export type CallProblemCode =
  | 'microphone-denied'
  | 'microphone-missing'
  | 'microphone-busy'
  | 'microphone-unsupported'
  | 'transcription-failed'
  | 'speech-service-unavailable'
  | 'reply-failed'
  | 'reply-timeout'
  | 'voice-generation-failed'
  | 'playback-blocked'
  | 'playback-failed'
  | 'offline'
  | 'session-unavailable'
  | 'session-ended'
  | 'save-failed'
  | 'turn-limit'
  | 'rate-limited'
  | 'end-failed';

export interface CallProblem {
  code: CallProblemCode;
  /** One short sentence saying what happened. Never a raw provider message or a stack trace. */
  title: string;
  /** What was kept, for example "Your transcript so far is saved." */
  preserved: string;
  /** What the trainee can do next, for example "Allow the microphone in the address bar, then try again." */
  advice: string;
  /** What "Try again" does, or null when retrying cannot help. */
  retry: 'microphone' | 'transcribe' | 'send' | 'speak' | 'load' | 'end' | null;
  /** Typing a reply still works, so the call can continue without the voice feature that failed. */
  textFallback: boolean;
  /** `blocking` stops the call until handled; `degraded` leaves the call usable. */
  severity: 'blocking' | 'degraded';
}

/** What this browser and this server can do for a spoken call right now. */
export interface CallSupport {
  /** Who turns the trainee's speech into text. */
  capture: 'server-speech' | 'browser-recognition' | 'none';
  /** Who speaks the customer's replies. */
  playback: 'server-speech' | 'browser-synthesis' | 'none';
  secureContext: boolean;
  /** One plain sentence saying why a voice call is not available, or null when it is. */
  reason: string | null;
  /** Shown beside the call controls, for example "Azure AI Speech" or "Browser speech recognition (online)". */
  captureLabel: string;
  playbackLabel: string;
  /**
   * The server's speech provider in use is the scripted demonstration: it does not understand audio
   * (it answers with the next scripted sentence) and its "voice" is a placeholder sound. Absent or
   * false for browser speech and for every real provider.
   */
  speechDemo?: boolean;
}

export type MicrophoneState = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unavailable';

/** One line of the transcript as the call screen shows it. */
export interface CallTurn {
  /** Stable for the life of the turn, including while it is still being sent. */
  key: string;
  /** The server's position in the conversation (1-based), or null until it has been stored. */
  index: number | null;
  role: 'customer' | 'trainee';
  text: string;
  inputMode: InputMode;
  createdAt: string;
  /** Customer turns are always `sent`. A `failed` trainee turn can be retried and is never lost. */
  status: 'transcribing' | 'sending' | 'sent' | 'failed';
  clientMessageId: string | null;
  /** The trainee stopped the customer's voice before it finished. The text above is still complete. */
  interrupted: boolean;
}

export interface CallStatePoint {
  turnIndex: number;
  band: TemperatureBandId;
  label: string;
}

export interface CallSnapshot {
  loading: boolean;
  /** Set when the session could not be loaded at all (the screen shows an error page). */
  loadProblem: CallProblem | null;
  session: SessionDTO | null;

  phase: CallPhase;
  /** How this call is being held: spoken, or typed only. */
  mode: InputMode;
  microphone: MicrophoneState;
  muted: boolean;
  paused: boolean;
  /** Hands-free: the microphone reopens by itself after each customer reply. Otherwise push to talk. */
  handsFree: boolean;
  /** True while the trainee is speaking (voice activity), for the "speech detected" indicator. */
  speechDetected: boolean;
  /** Microphone level, 0 to 1, at most about 15 updates a second; 0 whenever the microphone is closed. */
  micLevel: number;
  /** The customer's voice level, 0 to 1, while it plays. Shaped from the text when the engine cannot measure it. */
  customerLevel: number;
  /** The trainee's words so far, while they are still speaking. Empty where the engine has none. */
  interim: string;

  turns: CallTurn[];
  /** The customer's public state after the latest turn. Mood is always shown; facts and shifts are guided practice only. */
  customerState: PublicStateDTO | null;
  /** The customer's mood after every exchange, for the small temperature trace. */
  stateHistory: CallStatePoint[];

  problem: CallProblem | null;
  /** Soft guidance that is not an error, such as "Nothing was heard." */
  hint: string | null;
  /** Seconds since the call started, counted from the server's start time. */
  elapsedSeconds: number;
  turnsRemaining: number | null;

  support: CallSupport;
  voiceDetails: {
    /** The voice name that spoke the latest customer turn (from the server's response headers), if any. */
    voice: string | null;
    /** The expressive style that was really applied ("none" when mood was approximated by rate and pitch). */
    style: string | null;
    language: SpeechLanguage;
  };

  /**
   * The latest thing a screen reader should hear, as whole sentences, one at a time: a new customer
   * reply, a change of phase, a problem. Never character by character. Changes identity per message.
   */
  announcement: { id: number; text: string } | null;
}

export interface CallActions {
  /**
   * Starts the call from a click or tap. With `voice: true` it asks for the microphone, primes audio
   * (so the customer's voice may play) and then speaks the opening line. With `voice: false` it starts
   * a typed call and never touches the microphone.
   */
  begin(options: { voice: boolean }): Promise<void>;
  /** Push to talk: opens the microphone for one utterance, or stops listening if it is already open. */
  talk(): void;
  /** Finishes the current utterance now instead of waiting for silence. */
  stopTalking(): void;
  toggleMute(): void;
  /** Pauses the whole voice loop (no listening, customer voice stopped) until resumed. */
  togglePause(): void;
  setHandsFree(on: boolean): void;
  setLanguage(language: SpeechLanguage): void;
  /** Stops the customer's voice and gives the turn to the trainee. The transcript is unchanged. */
  interrupt(): void;
  /** Speaks the latest customer turn again. */
  replay(): void;
  /** The typed fallback. Resolves false if the message was not accepted (empty, too long, busy). */
  sendText(text: string): Promise<boolean>;
  /** Repeats whatever failed (see `CallProblem.retry`). */
  retry(): void;
  /** Clears a degraded problem the trainee has read. */
  dismissProblem(): void;
  /**
   * End and review: stops capture, stops customer audio, lets an exchange in flight finish or fail
   * safely, closes the call on the server and resolves with the session id to open the report for.
   * Calling it again while it runs returns the same promise. Safe at any phase.
   */
  endCall(): Promise<{ sessionId: string } | null>;
}

export interface UseCallOptions {
  /** The server's speech capabilities from /api/config. */
  serverSpeech: SpeechCapabilitiesDTO;
  /** Where the trainee's browser language suggests; the trainee can change it. */
  language?: SpeechLanguage;
  /**
   * The most trainee messages a call allows (`limits.maxTraineeTurns` from /api/config). With it,
   * `turnsRemaining` is known as soon as the call loads; without it, after the first reply.
   */
  maxTraineeTurns?: number | null;
}
