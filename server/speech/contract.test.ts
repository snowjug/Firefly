import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SPEECH_LANGUAGES, type SpeechLanguage } from '#shared/domain/speech.ts';
import { VOICE_IDS } from '#shared/domain/voices.ts';
import { createAzureSpeechProvider } from './azure.ts';
import { startFakeAzureSpeech, type FakeAzureSpeech } from './fake-azure-speech-server.ts';
import { createNoneSpeechProvider } from './index.ts';
import { createMockSpeechProvider } from './mock.ts';
import {
  NOTHING_TO_SPEAK_MESSAGE,
  SPEECH_LIMITS,
  SpeechError,
  type SpeechProvider,
} from './types.ts';
import { describeVoices, voiceDirection } from './voices.ts';
import { encodeWav } from './wav.ts';

// One suite for the speech port, run against every adapter that can speak and hear: whatever sits
// behind `SpeechProvider`, these things hold. (The demonstration and the Azure client stand in for
// each other here; neither is real speech, and Azure is the local fake of its REST endpoints.)

let fake: FakeAzureSpeech;
beforeAll(async () => {
  fake = await startFakeAzureSpeech();
});
afterAll(() => fake.close());

const adapters: [string, () => SpeechProvider][] = [
  ['the scripted demonstration', () => createMockSpeechProvider()],
  [
    'Azure AI Speech (local fake)',
    () =>
      createAzureSpeechProvider(
        {
          kind: 'azure-speech',
          apiKey: fake.key,
          sttUrl: fake.sttUrl,
          ttsUrl: fake.ttsUrl,
          voices: { female: null, male: null },
          timeoutMs: 2000,
        },
        { sleep: () => Promise.resolve() },
      ),
  ],
];

const direction = (language: SpeechLanguage = 'en-GB', voice?: (typeof VOICE_IDS)[number]) =>
  voiceDirection({ speaker: 'female', language, mood: 'calm', ...(voice ? { voice } : {}) });

describe.each(adapters)('the speech port: %s', (_name, make) => {
  it('says what it is and what it can do, without claiming more', () => {
    const provider = make();
    const capabilities = provider.capabilities();
    expect(capabilities.provider).toBe(provider.kind);
    expect(capabilities.label).toBe(provider.label);
    expect(capabilities.demo).toBe(provider.demo);
    expect(capabilities.transcribe).toBe(true);
    expect(capabilities.synthesize).toBe(true);
    expect(capabilities.limits).toEqual(SPEECH_LIMITS);
    expect(typeof capabilities.expressiveStyles).toBe('boolean');
  });

  it('offers the four neutral voices in every language, in order, and describes exactly them', () => {
    const provider = make();
    for (const language of SPEECH_LANGUAGES) {
      const options = provider.listVoices(language);
      expect(options.map((option) => option.id)).toEqual([...VOICE_IDS]);
      // The first choice is never a copy of an earlier one.
      expect(options[0]?.shared).toBe(false);
      for (const option of options) expect(option.providerVoice.length).toBeGreaterThan(0);
    }
    expect(provider.capabilities().voices).toEqual(describeVoices((l) => provider.listVoices(l)));
  });

  it('turns a recording into recognised text, or says there was no speech, never both', async () => {
    const provider = make();
    const audio = encodeWav(Buffer.alloc(32000, 1));
    const heard = await provider.transcribe({ audio, language: 'en-GB', durationMs: 1000 });
    expect(['recognised', 'no-speech']).toContain(heard.status);
    expect(heard.durationMs).toBe(1000);
    expect(heard.status === 'recognised' ? heard.text.length > 0 : heard.text === '').toBe(true);
  });

  it('speaks a line as audio, and says which voice, which style and which choice were really used', async () => {
    const provider = make();
    const plain = await provider.synthesize({
      text: 'Hello, I need some help.',
      direction: direction(),
    });
    expect(plain.audio.length).toBeGreaterThan(32);
    expect(typeof plain.contentType).toBe('string');
    expect(plain.voice.length).toBeGreaterThan(0);
    expect(plain.style.length).toBeGreaterThan(0);
    // No choice was made, so none is claimed.
    expect(plain.voiceId).toBeUndefined();

    for (const voice of VOICE_IDS) {
      const chosen = await provider.synthesize({
        text: 'Hello, I need some help.',
        direction: direction('en-GB', voice),
      });
      expect(chosen.voiceId).toBe(voice);
    }
  });

  it('refuses a line with nothing in it to speak in one way: a plain, final speech failure', async () => {
    const provider = make();
    for (const nothing of ['', '   ', '*sighs*', '{"mood":"angry"}', '\u0000\u200b']) {
      const error = await provider
        .synthesize({ text: nothing, direction: direction() })
        .catch((caught: unknown) => caught);
      expect(error, JSON.stringify(nothing)).toBeInstanceOf(SpeechError);
      expect(error).toMatchObject({
        code: 'speech_failed',
        retryable: false,
        message: NOTHING_TO_SPEAK_MESSAGE,
      });
    }
  });

  it('gives a failure no secret and no words: its message is a fixed sentence', async () => {
    const provider = make();
    const error = await provider
      .synthesize({ text: '', direction: direction() })
      .catch((caught: unknown) => caught as SpeechError);
    expect(JSON.stringify(error, Object.getOwnPropertyNames(error))).not.toContain(fake.key);
  });
});

describe('the speech port: speech switched off', () => {
  it('can do nothing, offers no voice, and turns every request away the same plain way', async () => {
    const provider = createNoneSpeechProvider();
    expect(provider.capabilities()).toMatchObject({
      provider: 'none',
      transcribe: false,
      synthesize: false,
      expressiveStyles: false,
      voices: [],
    });
    for (const language of SPEECH_LANGUAGES) expect(provider.listVoices(language)).toEqual([]);
    const audio = encodeWav(Buffer.alloc(3200));
    const heard = await provider
      .transcribe({ audio, language: 'en-GB', durationMs: 100 })
      .catch((e: unknown) => e);
    const spoken = await provider
      .synthesize({ text: 'Hello.', direction: direction() })
      .catch((e: unknown) => e);
    for (const error of [heard, spoken]) {
      expect(error).toBeInstanceOf(SpeechError);
      expect(error).toMatchObject({ code: 'speech_unavailable', retryable: false });
    }
  });
});
