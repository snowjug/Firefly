import { useMemo } from 'react';
import { useSpeechSetup } from './use-speech-setup.ts';
import { voiceChoices, type VoiceOption } from './voice-choice.ts';

/**
 * The customer voices this setup can offer (see `voiceChoices`): the same list the case brief shows,
 * so a voice chosen on the scenario page is one the brief and the call can use.
 */
export function useVoiceOptions(): readonly VoiceOption[] {
  const { config, setup } = useSpeechSetup();
  return useMemo(
    () => voiceChoices(config?.speech ?? null, setup?.playback ?? null),
    [config, setup],
  );
}
