import { render } from '@testing-library/react';
import { vi } from 'vitest';
import type { AppConfigDTO } from '#shared/domain/api.ts';
import { App, AppProviders, createAppRouter } from '../App.tsx';

// Helpers for tests that render the app shell and the router.

export function makeConfig(
  overrides: { demo?: boolean; label?: string; notice?: string | null } = {},
): AppConfigDTO {
  const {
    demo = true,
    label = demo ? 'Demo mode' : 'Azure OpenAI (gpt-4o)',
    notice = null,
  } = overrides;
  return {
    app: { name: 'Firefly', version: '0.0.0-test' },
    provider: { kind: demo ? 'mock' : 'azure-openai', label, demo, notice },
    speech: {
      provider: 'none',
      label: 'None',
      demo: false,
      transcribe: false,
      synthesize: false,
      expressiveStyles: false,
      notice: null,
      limits: { maxAudioBytes: 1, maxAudioSeconds: 1, sampleRate: 16000 },
    },
    limits: { maxMessageChars: 1000, maxTraineeTurns: 40 },
    features: { devDiagnostics: false, testHooks: false },
  };
}

/** Answers /api/config with `config`, or with a server error when it is null. */
export function stubConfig(config: AppConfigDTO | null = makeConfig()) {
  const fetchStub = vi.fn(async () =>
    config
      ? new Response(JSON.stringify(config), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      : new Response('{}', { status: 500, headers: { 'Content-Type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fetchStub);
  return fetchStub;
}

/** jsdom does not scroll. These stand in for the two calls navigation makes. */
export function stubScrolling() {
  const scrollTo = vi.fn();
  const scrollIntoView = vi.fn();
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
  Element.prototype.scrollIntoView = scrollIntoView;
  return { scrollTo, scrollIntoView };
}

/** Renders the whole app at `path` in an in-memory router, with the providers main.tsx uses. */
export function renderApp(path = '/', config: AppConfigDTO | null = makeConfig()) {
  stubConfig(config);
  const scrolling = stubScrolling();
  const router = createAppRouter([path]);
  const view = render(
    <AppProviders>
      <App router={router} />
    </AppProviders>,
  );
  return { router, scrolling, ...view };
}
