import type { SpeechLanguage } from '#shared/domain/speech.ts';
import type { VoiceId } from '#shared/domain/voices.ts';
import type { TemperatureBandId } from '#shared/domain/vocab.ts';

// The shapes shared by the two ways of speaking the customer's replies (the server's speech service
// and the browser's own voices). The call engine only ever talks to these.
//
// Turn-taking is controlled: the customer speaks, the trainee can stop the customer at any time
// ("Stop customer audio"), and the trainee speaks after the customer has finished or been stopped. Firefly
// does not let the trainee talk over the customer and have the voice stop by itself ("barge-in"):
// a microphone cannot tell the customer's own voice, coming back out of the speakers, from the
// trainee's, and a voice that stops on its own echo is worse than one that waits. See ../turn-taking.ts.

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
  /**
   * The voice the trainee chose (`voice-a` to `voice-d`). The server speaks with the provider voice
   * behind it; the browser uses the best local voice it has. Left out, the old pairing by `voiceSeed`
   * is used, so a call saved before voices could be chosen sounds as it always did.
   */
  voice?: VoiceId;
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
 *
 * `onStart` is "customer speaking"; `onLevel` is the meter that shows it; `onEnd` hands the turn to
 * the trainee; `onFailure('generation')` is a voice that could not be made and `onFailure('playback')`
 * one that could not be played; `onBlocked` is a browser that wants a tap first.
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
  /**
   * The customer's voice level, 0 to 1, about 15 times a second while it plays. `measured` is true
   * when the level was read from the sound that is playing, and false (or left out) when it was
   * shaped from the words because the page cannot measure that voice, as with a browser voice.
   */
  onLevel(level: number, measured?: boolean): void;
  onDetails(details: VoiceDetails): void;
}

/**
 * What stopping a reply says, so the call can record that the customer was cut off. The words of the
 * reply are already in the transcript in full, whatever was heard of them.
 */
export interface PlaybackStop {
  /** The voice was audible when it was stopped: the trainee cut the customer off. */
  interrupted: boolean;
  /** How much of the voice had played, in milliseconds. 0 when it had not started. */
  playedMs: number;
}

export interface PlaybackJob {
  /** Stops the voice at once. Nothing is reported afterwards. Safe to call again. */
  stop(): PlaybackStop;
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
