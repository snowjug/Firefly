import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AZURE_WAV_OUTPUT_FORMAT,
  createAzureSpeechProvider,
  type AzureSpeechConfig,
} from './azure.ts';
import { startFakeAzureSpeech, type FakeAzureSpeech } from './fake-azure-speech-server.ts';
import {
  liveSmokeGate,
  runSpeechSmoke,
  SMOKE_KEYWORDS,
  SMOKE_MIN_MATCHES,
  SMOKE_SENTENCE,
} from './testing/live-smoke.ts';

// OPTIONAL SMOKE TEST OF THE REAL AZURE AI SPEECH SERVICE.
//
// It speaks one short, fixed, synthetic sentence and transcribes it back. It is skipped unless
// FIREFLY_LIVE_SPEECH_SMOKE=1 and the Azure Speech settings are in the environment, and it never runs
// in CI. To run it on your own machine, with your own Speech resource:
//
//   FIREFLY_LIVE_SPEECH_SMOKE=1 AZURE_SPEECH_KEY=<your-speech-key> AZURE_SPEECH_REGION=<your-region> \
//     npx vitest run server/speech/azure.live.test.ts
//
// (AZURE_SPEECH_ENDPOINT may be used instead of AZURE_SPEECH_REGION; see .env.example for both.) It
// writes no audio to disk, prints no key, and sends only the fixed sentence above. It checks that a
// round trip through the real service works; it is not a measure of how natural a voice sounds or
// how well it understands anyone.

const gate = liveSmokeGate(process.env);

describe.skipIf(!gate.run)('live smoke test: Azure AI Speech (the real service)', () => {
  it('speaks one short sentence and transcribes it back', { timeout: 60_000 }, async () => {
    if (!gate.run) return;
    const provider = createAzureSpeechProvider(gate.config, {
      outputFormat: AZURE_WAV_OUTPUT_FORMAT,
    });
    const result = await runSpeechSmoke(provider);
    expect(result.status).toBe('recognised');
    expect(result.audioMs).toBeGreaterThan(500);
    expect(
      result.matched.length,
      `heard "${result.transcript}", which has ${result.matched.length} of the words ${SMOKE_KEYWORDS.join(', ')}`,
    ).toBeGreaterThanOrEqual(SMOKE_MIN_MATCHES);
  });
});

describe('the live smoke test is never run by accident', () => {
  const settings = {
    FIREFLY_LIVE_SPEECH_SMOKE: '1',
    AZURE_SPEECH_KEY: 'unit-test-speech-key-7d41',
    AZURE_SPEECH_REGION: 'uksouth',
  };

  it('needs the flag, and is skipped without it however much else is set', () => {
    expect(liveSmokeGate({}).run).toBe(false);
    expect(liveSmokeGate({ ...settings, FIREFLY_LIVE_SPEECH_SMOKE: undefined }).run).toBe(false);
    for (const flag of ['0', 'true', 'yes', '']) {
      expect(liveSmokeGate({ ...settings, FIREFLY_LIVE_SPEECH_SMOKE: flag }).run, flag).toBe(false);
    }
  });

  it('never runs in CI, even with the flag and a key', () => {
    const gated = liveSmokeGate({ ...settings, CI: 'true' });
    expect(gated).toMatchObject({ run: false });
    expect(gated.run === false && gated.reason).toContain('CI');
  });

  it('needs the key and a region or an address, and says which, naming variables and never values', () => {
    for (const missing of [
      { ...settings, AZURE_SPEECH_KEY: undefined },
      { ...settings, AZURE_SPEECH_REGION: undefined },
    ]) {
      const gated = liveSmokeGate(missing);
      expect(gated.run).toBe(false);
      const reason = gated.run === false ? gated.reason : '';
      expect(reason).toMatch(/AZURE_SPEECH_(KEY|REGION)/);
      expect(reason).not.toContain(settings.AZURE_SPEECH_KEY);
    }
    // An address does as well as a region; placeholder values from .env.example do not count.
    expect(
      liveSmokeGate({
        ...settings,
        AZURE_SPEECH_REGION: undefined,
        AZURE_SPEECH_ENDPOINT: 'https://example.cognitiveservices.azure.com',
      }).run,
    ).toBe(true);
    expect(liveSmokeGate({ ...settings, AZURE_SPEECH_KEY: '<your-speech-key>' }).run).toBe(false);
  });

  it('runs when it is asked to and everything it needs is there, and carries the settings through', () => {
    const gated = liveSmokeGate(settings);
    expect(gated.run).toBe(true);
    const config = (gated.run ? gated.config : null) as AzureSpeechConfig;
    expect(config.kind).toBe('azure-speech');
    expect(config.sttUrl).toBe(
      'https://uksouth.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1',
    );
  });
});

describe('the live smoke test’s own plumbing, against the local fake (not real speech)', () => {
  let fake: FakeAzureSpeech;
  beforeAll(async () => {
    // The fake does not understand audio: it answers a recogniser's request with this line.
    fake = await startFakeAzureSpeech({ recognisedText: SMOKE_SENTENCE });
  });
  afterAll(() => fake.close());

  it('asks for WAV, sends that WAV back for recognition, and counts the words that come back', async () => {
    const provider = createAzureSpeechProvider(
      {
        kind: 'azure-speech',
        apiKey: fake.key,
        sttUrl: fake.sttUrl,
        ttsUrl: fake.ttsUrl,
        voices: { female: null, male: null },
        timeoutMs: 2000,
      },
      { outputFormat: AZURE_WAV_OUTPUT_FORMAT, sleep: () => Promise.resolve() },
    );
    const result = await runSpeechSmoke(provider);
    expect(fake.requests.map((request) => request.service)).toEqual(['tts', 'stt']);
    expect(fake.requests[0]?.headers['x-microsoft-outputformat']).toBe('riff-16khz-16bit-mono-pcm');
    expect(fake.requests[0]?.text).toContain(SMOKE_SENTENCE);
    // The audio the fake sent back is what the recogniser was given, as a real 16 kHz WAV.
    const sent = fake.requests[1]?.body;
    expect(sent?.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(fake.requests[1]?.headers['content-type']).toBe(
      'audio/wav; codecs=audio/pcm; samplerate=16000',
    );
    expect(result.status).toBe('recognised');
    expect(result.matched).toEqual([...SMOKE_KEYWORDS]);
    expect(result.audioMs).toBeGreaterThan(500);
  });
});
