import type { ApiErrorBody } from '#shared/domain/api.ts';
import { SPEECH_RESPONSE_HEADERS, type SpeechLanguage } from '#shared/domain/speech.ts';
import type { VoiceId } from '#shared/domain/voices.ts';
import { ApiError, isAbort, type SpokenTurn } from '../../lib/api.ts';
import type { SpeakOptions } from './playback/server-playback.ts';

// The web app's side of the speech endpoints that carry a chosen voice: speaking one stored customer
// turn, and the "Test voice" preview. They answer with audio, so they live with the voice feature and
// not with the JSON client, and they report failures the same way (an `ApiError` with a message that is
// safe to show, a stable code and a retryable flag). The speech provider's key never reaches the
// browser, and nothing here keeps the audio: the caller gets a Blob and decides what to do with it.

/** Audio the server spoke, with what the provider really used. */
export interface SpokenAudio extends SpokenTurn {
  /** The neutral choice (`voice-a` to `voice-d`) the audio was made for, or null when none was named. */
  voiceId: string | null;
}

const NETWORK_MESSAGE =
  "Can't reach Firefly right now. Check that the server is running and that you are online, then try again.";

async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`/api${path}`, { credentials: 'same-origin', ...init });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new ApiError(0, 'network', NETWORK_MESSAGE, true);
  }
}

async function failure(response: Response): Promise<ApiError> {
  let data: unknown = null;
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  const err = (data as ApiErrorBody | null)?.error;
  return new ApiError(
    response.status,
    err?.code ?? 'internal',
    err?.message ?? 'Something went wrong on our side. Please try again.',
    err?.retryable ?? response.status >= 500,
    err?.details,
  );
}

async function audioOf(response: Response): Promise<SpokenAudio> {
  const voiceId = response.headers.get(SPEECH_RESPONSE_HEADERS.voiceId);
  return {
    audio: await response.blob(),
    contentType: response.headers.get('content-type') ?? 'audio/mpeg',
    provider: response.headers.get(SPEECH_RESPONSE_HEADERS.provider),
    voice: response.headers.get(SPEECH_RESPONSE_HEADERS.voice),
    style: response.headers.get(SPEECH_RESPONSE_HEADERS.style),
    voiceId: voiceId === null || voiceId === 'none' ? null : voiceId,
  };
}

const query = (language: SpeechLanguage, voice?: VoiceId) => {
  const search = new URLSearchParams({ lang: language });
  if (voice) search.set('voice', voice);
  return `?${search.toString()}`;
};

/**
 * Asks the server to speak one stored customer turn, in the chosen voice when one is given. The words
 * come from the session, never from the browser. Without a voice the request is exactly what it was
 * before voices could be chosen, and the server pairs a voice as it always did. It can be used
 * wherever a `SpeakTurn` is wanted.
 */
export async function speakTurnWithVoice(
  sessionId: string,
  turnIndex: number,
  language: SpeechLanguage,
  signal: AbortSignal,
  options: SpeakOptions = {},
): Promise<SpokenAudio> {
  const response = await send(
    `/sessions/${encodeURIComponent(sessionId)}/turns/${turnIndex}/speech${query(language, options.voice)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal },
  );
  if (!response.ok) throw await failure(response);
  return audioOf(response);
}

/**
 * Asks the server to say the one fixed preview sentence in the chosen voice ("Test voice"). It needs
 * no call and sends no words: the sentence is fixed on the server.
 */
export async function fetchVoicePreview(
  voice: VoiceId,
  language: SpeechLanguage,
  signal?: AbortSignal,
): Promise<SpokenAudio> {
  const response = await send(`/speech/preview${query(language, voice)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw await failure(response);
  return audioOf(response);
}
