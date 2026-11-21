import type { FullConfig } from '@playwright/test';
import { writeFakeMicrophoneWav } from './fake-microphone.ts';

// Runs once before the suite, after the server has started. It writes the fake microphone file and
// refuses to run the journeys against a server that is not set up for them: a reused or external
// server with a real model, real speech or no failure hooks would make every test misleading.

export default async function globalSetup(config: FullConfig): Promise<void> {
  writeFakeMicrophoneWav();

  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error('The suite has no baseURL.');

  let settings: {
    provider?: { kind?: string };
    speech?: { provider?: string };
    features?: { testHooks?: boolean };
  };
  try {
    const response = await fetch(new URL('/api/config', baseURL));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    settings = (await response.json()) as typeof settings;
  } catch (error) {
    throw new Error(`Firefly did not answer at ${baseURL}/api/config: ${String(error)}`);
  }

  // The gated real-provider spec runs against a server the operator started with real credentials.
  if (process.env.FIREFLY_E2E_REAL === '1') return;

  const problems: string[] = [];
  if (settings.provider?.kind !== 'mock')
    problems.push('FIREFLY_PROVIDER=mock (the demo customer)');
  if (settings.speech?.provider !== 'mock') problems.push('FIREFLY_SPEECH_PROVIDER=mock');
  if (settings.features?.testHooks !== true) problems.push('FIREFLY_TEST_HOOKS=1');
  if (problems.length > 0) {
    throw new Error(
      `The server at ${baseURL} is not set up for the browser tests. It needs ${problems.join(', ')}. ` +
        'Stop it so that the suite starts its own, or restart it with those settings.',
    );
  }
}
