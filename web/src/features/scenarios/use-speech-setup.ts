import { useMemo } from 'react';
import { useAppConfig } from '../../lib/config.tsx';
import { detectFeatures } from '../voice/support.ts';
import { describeSpeechSetup, type SpeechSetup } from './speech-setup.ts';

/**
 * How speech works in this setup, for the brief: what the server can do (from /api/config) and
 * what this browser can do (looked up once, when the brief opens). `setup` is null until the
 * server's settings are known.
 */
export function useSpeechSetup() {
  const { config, loading, error, reload } = useAppConfig();
  const features = useMemo(() => detectFeatures(), []);
  const setup: SpeechSetup | null = useMemo(
    () => (config ? describeSpeechSetup(config.speech, features) : null),
    [config, features],
  );
  return { config, setup, loading, error, reload };
}
