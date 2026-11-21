import { useCallback, useEffect, useRef, useState } from 'react';
import type { SpeechLanguage } from '#shared/domain/speech.ts';
import type { VoiceId } from '#shared/domain/voices.ts';
import type { VoiceError } from '../voice/errors.ts';
import type { PlaybackJob } from '../voice/playback/types.ts';
import { createVoicePreview, type VoicePreview } from '../voice/preview.ts';
import type { PlaybackKind } from '../voice/support.ts';

export type PreviewState = 'idle' | 'playing' | 'failed';

export type PreviewSupport = { available: true } | { available: false; reason: string };

/** What is said beside the button when a sample could not play. The choice itself is never lost. */
export function previewFailureText(error: VoiceError): string {
  return `${error.message} Your choice is kept. You can test again or start the call.`;
}

/**
 * "Test voice": one short, fixed sentence in the chosen voice, spoken the way the call will speak
 * the customer (by the speech service, or by the browser's own voices). It can be stopped, never
 * overlaps itself, and stops when the page is left. `playback` is how this setup will speak the
 * customer (null while that is not known yet).
 */
export function useVoicePreview(playback: PlaybackKind | null, language: SpeechLanguage) {
  const [state, setState] = useState<PreviewState>('idle');
  const [error, setError] = useState<VoiceError | null>(null);
  const engine = useRef<{ kind: PlaybackKind; preview: VoicePreview } | null>(null);
  const job = useRef<PlaybackJob | null>(null);

  const stop = useCallback(() => {
    job.current?.stop();
    job.current = null;
    setState('idle');
  }, []);

  const play = useCallback(
    (voice: VoiceId) => {
      if (playback === null) return;
      let current = engine.current;
      if (current?.kind !== playback) {
        current?.preview.dispose();
        current = { kind: playback, preview: createVoicePreview({ engine: playback }) };
        engine.current = current;
      }
      setError(null);
      setState('playing');
      job.current = current.preview.play(voice, language, {
        onStart: () => setState('playing'),
        onEnd: () => {
          job.current = null;
          setState('idle');
        },
        onFailure: (failure) => {
          job.current = null;
          setError(failure);
          setState('failed');
        },
      });
    },
    [playback, language],
  );

  useEffect(
    () => () => {
      job.current?.stop();
      engine.current?.preview.dispose();
      engine.current = null;
    },
    [],
  );

  const support: PreviewSupport =
    playback === null
      ? { available: false, reason: 'Checking what this browser can play.' }
      : { available: true };
  return { state, error, play, stop, support };
}
