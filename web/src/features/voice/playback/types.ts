import type { SpeechLanguage } from '#shared/domain/speech.ts';
import type { TemperatureBandId } from '#shared/domain/vocab.ts';

// The shapes shared by the two ways of speaking the customer's replies (the server's speech service
// and the browser's own voices). The call engine only ever talks to these.

export type PlaybackEngine = 'server-speech' | 'browser-synthesis';

export interface PlayRequest {
  sessionId: string;
  /** The stored customer turn to speak. The server reads its text itself; the browser speaks `text`. */
  turnIndex: number;
  text: string;
  language: SpeechLanguage;
  mood: TemperatureBandId;
  /** Anything stable for one customer (such as the persona's name): it keeps their voice the same. */
  voiceSeed: string;
}

export interface VoiceDetails {
  /** The voice that really spoke, or null when the browser did not say. */
  voice: string | null;
  /** The expressive style that was really applied, `none` when mood was only approximated. */
  style: string | null;
  /** True when the voice runs on this device, false when it is online, null when unknown. */
  local: boolean | null;
  /** The language tag of the voice that spoke (a browser voice can differ from the language asked for), or null when unknown. */
  lang: string | null;
}

/**
 * What one spoken reply tells the call engine. The order is: details (when known), start, then end.
 * A reply that cannot play ends with `onBlocked` or `onFailure` instead. After `stop`, or after any
 * of those, nothing more is reported.
 */
export interface PlaybackHandlers {
  /** The voice is audible now. `estimateMs` is the best guess at how long it will take. */
  onStart(info: { estimateMs: number }): void;
  /** The real length is known (server audio only). */
  onDuration(ms: number): void;
  onEnd(): void;
  /** The browser refused to play sound before the trainee interacted with the page. */
  onBlocked(): void;
  /** `generation`: the voice could not be made. `playback`: it was made but could not be played. */
  onFailure(kind: 'generation' | 'playback'): void;
  /** The customer's voice level, 0 to 1, about 15 times a second while it plays. */
  onLevel(level: number): void;
  onDetails(details: VoiceDetails): void;
}

export interface PlaybackJob {
  /** Stops the voice at once. Nothing is reported afterwards. */
  stop(): void;
}

export interface Playback {
  readonly engine: PlaybackEngine;
  /** Called from a click or tap: lets sound play later without another gesture. */
  prime(): void;
  /** Speaks one reply. Only one reply is ever speaking: starting another stops the first. */
  play(request: PlayRequest, handlers: PlaybackHandlers): PlaybackJob;
  /** Stops any voice and lets go of everything. */
  dispose(): void;
}
