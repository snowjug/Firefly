import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { describe, expect, it } from 'vitest';
import { loadAppConfig } from '../config.ts';
import {
  azureEndpoints,
  DEFAULT_SPEECH_TIMEOUT_MS,
  loadSpeechConfig,
  SpeechError,
} from './types.ts';

const KEY = 'unit-test-speech-key-7d41';
const azure = (extra: Record<string, string> = {}): NodeJS.ProcessEnv => ({
  FIREFLY_SPEECH_PROVIDER: 'azure-speech',
  AZURE_SPEECH_KEY: KEY,
  AZURE_SPEECH_REGION: 'uksouth',
  ...extra,
});

describe('loadSpeechConfig: which provider', () => {
  it('is off unless speech is asked for', () => {
    expect(loadSpeechConfig({})).toEqual({ config: { kind: 'none' }, problem: null });
    expect(loadSpeechConfig({ FIREFLY_SPEECH_PROVIDER: '' }).config.kind).toBe('none');
    expect(loadSpeechConfig({ FIREFLY_SPEECH_PROVIDER: ' None ' }).config.kind).toBe('none');
    // Azure variables on their own do not turn it on.
    expect(loadSpeechConfig({ AZURE_SPEECH_KEY: KEY, AZURE_SPEECH_REGION: 'uksouth' })).toEqual({
      config: { kind: 'none' },
      problem: null,
    });
  });

  it('is the scripted demonstration only when it is asked for by name', () => {
    expect(loadSpeechConfig({ FIREFLY_SPEECH_PROVIDER: 'mock' })).toEqual({
      config: { kind: 'mock' },
      problem: null,
    });
    expect(loadSpeechConfig({ FIREFLY_SPEECH_PROVIDER: ' MOCK ' }).config.kind).toBe('mock');
  });

  it('turns speech off, and says so, for a provider it does not know', () => {
    const loaded = loadSpeechConfig({ FIREFLY_SPEECH_PROVIDER: 'google' });
    expect(loaded.config).toEqual({ kind: 'none' });
    expect(loaded.problem).toBe(
      'FIREFLY_SPEECH_PROVIDER is not recognised. Use none, mock or azure-speech. Spoken calls are turned off.',
    );
  });

  it('does not repeat an unrecognised value, which could be a secret pasted in the wrong place', () => {
    const loaded = loadSpeechConfig({ FIREFLY_SPEECH_PROVIDER: KEY });
    expect(loaded.problem).not.toContain(KEY);
    expect(JSON.stringify(loaded)).not.toContain(KEY);
  });
});

describe('loadSpeechConfig: Azure AI Speech', () => {
  it('needs a key and a region or an endpoint, and falls back to off rather than failing', () => {
    expect(loadSpeechConfig({ FIREFLY_SPEECH_PROVIDER: 'azure-speech' })).toEqual({
      config: { kind: 'none' },
      problem:
        'FIREFLY_SPEECH_PROVIDER=azure-speech but AZURE_SPEECH_KEY is not set and neither AZURE_SPEECH_REGION nor AZURE_SPEECH_ENDPOINT is set. Spoken calls are turned off.',
    });
    expect(loadSpeechConfig(azure({ AZURE_SPEECH_KEY: '' })).problem).toBe(
      'FIREFLY_SPEECH_PROVIDER=azure-speech but AZURE_SPEECH_KEY is not set. Spoken calls are turned off.',
    );
    expect(loadSpeechConfig(azure({ AZURE_SPEECH_REGION: '' })).problem).toBe(
      'FIREFLY_SPEECH_PROVIDER=azure-speech but neither AZURE_SPEECH_REGION nor AZURE_SPEECH_ENDPOINT is set. Spoken calls are turned off.',
    );
  });

  it('treats the placeholders from .env.example as not set', () => {
    const loaded = loadSpeechConfig(
      azure({ AZURE_SPEECH_KEY: '<your-speech-key>', AZURE_SPEECH_REGION: '<uksouth>' }),
    );
    expect(loaded.config.kind).toBe('none');
    expect(loaded.problem).toContain('AZURE_SPEECH_KEY is not set');
    expect(loaded.problem).toContain('neither AZURE_SPEECH_REGION nor AZURE_SPEECH_ENDPOINT');
  });

  it('builds the regional addresses from a region', () => {
    expect(loadSpeechConfig(azure())).toEqual({
      config: {
        kind: 'azure-speech',
        apiKey: KEY,
        sttUrl:
          'https://uksouth.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1',
        ttsUrl: 'https://uksouth.tts.speech.microsoft.com/cognitiveservices/v1',
        voices: { female: null, male: null },
        timeoutMs: DEFAULT_SPEECH_TIMEOUT_MS,
      },
      problem: null,
    });
    expect(loadSpeechConfig(azure({ AZURE_SPEECH_REGION: '  EastUS2 ' })).config).toMatchObject({
      ttsUrl: 'https://eastus2.tts.speech.microsoft.com/cognitiveservices/v1',
    });
  });

  it('refuses a region that is not a plain region name, so it cannot change the host', () => {
    for (const region of [
      'uk south',
      'uksouth.evil.test',
      'evil.test/',
      'a@b',
      'x',
      '-uksouth',
      '../x',
    ]) {
      const loaded = loadSpeechConfig(azure({ AZURE_SPEECH_REGION: region }));
      expect(loaded.config.kind, region).toBe('none');
      expect(loaded.problem, region).toBe(
        'AZURE_SPEECH_REGION is not a region name such as uksouth. Spoken calls are turned off.',
      );
    }
  });

  it('refuses a key that cannot be sent in a header, without repeating it', () => {
    for (const bad of ['two words', 'tab\there', 'new\nline', 'caf\u00e9-key-1234']) {
      const loaded = loadSpeechConfig(azure({ AZURE_SPEECH_KEY: bad }));
      expect(loaded.config.kind).toBe('none');
      expect(loaded.problem).toBe(
        'AZURE_SPEECH_KEY contains characters that cannot be sent to the speech service. Spoken calls are turned off.',
      );
    }
  });

  it('reads the optional voices, and ignores one that is not a voice name, with a notice', () => {
    const both = loadSpeechConfig(
      azure({
        AZURE_SPEECH_VOICE_FEMALE: ' en-GB-LibbyNeural ',
        AZURE_SPEECH_VOICE_MALE: 'en-US-Andrew:DragonHDLatestNeural',
      }),
    );
    expect(both.problem).toBeNull();
    expect(both.config).toMatchObject({
      voices: { female: 'en-GB-LibbyNeural', male: 'en-US-Andrew:DragonHDLatestNeural' },
    });

    const bad = loadSpeechConfig(
      azure({
        AZURE_SPEECH_VOICE_FEMALE: 'Sonia <b>',
        AZURE_SPEECH_VOICE_MALE: 'en-GB-RyanNeural',
      }),
    );
    expect(bad.config).toMatchObject({
      kind: 'azure-speech',
      voices: { female: null, male: 'en-GB-RyanNeural' },
    });
    expect(bad.problem).toBe(
      'AZURE_SPEECH_VOICE_FEMALE is not a voice name such as en-GB-SoniaNeural, so the default voice is used.',
    );
    const worse = loadSpeechConfig(
      azure({ AZURE_SPEECH_VOICE_FEMALE: '??', AZURE_SPEECH_VOICE_MALE: 'x y' }),
    );
    expect(worse.problem).toBe(
      'AZURE_SPEECH_VOICE_FEMALE and AZURE_SPEECH_VOICE_MALE are not voice names such as en-GB-SoniaNeural, so the default voices are used.',
    );
    expect(worse.config.kind).toBe('azure-speech');
  });

  it('keeps the request timeout between one and sixty seconds', () => {
    const timeout = (value: string | undefined) =>
      (
        loadSpeechConfig(azure(value === undefined ? {} : { FIREFLY_SPEECH_TIMEOUT_MS: value }))
          .config as {
          timeoutMs: number;
        }
      ).timeoutMs;
    expect(timeout(undefined)).toBe(15_000);
    expect(timeout('20000')).toBe(20_000);
    expect(timeout('10')).toBe(1_000);
    expect(timeout('9999999')).toBe(60_000);
    expect(timeout('soon')).toBe(15_000);
    expect(timeout('')).toBe(15_000);
  });

  it('is part of the application configuration', () => {
    expect(loadAppConfig({}).speech).toEqual({ config: { kind: 'none' }, problem: null });
    expect(loadAppConfig({ FIREFLY_SPEECH_PROVIDER: 'mock' }).speech.config.kind).toBe('mock');
  });

  it('never puts the key, or any other value it was given, in a problem', () => {
    const secrets = {
      AZURE_SPEECH_KEY: KEY,
      AZURE_SPEECH_ENDPOINT: 'http://user:pass@secret-host.example/path?token=abc',
      AZURE_SPEECH_REGION: 'region with secret',
      AZURE_SPEECH_VOICE_FEMALE: 'voice secret!',
      AZURE_SPEECH_VOICE_MALE: 'another secret!',
    };
    for (const omit of [undefined, 'AZURE_SPEECH_KEY', 'AZURE_SPEECH_ENDPOINT']) {
      const env: NodeJS.ProcessEnv = { FIREFLY_SPEECH_PROVIDER: 'azure-speech', ...secrets };
      if (omit) delete env[omit];
      const text = JSON.stringify(loadSpeechConfig(env).problem);
      for (const value of Object.values(secrets)) expect(text).not.toContain(value);
      expect(text).not.toContain('secret-host');
    }
  });
});

describe('azureEndpoints', () => {
  const custom = (base: string) => ({
    sttUrl: `${base}/stt/speech/recognition/conversation/cognitiveservices/v1`,
    ttsUrl: `${base}/tts/cognitiveservices/v1`,
  });

  it('uses the custom-domain layout for a resource address', () => {
    expect(azureEndpoints(undefined, 'https://my-speech.cognitiveservices.azure.com')).toEqual(
      custom('https://my-speech.cognitiveservices.azure.com'),
    );
    expect(azureEndpoints(undefined, ' https://my-speech.cognitiveservices.azure.com/// ')).toEqual(
      custom('https://my-speech.cognitiveservices.azure.com'),
    );
  });

  it('prefers the address when both an address and a region are given', () => {
    expect(azureEndpoints('uksouth', 'https://my-speech.cognitiveservices.azure.com')).toEqual(
      custom('https://my-speech.cognitiveservices.azure.com'),
    );
  });

  it('accepts any https address, such as a private endpoint, a sovereign cloud or a gateway', () => {
    expect(azureEndpoints(undefined, 'https://my-speech.cognitiveservices.azure.us')).toEqual(
      custom('https://my-speech.cognitiveservices.azure.us'),
    );
    expect(azureEndpoints(undefined, 'https://gateway.example.test:8443/speech-proxy/')).toEqual(
      custom('https://gateway.example.test:8443/speech-proxy'),
    );
  });

  it('recognises a regional speech host and gives it the matching text-to-speech host', () => {
    for (const [given, domain, name] of [
      ['https://uksouth.stt.speech.microsoft.com', 'microsoft.com', 'uksouth'],
      ['https://uksouth.tts.speech.microsoft.com/', 'microsoft.com', 'uksouth'],
      ['https://usgovvirginia.stt.speech.azure.us', 'azure.us', 'usgovvirginia'],
    ] as const) {
      expect(azureEndpoints(undefined, given)).toEqual({
        sttUrl: `https://${name}.stt.speech.${domain}/speech/recognition/conversation/cognitiveservices/v1`,
        ttsUrl: `https://${name}.tts.speech.${domain}/cognitiveservices/v1`,
      });
    }
  });

  it('refuses an address that is not https, or has sign-in details, a query or a fragment', () => {
    for (const bad of [
      'http://my-speech.cognitiveservices.azure.com',
      'ftp://my-speech.cognitiveservices.azure.com',
      'my-speech.cognitiveservices.azure.com',
      'https://user:pass@my-speech.cognitiveservices.azure.com',
      'https://my-speech.cognitiveservices.azure.com?key=abc',
      'https://my-speech.cognitiveservices.azure.com/#frag',
      'https://',
      'not a url',
    ]) {
      expect(azureEndpoints(undefined, bad), bad).toHaveProperty('problem');
    }
  });
});

describe('SpeechError', () => {
  it('carries a code and whether trying again can help, and keeps a cause out of its message', () => {
    const error = new SpeechError(
      'speech_failed',
      'The speech service could not complete that request.',
      true,
      new Error('ECONNRESET'),
    );
    expect(error).toMatchObject({ name: 'SpeechError', code: 'speech_failed', retryable: true });
    expect(error.message).not.toContain('ECONNRESET');
    expect((error.cause as Error).message).toBe('ECONNRESET');
  });
});

describe('.env.example', () => {
  const text = readFileSync(new URL('../../.env.example', import.meta.url), 'utf8');
  const example = parseEnv(text);

  it('documents every variable speech reads', () => {
    for (const name of [
      'FIREFLY_SPEECH_PROVIDER',
      'AZURE_SPEECH_KEY',
      'AZURE_SPEECH_REGION',
      'AZURE_SPEECH_ENDPOINT',
      'AZURE_SPEECH_VOICE_FEMALE',
      'AZURE_SPEECH_VOICE_MALE',
      'FIREFLY_SPEECH_TIMEOUT_MS',
    ]) {
      expect(text, name).toContain(name);
    }
  });

  it('leaves speech off as copied, and holds placeholders only', () => {
    expect(loadSpeechConfig(example)).toEqual({ config: { kind: 'none' }, problem: null });
    expect(example.FIREFLY_SPEECH_PROVIDER).toBe('none');
    expect(example.AZURE_SPEECH_KEY).toMatch(/^<.*>$/);
    expect(example.AZURE_SPEECH_REGION).toMatch(/^<.*>$/);
  });

  it('does not let its placeholders pass for a configuration when Azure is chosen', () => {
    const loaded = loadSpeechConfig({ ...example, FIREFLY_SPEECH_PROVIDER: 'azure-speech' });
    expect(loaded.config.kind).toBe('none');
    expect(loaded.problem).toContain('AZURE_SPEECH_KEY is not set');
    expect(loaded.problem).toContain('neither AZURE_SPEECH_REGION nor AZURE_SPEECH_ENDPOINT');
  });

  it('works once a key and region replace the placeholders, with the timeout it shows', () => {
    const loaded = loadSpeechConfig({
      ...example,
      FIREFLY_SPEECH_PROVIDER: 'azure-speech',
      AZURE_SPEECH_KEY: KEY,
      AZURE_SPEECH_REGION: 'uksouth',
    });
    expect(loaded.problem).toBeNull();
    expect(loaded.config).toMatchObject({ kind: 'azure-speech', timeoutMs: 15_000 });
  });
});
