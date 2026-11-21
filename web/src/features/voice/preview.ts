import type { SpeechLanguage } from '#shared/domain/speech.ts';
import { VOICE_PREVIEW_TEXT, type VoiceId } from '#shared/domain/voices.ts';
import { apiError, playbackError, voiceError, type VoiceError } from './errors.ts';
import { createBrowserPlayback } from './playback/browser-playback.ts';
import { createServerPlayback } from './playback/server-playback.ts';
import type { Playback, PlaybackJob, PlaybackStop } from './playback/types.ts';
import { fetchVoicePreview, type SpokenAudio } from './speech-client.ts';
import type { PlaybackKind } from './support.ts';

// "Test voice": one short, fixed, neutral sentence in the voice the trainee is thinking of choosing.
// It is one request to the server (or one phrase spoken by the browser's own voice), it never
// blocks anything else (it returns at once and reports through handlers), a second press stops the
// first, and every failure becomes a plain `VoiceError` for the screen to show beside the button.
// It must not be used while a call's customer is speaking: it is for the set-up screen, before a call.

export const PREVIEW_TIMEOUT_MS = 8000;

export interface VoicePreviewHandlers {
  /** The sentence is audible. */
  onStart?(): void;
  /** The sentence finished. */
  onEnd?(): void;
  /** The preview could not play. The call is not affected. */
  onFailure?(error: VoiceError): void;
}

export interface VoicePreview {
  /** Plays the preview sentence. Starting another stops the one before. Returns at once. */
  play(voice: VoiceId, language: SpeechLanguage, handlers?: VoicePreviewHandlers): PlaybackJob;
  /** Stops any preview and lets go of the audio element, the blob URL and the speaking voice. */
  dispose(): void;
}

export interface VoicePreviewOptions {
  /** Who speaks it: the server's speech service, the browser's own voices, or nobody. */
  engine: PlaybackKind;
  /** Fetches the audio from the server. Defaults to the real endpoint; tests pass a fake. */
  fetchPreview?: (
    voice: VoiceId,
    language: SpeechLanguage,
    signal?: AbortSignal,
  ) => Promise<SpokenAudio>;
  /** How long to wait for the audio before giving up (default 8 s). */
  timeoutMs?: number;
}

const NOT_PLAYING: PlaybackStop = { interrupted: false, playedMs: 0 };

export function createVoicePreview(options: VoicePreviewOptions): VoicePreview {
  const fetchPreview = options.fetchPreview ?? fetchVoicePreview;
  // The last failure of the request itself, so "could not make the voice" can say whether the
  // network, a time-out or the service was to blame (the player only knows it was not made).
  let lastFetchError: unknown = null;

  let playback: Playback | null = null;
  let job: PlaybackJob | null = null;

  const player = (): Playback | null => {
    if (playback) return playback;
    if (options.engine === 'server-speech') {
      playback = createServerPlayback({
        generationTimeoutMs: options.timeoutMs ?? PREVIEW_TIMEOUT_MS,
        speakTurn: async (_sessionId, _turn, language, signal, speakOptions) => {
          try {
            return await fetchPreview(speakOptions?.voice ?? 'voice-a', language, signal);
          } catch (error) {
            lastFetchError = error;
            throw error;
          }
        },
      });
    } else if (options.engine === 'browser-synthesis') {
      playback = createBrowserPlayback();
    }
    return playback;
  };

  return {
    play(voice, language, handlers = {}) {
      job?.stop();
      job = null;
      lastFetchError = null;
      const fail = (error: VoiceError) => handlers.onFailure?.(error);
      const engine = player();
      if (!engine) {
        queueMicrotask(() => fail(voiceError('preview-unavailable')));
        return { stop: () => NOT_PLAYING };
      }
      // Inside the click: lets the browser play sound a moment later, when the audio has arrived.
      engine.prime();
      const started = engine.play(
        {
          sessionId: 'voice-preview',
          turnIndex: 0,
          text: VOICE_PREVIEW_TEXT,
          language,
          mood: 'calm',
          voiceSeed: voice,
          voice,
        },
        {
          onStart: () => handlers.onStart?.(),
          onDuration: () => undefined,
          onLevel: () => undefined,
          onDetails: () => undefined,
          onEnd: () => handlers.onEnd?.(),
          onBlocked: () => fail(playbackError('blocked')),
          onFailure: (kind) => {
            // A voice that could not be made says why when the request knows; the preview has its
            // own plain sentence, with Retry and "Continue" (start the call anyway) to offer.
            const cause =
              kind === 'generation' && lastFetchError !== null
                ? apiError(lastFetchError, 'voice')
                : playbackError(kind);
            fail(
              cause.code === 'voice-failed' || cause.code === 'playback-failed'
                ? voiceError('preview-unavailable')
                : cause,
            );
          },
        },
      );
      job = started;
      return started;
    },
    dispose() {
      job?.stop();
      job = null;
      playback?.dispose();
      playback = null;
    },
  };
}
