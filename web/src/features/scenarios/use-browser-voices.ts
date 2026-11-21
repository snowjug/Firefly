import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { SpeechLanguage } from '#shared/domain/speech.ts';
import { describeBrowserVoices } from '../voice/playback/voices.ts';
import { getSynthesis } from '../voice/support.ts';

/** Browsers list their voices a moment after the page opens: with none listed by then, there are none. */
export const VOICE_LIST_GRACE_MS = 1500;

function subscribe(notify: () => void): () => void {
  const synthesis = getSynthesis();
  synthesis?.addEventListener('voiceschanged', notify);
  return () => synthesis?.removeEventListener('voiceschanged', notify);
}

// `getVoices()` hands back a new array every time, which the store would take for a change every
// time, so the list is kept for as long as what it says stays the same.
let last: { key: string; voices: readonly SpeechSynthesisVoice[] } = { key: '', voices: [] };

function listedVoices(): readonly SpeechSynthesisVoice[] {
  const list = getSynthesis()?.getVoices() ?? [];
  const key = list
    .map((voice) =>
      [voice.voiceURI, voice.name, voice.lang, voice.localService, voice.default].join('|'),
    )
    .join(';');
  if (key !== last.key) last = { key, voices: list };
  return last.voices;
}

/**
 * What the four voice choices come to when the browser's own voices speak the customer, said
 * plainly: a browser with one English voice cannot make four voices sound different. Null when it
 * does not apply, when every choice has a voice of its own, and while the browser is still listing
 * its voices.
 */
export function useBrowserVoiceNote(active: boolean, language: SpeechLanguage): string | null {
  const voices = useSyncExternalStore(subscribe, listedVoices);
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setWaited(true), VOICE_LIST_GRACE_MS);
    return () => clearTimeout(timer);
  }, [active]);
  return useMemo(
    () =>
      active && (voices.length > 0 || waited) ? describeBrowserVoices(voices, language).note : null,
    [active, voices, waited, language],
  );
}
