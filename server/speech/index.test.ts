import { describe, expect, it } from 'vitest';
import {
  createNoneSpeechProvider,
  createSpeechProvider,
  createSpeechProviderFromEnv,
} from './index.ts';
import { SPEECH_OFF_MESSAGES, SpeechError, loadSpeechConfig } from './types.ts';
import { voiceDirection } from './voices.ts';
import { encodeWav } from './wav.ts';

const request = {
  audio: encodeWav(Buffer.alloc(3200)),
  language: 'en-GB' as const,
  durationMs: 100,
};
const line = {
  text: 'Hello.',
  direction: voiceDirection({ speaker: 'female', language: 'en-GB', mood: 'calm' }),
};

describe('speech switched off', () => {
  it('reports that it can do nothing, and says it is not configured', () => {
    const none = createNoneSpeechProvider();
    expect(none).toMatchObject({ kind: 'none', label: 'Not configured', demo: false });
    expect(none.capabilities()).toMatchObject({
      provider: 'none',
      transcribe: false,
      synthesize: false,
      expressiveStyles: false,
      notice: null,
    });
  });

  it('turns every call away with a message that says what to do instead', async () => {
    const none = createNoneSpeechProvider();
    const heard = await none.transcribe(request).catch((error: unknown) => error);
    const spoken = await none.synthesize(line).catch((error: unknown) => error);
    for (const error of [heard, spoken]) {
      expect(error).toBeInstanceOf(SpeechError);
      expect(error).toMatchObject({ code: 'speech_unavailable', retryable: false });
    }
    expect((heard as SpeechError).message).toBe(SPEECH_OFF_MESSAGES.transcribe);
    expect((spoken as SpeechError).message).toBe(SPEECH_OFF_MESSAGES.synthesize);
  });
});

describe('createSpeechProvider', () => {
  it('makes the provider the configuration describes', () => {
    expect(createSpeechProvider(loadSpeechConfig({})).kind).toBe('none');
    expect(
      createSpeechProvider(loadSpeechConfig({ FIREFLY_SPEECH_PROVIDER: 'mock' })),
    ).toMatchObject({
      kind: 'mock',
      demo: true,
    });
    const azure = createSpeechProvider(
      loadSpeechConfig({
        FIREFLY_SPEECH_PROVIDER: 'azure-speech',
        AZURE_SPEECH_KEY: 'unit-test-speech-key-7d41',
        AZURE_SPEECH_REGION: 'uksouth',
      }),
    );
    expect(azure).toMatchObject({ kind: 'azure-speech', label: 'Azure AI Speech', demo: false });
    expect(azure.capabilities().notice).toBeNull();
  });

  it('is not configured, with the reason as its notice, when Azure is asked for without a key', () => {
    const provider = createSpeechProvider(
      loadSpeechConfig({ FIREFLY_SPEECH_PROVIDER: 'azure-speech', AZURE_SPEECH_REGION: 'uksouth' }),
    );
    expect(provider.kind).toBe('none');
    expect(provider.capabilities().notice).toBe(
      'FIREFLY_SPEECH_PROVIDER=azure-speech but AZURE_SPEECH_KEY is not set. Spoken calls are turned off.',
    );
  });

  it('keeps Azure working, with the reason as its notice, when only an optional setting was wrong', () => {
    const provider = createSpeechProvider(
      loadSpeechConfig({
        FIREFLY_SPEECH_PROVIDER: 'azure-speech',
        AZURE_SPEECH_KEY: 'unit-test-speech-key-7d41',
        AZURE_SPEECH_REGION: 'uksouth',
        AZURE_SPEECH_VOICE_FEMALE: 'not a voice',
      }),
    );
    expect(provider.kind).toBe('azure-speech');
    expect(provider.capabilities()).toMatchObject({ transcribe: true, synthesize: true });
    expect(provider.capabilities().notice).toContain(
      'AZURE_SPEECH_VOICE_FEMALE is not a voice name',
    );
  });

  it('builds the provider straight from environment variables', () => {
    expect(createSpeechProviderFromEnv({}).kind).toBe('none');
    expect(createSpeechProviderFromEnv({ FIREFLY_SPEECH_PROVIDER: 'mock' }).kind).toBe('mock');
  });
});
