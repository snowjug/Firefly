// The shapes shared by the two ways of capturing the trainee's speech (the server's speech service
// and the browser's own recognition). The call engine only ever talks to these.

/** Why a microphone could not be used. */
export type MicrophoneFailure = 'denied' | 'missing' | 'busy' | 'unsupported';

export class MicrophoneError extends Error {
  readonly reason: MicrophoneFailure;
  constructor(reason: MicrophoneFailure, message = `Microphone unavailable: ${reason}.`) {
    super(message);
    this.name = 'MicrophoneError';
    this.reason = reason;
  }
}

export type CaptureFailure =
  | { kind: 'microphone'; reason: MicrophoneFailure }
  | { kind: 'service'; reason: 'network' | 'language' | 'unknown' };

export type SpeechEndReason = 'silence' | 'limit' | 'stopped';

/**
 * What one listening pass tells the call engine. The order is always: speech starts, speech ends,
 * then either the audio (server speech) or the text (browser recognition). A pass that hears nothing
 * usable ends with `onNothing`; one that cannot continue ends with `onFailure`. After either of
 * those, or after `cancel`, nothing more is reported.
 */
export interface CaptureHandlers {
  onSpeechStart(): void;
  /** The trainee stopped speaking; what they said is being turned into text. */
  onSpeechEnd(info: { reason: SpeechEndReason }): void;
  /** A burst too short or too quiet to be speech was ignored; listening carries on. */
  onSpeechDropped(): void;
  /** The words so far, while the trainee is still speaking (browser recognition only). */
  onInterim(text: string): void;
  /** Server speech: the finished utterance as a 16 kHz mono WAV. Held in memory only. */
  onAudio(audio: Blob, info: { durationMs: number }): void;
  /** Browser recognition: the recognised text. */
  onText(text: string): void;
  onNothing(): void;
  onFailure(failure: CaptureFailure): void;
}

export interface CaptureSession {
  /** Ends the utterance now instead of waiting for silence. */
  finish(): void;
  /** Stops listening and throws away anything heard. Nothing is reported afterwards. */
  cancel(): void;
}

export type CaptureEngine = 'server-speech' | 'browser-recognition';

export interface Capture {
  readonly engine: CaptureEngine;
  /** Called from a click or tap: gets ready for anything that needs a gesture. */
  prepare(): void;
  /** Starts one listening pass. Only one pass is ever open at a time. */
  listen(handlers: CaptureHandlers): CaptureSession;
  /** Cancels any pass and lets go of everything. */
  dispose(): void;
}
