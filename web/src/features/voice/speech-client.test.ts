import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SPEECH_RESPONSE_HEADERS } from '#shared/domain/speech.ts';
import { api, ApiError } from '../../lib/api.ts';
import type { SpeakTurn } from './playback/server-playback.ts';
import { fetchVoicePreview, speakTurnWithVoice } from './speech-client.ts';

// The two requests that carry a chosen voice, checked against a stand-in for `fetch`: what is sent,
// what comes back, and how a failure is reported. Nothing here reaches a server.

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const AUDIO_HEADERS = {
  'content-type': 'audio/mpeg',
  [SPEECH_RESPONSE_HEADERS.provider]: 'azure-speech',
  [SPEECH_RESPONSE_HEADERS.voice]: 'en-GB-RyanNeural',
  [SPEECH_RESPONSE_HEADERS.style]: 'none',
  [SPEECH_RESPONSE_HEADERS.voiceId]: 'voice-b',
};
const audioResponse = (headers: Record<string, string> = {}) =>
  new Response(new Blob(['not really mp3']), {
    status: 200,
    headers: { ...AUDIO_HEADERS, ...headers },
  });

const errorResponse = (status: number, body: unknown) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

describe('speakTurnWithVoice', () => {
  it('asks for the stored turn in the chosen voice, and sends no words', async () => {
    fetchMock.mockResolvedValue(audioResponse());
    const controller = new AbortController();
    await speakTurnWithVoice('session-1', 3, 'en-GB', controller.signal, { voice: 'voice-b' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/sessions/session-1/turns/3/speech?lang=en-GB&voice=voice-b');
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: controller.signal,
    });
  });

  it('is exactly the request the JSON client makes when no voice is named', async () => {
    fetchMock.mockImplementation(async () => audioResponse());
    const controller = new AbortController();
    await api.speakTurn('session-1', 3, 'en-IE', controller.signal);
    await speakTurnWithVoice('session-1', 3, 'en-IE', controller.signal);
    expect(fetchMock.mock.calls[1]).toEqual(fetchMock.mock.calls[0]);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/sessions/session-1/turns/3/speech?lang=en-IE');
  });

  it('encodes the session id', async () => {
    fetchMock.mockResolvedValue(audioResponse());
    await speakTurnWithVoice('a/b c?d', 0, 'en-US', new AbortController().signal);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/sessions/a%2Fb%20c%3Fd/turns/0/speech?lang=en-US',
    );
  });

  it('reads back what the provider really used', async () => {
    fetchMock.mockResolvedValue(audioResponse());
    const spoken = await speakTurnWithVoice('s', 1, 'en-GB', new AbortController().signal, {
      voice: 'voice-b',
    });
    expect(spoken).toMatchObject({
      contentType: 'audio/mpeg',
      provider: 'azure-speech',
      voice: 'en-GB-RyanNeural',
      style: 'none',
      voiceId: 'voice-b',
    });
    expect(spoken.audio).toBeInstanceOf(Blob);
  });

  it('says "no voice id" when the server named none, or sent nothing', async () => {
    const signal = new AbortController().signal;
    fetchMock.mockResolvedValueOnce(audioResponse({ [SPEECH_RESPONSE_HEADERS.voiceId]: 'none' }));
    expect((await speakTurnWithVoice('s', 1, 'en-GB', signal)).voiceId).toBeNull();
    const bare = new Response(new Blob(['x']), { status: 200 });
    fetchMock.mockResolvedValueOnce(bare);
    expect(await speakTurnWithVoice('s', 1, 'en-GB', signal)).toMatchObject({
      voiceId: null,
      provider: null,
      voice: null,
      style: null,
    });
  });

  it('can be used wherever a SpeakTurn is wanted, such as the playback engine', async () => {
    fetchMock.mockResolvedValue(audioResponse());
    const asSpeakTurn: SpeakTurn = speakTurnWithVoice;
    const spoken = await asSpeakTurn('s', 2, 'en-GB', new AbortController().signal, {
      voice: 'voice-c',
    });
    expect(spoken.provider).toBe('azure-speech');
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/sessions/s/turns/2/speech?lang=en-GB&voice=voice-c',
    );
  });

  describe('failures', () => {
    const signal = () => new AbortController().signal;

    it("becomes an ApiError with the server's code, plain message, retry flag and details", async () => {
      fetchMock.mockResolvedValue(
        errorResponse(429, {
          error: {
            code: 'rate_limited',
            message: 'You are going a bit fast. Wait a moment and try again.',
            retryable: true,
            details: { retryAfterSeconds: 4 },
          },
        }),
      );
      const error = await speakTurnWithVoice('s', 1, 'en-GB', signal()).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        status: 429,
        code: 'rate_limited',
        message: 'You are going a bit fast. Wait a moment and try again.',
        retryable: true,
        details: { retryAfterSeconds: 4 },
      });
    });

    it("falls back to a plain message for a body that is not the API's own", async () => {
      fetchMock.mockResolvedValueOnce(errorResponse(502, '<html>Bad gateway</html>'));
      const bad = await speakTurnWithVoice('s', 1, 'en-GB', signal()).catch((e: unknown) => e);
      expect(bad).toMatchObject({
        status: 502,
        code: 'internal',
        retryable: true,
        message: 'Something went wrong on our side. Please try again.',
      });
      fetchMock.mockResolvedValueOnce(errorResponse(404, ''));
      const missing = await speakTurnWithVoice('s', 1, 'en-GB', signal()).catch((e: unknown) => e);
      expect(missing).toMatchObject({ status: 404, code: 'internal', retryable: false });
    });

    it('says the network is down as a retryable ApiError with status 0', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
      const error = await speakTurnWithVoice('s', 1, 'en-GB', signal()).catch((e: unknown) => e);
      expect(error).toMatchObject({ status: 0, code: 'network', retryable: true });
      expect((error as ApiError).message).not.toMatch(/fetch/i);
    });

    it('lets a cancelled request stay a cancellation', async () => {
      fetchMock.mockRejectedValue(new DOMException('Aborted', 'AbortError'));
      const error = await speakTurnWithVoice('s', 1, 'en-GB', signal()).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(DOMException);
      expect((error as DOMException).name).toBe('AbortError');
    });
  });
});

describe('fetchVoicePreview', () => {
  it('asks for the preview in the chosen voice and language, and sends no words', async () => {
    fetchMock.mockResolvedValue(audioResponse({ [SPEECH_RESPONSE_HEADERS.voiceId]: 'voice-d' }));
    const controller = new AbortController();
    const preview = await fetchVoicePreview('voice-d', 'en-AU', controller.signal);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/speech/preview?lang=en-AU&voice=voice-d');
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      body: '{}',
      signal: controller.signal,
    });
    expect(preview.voiceId).toBe('voice-d');
  });

  it('makes one request, and works without a signal', async () => {
    fetchMock.mockResolvedValue(audioResponse());
    await fetchVoicePreview('voice-a', 'en-GB');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty('signal');
  });

  it('reports a refused preview the way every other speech request does', async () => {
    fetchMock.mockResolvedValue(
      errorResponse(503, {
        error: { code: 'speech_unavailable', message: 'Speech is off.', retryable: false },
      }),
    );
    await expect(fetchVoicePreview('voice-c', 'en-GB')).rejects.toMatchObject({
      status: 503,
      code: 'speech_unavailable',
      retryable: false,
    });
  });
});
