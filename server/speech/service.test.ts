import { describe, expect, it } from 'vitest';
import { VOICE_IDS, VOICE_PREVIEW_TEXT } from '#shared/domain/voices.ts';
import { createNoneSpeechProvider } from './index.ts';
import { createMockSpeechProvider, MOCK_UTTERANCES } from './mock.ts';
import {
  directionForLine,
  previewVoice,
  requireSpeech,
  speakLine,
  transcribeRecording,
} from './service.ts';
import { flakySpeech, recordingSpeech } from './testing/fakes.ts';
import { SPEECH_OFF_MESSAGES, SpeechError } from './types.ts';
import { encodeWav } from './wav.ts';

// The speech use cases with an in-memory provider: no HTTP, no database, no model.

const recordingOf = (ms: number) => ({
  audio: encodeWav(Buffer.alloc((ms / 1000) * 32000, 1)),
  language: 'en-GB' as const,
  durationMs: ms,
});

describe('requireSpeech', () => {
  it('lets a provider that can do the job through, and turns one that cannot away with a message that says what to do instead', () => {
    expect(() => requireSpeech(createMockSpeechProvider(), 'transcribe')).not.toThrow();
    expect(() => requireSpeech(createMockSpeechProvider(), 'synthesize')).not.toThrow();
    for (const job of ['transcribe', 'synthesize'] as const) {
      let caught: unknown;
      try {
        requireSpeech(createNoneSpeechProvider(), job);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(SpeechError);
      expect(caught).toMatchObject({
        code: 'speech_unavailable',
        retryable: false,
        message: SPEECH_OFF_MESSAGES[job],
      });
    }
  });
});

describe('directionForLine', () => {
  it('is the mood’s delivery with the chosen voice, and nothing extra when no voice is chosen', () => {
    expect(
      directionForLine({ speaker: 'male', mood: 'frustrated' }, { language: 'en-US' }),
    ).toEqual({
      speaker: 'male',
      language: 'en-US',
      mood: 'frustrated',
      pace: 'firm',
      intensity: 0.5,
    });
    expect(
      directionForLine(
        { speaker: 'male', mood: 'calm', recovering: true },
        { language: 'en-AU', voice: 'voice-c' },
      ),
    ).toEqual({
      speaker: 'male',
      language: 'en-AU',
      mood: 'calm',
      pace: 'measured',
      intensity: 0,
      voice: 'voice-c',
      recovering: true,
    });
  });
});

describe('speakLine', () => {
  it('speaks the stored line, in the chosen voice and language, with the mood the call had', async () => {
    const { provider, spoken } = recordingSpeech();
    const result = await speakLine(
      provider,
      { text: 'I have been waiting two days.', speaker: 'female', mood: 'angry' },
      { language: 'en-IE', voice: 'voice-d' },
    );
    expect(spoken).toHaveLength(1);
    expect(spoken[0]?.text).toBe('I have been waiting two days.');
    expect(spoken[0]?.direction).toMatchObject({
      language: 'en-IE',
      mood: 'angry',
      pace: 'firm',
      voice: 'voice-d',
    });
    expect(result.voiceId).toBe('voice-d');
  });

  it('pairs a voice by speaker, as it always did, when none is chosen', async () => {
    const { provider, spoken } = recordingSpeech();
    await speakLine(
      provider,
      { text: 'Hello.', speaker: 'male', mood: 'calm' },
      { language: 'en-GB' },
    );
    expect(spoken[0]?.direction.speaker).toBe('male');
    expect(spoken[0]?.direction).not.toHaveProperty('voice');
  });

  it('turns a request away before asking the provider anything when speech is off', async () => {
    await expect(
      speakLine(
        createNoneSpeechProvider(),
        { text: 'Hello.', speaker: 'female', mood: 'calm' },
        { language: 'en-GB' },
      ),
    ).rejects.toMatchObject({ code: 'speech_unavailable' });
  });

  it('lets a provider failure through unchanged, so the caller can map it', async () => {
    const { provider } = flakySpeech({ synthesize: 1 });
    await expect(
      speakLine(
        provider,
        { text: 'Hello.', speaker: 'female', mood: 'calm' },
        { language: 'en-GB' },
      ),
    ).rejects.toMatchObject({ code: 'speech_failed', retryable: true });
  });
});

describe('previewVoice', () => {
  it('speaks the one fixed sentence, calmly, in each of the four voices', async () => {
    const { provider, spoken } = recordingSpeech();
    for (const voice of VOICE_IDS) {
      const result = await previewVoice(provider, { language: 'en-GB', voice });
      expect(result.voiceId).toBe(voice);
    }
    expect(spoken.map((s) => s.text)).toEqual(VOICE_IDS.map(() => VOICE_PREVIEW_TEXT));
    expect(spoken.map((s) => s.direction.voice)).toEqual([...VOICE_IDS]);
    for (const request of spoken) {
      expect(request.direction).toMatchObject({ mood: 'calm', pace: 'measured', intensity: 0 });
      expect(request.direction).not.toHaveProperty('recovering');
    }
  });

  it('takes no words from the caller: its options name a voice and a language and nothing else', async () => {
    const { provider, spoken } = recordingSpeech();
    // Extra properties are ignored at run time as well as refused by the types.
    await previewVoice(provider, {
      language: 'en-US',
      voice: 'voice-a',
      text: 'Say something else.',
    } as never);
    expect(spoken[0]?.text).toBe(VOICE_PREVIEW_TEXT);
  });

  it('is turned away when speech is off', async () => {
    await expect(
      previewVoice(createNoneSpeechProvider(), { language: 'en-GB', voice: 'voice-a' }),
    ).rejects.toMatchObject({ code: 'speech_unavailable', retryable: false });
  });
});

describe('transcribeRecording', () => {
  it('hands the recording to the provider once and returns what it heard, unchanged', async () => {
    const { provider, heard } = recordingSpeech();
    const result = await transcribeRecording(provider, recordingOf(1500));
    expect(heard).toHaveLength(1);
    expect(result).toEqual({ status: 'recognised', text: MOCK_UTTERANCES[0], durationMs: 1500 });
  });

  it('is turned away when speech is off, without touching the recording', async () => {
    await expect(
      transcribeRecording(createNoneSpeechProvider(), recordingOf(500)),
    ).rejects.toMatchObject({ code: 'speech_unavailable' });
  });

  it('can be tried again after a failure, and the retry is a plain second request', async () => {
    const { provider, calls } = flakySpeech({ transcribe: 1 });
    const upload = recordingOf(1000);
    await expect(transcribeRecording(provider, upload)).rejects.toMatchObject({
      code: 'speech_failed',
    });
    await expect(transcribeRecording(provider, upload)).resolves.toMatchObject({
      status: 'recognised',
    });
    expect(calls.transcribe).toBe(2);
  });
});
