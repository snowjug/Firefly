import { SPEECH_RESPONSE_HEADERS } from '#shared/domain/speech.ts';
import {
  AZURE_SHARED_SPEECH,
  AZURE_SPEECH,
  DEMO_SPEECH,
  NO_SPEECH,
  OLD_SERVER_SPEECH,
  appConfig,
  publicScenarios,
} from '../testing/fixtures.ts';

// Development only. The scenario gallery answers the app's `/api` calls itself, so the real pages
// can be looked at in every state without a server: choose one with ?state=<name>.

export const GALLERY_STATES = {
  default: 'Demo speech, every scenario',
  azure: 'A real speech service is configured',
  'azure-shared': 'A real speech service with fewer voices than choices',
  'old-server': 'A server from before voices could be chosen',
  'no-speech': 'No speech service: typing only',
  loading: 'The scenarios never finish loading',
  slow: 'The scenarios take two seconds to arrive',
  unreachable: 'The server cannot be reached',
  empty: 'The server has no scenarios',
  'preview-fails': 'The voice sample cannot be made',
  'start-fails': 'Starting a call always fails (can be retried)',
  'start-fails-once': 'Starting a call fails once, then works',
  'start-slow': 'Starting a call takes three seconds',
} as const;

export type GalleryState = keyof typeof GALLERY_STATES;

export function isGalleryState(value: string | null): value is GalleryState {
  return value !== null && Object.hasOwn(GALLERY_STATES, value);
}

const aborted = () => new DOMException('The request was cancelled.', 'AbortError');

function wait(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(aborted());
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(aborted());
      },
      { once: true },
    );
  });
}

function never(signal?: AbortSignal | null): Promise<never> {
  return new Promise((_, reject) => {
    if (signal?.aborted) return reject(aborted());
    signal?.addEventListener('abort', () => reject(aborted()), { once: true });
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function problem(status: number, code: string, message: string, retryable: boolean): Response {
  return json({ error: { code, message, retryable } }, status);
}

/** A short, soft tone as a WAV file (16-bit mono): the pretend server's "voice" for the sample. */
function tone(seconds: number, hertz: number): Blob {
  const rate = 16000;
  const samples = Math.round(seconds * rate);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i += 1) {
    const fade = Math.min(1, i / 800, (samples - i) / 800);
    const sample = Math.sin((2 * Math.PI * hertz * i) / rate) * 4000 * fade;
    view.setInt16(44 + i * 2, Math.round(sample), true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

const PITCH: Record<string, number> = {
  'voice-a': 294,
  'voice-b': 392,
  'voice-c': 262,
  'voice-d': 330,
};

/** Replaces `fetch` for `/api` calls; anything else (the page's own files) goes to the network. */
export function installPretendServer(state: GalleryState): void {
  const network = window.fetch.bind(window);
  const scenarios = state === 'empty' ? [] : publicScenarios();
  const speech =
    state === 'azure' || state === 'preview-fails'
      ? AZURE_SPEECH
      : state === 'azure-shared'
        ? AZURE_SHARED_SPEECH
        : state === 'old-server'
          ? OLD_SERVER_SPEECH
          : state === 'no-speech'
            ? NO_SPEECH
            : DEMO_SPEECH;
  let sessionsAsked = 0;

  window.fetch = async (input, init) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href, window.location.href);
    if (!url.pathname.startsWith('/api/')) return network(input, init);
    const signal = init?.signal;
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.pathname.slice('/api'.length);

    if (state === 'unreachable') throw new TypeError('Failed to fetch');

    if (method === 'GET' && path === '/config') return json(appConfig({ speech }));

    if (method === 'GET' && path.startsWith('/scenarios')) {
      if (state === 'loading') return never(signal);
      if (state === 'slow') await wait(2000, signal);
      if (path === '/scenarios') return json({ scenarios });
      const id = decodeURIComponent(path.slice('/scenarios/'.length));
      const found = scenarios.find((scenario) => scenario.id === id);
      return found
        ? json({ scenario: found })
        : problem(404, 'not_found', 'That scenario could not be found.', false);
    }

    if (method === 'POST' && path === '/speech/preview') {
      const voice = url.searchParams.get('voice');
      await wait(400, signal);
      if (state === 'preview-fails') {
        return problem(503, 'speech_unavailable', 'The speech service is busy right now.', true);
      }
      return new Response(tone(1.2, PITCH[voice ?? ''] ?? 330), {
        status: 200,
        headers: {
          'Content-Type': 'audio/wav',
          [SPEECH_RESPONSE_HEADERS.provider]: speech.provider,
          [SPEECH_RESPONSE_HEADERS.voiceId]: voice ?? 'none',
        },
      });
    }

    if (method === 'POST' && path === '/sessions') {
      sessionsAsked += 1;
      if (state === 'start-slow') await wait(3000, signal);
      if (state === 'start-fails' || (state === 'start-fails-once' && sessionsAsked === 1)) {
        return problem(503, 'unavailable', 'The simulator is busy right now.', true);
      }
      return json({ session: { id: 'gallery-call' } }, 201);
    }

    return problem(404, 'not_found', 'The gallery does not pretend to answer this.', false);
  };
}
