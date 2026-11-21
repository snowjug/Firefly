import { createMockSpeechProvider } from '../mock.ts';
import {
  SpeechError,
  type SpeechErrorCode,
  type SpeechProvider,
  type SynthesizeRequest,
  type TranscribeRequest,
} from '../types.ts';

// In-memory stand-ins for the speech port. They hold nothing but what a test asked them to remember,
// and they are what CI uses: no network, no key and no real speech.

/**
 * Wraps a provider and remembers what the server asked of it. `heard` holds each recording as it
 * was when the provider received it (a copy), and `handed` the very buffers the provider was handed,
 * so a test can also see that the server zeroed them afterwards.
 */
export function recordingSpeech(inner: SpeechProvider = createMockSpeechProvider()) {
  const spoken: SynthesizeRequest[] = [];
  const heard: TranscribeRequest[] = [];
  const handed: Buffer[] = [];
  const provider: SpeechProvider = {
    ...inner,
    transcribe: (request, signal) => {
      heard.push({ ...request, audio: Buffer.from(request.audio) });
      handed.push(request.audio);
      return inner.transcribe(request, signal);
    },
    synthesize: (request, signal) => {
      spoken.push(request);
      return inner.synthesize(request, signal);
    },
  };
  return { provider, spoken, heard, handed };
}

/** A provider whose every call fails in the given way, with a private cause that must never leak. */
export function failingSpeech(code: SpeechErrorCode, retryable: boolean): SpeechProvider {
  const fail = () =>
    Promise.reject(
      new SpeechError(code, `Message for ${code}.`, retryable, new Error('inner detail')),
    );
  return { ...createMockSpeechProvider(), transcribe: fail, synthesize: fail };
}

/**
 * A provider that fails the next `failures` calls of each kind (in the given way) and then works, so
 * a test can see what a retry after a failure does.
 */
export function flakySpeech(
  failures: { transcribe?: number; synthesize?: number },
  inner: SpeechProvider = createMockSpeechProvider(),
  code: SpeechErrorCode = 'speech_failed',
) {
  const left = { transcribe: failures.transcribe ?? 0, synthesize: failures.synthesize ?? 0 };
  const calls = { transcribe: 0, synthesize: 0 };
  const fail = () => new SpeechError(code, `Message for ${code}.`, true, new Error('inner detail'));
  const provider: SpeechProvider = {
    ...inner,
    transcribe(request, signal) {
      calls.transcribe++;
      if (left.transcribe-- > 0) return Promise.reject(fail());
      return inner.transcribe(request, signal);
    },
    synthesize(request, signal) {
      calls.synthesize++;
      if (left.synthesize-- > 0) return Promise.reject(fail());
      return inner.synthesize(request, signal);
    },
  };
  return { provider, calls };
}
