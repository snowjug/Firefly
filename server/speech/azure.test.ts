import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { SpeechLanguage } from '#shared/domain/speech.ts';
import type { TemperatureBandId } from '#shared/domain/vocab.ts';
import {
  AZURE_OUTPUT_FORMAT,
  AZURE_STT_CONTENT_TYPE,
  AZURE_WAV_OUTPUT_FORMAT,
  createAzureSpeechProvider,
  MAX_RETRY_AFTER_MS,
  SPEECH_MESSAGES,
  type AzureSpeechConfig,
  type AzureSpeechOptions,
} from './azure.ts';
import {
  FAKE_PROVIDER_ERROR_TEXT,
  FAKE_RECOGNISED_TEXT,
  fakeMp3,
  startFakeAzureSpeech,
  type FakeAzureSpeech,
  type Step,
} from './fake-azure-speech-server.ts';
import { SPEECH_LIMITS, SpeechError, type SpeechProvider } from './types.ts';
import { describeVoices, voiceDirection, voiceOptions } from './voices.ts';
import { encodeWav } from './wav.ts';

let fake: FakeAzureSpeech;
beforeAll(async () => {
  fake = await startFakeAzureSpeech();
});
afterEach(() => fake.reset());
afterAll(() => fake.close());

/** A key the fake service does not accept. */
const WRONG_KEY = 'a-different-key-9999';

const config = (extra: Partial<AzureSpeechConfig> = {}): AzureSpeechConfig => ({
  kind: 'azure-speech',
  apiKey: fake.key,
  sttUrl: fake.sttUrl,
  ttsUrl: fake.ttsUrl,
  voices: { female: null, male: null },
  timeoutMs: 2000,
  ...extra,
});

/** A sleep that records the wait instead of waiting. */
function recordedSleep() {
  const waits: number[] = [];
  return {
    waits,
    sleep: (ms: number) => {
      waits.push(ms);
      return Promise.resolve();
    },
  };
}

const provider = (extra: Partial<AzureSpeechConfig> = {}, options: AzureSpeechOptions = {}) =>
  createAzureSpeechProvider(config(extra), { sleep: () => Promise.resolve(), ...options });

const wav = encodeWav(Buffer.alloc(32000, 3));
const listen = { audio: wav, language: 'en-GB' as const, durationMs: 1000 };
const direction = (
  mood: TemperatureBandId,
  speaker: 'female' | 'male' = 'female',
  language: SpeechLanguage = 'en-GB',
) => voiceDirection({ speaker, language, mood });
const speak = (text = 'Hello there.', dir = direction('calm')) => ({ text, direction: dir });

/** The same provider, with every call tied to this signal. */
const withSignal = (p: SpeechProvider, signal: AbortSignal): SpeechProvider => ({
  ...p,
  transcribe: (request) => p.transcribe(request, signal),
  synthesize: (request) => p.synthesize(request, signal),
});

async function failureOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected the call to fail');
}

async function speechErrorOf(promise: Promise<unknown>): Promise<SpeechError> {
  const error = await failureOf(promise);
  expect(error).toBeInstanceOf(SpeechError);
  return error as SpeechError;
}

/** Nothing about the key, the address or what the provider said may be reachable from an error. */
function expectNoLeak(error: SpeechError) {
  const dump = [
    error.message,
    error.stack,
    JSON.stringify(error, Object.getOwnPropertyNames(error)),
    String(error.cause),
    JSON.stringify(error.cause, Object.getOwnPropertyNames(error.cause ?? {})),
  ].join('\n');
  for (const secret of [
    fake.key,
    FAKE_PROVIDER_ERROR_TEXT,
    'Access denied',
    '127.0.0.1',
    fake.origin,
  ]) {
    expect(dump).not.toContain(secret);
  }
}

describe('speech to text: what is sent', () => {
  it('posts the recording with the key header, the WAV content type and the language', async () => {
    const result = await provider().transcribe(listen);
    expect(result).toEqual({ status: 'recognised', text: FAKE_RECOGNISED_TEXT, durationMs: 1000 });

    expect(fake.requests).toHaveLength(1);
    const sent = fake.requests[0];
    expect(sent?.method).toBe('POST');
    expect(sent?.path).toBe('/speech/recognition/conversation/cognitiveservices/v1');
    expect(sent?.query).toEqual({ language: 'en-GB', format: 'simple', profanity: 'raw' });
    expect(sent?.headers['ocp-apim-subscription-key']).toBe(fake.key);
    expect(sent?.headers['content-type']).toBe('audio/wav; codecs=audio/pcm; samplerate=16000');
    expect(sent?.headers.accept).toBe('application/json');
    expect(sent?.headers['user-agent']).toBe('Firefly');
    for (const name of ['authorization', 'cookie', 'origin', 'referer']) {
      expect(sent?.headers[name], name).toBeUndefined();
    }
    expect(sent?.body.equals(wav)).toBe(true);
    expect(AZURE_STT_CONTENT_TYPE).toBe('audio/wav; codecs=audio/pcm; samplerate=16000');
  });

  it('uses the language the trainee chose', async () => {
    for (const language of ['en-GB', 'en-US', 'en-IE', 'en-AU', 'en-IN'] as const) {
      await provider().transcribe({ ...listen, language });
    }
    expect(fake.requests.map((r) => r.query.language)).toEqual([
      'en-GB',
      'en-US',
      'en-IE',
      'en-AU',
      'en-IN',
    ]);
    expect(fake.requests.every((r) => r.query.profanity === 'raw')).toBe(true);
  });

  it('asks for profanity as spoken (profanity=raw), once, whatever order the query is written in', async () => {
    await provider().transcribe(listen);
    const pairs = [...new URLSearchParams(fake.requests[0]?.search)]
      .map(([name, value]) => `${name}=${value}`)
      .sort();
    expect(pairs).toEqual(['format=simple', 'language=en-GB', 'profanity=raw']);
  });

  it('works with the custom-domain address layout too', async () => {
    const custom = provider({
      sttUrl: `${fake.customBase}/stt/speech/recognition/conversation/cognitiveservices/v1`,
    });
    expect((await custom.transcribe(listen)).status).toBe('recognised');
    expect(fake.requests[0]?.path).toBe(
      '/stt/speech/recognition/conversation/cognitiveservices/v1',
    );
  });

  it('asks for the simple result only: no pronunciation assessment, no storing of audio, nothing else', async () => {
    await provider().transcribe(listen);
    const sent = fake.requests[0];
    expect(Object.keys(sent?.query ?? {}).sort()).toEqual(['format', 'language', 'profanity']);
    expect(Object.keys(sent?.headers ?? {})).not.toContain('pronunciation-assessment');
  });
});

describe('speech to text: what comes back', () => {
  it('returns profanity as it was spoken, because the report quotes the transcript as evidence', async () => {
    fake.enqueue({ recognition: 'Success', text: 'This is damn useless, and you know it.' });
    expect((await provider().transcribe(listen)).text).toBe(
      'This is damn useless, and you know it.',
    );
  });

  it('reports recognised text, and the length of the recording that was sent', async () => {
    fake.enqueue({ recognition: 'Success', text: 'Can you tell me what is happening?' });
    expect(await provider().transcribe({ ...listen, durationMs: 4321 })).toEqual({
      status: 'recognised',
      text: 'Can you tell me what is happening?',
      durationMs: 4321,
    });
  });

  it.each(['NoMatch', 'InitialSilenceTimeout', 'BabbleTimeout'] as const)(
    'reports %s as no speech, with no text',
    async (recognition) => {
      fake.enqueue({ recognition, text: 'ignored' });
      expect(await provider().transcribe(listen)).toEqual({
        status: 'no-speech',
        text: '',
        durationMs: 1000,
      });
      expect(fake.requests).toHaveLength(1);
    },
  );

  it('reports a successful result with no words as no speech', async () => {
    fake.enqueue({ recognition: 'Success', text: '   ' });
    expect((await provider().transcribe(listen)).status).toBe('no-speech');
    fake.enqueue({ status: 200, json: { RecognitionStatus: 'Success' } });
    expect((await provider().transcribe(listen)).status).toBe('no-speech');
  });

  it('reports the Error status as a retryable failure, once, without retrying it', async () => {
    fake.enqueue({ recognition: 'Error' });
    const error = await speechErrorOf(provider().transcribe(listen));
    expect(error).toMatchObject({
      code: 'speech_failed',
      retryable: true,
      message: SPEECH_MESSAGES.failed,
    });
    expect(fake.requests).toHaveLength(1);
  });

  it('tidies the text and ignores everything else in the answer', async () => {
    fake.enqueue({
      status: 200,
      json: {
        RecognitionStatus: 'Success',
        DisplayText: ' Hello\u0000,\n  I am\u200b here. ',
        Offset: 5,
        Duration: 7,
        SNR: 12.5,
        NBest: [{ Confidence: 0.9, Display: 'something else' }],
      },
    });
    expect((await provider().transcribe(listen)).text).toBe('Hello, I am here.');
  });

  it('never returns more than a message can hold', async () => {
    fake.enqueue({ recognition: 'Success', text: 'word '.repeat(1000) });
    expect((await provider().transcribe(listen)).text.length).toBeLessThanOrEqual(1500);
  });
});

describe.each([
  ['speech to text', (p: SpeechProvider) => p.transcribe(listen)],
  ['text to speech', (p: SpeechProvider) => p.synthesize(speak())],
])('%s: failures', (_name, call) => {
  const rejected = {
    status: 401,
    json: { error: { code: '401', message: FAKE_PROVIDER_ERROR_TEXT } },
  } satisfies Step;

  it.each([401, 403, 404])(
    'treats HTTP %s as speech that is not configured correctly, and does not retry',
    async (status) => {
      fake.enqueue({ ...rejected, status });
      const error = await speechErrorOf(call(provider()));
      expect(error).toMatchObject({ code: 'speech_unavailable', retryable: false });
      expect(error.message).toBe(SPEECH_MESSAGES.notConfigured);
      expect(error.message).toMatch(/not configured correctly/);
      expect(fake.requests).toHaveLength(1);
      expectNoLeak(error);
    },
  );

  it('answers a wrong key the way the real service does, and gives nothing away', async () => {
    const error = await speechErrorOf(call(provider({ apiKey: WRONG_KEY })));
    expect(error).toMatchObject({ code: 'speech_unavailable', retryable: false });
    expectNoLeak(error);
    expect(JSON.stringify(error)).not.toContain(WRONG_KEY);
    expect(error.message).not.toContain(WRONG_KEY);
  });

  it('treats a redirect as a wrong address, and never follows it with the key', async () => {
    fake.enqueue({ status: 302, headers: { location: `${fake.origin}/elsewhere` } });
    const error = await speechErrorOf(call(provider()));
    expect(error).toMatchObject({ code: 'speech_unavailable', retryable: false });
    expect(fake.requests.map((r) => r.path)).not.toContain('/elsewhere');
    expect(fake.requests).toHaveLength(1);
  });

  it.each([400, 415, 422])(
    'treats HTTP %s as a request the service refused, not worth retrying',
    async (status) => {
      fake.enqueue({ status, text: 'bad request, with provider words in it' });
      const error = await speechErrorOf(call(provider()));
      expect(error).toMatchObject({
        code: 'speech_failed',
        retryable: false,
        message: SPEECH_MESSAGES.rejected,
      });
      expect(fake.requests).toHaveLength(1);
      expect(error.message).not.toContain('provider words');
    },
  );

  it('tries a rate limit once more, then reports it as retryable', async () => {
    fake.enqueue({ status: 429, text: 'slow down' }, { status: 429, text: 'slow down' });
    const error = await speechErrorOf(call(provider()));
    expect(error).toMatchObject({
      code: 'speech_rate_limited',
      retryable: true,
      message: SPEECH_MESSAGES.rateLimited,
    });
    expect(fake.requests).toHaveLength(2);
  });

  it.each([500, 502, 503, 504])(
    'tries HTTP %s once more, then reports it as a retryable failure',
    async (status) => {
      fake.enqueue({ status, text: 'upstream trouble' }, { status, text: 'upstream trouble' });
      const error = await speechErrorOf(call(provider()));
      expect(error).toMatchObject({
        code: 'speech_failed',
        retryable: true,
        message: SPEECH_MESSAGES.failed,
      });
      expect(fake.requests).toHaveLength(2);
      expectNoLeak(error);
    },
  );

  it('succeeds when the one retry succeeds', async () => {
    fake.enqueue({ status: 503, text: 'busy' });
    const result = await call(provider());
    expect(result).toBeDefined();
    expect(fake.requests).toHaveLength(2);
  });

  it('retries a dropped connection once, then reports the service as unreachable', async () => {
    fake.enqueue({ drop: true }, { drop: true });
    const error = await speechErrorOf(call(provider()));
    expect(error).toMatchObject({
      code: 'speech_failed',
      retryable: true,
      message: SPEECH_MESSAGES.unreachable,
    });
    expect(fake.requests).toHaveLength(2);
    expectNoLeak(error);
  });

  it('succeeds when the connection drops once and then works', async () => {
    fake.enqueue({ drop: true });
    await call(provider());
    expect(fake.requests).toHaveLength(2);
  });

  it('reports a service that never answers as a timeout, without a retry', async () => {
    fake.enqueue({ hang: true });
    const started = Date.now();
    const error = await speechErrorOf(call(provider({ timeoutMs: 150 })));
    expect(error).toMatchObject({
      code: 'speech_timeout',
      retryable: true,
      message: SPEECH_MESSAGES.timeout,
    });
    expect(fake.requests).toHaveLength(1);
    expect(Date.now() - started).toBeLessThan(1500);
  });

  it('reports a service that answers too slowly as a timeout', async () => {
    fake.enqueue({ recognition: 'Success', delayMs: 600 });
    const error = await speechErrorOf(call(provider({ timeoutMs: 150 })));
    expect(error.code).toBe('speech_timeout');
  });

  it('stops at once when the caller gives up, and does not call that a failure', async () => {
    fake.enqueue({ hang: true });
    const controller = new AbortController();
    const pending = call(withSignal(provider(), controller.signal));
    setTimeout(() => controller.abort(), 60);
    expect(await failureOf(pending)).toMatchObject({ name: 'AbortError' });
    expect(fake.requests).toHaveLength(1);
  });

  it('does not even start when the caller has already given up', async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await failureOf(call(withSignal(provider(), controller.signal)))).toMatchObject({
      name: 'AbortError',
    });
    expect(fake.requests).toHaveLength(0);
  });

  it('honours Retry-After before the retry, but never for long', async () => {
    const { waits, sleep } = recordedSleep();
    const waiting = provider({}, { sleep });
    fake.enqueue({ status: 429, headers: { 'retry-after': '1' } });
    await call(waiting);
    fake.enqueue({ status: 429, headers: { 'retry-after': '30' } });
    await call(waiting);
    fake.enqueue({ status: 503 });
    await call(waiting);
    fake.enqueue({ status: 429, headers: { 'retry-after': 'tomorrow' } });
    await call(waiting);
    expect(waits).toEqual([1000, MAX_RETRY_AFTER_MS, 300, 300]);
    expect(MAX_RETRY_AFTER_MS).toBe(2000);
  });

  it('does not wait for a failure that is not worth retrying', async () => {
    const { waits, sleep } = recordedSleep();
    fake.enqueue({ status: 401 });
    await failureOf(call(provider({}, { sleep })));
    fake.enqueue({ status: 400 });
    await failureOf(call(provider({}, { sleep })));
    expect(waits).toEqual([]);
  });
});

describe('speech to text: answers it will not trust', () => {
  const unusable: [string, Step][] = [
    ['text that is not JSON', { status: 200, text: 'not json at all' }],
    ['an empty answer', { status: 200, text: '' }],
    ['JSON that is not an object', { status: 200, json: ['Success'] }],
    ['an object with no status', { status: 200, json: { DisplayText: 'hi' } }],
    ['a status it does not know', { status: 200, json: { RecognitionStatus: 'Maybe' } }],
    ['a status of the wrong type', { status: 200, json: { RecognitionStatus: 1 } }],
    [
      'text of the wrong type',
      { status: 200, json: { RecognitionStatus: 'Success', DisplayText: 42 } },
    ],
    ['null', { status: 200, text: 'null' }],
  ];

  it.each(unusable)(
    'rejects %s, as a retryable failure, without calling again',
    async (_label, step) => {
      fake.enqueue(step);
      const error = await speechErrorOf(provider().transcribe(listen));
      expect(error).toMatchObject({
        code: 'speech_failed',
        retryable: true,
        message: SPEECH_MESSAGES.badOutput,
      });
      expect(fake.requests).toHaveLength(1);
    },
  );

  it('rejects an answer that is far larger than any recognition result', async () => {
    fake.enqueue({ status: 200, body: Buffer.alloc(200_000, 0x61) });
    const error = await speechErrorOf(provider().transcribe(listen));
    expect(error).toMatchObject({ code: 'speech_failed', message: SPEECH_MESSAGES.badOutput });
    expect(fake.requests).toHaveLength(1);
  });
});

describe('text to speech: what is sent', () => {
  it('posts SSML with the key header, the SSML content type and the one mp3 output format', async () => {
    const result = await provider().synthesize(
      speak("I've waited two days & nobody called.", direction('frustrated')),
    );

    expect(fake.requests).toHaveLength(1);
    const sent = fake.requests[0];
    expect(sent?.method).toBe('POST');
    expect(sent?.path).toBe('/cognitiveservices/v1');
    expect(sent?.query).toEqual({});
    expect(sent?.headers['ocp-apim-subscription-key']).toBe(fake.key);
    expect(sent?.headers['content-type']).toBe('application/ssml+xml');
    expect(sent?.headers['x-microsoft-outputformat']).toBe('audio-24khz-48kbitrate-mono-mp3');
    expect(AZURE_OUTPUT_FORMAT).toBe('audio-24khz-48kbitrate-mono-mp3');
    expect(sent?.headers['user-agent']).toBe('Firefly');
    for (const name of ['authorization', 'cookie', 'origin', 'referer']) {
      expect(sent?.headers[name], name).toBeUndefined();
    }
    // Sonia lists no angry or unfriendly style, so a frustrated customer is shown by rate and pitch only.
    expect(sent?.text).toBe(
      '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-GB">' +
        '<voice name="en-GB-SoniaNeural"><prosody rate="+8%" pitch="-2%">' +
        'I&apos;ve waited two days &amp; nobody called.' +
        '</prosody></voice></speak>',
    );
    expect(result).toEqual({
      audio: fakeMp3(),
      contentType: 'audio/mpeg',
      voice: 'en-GB-SoniaNeural',
      style: 'none',
    });
  });

  it('applies a style, at a reduced degree, on a voice that lists it, and says which', async () => {
    const result = await provider().synthesize(
      speak('This is not good enough.', direction('angry', 'male', 'en-US')),
    );
    expect(result).toMatchObject({ voice: 'en-US-GuyNeural', style: 'angry' });
    expect(fake.requests[0]?.text).toContain(
      '<voice name="en-US-GuyNeural"><mstts:express-as style="angry" styledegree="0.73"><prosody rate="+11%">This is not good enough.</prosody></mstts:express-as></voice>',
    );
    expect(fake.requests[0]?.text).not.toContain('shouting');
  });

  it("uses an administrator's voice, with no style unless the table lists it for that voice", async () => {
    const custom = provider({ voices: { female: 'en-GB-LibbyNeural', male: 'en-US-DavisNeural' } });
    const libby = await custom.synthesize(speak('Hello.', direction('angry', 'female', 'en-GB')));
    expect(libby).toMatchObject({ voice: 'en-GB-LibbyNeural', style: 'none' });
    const davis = await custom.synthesize(speak('Hello.', direction('angry', 'male', 'en-GB')));
    expect(davis).toMatchObject({ voice: 'en-US-DavisNeural', style: 'angry' });
    expect(fake.requests[0]?.text).toContain('xml:lang="en-GB"');
    expect(fake.requests[1]?.text).toContain('xml:lang="en-US"');
  });

  it('speaks a long line cut at a sentence, never more than the limit', async () => {
    const long = Array.from({ length: 200 }, (_, i) => `Sentence ${i + 1} goes here.`).join(' ');
    await provider().synthesize(speak(long));
    const ssml = fake.requests[0]?.text ?? '';
    expect(Buffer.byteLength(ssml)).toBeLessThan(8192);
    expect(ssml).toContain('goes here.</prosody>');
  });

  it('has nothing to ask for when the line holds only control characters', async () => {
    const error = await speechErrorOf(provider().synthesize(speak('\u0000\u0001 \u200b')));
    expect(error).toMatchObject({
      code: 'speech_failed',
      retryable: false,
      message: SPEECH_MESSAGES.nothingToSpeak,
    });
    expect(fake.requests).toHaveLength(0);
  });
});

describe('text to speech: the voice the trainee chose', () => {
  it('speaks with the catalogue voice for the choice and the language, and says which choice it was', async () => {
    const result = await provider().synthesize(
      speak(
        'Hello there.',
        voiceDirection({ speaker: 'male', language: 'en-AU', mood: 'calm', voice: 'voice-b' }),
      ),
    );
    expect(result).toMatchObject({
      voice: 'en-AU-WilliamNeural',
      style: 'none',
      voiceId: 'voice-b',
      contentType: 'audio/mpeg',
    });
    // Calm is -4%, and Voice B is a little quicker (+4%), so the two cancel out.
    expect(fake.requests[0]?.text).toContain(
      '<voice name="en-AU-WilliamNeural"><prosody rate="+0%">Hello there.</prosody></voice>',
    );
    expect(fake.requests[0]?.text).toContain('xml:lang="en-AU"');
  });

  it('does not claim a choice when none was made, and keeps the old pairing', async () => {
    const result = await provider().synthesize(
      speak('Hello there.', direction('calm', 'male', 'en-GB')),
    );
    expect(result.voice).toBe('en-GB-RyanNeural');
    expect(result).not.toHaveProperty('voiceId');
  });

  it('can be asked for WAV, which only the live smoke test does, and then says so', async () => {
    const wavProvider = provider({}, { outputFormat: AZURE_WAV_OUTPUT_FORMAT });
    const result = await wavProvider.synthesize(speak('Hello there.'));
    expect(fake.requests[0]?.headers['x-microsoft-outputformat']).toBe('riff-16khz-16bit-mono-pcm');
    expect(result.contentType).toBe('audio/wav');
    expect(result.audio.subarray(0, 4).toString('latin1')).toBe('RIFF');
    // Everything else asks for the one mp3 format.
    await provider().synthesize(speak('Hello there.'));
    expect(fake.requests[1]?.headers['x-microsoft-outputformat']).toBe(AZURE_OUTPUT_FORMAT);
  });

  it('lists the same four voices whatever the administrator replaced, because the replacements are for the old pairing', () => {
    const custom = provider({ voices: { female: 'en-US-JennyNeural', male: 'en-US-DavisNeural' } });
    expect(custom.listVoices('en-GB')).toEqual(voiceOptions('en-GB'));
    expect(
      provider()
        .listVoices('en-IE')
        .map((option) => option.shared),
    ).toEqual([false, false, true, true]);
  });
});

describe('text to speech: answers it will not trust', () => {
  it.each<[string, Step]>([
    ['a JSON error with a success status', { status: 200, text: `{"error":"${'x'.repeat(60)}"}` }],
    ['an HTML page', { status: 200, text: `<html><body>${'Sign in'.repeat(20)}</body></html>` }],
    ['an empty answer', { status: 200, text: '' }],
    ['an answer too small to be audio', { status: 200, body: Buffer.alloc(8, 0xff) }],
    ['audio far larger than any reply', { audio: Buffer.alloc(9 * 1024 * 1024, 0xff) }],
  ])('rejects %s, as a retryable failure, without calling again', async (_label, step) => {
    fake.enqueue(step);
    const error = await speechErrorOf(provider().synthesize(speak()));
    expect(error).toMatchObject({
      code: 'speech_failed',
      retryable: true,
      message: SPEECH_MESSAGES.badOutput,
    });
    expect(fake.requests).toHaveLength(1);
  });

  it('accepts a short clip', async () => {
    fake.enqueue({ audio: fakeMp3(1) });
    expect((await provider().synthesize(speak())).audio).toHaveLength(154);
  });
});

describe('what the provider says about itself', () => {
  it('is labelled Azure AI Speech, can do both jobs and is not a demonstration', () => {
    const azure = provider();
    expect(azure).toMatchObject({ kind: 'azure-speech', label: 'Azure AI Speech', demo: false });
    expect(azure.capabilities()).toEqual({
      provider: 'azure-speech',
      label: 'Azure AI Speech',
      demo: false,
      transcribe: true,
      synthesize: true,
      expressiveStyles: false,
      notice: null,
      voices: describeVoices(voiceOptions),
      limits: SPEECH_LIMITS,
    });
  });

  it('claims expressive styles only when every voice it would use lists them', () => {
    const us = provider({ voices: { female: 'en-US-AriaNeural', male: 'en-US-GuyNeural' } });
    expect(us.capabilities().expressiveStyles).toBe(true);
    expect(
      provider({ voices: { female: 'en-US-AriaNeural', male: null } }).capabilities()
        .expressiveStyles,
    ).toBe(false);
  });

  it('shows a notice when a setting had to be adjusted, and never the key', () => {
    const notice = 'AZURE_SPEECH_VOICE_FEMALE is not a voice name, so the default voice is used.';
    const adjusted = provider({}, { notice }).capabilities();
    expect(adjusted.notice).toBe(notice);
    expect(JSON.stringify(adjusted)).not.toContain(fake.key);
  });
});

describe('the local stand-in for the service, which the tests above rely on', () => {
  // Without these, "profanity comes back as spoken" would pass even if the option were never sent.
  const heard = async (query: string) => {
    fake.enqueue({ recognition: 'Success', text: 'This is damn useless.' });
    const response = await fetch(`${fake.sttUrl}?${query}`, {
      method: 'POST',
      headers: {
        'ocp-apim-subscription-key': fake.key,
        'content-type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
      },
      body: new Uint8Array(wav.buffer as ArrayBuffer, wav.byteOffset, wav.byteLength),
    });
    return { status: response.status, json: (await response.json().catch(() => null)) as unknown };
  };

  it('masks profanity unless it is asked for as raw, and removes it when asked to', async () => {
    const said = async (query: string) =>
      ((await heard(`language=en-GB&format=simple${query}`)).json as { DisplayText: string })
        .DisplayText;
    expect(await said('')).toBe('This is d*** useless.');
    expect(await said('&profanity=masked')).toBe('This is d*** useless.');
    expect(await said('&profanity=removed')).toBe('This is useless.');
    expect(await said('&profanity=raw')).toBe('This is damn useless.');
  });

  it('refuses a profanity option that is not one of masked, removed or raw', async () => {
    expect((await heard('language=en-GB&profanity=rwa')).status).toBe(400);
    expect((await heard('language=en-GB&profanity=raw')).status).toBe(200);
  });
});
