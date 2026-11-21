import net from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SPEECH_LANGUAGES, type SpeechLanguage } from '#shared/domain/speech.ts';
import { VOICE_IDS, VOICE_PREVIEW_TEXT } from '#shared/domain/voices.ts';
import type { TemperatureBandId } from '#shared/domain/vocab.ts';
import { createLogger } from '../log.ts';
import { createAzureSpeechProvider, SPEECH_MESSAGES } from '../speech/azure.ts';
import {
  FAKE_PROVIDER_ERROR_TEXT,
  FAKE_RECOGNISED_TEXT,
  fakeMp3,
  startFakeAzureSpeech,
  type FakeAzureSpeech,
  type Step,
} from '../speech/fake-azure-speech-server.ts';
import { createNoneSpeechProvider, createSpeechProvider } from '../speech/index.ts';
import { createMockSpeechProvider, MOCK_UTTERANCES, mockVoiceOptions } from '../speech/mock.ts';
import {
  createSpeechTestApp,
  type FakeTurn,
  type NewFakeCall,
  type SpeechTestApp,
  type SpeechTestClient,
} from '../speech/testing/app-harness.ts';
import { failingSpeech, flakySpeech, recordingSpeech } from '../speech/testing/fakes.ts';
import { loadSpeechConfig, SpeechError, type SpeechErrorCode } from '../speech/types.ts';
import {
  cleanText,
  describeVoices,
  escapeXml,
  voiceOptions,
  VOICE_CATALOGUE,
} from '../speech/voices.ts';
import { encodeWav, validateWav } from '../speech/wav.ts';

// The speech endpoints, end to end: the real HTTP app with the speech provider in front of an
// in-memory stand-in for the one thing they ask of the session service (a customer turn's stored
// words). So these tests hold no scenario and do not depend on the scenario library or its schema.
// The scripted demo provider, speech switched off, and the real Azure client talking to a local
// fake of Azure's REST endpoints all stand in for the speech service: none of this is real
// speech recognition, a real voice, or a call to the live service.

const SPEECH_KEYS = ['provider', 'voice', 'style', 'voice-id'] as const;
/** A key the fake service does not accept. */
const WRONG_KEY = 'a-wrong-key-for-tests';

const bytes = (buffer: Buffer) =>
  new Uint8Array(buffer.buffer as ArrayBuffer, buffer.byteOffset, buffer.byteLength);
const recording = (seconds: number) => encodeWav(Buffer.alloc(Math.round(seconds * 32000), 1));

async function withApp<T>(
  options: Parameters<typeof createSpeechTestApp>[0],
  run: (app: SpeechTestApp) => Promise<T>,
): Promise<T> {
  const app = await createSpeechTestApp(options);
  try {
    return await run(app);
  } finally {
    await app.close();
  }
}

const startCall = (app: SpeechTestApp, client: SpeechTestClient, options?: NewFakeCall) =>
  app.startCall(client, options);

const transcribe = (
  client: SpeechTestClient,
  body: Buffer | string,
  query = '',
  type = 'audio/wav',
) =>
  client.raw(`/api/speech/transcribe${query}`, {
    method: 'POST',
    headers: type ? { 'content-type': type } : {},
    body: typeof body === 'string' ? body : bytes(body),
  });

const speakTurn = (
  client: SpeechTestClient,
  id: string,
  index: number | string,
  query = '',
  body = '{}',
) =>
  client.raw(`/api/sessions/${id}/turns/${index}/speech${query}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });

const preview = (client: SpeechTestClient, query = '', body = '{}') =>
  client.raw(`/api/speech/preview${query}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });

async function errorOf(res: Response) {
  const body = (await res.json()) as {
    error: { code: string; message: string; retryable: boolean };
  };
  expect(Object.keys(body)).toEqual(['error']);
  return body.error;
}

const customer = (index: number, text: string, mood: TemperatureBandId = 'calm'): FakeTurn => ({
  index,
  role: 'customer',
  text,
  mood,
});
const trainee = (index: number, text = 'Trainee words.'): FakeTurn => ({
  index,
  role: 'trainee',
  text,
});

// ---------------------------------------------------------------------------------------

describe('what /api/config and /api/health say about speech', () => {
  const limits = { maxAudioBytes: 1_500_000, maxAudioSeconds: 30, sampleRate: 16000 };
  let fake: FakeAzureSpeech;
  beforeAll(async () => {
    fake = await startFakeAzureSpeech();
  });
  afterAll(() => fake.close());

  const azure = () =>
    createAzureSpeechProvider({
      kind: 'azure-speech',
      apiKey: fake.key,
      sttUrl: fake.sttUrl,
      ttsUrl: fake.ttsUrl,
      voices: { female: null, male: null },
      timeoutMs: 1000,
    });

  it('says speech is not configured unless it is switched on, and offers no voices', async () => {
    await withApp({}, async (app) => {
      const client = app.client();
      expect((await client.get('/api/config')).body.speech).toEqual({
        provider: 'none',
        label: 'Not configured',
        demo: false,
        transcribe: false,
        synthesize: false,
        expressiveStyles: false,
        notice: null,
        voices: [],
        limits,
      });
      expect((await client.get('/api/health')).body.speech).toEqual({ kind: 'none' });
    });
  });

  it('labels the scripted provider as a demonstration, and its four voices as one placeholder sound', async () => {
    await withApp({ speech: createMockSpeechProvider() }, async (app) => {
      const client = app.client();
      const { speech } = (await client.get('/api/config')).body;
      expect(speech).toEqual({
        provider: 'mock',
        label: 'Demo speech (scripted)',
        demo: true,
        transcribe: true,
        synthesize: true,
        expressiveStyles: false,
        notice: null,
        voices: describeVoices(mockVoiceOptions),
        limits,
      });
      expect(speech.voices.map((voice: { id: string }) => voice.id)).toEqual([...VOICE_IDS]);
      expect(speech.voices[1].languages['en-GB']).toEqual({ voice: 'shared', styles: false });
      expect((await client.get('/api/health')).body.speech).toEqual({ kind: 'mock' });
    });
  });

  it('reports Azure AI Speech with its four neutral voices, and without a trace of the key, where it lives or any voice name', async () => {
    await withApp({ speech: azure() }, async (app) => {
      const client = app.client();
      const config = await client.get('/api/config');
      expect(config.body.speech).toEqual({
        provider: 'azure-speech',
        label: 'Azure AI Speech',
        demo: false,
        transcribe: true,
        synthesize: true,
        expressiveStyles: false,
        notice: null,
        voices: describeVoices(voiceOptions),
        limits,
      });
      const { voices } = config.body.speech;
      expect(voices.map((voice: { label: string }) => voice.label)).toEqual([
        'Voice A - Warm',
        'Voice B - Direct',
        'Voice C - Measured',
        'Voice D - Concise',
      ]);
      // Ireland has two standard voices: the third and fourth choices share them.
      expect(voices[2].languages['en-IE']).toEqual({ voice: 'shared', styles: false });
      expect(voices[2].languages['en-US']).toEqual({ voice: 'own', styles: true });
      const health = await client.get('/api/health');
      expect(health.body.speech).toEqual({ kind: 'azure-speech' });
      for (const res of [config, health]) {
        const text = JSON.stringify(res.body);
        expect(text).not.toContain(fake.key);
        expect(text).not.toContain(fake.origin);
        expect(text).not.toContain('127.0.0.1');
        expect(text).not.toMatch(/[A-Z][a-z]+Neural/);
        expect(JSON.stringify([...res.headers])).not.toContain(fake.key);
      }
      expect(JSON.stringify(voices)).not.toMatch(/female|male|speaker/i);
    });
  });

  it('falls back to not configured, with the reason, when Azure is asked for but not set up', async () => {
    const loaded = loadSpeechConfig({
      FIREFLY_SPEECH_PROVIDER: 'azure-speech',
      AZURE_SPEECH_REGION: 'uksouth',
    });
    await withApp({ speech: createSpeechProvider(loaded) }, async (app) => {
      const { speech } = (await app.client().get('/api/config')).body;
      expect(speech).toMatchObject({
        provider: 'none',
        label: 'Not configured',
        transcribe: false,
      });
      expect(speech.notice).toBe(
        'FIREFLY_SPEECH_PROVIDER=azure-speech but AZURE_SPEECH_KEY is not set. Spoken calls are turned off.',
      );
    });
  });

  it('shows a notice for a setting that was adjusted while speech keeps working', async () => {
    const loaded = loadSpeechConfig({
      FIREFLY_SPEECH_PROVIDER: 'azure-speech',
      AZURE_SPEECH_KEY: fake.key,
      AZURE_SPEECH_REGION: 'uksouth',
      AZURE_SPEECH_VOICE_MALE: 'not a voice!',
    });
    await withApp({ speech: createSpeechProvider(loaded) }, async (app) => {
      const { speech } = (await app.client().get('/api/config')).body;
      expect(speech).toMatchObject({ provider: 'azure-speech', transcribe: true });
      expect(speech.notice).toContain('AZURE_SPEECH_VOICE_MALE is not a voice name');
      expect(JSON.stringify(speech)).not.toContain(fake.key);
    });
  });
});

// ---------------------------------------------------------------------------------------

describe('POST /api/speech/transcribe', () => {
  it('turns a recording into text, and says how long the recording was', async () => {
    await withApp({ speech: createMockSpeechProvider() }, async (app) => {
      const res = await transcribe(app.client(), recording(1.5));
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(await res.json()).toEqual({
        status: 'recognised',
        text: MOCK_UTTERANCES[0],
        durationMs: 1500,
      });
    });
  });

  it('reads the language from the query, defaulting to British English', async () => {
    const { provider, heard } = recordingSpeech();
    await withApp({ speech: provider }, async (app) => {
      const client = app.client();
      await transcribe(client, recording(1));
      for (const lang of ['en-US', 'en-IE', 'en-AU', 'en-IN', 'en-GB'] as const) {
        expect((await transcribe(client, recording(1), `?lang=${lang}`)).status).toBe(200);
      }
      expect(heard.map((h) => h.language)).toEqual([
        'en-GB',
        'en-US',
        'en-IE',
        'en-AU',
        'en-IN',
        'en-GB',
      ]);
      expect(heard[0]).toMatchObject({ durationMs: 1000 });
      expect(heard[0]?.audio.subarray(0, 4).toString('latin1')).toBe('RIFF');
    });
  });

  it('refuses a language that is not offered, without calling the provider', async () => {
    const { provider, heard } = recordingSpeech();
    await withApp({ speech: provider }, async (app) => {
      for (const lang of ['fr-FR', 'en', 'EN-GB', 'en-GB%20', '']) {
        const res = await transcribe(app.client(), recording(1), `?lang=${lang}`);
        expect(res.status, lang).toBe(400);
        expect((await errorOf(res)).code).toBe('validation_failed');
      }
      expect(heard).toHaveLength(0);
    });
  });

  it('works through the recognised lines in turn, and reports silence without using one up', async () => {
    await withApp({ speech: createMockSpeechProvider() }, async (app) => {
      const client = app.client();
      const first = await (await transcribe(client, recording(1))).json();
      const silent = await (await transcribe(client, recording(0.1))).json();
      const second = await (await transcribe(client, recording(1))).json();
      expect(first.text).toBe(MOCK_UTTERANCES[0]);
      expect(silent).toEqual({ status: 'no-speech', text: '', durationMs: 100 });
      expect(second.text).toBe(MOCK_UTTERANCES[1]);
    });
  });

  it('accepts audio/x-wav and a type with parameters', async () => {
    await withApp({ speech: createMockSpeechProvider() }, async (app) => {
      for (const type of ['audio/x-wav', 'audio/wav; codecs=audio/pcm; samplerate=16000']) {
        expect((await transcribe(app.client(), recording(1), '', type)).status, type).toBe(200);
      }
    });
  });

  it('refuses any other type with 415, and never reads or forwards the body', async () => {
    const { provider, heard } = recordingSpeech();
    await withApp({ speech: provider }, async (app) => {
      for (const type of [
        'application/json',
        'text/plain',
        'audio/mpeg',
        'audio/webm',
        'application/octet-stream',
        '',
      ]) {
        const res = await transcribe(app.client(), recording(1), '', type);
        expect(res.status, type).toBe(415);
        expect(await errorOf(res)).toEqual({
          code: 'unsupported_media',
          message: 'Send the recording as audio/wav.',
          retryable: false,
        });
      }
      expect(heard).toHaveLength(0);
    });
  });

  it('refuses an upload over 1.5 MB with 413', async () => {
    const { provider, heard } = recordingSpeech();
    await withApp({ speech: provider }, async (app) => {
      const client = app.client();
      const res = await transcribe(client, Buffer.alloc(1_500_001));
      expect(res.status).toBe(413);
      expect(await errorOf(res)).toMatchObject({ code: 'payload_too_large', retryable: false });
      // The server is still serving afterwards.
      expect((await transcribe(client, recording(1))).status).toBe(200);
      expect(heard).toHaveLength(1);
    });
  });

  it('refuses a recording longer than 30 seconds with a plain message, even one under the size limit', async () => {
    await withApp({ speech: createMockSpeechProvider() }, async (app) => {
      const client = app.client();
      const long = await transcribe(client, recording(31));
      expect(long.status).toBe(400);
      expect(await errorOf(long)).toEqual({
        code: 'validation_failed',
        message: 'The recording is longer than 30 seconds.',
        retryable: false,
      });
      // The largest upload that is still read (1,500,000 bytes) is also longer than 30 seconds.
      const tooLong = recording(46.8);
      const largest = Buffer.concat([tooLong, Buffer.alloc(1_500_000 - tooLong.length)]);
      expect(largest).toHaveLength(1_500_000);
      expect((await transcribe(client, largest)).status).toBe(400);
      expect((await transcribe(client, recording(30))).status).toBe(200);
    });
  });

  it('refuses what is not a 16 kHz, 16-bit, mono WAV file with 400', async () => {
    const stereo = recording(1);
    stereo.writeUInt16LE(2, 22);
    const fast = recording(1);
    fast.writeUInt32LE(44100, 24);
    const cases: [string, Buffer | string, string][] = [
      ['nothing', '', 'That recording is not a WAV file.'],
      ['text', 'hello there', 'That recording is not a WAV file.'],
      ['JSON', '{"audio":true}'.padEnd(64, ' '), 'That recording is not a WAV file.'],
      [
        'an mp3 header',
        Buffer.from('ID3\u0004'.padEnd(64, '\u0000'), 'latin1'),
        'That recording is not a WAV file.',
      ],
      ['stereo', stereo, 'The recording must be 16-bit mono WAV at 16 kHz.'],
      ['44.1 kHz', fast, 'The recording must be 16-bit mono WAV at 16 kHz.'],
      ['a cut-off file', recording(2).subarray(0, 20_000), 'The recording looks incomplete.'],
      ['a header with no audio', recording(2).subarray(0, 44), 'The recording looks incomplete.'],
    ];
    const { provider, heard } = recordingSpeech();
    await withApp({ speech: provider }, async (app) => {
      for (const [label, body, message] of cases) {
        const res = await transcribe(app.client(), body);
        expect(res.status, label).toBe(400);
        expect(await errorOf(res), label).toEqual({
          code: 'validation_failed',
          message,
          retryable: false,
        });
      }
      expect(heard).toHaveLength(0);
    });
  });

  it('says so, with 503, when speech is not turned on, and keeps the reason user-safe', async () => {
    await withApp({}, async (app) => {
      const res = await transcribe(app.client(), recording(1));
      expect(res.status).toBe(503);
      expect(await errorOf(res)).toEqual({
        code: 'speech_unavailable',
        message: 'Speech is not turned on for this server, so type your reply instead.',
        retryable: false,
      });
    });
  });

  it('is only a POST: it does not exist as a GET, or as anything else', async () => {
    await withApp({ speech: createMockSpeechProvider() }, async (app) => {
      const client = app.client();
      for (const method of ['GET', 'PUT', 'DELETE', 'PATCH']) {
        const res = await client.raw('/api/speech/transcribe', { method });
        expect(res.status, method).toBe(405);
        expect((await errorOf(res)).code).toBe('bad_request');
      }
    });
  });

  it('refuses a cross-site upload', async () => {
    await withApp({ speech: createMockSpeechProvider() }, async (app) => {
      const res = await app.client().raw('/api/speech/transcribe', {
        method: 'POST',
        headers: { 'content-type': 'audio/wav', origin: 'https://evil.example' },
        body: bytes(recording(1)),
      });
      expect(res.status).toBe(403);
    });
  });

  it('maps every way the provider can fail to its own status and code', async () => {
    const cases: [SpeechErrorCode, number, boolean][] = [
      ['speech_unavailable', 503, false],
      ['speech_failed', 502, true],
      ['speech_timeout', 504, true],
      ['speech_rate_limited', 429, true],
    ];
    for (const [code, status, retryable] of cases) {
      await withApp({ speech: failingSpeech(code, retryable) }, async (app) => {
        const res = await transcribe(app.client(), recording(1));
        expect(res.status, code).toBe(status);
        const body = await res.json();
        expect(body, code).toEqual({ error: { code, message: `Message for ${code}.`, retryable } });
        expect(JSON.stringify(body)).not.toContain('inner detail');
      });
    }
  });
});

describe('the recording is released as soon as the provider has finished with it', () => {
  it('zeroes the bytes it handed to the provider, so no audio lingers in the server’s memory', async () => {
    const { provider, heard, handed } = recordingSpeech();
    await withApp({ speech: provider }, async (app) => {
      expect((await transcribe(app.client(), recording(1))).status).toBe(200);
      // The provider received real audio...
      expect(heard[0]?.audio.subarray(0, 4).toString('latin1')).toBe('RIFF');
      expect(heard[0]?.audio.some((byte) => byte !== 0)).toBe(true);
      // ...and once it had finished with it, the very same bytes were zeroed.
      const kept = handed[0] as Buffer;
      expect(kept.length).toBeGreaterThan(32000);
      expect(kept.every((byte) => byte === 0)).toBe(true);
    });
  });

  it('does the same when the provider fails, and when the caller gives up', async () => {
    const seen: Buffer[] = [];
    const failing = {
      ...createMockSpeechProvider(),
      transcribe: (request: { audio: Buffer }) => {
        seen.push(request.audio);
        return Promise.reject(new SpeechError('speech_failed', 'Nope.', true));
      },
    };
    await withApp({ speech: failing }, async (app) => {
      expect((await transcribe(app.client(), recording(1))).status).toBe(502);
    });
    const gone = {
      ...createMockSpeechProvider(),
      transcribe: (request: { audio: Buffer }, signal?: AbortSignal) => {
        seen.push(request.audio);
        return new Promise<never>((_resolve, reject) => {
          signal?.addEventListener('abort', () =>
            reject(new DOMException('Cancelled', 'AbortError')),
          );
        });
      },
    };
    await withApp({ speech: gone }, async (app) => {
      const controller = new AbortController();
      const pending = app
        .client()
        .raw('/api/speech/transcribe', {
          method: 'POST',
          headers: { 'content-type': 'audio/wav' },
          body: bytes(recording(1)),
          signal: controller.signal,
        })
        .catch(() => null);
      while (seen.length < 2) await new Promise((resolve) => setTimeout(resolve, 10));
      controller.abort();
      await pending;
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(seen).toHaveLength(2);
    for (const audio of seen) expect(audio.every((byte) => byte === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------

describe('POST /api/sessions/:id/turns/:index/speech', () => {
  it('speaks a stored customer turn and says what was used, in the response headers', async () => {
    await withApp({ speech: createMockSpeechProvider() }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client);
      const res = await speakTurn(client, id, 1);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('audio/wav');
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('x-firefly-speech-provider')).toBe('mock');
      expect(res.headers.get('x-firefly-speech-voice')).toBe('mock');
      expect(res.headers.get('x-firefly-speech-style')).toBe('none');
      // No voice was asked for, so none is claimed.
      expect(res.headers.get('x-firefly-speech-voice-id')).toBe('none');
      const audio = Buffer.from(await res.arrayBuffer());
      expect(Number(res.headers.get('content-length'))).toBe(audio.length);
      expect(validateWav(audio).ok).toBe(true);
    });
  });

  it('keeps the x-firefly-speech headers off everything but spoken audio', async () => {
    await withApp({ speech: createMockSpeechProvider() }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client);
      const everything = [
        await client.raw('/api/health'),
        await client.raw('/api/config'),
        await transcribe(client, recording(1)),
        await speakTurn(client, id, 99),
        await preview(client, '?voice=nonsense'),
      ];
      for (const res of everything) {
        for (const key of SPEECH_KEYS) {
          expect(res.headers.get(`x-firefly-speech-${key}`)).toBeNull();
        }
      }
    });
  });

  it('speaks the words stored in the call, never words from the request', async () => {
    const { provider, spoken } = recordingSpeech();
    await withApp({ speech: provider }, async (app) => {
      const client = app.client();
      const { id, opening } = await startCall(app, client);
      const attempts = [
        speakTurn(client, id, 1, '', JSON.stringify({ text: 'Say something else entirely.' })),
        speakTurn(client, id, 1, '?text=Say%20this%20instead&ssml=%3Cspeak%3E'),
        client.raw(`/api/sessions/${id}/turns/1/speech`, {
          method: 'POST',
          headers: { 'content-type': 'text/plain', 'x-text': 'Say it' },
          body: 'Plain words to say',
        }),
      ];
      for (const res of await Promise.all(attempts)) expect(res.status).toBe(200);
      expect(spoken).toHaveLength(3);
      for (const request of spoken) expect(request.text).toBe(opening);
    });
  });

  it('ignores whatever body it is sent, but refuses one that says it is larger than a JSON request may be', async () => {
    const { provider, spoken } = recordingSpeech();
    await withApp({ speech: provider }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client);
      expect((await speakTurn(client, id, 1, '', 'not json at all {{')).status).toBe(200);
      expect((await speakTurn(client, id, 1, '', '')).status).toBe(200);
      const big = await speakTurn(client, id, 1, '', 'x'.repeat(70_000));
      expect(big.status).toBe(413);
      expect((await errorOf(big)).code).toBe('payload_too_large');
      expect(spoken).toHaveLength(2);
    });
  });

  it('gives the provider the persona’s speaker, the language asked for and the mood the service reports, with no voice when none was chosen', async () => {
    const { provider, spoken } = recordingSpeech();
    await withApp({ speech: provider }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client);
      await speakTurn(client, id, 1);
      await speakTurn(client, id, 1, '?lang=en-IN');
      expect(spoken.map((s) => s.direction)).toEqual([
        { speaker: 'female', language: 'en-GB', mood: 'calm', pace: 'measured', intensity: 0 },
        { speaker: 'female', language: 'en-IN', mood: 'calm', pace: 'measured', intensity: 0 },
      ]);
    });
  });

  it.each([
    ['calm', 'measured', 0],
    ['concerned', 'brisk', 0.25],
    ['frustrated', 'firm', 0.5],
    ['angry', 'firm', 0.75],
    ['escalating', 'firm', 1],
  ] as const)('speaks a customer in the %s mood at a %s pace', async (mood, pace, intensity) => {
    const { provider, spoken } = recordingSpeech();
    await withApp({ speech: provider }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client, { mood });
      expect((await speakTurn(client, id, 1)).status).toBe(200);
      expect(spoken[0]?.direction).toMatchObject({ mood, pace, intensity });
    });
  });

  it('follows the mood the service reports for each turn, as the call heats up and cools down', async () => {
    const { provider, spoken } = recordingSpeech();
    await withApp({ speech: provider }, async (app) => {
      const client = app.client();
      const moods: TemperatureBandId[] = ['angry', 'frustrated', 'concerned', 'escalating'];
      const turns = moods.flatMap((mood, i): FakeTurn[] => [
        customer(i * 2 + 1, `Customer words ${i * 2 + 1}.`, mood),
        trainee(i * 2 + 2),
      ]);
      const { id } = await startCall(app, client, { turns });
      for (const index of [1, 3, 5, 7])
        expect((await speakTurn(client, id, index)).status).toBe(200);
      expect(spoken.map((s) => s.direction.mood)).toEqual(moods);
      expect(spoken.map((s) => s.text)).toEqual([
        'Customer words 1.',
        'Customer words 3.',
        'Customer words 5.',
        'Customer words 7.',
      ]);
    });
  });

  it('passes on that the customer is cooling down, only when the service says so', async () => {
    const { provider, spoken } = recordingSpeech();
    await withApp({ speech: provider }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client, {
        turns: [
          { ...customer(1, 'First.', 'angry') },
          trainee(2),
          { ...customer(3, 'Second.', 'frustrated'), recovering: true },
        ],
      });
      await speakTurn(client, id, 1);
      await speakTurn(client, id, 3);
      expect(spoken[0]?.direction).not.toHaveProperty('recovering');
      expect(spoken[1]?.direction).toMatchObject({ mood: 'frustrated', recovering: true });
    });
  });

  it('keeps the persona’s speaker for a whole call when no voice is chosen, so calls saved before voices were chosen sound as they did', async () => {
    const { provider, spoken } = recordingSpeech();
    await withApp({ speech: provider }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client, {
        speaker: 'male',
        turns: [
          customer(1, 'One.'),
          trainee(2),
          customer(3, 'Three.'),
          trainee(4),
          customer(5, 'Five.'),
        ],
      });
      for (const index of [1, 3, 5]) await speakTurn(client, id, index);
      expect(new Set(spoken.map((s) => s.direction.speaker))).toEqual(new Set(['male']));
    });
  });

  it('never tells the browser which speaker was chosen', async () => {
    await withApp({ speech: createMockSpeechProvider() }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client, { speaker: 'male' });
      const res = await speakTurn(client, id, 1);
      expect(JSON.stringify([...res.headers])).not.toMatch(/speaker|female|male/i);
      expect((await client.get('/api/config')).body.speech.voices).toBeDefined();
      expect(JSON.stringify((await client.get('/api/config')).body)).not.toMatch(
        /speaker|female|male/i,
      );
    });
  });

  it("refuses a turn that is the trainee's, so it cannot be used to speak the trainee's words", async () => {
    const { provider, spoken } = recordingSpeech();
    await withApp({ speech: provider }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client, {
        turns: [customer(1, 'Hello.'), trainee(2, 'Hello, I am Sam. What is happening?')],
      });
      const res = await speakTurn(client, id, 2);
      expect(res.status).toBe(400);
      expect(await errorOf(res)).toEqual({
        code: 'bad_request',
        message: "Only the customer's turns can be spoken.",
        retryable: false,
      });
      expect(spoken).toHaveLength(0);
    });
  });

  it('finds no turn for an index that is not a turn of the call', async () => {
    await withApp({ speech: createMockSpeechProvider() }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client);
      for (const index of [2, 99, 0, -1, '1.5', '1e3', 'abc', '%20', '999999', '1;2']) {
        const res = await speakTurn(client, id, index);
        expect(res.status, String(index)).toBe(404);
        expect((await errorOf(res)).code).toBe('not_found');
      }
    });
  });

  it('is not available to another browser profile, or for a session that does not exist', async () => {
    const { provider, spoken } = recordingSpeech();
    await withApp({ speech: provider }, async (app) => {
      const owner = app.client();
      const { id } = await startCall(app, owner);
      const stranger = app.client();
      for (const res of [
        await speakTurn(stranger, id, 1),
        await speakTurn(stranger, 'call-99999999', 1),
        await speakTurn(stranger, 'nonsense', 1),
      ]) {
        expect(res.status).toBe(404);
        expect(await errorOf(res)).toMatchObject({
          code: 'not_found',
          message: 'That session was not found.',
        });
      }
      expect(spoken).toHaveLength(0);
      expect((await speakTurn(owner, id, 1)).status).toBe(200);
    });
  });

  it('refuses a language that is not offered', async () => {
    const { provider, spoken } = recordingSpeech();
    await withApp({ speech: provider }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client);
      for (const lang of ['fr-FR', 'xx', 'en-gb']) {
        const res = await speakTurn(client, id, 1, `?lang=${lang}`);
        expect(res.status, lang).toBe(400);
        expect((await errorOf(res)).code).toBe('validation_failed');
      }
      expect(spoken).toHaveLength(0);
    });
  });

  it('says so, with 503, when speech is not turned on', async () => {
    await withApp({ speech: createNoneSpeechProvider() }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client);
      const res = await speakTurn(client, id, 1);
      expect(res.status).toBe(503);
      expect(await errorOf(res)).toEqual({
        code: 'speech_unavailable',
        message:
          "The customer's voice is not turned on for this server, so read their reply instead.",
        retryable: false,
      });
    });
  });

  it('is only a POST: it does not exist as a GET', async () => {
    await withApp({ speech: createMockSpeechProvider() }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client);
      for (const method of ['GET', 'PUT', 'DELETE']) {
        const res = await client.raw(`/api/sessions/${id}/turns/1/speech`, { method });
        expect(res.status, method).toBe(405);
      }
    });
  });

  it('maps every way the provider can fail to its own status and code', async () => {
    const cases: [SpeechErrorCode, number, boolean][] = [
      ['speech_unavailable', 503, false],
      ['speech_failed', 502, true],
      ['speech_timeout', 504, true],
      ['speech_rate_limited', 429, true],
    ];
    for (const [code, status, retryable] of cases) {
      await withApp({ speech: failingSpeech(code, retryable) }, async (app) => {
        const client = app.client();
        const { id } = await startCall(app, client);
        const res = await speakTurn(client, id, 1);
        expect(res.status, code).toBe(status);
        expect(await res.json()).toEqual({
          error: { code, message: `Message for ${code}.`, retryable },
        });
      });
    }
  });

  it('refuses a line with nothing in it to speak, the same way whichever provider is behind it', async () => {
    await withApp({ speech: createMockSpeechProvider() }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client, {
        turns: [customer(1, '*sighs*'), customer(3, '{"mood":"angry"}')],
      });
      for (const index of [1, 3]) {
        const res = await speakTurn(client, id, index);
        expect(res.status).toBe(502);
        expect(await errorOf(res)).toEqual({
          code: 'speech_failed',
          message: 'There is nothing to speak in that line.',
          retryable: false,
        });
      }
    });
  });
});

describe('the voice a trainee chooses', () => {
  it('reaches the provider as one of the four ids, on a customer turn, with the old pairing left for the rest', async () => {
    const { provider, spoken } = recordingSpeech();
    await withApp({ speech: provider }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client);
      for (const voice of VOICE_IDS) {
        const res = await speakTurn(client, id, 1, `?voice=${voice}`);
        expect(res.status, voice).toBe(200);
        expect(res.headers.get('x-firefly-speech-voice-id'), voice).toBe(voice);
      }
      expect(spoken.map((s) => s.direction.voice)).toEqual([...VOICE_IDS]);
      // The pairing is still sent, as a hint for providers that need one, and is never shown.
      expect(spoken[0]?.direction.speaker).toBe('female');
    });
  });

  it('is checked against the catalogue before anything is spoken, so an unknown id is refused', async () => {
    const { provider, spoken } = recordingSpeech();
    await withApp({ speech: provider }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client);
      for (const voice of [
        'voice-e',
        'Voice-A',
        'voice-a%20',
        'voice-0',
        'female',
        'male',
        '',
        'en-GB-SoniaNeural',
      ]) {
        const res = await speakTurn(client, id, 1, `?voice=${voice}`);
        expect(res.status, voice).toBe(400);
        expect((await errorOf(res)).code).toBe('validation_failed');
      }
      expect(spoken).toHaveLength(0);
    });
  });

  it('speaks with the voice for the language asked for, through Azure, and leaves the old pairing alone when none is chosen', async () => {
    const fake = await startFakeAzureSpeech();
    try {
      const azure = createAzureSpeechProvider(
        {
          kind: 'azure-speech',
          apiKey: fake.key,
          sttUrl: fake.sttUrl,
          ttsUrl: fake.ttsUrl,
          voices: { female: null, male: null },
          timeoutMs: 1000,
        },
        { sleep: () => Promise.resolve() },
      );
      await withApp({ speech: azure }, async (app) => {
        const client = app.client();
        const { id } = await startCall(app, client);
        for (const language of SPEECH_LANGUAGES) {
          for (const voice of VOICE_IDS) {
            const res = await speakTurn(client, id, 1, `?lang=${language}&voice=${voice}`);
            expect(res.headers.get('x-firefly-speech-voice'), `${language} ${voice}`).toBe(
              VOICE_CATALOGUE[language][voice],
            );
            expect(res.headers.get('x-firefly-speech-voice-id')).toBe(voice);
            expect(fake.requests.at(-1)?.text).toContain(`xml:lang="${language}"`);
          }
        }
        // No id: the persona's pairing, exactly as before.
        const old = await speakTurn(client, id, 1);
        expect(old.headers.get('x-firefly-speech-voice')).toBe('en-GB-SoniaNeural');
        expect(old.headers.get('x-firefly-speech-voice-id')).toBe('none');
      });
    } finally {
      await fake.close();
    }
  });
});

describe('POST /api/speech/preview ("Test voice")', () => {
  it('speaks one short, fixed sentence in the chosen voice, calmly, in one request to the provider', async () => {
    const { provider, spoken } = recordingSpeech();
    await withApp({ speech: provider }, async (app) => {
      const res = await preview(app.client(), '?voice=voice-b');
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('audio/wav');
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('x-firefly-speech-provider')).toBe('mock');
      expect(res.headers.get('x-firefly-speech-voice-id')).toBe('voice-b');
      expect(validateWav(Buffer.from(await res.arrayBuffer())).ok).toBe(true);
      expect(spoken).toHaveLength(1);
      expect(spoken[0]?.text).toBe(VOICE_PREVIEW_TEXT);
      expect(spoken[0]?.direction).toMatchObject({
        language: 'en-GB',
        mood: 'calm',
        pace: 'measured',
        intensity: 0,
        voice: 'voice-b',
      });
    });
  });

  it('needs no call, and works for a browser that has never had one', async () => {
    await withApp({ speech: createMockSpeechProvider() }, async (app) => {
      for (const voice of VOICE_IDS) {
        const res = await preview(app.client(), `?voice=${voice}&lang=en-US`);
        expect(res.status, voice).toBe(200);
        expect(res.headers.get('x-firefly-speech-voice-id')).toBe(voice);
      }
    });
  });

  it('says the same sentence whatever the request carries: the words are fixed on the server', async () => {
    const { provider, spoken } = recordingSpeech();
    await withApp({ speech: provider }, async (app) => {
      const client = app.client();
      const attempts = [
        preview(
          client,
          '?voice=voice-a&text=Say%20something%20else',
          JSON.stringify({ text: 'Say it.' }),
        ),
        preview(client, '?voice=voice-a&ssml=%3Cspeak%3E'),
        client.raw('/api/speech/preview?voice=voice-a', {
          method: 'POST',
          headers: { 'content-type': 'text/plain', 'x-text': 'Say it' },
          body: 'Plain words to say',
        }),
      ];
      for (const res of await Promise.all(attempts)) expect(res.status).toBe(200);
      expect(spoken.map((s) => s.text)).toEqual([
        VOICE_PREVIEW_TEXT,
        VOICE_PREVIEW_TEXT,
        VOICE_PREVIEW_TEXT,
      ]);
    });
  });

  it('needs a voice, one of the four, and a language that is offered, and asks nothing of the provider otherwise', async () => {
    const { provider, spoken } = recordingSpeech();
    await withApp({ speech: provider }, async (app) => {
      const client = app.client();
      for (const query of [
        '',
        '?lang=en-GB',
        '?voice=',
        '?voice=voice-e',
        '?voice=Voice-A',
        '?voice=female',
        '?voice=en-GB-SoniaNeural',
        '?voice=voice-a&lang=fr-FR',
        '?voice=voice-a&lang=',
      ]) {
        const res = await preview(client, query);
        expect(res.status, query).toBe(400);
        expect((await errorOf(res)).code, query).toBe('validation_failed');
      }
      expect(spoken).toHaveLength(0);
    });
  });

  it('refuses a body that says it is larger than a JSON request may be, without reading it', async () => {
    const { provider, spoken } = recordingSpeech();
    await withApp({ speech: provider }, async (app) => {
      const res = await preview(app.client(), '?voice=voice-a', 'x'.repeat(70_000));
      expect(res.status).toBe(413);
      expect(spoken).toHaveLength(0);
    });
  });

  it('says so, with 503, when speech is not turned on, without calling any provider', async () => {
    await withApp({ speech: createNoneSpeechProvider() }, async (app) => {
      const res = await preview(app.client(), '?voice=voice-a');
      expect(res.status).toBe(503);
      expect(await errorOf(res)).toEqual({
        code: 'speech_unavailable',
        message:
          "The customer's voice is not turned on for this server, so read their reply instead.",
        retryable: false,
      });
    });
  });

  it('is only a POST, and refuses a cross-site request', async () => {
    await withApp({ speech: createMockSpeechProvider() }, async (app) => {
      const client = app.client();
      for (const method of ['GET', 'PUT', 'DELETE']) {
        expect(
          (await client.raw('/api/speech/preview?voice=voice-a', { method })).status,
          method,
        ).toBe(405);
      }
      const cross = await client.raw('/api/speech/preview?voice=voice-a', {
        method: 'POST',
        headers: { origin: 'https://evil.example' },
      });
      expect(cross.status).toBe(403);
    });
  });

  it('maps every way the provider can fail to its own status and code, like every other speech request', async () => {
    const cases: [SpeechErrorCode, number, boolean][] = [
      ['speech_unavailable', 503, false],
      ['speech_failed', 502, true],
      ['speech_timeout', 504, true],
      ['speech_rate_limited', 429, true],
    ];
    for (const [code, status, retryable] of cases) {
      await withApp({ speech: failingSpeech(code, retryable) }, async (app) => {
        const res = await preview(app.client(), '?voice=voice-c');
        expect(res.status, code).toBe(status);
        const body = await res.json();
        expect(body).toEqual({ error: { code, message: `Message for ${code}.`, retryable } });
        expect(JSON.stringify(body)).not.toContain('inner detail');
      });
    }
  });

  it('does not use up a failure that was queued for a customer turn', async () => {
    await withApp({ speech: createMockSpeechProvider(), testHooks: true }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client);
      await client.post('/api/test/fail-next', { target: 'synthesize' });
      expect((await preview(client, '?voice=voice-a')).status).toBe(200);
      expect((await speakTurn(client, id, 1)).status).toBe(502);
      expect((await speakTurn(client, id, 1)).status).toBe(200);
    });
  });

  it('counts against the same speech limits as every other speech request, per browser and for the whole server', async () => {
    await withApp({ speech: createMockSpeechProvider() }, async (app) => {
      const client = app.client();
      const statuses: number[] = [];
      let limited: Response | null = null;
      for (let i = 0; i < 100 && !limited; i++) {
        const res = await preview(client, '?voice=voice-a');
        if (res.status === 429) limited = res;
        else statuses.push(res.status);
      }
      expect(limited).not.toBeNull();
      // 60 at once, plus at most a few refilled (one a second) while the loop ran.
      expect(statuses.length).toBeGreaterThanOrEqual(60);
      expect(statuses.length).toBeLessThanOrEqual(66);
      expect(await errorOf(limited as Response)).toMatchObject({
        code: 'rate_limited',
        retryable: true,
      });
      // The same allowance is used up for a recording, and another browser has its own.
      expect((await transcribe(client, recording(1))).status).toBe(429);
      expect((await preview(app.client(), '?voice=voice-a')).status).toBe(200);
    });
  });

  describe('with Azure AI Speech (a local fake of its REST endpoints)', () => {
    let fake: FakeAzureSpeech;
    beforeAll(async () => {
      fake = await startFakeAzureSpeech();
    });
    afterEach(() => fake.reset());
    afterAll(() => fake.close());

    const azure = () =>
      createAzureSpeechProvider(
        {
          kind: 'azure-speech',
          apiKey: fake.key,
          sttUrl: fake.sttUrl,
          ttsUrl: fake.ttsUrl,
          voices: { female: null, male: null },
          timeoutMs: 1000,
        },
        { sleep: () => Promise.resolve() },
      );

    it('sends Azure the fixed sentence in the voice for the language and the choice, one request each, and nothing else', async () => {
      await withApp({ speech: azure() }, async (app) => {
        const client = app.client();
        for (const language of SPEECH_LANGUAGES) {
          for (const voice of VOICE_IDS) {
            fake.reset();
            const res = await preview(client, `?voice=${voice}&lang=${language}`);
            expect(res.status, `${language} ${voice}`).toBe(200);
            expect(fake.requests).toHaveLength(1);
            const sent = fake.requests[0];
            expect(sent?.service).toBe('tts');
            expect(sent?.headers['ocp-apim-subscription-key']).toBe(fake.key);
            expect(sent?.text).toContain(`<voice name="${VOICE_CATALOGUE[language][voice]}">`);
            expect(sent?.text).toContain(`xml:lang="${language}"`);
            expect(sent?.text).toContain(escapeXml(cleanText(VOICE_PREVIEW_TEXT)));
            expect(res.headers.get('x-firefly-speech-voice')).toBe(
              VOICE_CATALOGUE[language][voice],
            );
            expect(res.headers.get('x-firefly-speech-style')).toBe('none');
            expect(res.headers.get('content-type')).toBe('audio/mpeg');
            expect(Buffer.from(await res.arrayBuffer()).equals(fakeMp3())).toBe(true);
          }
        }
      });
    });

    it('is told apart by pace between the four choices, and stays calm: no style, no pitch change', async () => {
      await withApp({ speech: azure() }, async (app) => {
        const client = app.client();
        const rates: Record<string, string> = {};
        for (const voice of VOICE_IDS) {
          fake.reset();
          await preview(client, `?voice=${voice}&lang=en-US`);
          const ssml = fake.requests[0]?.text ?? '';
          expect(ssml).not.toContain('express-as');
          expect(ssml).not.toContain('pitch=');
          rates[voice] = /rate="([+-]\d+%)"/.exec(ssml)?.[1] ?? '';
        }
        expect(rates).toEqual({
          'voice-a': '-6%',
          'voice-b': '+0%',
          'voice-c': '-10%',
          'voice-d': '-2%',
        });
      });
    });

    it('reports a service that is down as a failure the trainee can retry, and never passes on what Azure said', async () => {
      await withApp({ speech: azure() }, async (app) => {
        fake.enqueue(
          { status: 500, text: FAKE_PROVIDER_ERROR_TEXT },
          { status: 500, text: FAKE_PROVIDER_ERROR_TEXT },
        );
        const res = await preview(app.client(), '?voice=voice-a');
        expect(res.status).toBe(502);
        expect(await errorOf(res)).toEqual({
          code: 'speech_failed',
          message: SPEECH_MESSAGES.failed,
          retryable: true,
        });
      });
    });
  });
});

// ---------------------------------------------------------------------------------------

describe('trying again after a failure never makes anything twice', () => {
  const snapshot = (app: SpeechTestApp, id: string) => JSON.stringify(app.calls.get(id).turns);

  it('a recording that failed to transcribe is transcribed on the retry, and no turn is created by either request', async () => {
    const { provider, calls } = flakySpeech({ transcribe: 1 });
    await withApp({ speech: provider }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client);
      const before = snapshot(app, id);
      const upload = recording(1.2);

      const failed = await transcribe(client, upload);
      expect(failed.status).toBe(502);
      expect(await errorOf(failed)).toMatchObject({ code: 'speech_failed', retryable: true });
      const retried = await transcribe(client, upload);
      expect(retried.status).toBe(200);
      expect(await retried.json()).toEqual({
        status: 'recognised',
        text: MOCK_UTTERANCES[0],
        durationMs: 1200,
      });
      // The failed attempt did not use up a recognised line, and the call is exactly as it was.
      expect(calls.transcribe).toBe(2);
      expect(snapshot(app, id)).toBe(before);
    });
  });

  it('a customer line that failed to speak is spoken on the retry, once, and the call is exactly as it was', async () => {
    const { provider, calls } = flakySpeech({ synthesize: 1 });
    await withApp({ speech: provider }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client);
      const before = snapshot(app, id);

      const failed = await speakTurn(client, id, 1, '?voice=voice-b');
      expect(failed.status).toBe(502);
      expect(failed.headers.get('x-firefly-speech-provider')).toBeNull();
      expect(await errorOf(failed)).toMatchObject({ code: 'speech_failed', retryable: true });
      const retried = await speakTurn(client, id, 1, '?voice=voice-b');
      expect(retried.status).toBe(200);
      expect(retried.headers.get('x-firefly-speech-voice-id')).toBe('voice-b');
      const again = await speakTurn(client, id, 1, '?voice=voice-b');
      expect(
        Buffer.from(await again.arrayBuffer()).equals(Buffer.from(await retried.arrayBuffer())),
      ).toBe(true);
      expect(calls.synthesize).toBe(3);
      expect(snapshot(app, id)).toBe(before);
    });
  });

  it('a voice preview that failed is tried again without touching any call', async () => {
    const { provider } = flakySpeech({ synthesize: 1 });
    await withApp({ speech: provider }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client);
      const before = snapshot(app, id);
      expect((await preview(client, '?voice=voice-d')).status).toBe(502);
      expect((await preview(client, '?voice=voice-d')).status).toBe(200);
      expect(snapshot(app, id)).toBe(before);
    });
  });
});

// ---------------------------------------------------------------------------------------

describe('both endpoints share one rate limit per browser profile', () => {
  it('allows 60 requests and then answers 429, whichever endpoint is used', async () => {
    await withApp({ speech: createMockSpeechProvider() }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client);
      // Cheap requests that still count: a wrong media type, a turn that does not exist, a preview
      // that names no voice.
      const statuses: number[] = [];
      let limited: Response | null = null;
      for (let i = 0; i < 100 && !limited; i++) {
        const res =
          i % 3 === 0
            ? await transcribe(client, 'x', '', 'text/plain')
            : i % 3 === 1
              ? await speakTurn(client, id, 99)
              : await preview(client);
        if (res.status === 429) limited = res;
        else statuses.push(res.status);
      }
      expect(limited).not.toBeNull();
      // 60 at once, plus at most a few refilled (one a second) while the loop ran.
      expect(statuses.length).toBeGreaterThanOrEqual(60);
      expect(statuses.length).toBeLessThanOrEqual(66);
      expect(new Set(statuses)).toEqual(new Set([415, 404, 400]));
      expect(await errorOf(limited as Response)).toMatchObject({
        code: 'rate_limited',
        retryable: true,
      });
      // The next request of any kind is limited too, and another profile has its own allowance.
      expect((await transcribe(client, recording(1))).status).toBe(429);
      expect((await speakTurn(client, id, 1)).status).toBe(429);
      expect((await preview(client, '?voice=voice-a')).status).toBe(429);
      expect((await transcribe(app.client(), recording(1))).status).toBe(200);
    });
  });

  it('also stops a caller that keeps dropping its cookie, with one allowance for the whole server', async () => {
    await withApp({ speech: createMockSpeechProvider() }, async (app) => {
      const statuses: number[] = [];
      for (let i = 0; i < 160; i++) {
        // A new client has no cookie, so it always starts with a full per-profile allowance.
        statuses.push((await transcribe(app.client(), recording(1))).status);
      }
      const accepted = statuses.filter((status) => status === 200).length;
      // 120 at once, plus at most a few refilled (four a second) while the loop ran.
      expect(accepted).toBeGreaterThanOrEqual(120);
      expect(accepted).toBeLessThanOrEqual(130);
      expect(new Set(statuses)).toEqual(new Set([200, 429]));
    });
  });
});

// ---------------------------------------------------------------------------------------

describe('requests that never reach a route or that are given up on', () => {
  it('are logged under a constant label, never with the path or the whole session id', async () => {
    const lines: string[] = [];
    const log = createLogger((line) => lines.push(line));
    let sessionId = '';
    await withApp({ speech: createMockSpeechProvider(), log }, async (app) => {
      const client = app.client();
      sessionId = (await startCall(app, client)).id;
      // The speech route only exists for POST: a GET fails before any route matches.
      expect((await client.raw(`/api/sessions/${sessionId}/turns/1/speech`)).status).toBe(405);
    });
    const events = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    const refused = events.filter((e) => e.event === 'request' && e.status === 405);
    expect(refused).toHaveLength(1);
    expect(refused[0]).toMatchObject({ route: 'unmatched', sessionId: sessionId.slice(0, 8) });
    expect(lines.join('\n')).not.toContain(sessionId);
  });

  it('answer a malformed percent-escape in the address with 404, not a server error', async () => {
    const lines: string[] = [];
    const log = createLogger((line) => lines.push(line));
    await withApp({ speech: createMockSpeechProvider(), log }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client);
      const res = await speakTurn(client, id, '%');
      expect(res.status).toBe(404);
      expect(await errorOf(res)).toMatchObject({ code: 'not_found', retryable: false });
      expect((await client.raw('/api/sessions/%zz')).status).toBe(404);
    });
    expect(lines.join('\n')).not.toContain('request.error');
  });

  it('log an upload the browser abandons as cancelled, not as a server error', async () => {
    const lines: string[] = [];
    const log = createLogger((line) => lines.push(line));
    await withApp({ speech: createMockSpeechProvider(), log }, async (app) => {
      const { port } = new URL(app.baseUrl);
      await new Promise<void>((resolve) => {
        const socket = net.connect(Number(port), '127.0.0.1', () => {
          // Promise a large recording, send a little of it, then hang up.
          socket.write(
            'POST /api/speech/transcribe HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: audio/wav\r\nContent-Length: 200000\r\n\r\n' +
              'x'.repeat(1000),
          );
          setTimeout(() => {
            socket.destroy();
            setTimeout(resolve, 200);
          }, 100);
        });
        socket.on('error', () => undefined);
      });
    });
    const events = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(events.some((e) => e.event === 'request.error')).toBe(false);
    expect(events.find((e) => e.event === 'request')).toMatchObject({ status: 499 });
  });
});

// ---------------------------------------------------------------------------------------

describe('with Azure AI Speech (a local fake of its REST endpoints)', () => {
  let fake: FakeAzureSpeech;
  beforeAll(async () => {
    fake = await startFakeAzureSpeech();
  });
  afterEach(() => fake.reset());
  afterAll(() => fake.close());

  const azure = (extra: Partial<Parameters<typeof createAzureSpeechProvider>[0]> = {}) =>
    createAzureSpeechProvider(
      {
        kind: 'azure-speech',
        apiKey: fake.key,
        sttUrl: fake.sttUrl,
        ttsUrl: fake.ttsUrl,
        voices: { female: null, male: null },
        timeoutMs: 2000,
        ...extra,
      },
      { sleep: () => Promise.resolve() },
    );

  it('turns a recording into text with the key, the right content type and the chosen language', async () => {
    await withApp({ speech: azure() }, async (app) => {
      const upload = recording(2);
      const res = await transcribe(app.client(), upload, '?lang=en-US');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: 'recognised',
        text: FAKE_RECOGNISED_TEXT,
        durationMs: 2000,
      });
      const sent = fake.requests[0];
      expect(sent?.headers['ocp-apim-subscription-key']).toBe(fake.key);
      expect(sent?.headers['content-type']).toBe('audio/wav; codecs=audio/pcm; samplerate=16000');
      expect(sent?.query).toEqual({ language: 'en-US', format: 'simple', profanity: 'raw' });
      expect(sent?.body.equals(upload)).toBe(true);
    });
  });

  it('keeps what the trainee said, profanity included, in the answer', async () => {
    await withApp({ speech: azure() }, async (app) => {
      const said = 'Honestly, this is crap, and I want it fixed.';
      fake.enqueue({ recognition: 'Success', text: said });
      const heard = await transcribe(app.client(), recording(1));
      expect(await heard.json()).toEqual({ status: 'recognised', text: said, durationMs: 1000 });
    });
  });

  it('forwards a clean copy of the audio, whatever extra chunks the upload carried', async () => {
    await withApp({ speech: azure() }, async (app) => {
      const clean = recording(1);
      const extra = Buffer.concat([
        Buffer.from('LIST', 'latin1'),
        Buffer.from([4, 0, 0, 0]),
        Buffer.from('INFO'),
      ]);
      const messy = Buffer.concat([clean.subarray(0, 36), extra, clean.subarray(36)]);
      expect((await transcribe(app.client(), messy)).status).toBe(200);
      expect(fake.requests[0]?.body.equals(clean)).toBe(true);
    });
  });

  it.each(['NoMatch', 'InitialSilenceTimeout', 'BabbleTimeout'] as const)(
    'answers %s as a recording with no speech in it',
    async (recognition) => {
      await withApp({ speech: azure() }, async (app) => {
        fake.enqueue({ recognition });
        const res = await transcribe(app.client(), recording(1));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ status: 'no-speech', text: '', durationMs: 1000 });
      });
    },
  );

  it('sends Azure nothing about the profile or the session beyond the customer line itself', async () => {
    await withApp({ speech: azure() }, async (app) => {
      const client = app.client();
      const profileId = await client.profileId();
      expect(profileId).toHaveLength(32);
      const { id, opening } = await startCall(app, client);
      await transcribe(client, recording(1), '?lang=en-US');
      await speakTurn(client, id, 1);
      await preview(client, '?voice=voice-a');
      expect(fake.requests.map((r) => r.service)).toEqual(['stt', 'tts', 'tts']);

      for (const request of fake.requests) {
        // The line being spoken is the one thing that may carry words of the call, so it is taken out first.
        const line = escapeXml(cleanText(opening));
        const seen = [
          request.path,
          request.search,
          JSON.stringify(request.headers),
          request.service === 'tts' ? request.text.replace(line, '') : '',
        ].join('\n');
        for (const text of [profileId, id]) expect(seen, text).not.toContain(text);
      }
      expect(fake.requests[1]?.text).toContain(escapeXml(cleanText(opening)));
    });
  });

  it('speaks a calm customer with a voice that has no styles, using pace alone', async () => {
    await withApp({ speech: azure() }, async (app) => {
      const client = app.client();
      const { id, opening } = await startCall(app, client);
      const res = await speakTurn(client, id, 1);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('audio/mpeg');
      expect(res.headers.get('x-firefly-speech-provider')).toBe('azure-speech');
      expect(res.headers.get('x-firefly-speech-voice')).toBe('en-GB-SoniaNeural');
      expect(res.headers.get('x-firefly-speech-style')).toBe('none');
      expect(Buffer.from(await res.arrayBuffer()).equals(fakeMp3())).toBe(true);

      const sent = fake.requests[0];
      expect(sent?.headers['ocp-apim-subscription-key']).toBe(fake.key);
      expect(sent?.headers['content-type']).toBe('application/ssml+xml');
      expect(sent?.headers['x-microsoft-outputformat']).toBe('audio-24khz-48kbitrate-mono-mp3');
      expect(sent?.text).toBe(
        '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-GB">' +
          `<voice name="en-GB-SoniaNeural"><prosody rate="-4%">${escapeXml(cleanText(opening))}</prosody></voice></speak>`,
      );
    });
  });

  it('shows an angry customer by pace and pitch on a British voice, and says no style was applied', async () => {
    await withApp({ speech: azure() }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client, { mood: 'angry' });
      const res = await speakTurn(client, id, 1);
      expect(res.headers.get('x-firefly-speech-voice')).toBe('en-GB-SoniaNeural');
      expect(res.headers.get('x-firefly-speech-style')).toBe('none');
      expect(fake.requests[0]?.text).toContain('<prosody rate="+11%" pitch="-3%">');
      expect(fake.requests[0]?.text).not.toContain('express-as');
    });
  });

  it.each([
    ['frustrated', 'unfriendly', '0.55', '+8%'],
    ['angry', 'angry', '0.73', '+11%'],
  ] as const)(
    "applies the %s customer's style, at a reduced degree, on a US voice that lists it",
    async (mood, style, degree, rate) => {
      await withApp({ speech: azure() }, async (app) => {
        const client = app.client();
        const { id } = await startCall(app, client, { mood });
        const res = await speakTurn(client, id, 1, '?lang=en-US');
        expect(res.status).toBe(200);
        expect(res.headers.get('x-firefly-speech-voice')).toBe('en-US-AriaNeural');
        expect(res.headers.get('x-firefly-speech-style')).toBe(style);
        const ssml = fake.requests[0]?.text ?? '';
        expect(ssml).toContain(`<mstts:express-as style="${style}" styledegree="${degree}">`);
        expect(ssml).toContain(`<prosody rate="${rate}">`);
        expect(ssml).not.toContain('pitch=');
        expect(ssml).not.toContain('shouting');
      });
    },
  );

  it('speaks a customer who is cooling down more slowly, and without a style, even in an angry band', async () => {
    await withApp({ speech: azure() }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client, {
        turns: [{ ...customer(1, 'Thank you, that helps.', 'angry'), recovering: true }],
      });
      const res = await speakTurn(client, id, 1, '?lang=en-US&voice=voice-b');
      expect(res.headers.get('x-firefly-speech-style')).toBe('none');
      const ssml = fake.requests[0]?.text ?? '';
      expect(ssml).not.toContain('express-as');
      // Angry is +11% and -3% pitch. Cooling down halves them (5.5, -1.5) and slows the pace by 3
      // (2.5), and Voice B adds its own 4 to the pace (6.5): so +7% and, rounded, -1%.
      expect(ssml).toContain('<prosody rate="+7%" pitch="-1%">');
    });
  });

  it('uses the voice for each language, and a male voice for a male persona, when no voice is chosen', async () => {
    const expected: [SpeechLanguage, string, string][] = [
      ['en-GB', 'en-GB-SoniaNeural', 'en-GB-RyanNeural'],
      ['en-US', 'en-US-AriaNeural', 'en-US-GuyNeural'],
      ['en-IE', 'en-IE-EmilyNeural', 'en-IE-ConnorNeural'],
      ['en-AU', 'en-AU-NatashaNeural', 'en-AU-WilliamNeural'],
      ['en-IN', 'en-IN-NeerjaNeural', 'en-IN-PrabhatNeural'],
    ];
    for (const [speaker, index] of [
      ['female', 1],
      ['male', 2],
    ] as const) {
      await withApp({ speech: azure() }, async (app) => {
        const client = app.client();
        const { id } = await startCall(app, client, { speaker });
        for (const row of expected) {
          const res = await speakTurn(client, id, 1, `?lang=${row[0]}`);
          expect(res.headers.get('x-firefly-speech-voice'), row[0]).toBe(row[index]);
          expect(fake.requests.at(-1)?.text).toContain(`xml:lang="${row[0]}"`);
        }
      });
    }
  });

  it("uses an administrator's own voice for the old pairing, and applies a style to it only if its documentation lists one, but never replaces a chosen voice", async () => {
    await withApp(
      { speech: azure({ voices: { female: 'en-GB-LibbyNeural', male: null } }) },
      async (app) => {
        const client = app.client();
        const { id } = await startCall(app, client, { mood: 'angry' });
        const res = await speakTurn(client, id, 1, '?lang=en-US');
        expect(res.headers.get('x-firefly-speech-voice')).toBe('en-GB-LibbyNeural');
        expect(res.headers.get('x-firefly-speech-style')).toBe('none');
        expect(fake.requests[0]?.text).toContain('xml:lang="en-GB"');
        const chosen = await speakTurn(client, id, 1, '?lang=en-US&voice=voice-b');
        expect(chosen.headers.get('x-firefly-speech-voice')).toBe('en-US-AriaNeural');
      },
    );
  });

  describe.each([
    ['speech to text', 'transcribe'],
    ['text to speech', 'speak'],
  ] as const)('%s failures', (_label, endpoint) => {
    const call = async (app: SpeechTestApp) => {
      const client = app.client();
      if (endpoint === 'transcribe') return transcribe(client, recording(1));
      const { id } = await startCall(app, client);
      return speakTurn(client, id, 1);
    };

    it.each<[string, Step[], number, string, boolean, string]>([
      [
        'a rejected key',
        [{ status: 401, json: { error: { message: FAKE_PROVIDER_ERROR_TEXT } } }],
        503,
        'speech_unavailable',
        false,
        SPEECH_MESSAGES.notConfigured,
      ],
      [
        'a forbidden key',
        [{ status: 403, text: FAKE_PROVIDER_ERROR_TEXT }],
        503,
        'speech_unavailable',
        false,
        SPEECH_MESSAGES.notConfigured,
      ],
      [
        'a service that is busy',
        [
          { status: 429, text: 'busy' },
          { status: 429, text: 'busy' },
        ],
        429,
        'speech_rate_limited',
        true,
        SPEECH_MESSAGES.rateLimited,
      ],
      [
        'a server error',
        [
          { status: 500, text: 'oops' },
          { status: 503, text: 'oops' },
        ],
        502,
        'speech_failed',
        true,
        SPEECH_MESSAGES.failed,
      ],
      [
        'a request the service refuses',
        [{ status: 400, text: 'no' }],
        502,
        'speech_failed',
        false,
        SPEECH_MESSAGES.rejected,
      ],
      [
        'a dropped connection',
        [{ drop: true }, { drop: true }],
        502,
        'speech_failed',
        true,
        SPEECH_MESSAGES.unreachable,
      ],
      [
        'an answer that is not usable',
        [{ status: 200, text: 'not what was expected' }],
        502,
        'speech_failed',
        true,
        SPEECH_MESSAGES.badOutput,
      ],
    ])('reports %s', async (_what, steps, status, code, retryable, message) => {
      await withApp({ speech: azure() }, async (app) => {
        fake.enqueue(...steps);
        const res = await call(app);
        expect(res.status).toBe(status);
        expect(await errorOf(res)).toEqual({ code, message, retryable });
      });
    });

    it('reports a service that never answers as a timeout', async () => {
      await withApp({ speech: azure({ timeoutMs: 150 }) }, async (app) => {
        fake.enqueue({ hang: true });
        const res = await call(app);
        expect(res.status).toBe(504);
        expect(await errorOf(res)).toEqual({
          code: 'speech_timeout',
          message: SPEECH_MESSAGES.timeout,
          retryable: true,
        });
      });
    });

    it('recovers when the one retry works', async () => {
      await withApp({ speech: azure() }, async (app) => {
        fake.enqueue({ status: 503, text: 'busy' });
        expect((await call(app)).status).toBe(200);
        expect(fake.requests).toHaveLength(2);
      });
    });

    it('never passes on what the provider said, or the key, in the body or the headers', async () => {
      await withApp({ speech: azure({ apiKey: WRONG_KEY }) }, async (app) => {
        const res = await call(app);
        expect(res.status).toBe(503);
        const text = `${await res.text()}\n${JSON.stringify([...res.headers])}`;
        expect(text).toContain('not configured correctly');
        for (const secret of [
          WRONG_KEY,
          fake.key,
          FAKE_PROVIDER_ERROR_TEXT,
          'Access denied',
          '127.0.0.1',
        ]) {
          expect(text).not.toContain(secret);
        }
      });
    });
  });

  it('reports an Error recognition as a failure the trainee can retry', async () => {
    await withApp({ speech: azure() }, async (app) => {
      fake.enqueue({ recognition: 'Error' });
      const res = await transcribe(app.client(), recording(1));
      expect(res.status).toBe(502);
      expect(await errorOf(res)).toMatchObject({ code: 'speech_failed', retryable: true });
    });
  });
});

// ---------------------------------------------------------------------------------------

describe('what the server logs about speech', () => {
  let fake: FakeAzureSpeech;
  beforeAll(async () => {
    fake = await startFakeAzureSpeech();
  });
  afterAll(() => fake.close());

  it('records identifiers, sizes and timings only: no audio, no words, no key, nothing the provider said', async () => {
    const lines: string[] = [];
    const log = createLogger((line) => lines.push(line));
    const config = (apiKey: string) => ({
      kind: 'azure-speech' as const,
      apiKey,
      sttUrl: fake.sttUrl,
      ttsUrl: fake.ttsUrl,
      voices: { female: null, male: null },
      timeoutMs: 400,
    });
    const provider = createAzureSpeechProvider(config(fake.key), {
      sleep: () => Promise.resolve(),
    });
    const wrongKey = createAzureSpeechProvider(config(WRONG_KEY), {
      sleep: () => Promise.resolve(),
    });

    let opening = '';
    const upload = recording(1.25);
    await withApp({ speech: provider, log }, async (app) => {
      const client = app.client();
      const started = await startCall(app, client);
      opening = started.opening;
      await transcribe(client, upload, '?lang=en-US');
      await speakTurn(client, started.id, 1);
      await preview(client, '?voice=voice-c');
      fake.enqueue(
        { status: 500, text: FAKE_PROVIDER_ERROR_TEXT },
        { status: 500, text: FAKE_PROVIDER_ERROR_TEXT },
      );
      await transcribe(client, upload);
      fake.enqueue({ hang: true });
      await speakTurn(client, started.id, 1);
    });
    await withApp({ speech: wrongKey, log }, async (app) => {
      const client = app.client();
      const started = await startCall(app, client);
      await transcribe(client, upload);
      await speakTurn(client, started.id, 1);
      await preview(client, '?voice=voice-a');
    });

    const events = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(events.map((e) => e.event)).toEqual(
      expect.arrayContaining([
        'speech.transcribed',
        'speech.spoken',
        'speech.previewed',
        'speech.failed',
      ]),
    );

    const transcribed = events.find((e) => e.event === 'speech.transcribed');
    expect(transcribed).toMatchObject({
      level: 'info',
      provider: 'azure-speech',
      bytes: upload.length,
      audioMs: 1250,
      status: 'recognised',
    });
    expect(transcribed?.requestId).toMatch(/^[0-9a-f]{8}$/);
    expect(typeof transcribed?.ms).toBe('number');
    expect(events.find((e) => e.event === 'speech.spoken')).toMatchObject({
      provider: 'azure-speech',
      bytes: fakeMp3().length,
    });
    expect(events.find((e) => e.event === 'speech.previewed')).toMatchObject({
      provider: 'azure-speech',
      voice: 'voice-c',
      bytes: fakeMp3().length,
    });
    const failures = events.filter((e) => e.event === 'speech.failed');
    expect(failures.map((f) => f.code)).toEqual(
      expect.arrayContaining(['speech_failed', 'speech_unavailable']),
    );
    expect(failures.map((f) => f.op)).toEqual(
      expect.arrayContaining(['transcribe', 'speak', 'preview']),
    );

    const everything = lines.join('\n');
    for (const secret of [
      fake.key,
      WRONG_KEY,
      FAKE_PROVIDER_ERROR_TEXT,
      FAKE_RECOGNISED_TEXT,
      opening,
      opening.slice(0, 30),
      'Hello, this is a test of the voice',
      upload.toString('base64').slice(0, 40),
      upload.toString('latin1').slice(0, 44),
      '127.0.0.1',
      'ocp-apim',
    ]) {
      expect(everything).not.toContain(secret);
    }
  });
});

// ---------------------------------------------------------------------------------------
// The browser tests run with FIREFLY_SPEECH_PROVIDER=mock and FIREFLY_TEST_HOOKS=1, and use these
// hooks to prove that a failed recording or a failed voice leaves the call usable.

describe('failure hooks for speech, with the test hooks switched on', () => {
  const failNext = (app: SpeechTestApp, target: string, count?: number) =>
    app.client().post('/api/test/fail-next', count === undefined ? { target } : { target, count });
  const SIMULATED = {
    code: 'speech_failed',
    message: 'The speech service is temporarily unavailable (simulated failure).',
    retryable: true,
  };

  it('fails the next transcription as a retryable speech failure, and the retry goes through', async () => {
    const { provider, heard } = recordingSpeech();
    await withApp({ speech: provider, testHooks: true }, async (app) => {
      const client = app.client();
      expect((await failNext(app, 'transcribe')).body).toEqual({ queued: 1 });

      const failed = await transcribe(client, recording(1));
      expect(failed.status).toBe(502);
      expect(await errorOf(failed)).toEqual(SIMULATED);
      // The provider was never asked, so the demonstration's script has not moved on.
      expect(heard).toHaveLength(0);

      const retried = await transcribe(client, recording(1));
      expect(retried.status).toBe(200);
      expect(await retried.json()).toEqual({
        status: 'recognised',
        text: MOCK_UTTERANCES[0],
        durationMs: 1000,
      });
      expect(heard).toHaveLength(1);
      // The failure was used up.
      expect((await transcribe(client, recording(1))).status).toBe(200);
    });
  });

  it('fails the next spoken reply as a retryable speech failure, and the retry goes through', async () => {
    const { provider, spoken } = recordingSpeech();
    await withApp({ speech: provider, testHooks: true }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client);
      expect((await failNext(app, 'synthesize')).body).toEqual({ queued: 1 });

      const failed = await speakTurn(client, id, 1);
      expect(failed.status).toBe(502);
      expect(failed.headers.get('x-firefly-speech-provider')).toBeNull();
      expect(await errorOf(failed)).toEqual(SIMULATED);
      expect(spoken).toHaveLength(0);

      const retried = await speakTurn(client, id, 1);
      expect(retried.status).toBe(200);
      expect(retried.headers.get('x-firefly-speech-provider')).toBe('mock');
      expect(validateWav(Buffer.from(await retried.arrayBuffer())).ok).toBe(true);
      expect(spoken).toHaveLength(1);
      expect((await speakTurn(client, id, 1)).status).toBe(200);
    });
  });

  it('keeps a separate queue for each kind of call', async () => {
    await withApp({ speech: createMockSpeechProvider(), testHooks: true }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client);

      await failNext(app, 'transcribe');
      expect((await speakTurn(client, id, 1)).status).toBe(200);
      expect((await transcribe(client, recording(1))).status).toBe(502);

      await failNext(app, 'synthesize');
      expect((await transcribe(client, recording(1))).status).toBe(200);
      expect((await speakTurn(client, id, 1)).status).toBe(502);

      // A failure queued for the customer's replies does not touch speech.
      await failNext(app, 'customer');
      expect((await transcribe(client, recording(1))).status).toBe(200);
      expect((await speakTurn(client, id, 1)).status).toBe(200);
    });
  });

  it('fails as many calls as it is asked to, and a count of 0 clears it', async () => {
    await withApp({ speech: createMockSpeechProvider(), testHooks: true }, async (app) => {
      const client = app.client();
      await failNext(app, 'transcribe', 2);
      const statuses: number[] = [];
      for (let i = 0; i < 4; i++) statuses.push((await transcribe(client, recording(1))).status);
      expect(statuses).toEqual([502, 502, 200, 200]);

      await failNext(app, 'transcribe', 3);
      await failNext(app, 'transcribe', 0);
      expect((await transcribe(client, recording(1))).status).toBe(200);
    });
  });

  it('is not used up by a request that never reaches the provider', async () => {
    const { provider, heard, spoken } = recordingSpeech();
    await withApp({ speech: provider, testHooks: true }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client, {
        turns: [customer(1, 'Hello.'), trainee(2, 'Hello, I am Sam. What is happening?')],
      });
      await failNext(app, 'transcribe');
      await failNext(app, 'synthesize');

      // Each of these is refused before the provider would be called.
      expect((await transcribe(client, recording(1), '', 'text/plain')).status).toBe(415);
      expect((await transcribe(client, 'not audio')).status).toBe(400);
      expect((await transcribe(client, recording(1), '?lang=fr-FR')).status).toBe(400);
      expect((await speakTurn(client, id, 2)).status).toBe(400); // the trainee's own turn
      expect((await speakTurn(client, id, 99)).status).toBe(404);
      expect((await speakTurn(app.client(), id, 1)).status).toBe(404); // another browser profile
      expect((await speakTurn(client, id, 1, '?lang=fr-FR')).status).toBe(400);
      expect((await speakTurn(client, id, 1, '?voice=voice-z')).status).toBe(400);
      expect((await preview(client, '?voice=voice-z')).status).toBe(400);

      // The queued failures are still there for the next real requests.
      expect((await transcribe(client, recording(1))).status).toBe(502);
      expect((await speakTurn(client, id, 1)).status).toBe(502);
      expect((await transcribe(client, recording(1))).status).toBe(200);
      expect((await speakTurn(client, id, 1)).status).toBe(200);
      expect(heard).toHaveLength(1);
      expect(spoken).toHaveLength(1);
    });
  });

  it('is not used up when speech is switched off, which is its own answer', async () => {
    await withApp({ testHooks: true }, async (app) => {
      const client = app.client();
      const { id } = await startCall(app, client);
      await failNext(app, 'transcribe');
      await failNext(app, 'synthesize');

      const off = await transcribe(client, recording(1));
      expect(off.status).toBe(503);
      expect((await errorOf(off)).code).toBe('speech_unavailable');
      expect((await speakTurn(client, id, 1)).status).toBe(503);
      expect((await preview(client, '?voice=voice-a')).status).toBe(503);

      // Both failures are still queued: neither request got as far as the speech call.
      expect(() => app.hooks.maybeFail('transcribe')).toThrowError(SpeechError);
      expect(() => app.hooks.maybeFail('synthesize')).toThrowError(SpeechError);
    });
  });

  it('is logged like any other speech failure, with identifiers and no words', async () => {
    const lines: string[] = [];
    const log = createLogger((line) => lines.push(line));
    await withApp({ speech: createMockSpeechProvider(), testHooks: true, log }, async (app) => {
      const client = app.client();
      const { id, opening } = await startCall(app, client);
      await failNext(app, 'transcribe');
      await failNext(app, 'synthesize');
      await transcribe(client, recording(1));
      await speakTurn(client, id, 1);

      const failures = lines
        .map((line) => JSON.parse(line) as Record<string, unknown>)
        .filter((event) => event.event === 'speech.failed');
      expect(failures).toHaveLength(2);
      expect(failures[0]).toMatchObject({
        level: 'warn',
        op: 'transcribe',
        provider: 'mock',
        code: 'speech_failed',
      });
      expect(failures[1]).toMatchObject({ op: 'speak', provider: 'mock', code: 'speech_failed' });
      expect(failures[0]?.requestId).toMatch(/^[0-9a-f]{8}$/);
      expect(lines.join('\n')).not.toContain(opening.slice(0, 30));
    });
  });

  it('works the same when the provider is Azure AI Speech', async () => {
    const fake = await startFakeAzureSpeech();
    try {
      const azure = createAzureSpeechProvider(
        {
          kind: 'azure-speech',
          apiKey: fake.key,
          sttUrl: fake.sttUrl,
          ttsUrl: fake.ttsUrl,
          voices: { female: null, male: null },
          timeoutMs: 1000,
        },
        { sleep: () => Promise.resolve() },
      );
      await withApp({ speech: azure, testHooks: true }, async (app) => {
        const client = app.client();
        await failNext(app, 'transcribe');
        const failed = await transcribe(client, recording(1));
        expect(failed.status).toBe(502);
        expect(await errorOf(failed)).toEqual(SIMULATED);
        // The service itself was never called for the failed request.
        expect(fake.requests).toHaveLength(0);
        expect((await transcribe(client, recording(1))).status).toBe(200);
        expect(fake.requests).toHaveLength(1);
      });
    } finally {
      await fake.close();
    }
  });

  it('refuses a target it does not know and a count it cannot use', async () => {
    await withApp({ speech: createMockSpeechProvider(), testHooks: true }, async (app) => {
      for (const body of [
        { target: 'speak' },
        { target: 'transcription' },
        { target: 'transcribe', count: 6 },
        { target: 'synthesize', count: -1 },
        { target: 'synthesize', count: 1.5 },
        { target: 'synthesize', count: '1' },
        {},
      ]) {
        const res = await app.client().post('/api/test/fail-next', body);
        expect(res.status, JSON.stringify(body)).toBe(400);
        expect(res.body.error.code).toBe('validation_failed');
      }
      // Nothing was queued by any of those.
      expect((await transcribe(app.client(), recording(1))).status).toBe(200);
    });
  });
});

describe('failure hooks for speech, with the test hooks switched off', () => {
  it('are not there: the route is a 404 for every target, and speech is never made to fail', async () => {
    const { provider, heard, spoken } = recordingSpeech();
    await withApp({ speech: provider, testHooks: false }, async (app) => {
      const client = app.client();
      for (const target of ['transcribe', 'synthesize', 'customer', 'classifier', 'evaluator']) {
        for (const count of [undefined, 1, 0]) {
          const res = await client.post(
            '/api/test/fail-next',
            count === undefined ? { target } : { target, count },
          );
          expect(res.status, `${target} ${count}`).toBe(404);
          expect(res.body.error.code).toBe('not_found');
        }
      }
      expect((await client.get('/api/config')).body.features.testHooks).toBe(false);

      const { id } = await startCall(app, client);
      expect((await transcribe(client, recording(1))).status).toBe(200);
      expect((await speakTurn(client, id, 1)).status).toBe(200);
      expect(heard).toHaveLength(1);
      expect(spoken).toHaveLength(1);
    });
  });

  it('cannot be queued even by calling the hooks directly', async () => {
    await withApp({ speech: createMockSpeechProvider(), testHooks: false }, async (app) => {
      app.hooks.setNext('transcribe', 5);
      app.hooks.setNext('synthesize', 5);
      const client = app.client();
      const { id } = await startCall(app, client);
      expect((await transcribe(client, recording(1))).status).toBe(200);
      expect((await speakTurn(client, id, 1)).status).toBe(200);
    });
  });
});
