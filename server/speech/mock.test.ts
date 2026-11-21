import { describe, expect, it } from 'vitest';
import { VOICE_IDS } from '#shared/domain/voices.ts';
import { describeVoices, voiceDirection } from './voices.ts';
import {
  createMockSpeechProvider,
  MOCK_MIN_AUDIO_MS,
  MOCK_UTTERANCES,
  mockVoiceOptions,
} from './mock.ts';
import { NOTHING_TO_SPEAK_MESSAGE, SPEECH_LIMITS, SpeechError } from './types.ts';
import { encodeWav, validateWav } from './wav.ts';

const clip = (ms: number) => ({
  audio: encodeWav(Buffer.alloc((ms / 1000) * 32000)),
  language: 'en-GB' as const,
  durationMs: ms,
});
const direction = voiceDirection({ speaker: 'female', language: 'en-GB', mood: 'calm' });

describe('demo speech: what it says about itself', () => {
  it('is labelled as a scripted demonstration, can do both jobs, and claims no expressive styles', () => {
    const provider = createMockSpeechProvider();
    expect(provider).toMatchObject({ kind: 'mock', label: 'Demo speech (scripted)', demo: true });
    expect(provider.capabilities()).toEqual({
      provider: 'mock',
      label: 'Demo speech (scripted)',
      demo: true,
      transcribe: true,
      synthesize: true,
      expressiveStyles: false,
      notice: null,
      voices: describeVoices(mockVoiceOptions),
      limits: { maxAudioBytes: 1_500_000, maxAudioSeconds: 30, sampleRate: 16000 },
    });
    expect(provider.capabilities().limits).toEqual(SPEECH_LIMITS);
  });

  it('offers the four choices as one placeholder sound told apart by pace alone, and says so', () => {
    const provider = createMockSpeechProvider();
    const options = provider.listVoices('en-GB');
    expect(options.map((option) => option.id)).toEqual([...VOICE_IDS]);
    expect(options.map((option) => option.providerVoice)).toEqual(['mock', 'mock', 'mock', 'mock']);
    // Only the first is not a copy of an earlier choice; none has a speaking style.
    expect(options.map((option) => option.shared)).toEqual([false, true, true, true]);
    expect(options.every((option) => !option.styles)).toBe(true);
  });
});

describe('demo speech: transcription', () => {
  it('does not understand audio: it reads the next scripted line, in order, and starts again at the end', async () => {
    const provider = createMockSpeechProvider();
    const said: string[] = [];
    for (let i = 0; i < MOCK_UTTERANCES.length + 2; i++) {
      const result = await provider.transcribe(clip(1000));
      expect(result.status).toBe('recognised');
      said.push(result.text);
    }
    expect(said.slice(0, MOCK_UTTERANCES.length)).toEqual([...MOCK_UTTERANCES]);
    expect(said.slice(MOCK_UTTERANCES.length)).toEqual(MOCK_UTTERANCES.slice(0, 2));
  });

  it('gives the same answer whatever the audio holds, and reports the length of the clip', async () => {
    const a = await createMockSpeechProvider().transcribe(clip(2000));
    const loud = { ...clip(2000), audio: Buffer.alloc(64044, 0x7f) };
    const b = await createMockSpeechProvider().transcribe(loud);
    expect(a).toEqual(b);
    expect(a.durationMs).toBe(2000);
  });

  it('hears nothing in a clip shorter than 150 ms, without using up a line', async () => {
    const provider = createMockSpeechProvider();
    expect(MOCK_MIN_AUDIO_MS).toBe(150);
    expect(await provider.transcribe(clip(149))).toEqual({
      status: 'no-speech',
      text: '',
      durationMs: 149,
    });
    expect((await provider.transcribe(clip(150))).text).toBe(MOCK_UTTERANCES[0]);
    expect((await provider.transcribe(clip(50))).status).toBe('no-speech');
    expect((await provider.transcribe(clip(300))).text).toBe(MOCK_UTTERANCES[1]);
  });

  it('keeps its own place for each provider it creates', async () => {
    const first = createMockSpeechProvider();
    const second = createMockSpeechProvider();
    await first.transcribe(clip(500));
    expect((await second.transcribe(clip(500))).text).toBe(MOCK_UTTERANCES[0]);
  });

  it('says only plain things a support engineer might say, with no contact details', () => {
    expect(MOCK_UTTERANCES.length).toBeGreaterThanOrEqual(6);
    for (const line of MOCK_UTTERANCES) {
      expect(line).not.toMatch(/@|https?:|\d{4}/);
      expect(line.length).toBeLessThan(200);
    }
  });
});

describe('demo speech: the customer "voice"', () => {
  const speak = (text: string) => createMockSpeechProvider().synthesize({ text, direction });

  it('returns a valid 16-bit mono WAV, labelled as the mock voice with no style', async () => {
    const spoken = await speak('Hello, I cannot sign in to my account.');
    expect(spoken).toMatchObject({ contentType: 'audio/wav', voice: 'mock', style: 'none' });
    const checked = validateWav(spoken.audio);
    expect(checked.ok).toBe(true);
  });

  it('lasts about as long as the line, between half a second and eight seconds', async () => {
    const seconds = async (text: string) => {
      const checked = validateWav((await speak(text)).audio);
      return checked.ok ? checked.durationMs / 1000 : Number.NaN;
    };
    expect(await seconds('Hi.')).toBe(0.5);
    expect(await seconds('x'.repeat(75))).toBe(5);
    expect(await seconds('x'.repeat(30))).toBe(2);
    expect(await seconds('x'.repeat(5000))).toBe(8);
    expect(await seconds('x'.repeat(150))).toBe(8);
  });

  it('refuses a line with nothing in it to speak, the same way the real provider does', async () => {
    // Only what would be spoken counts: a line that is only a stage direction or only markup has no words.
    for (const nothing of ['', '   ', '*sighs*', '{"mood":"angry"}', '\u0000\u200b']) {
      const error = await speak(nothing).catch((caught: unknown) => caught);
      expect(error, JSON.stringify(nothing)).toBeInstanceOf(SpeechError);
      expect(error).toMatchObject({
        code: 'speech_failed',
        retryable: false,
        message: NOTHING_TO_SPEAK_MESSAGE,
      });
    }
  });

  it('sounds as long as the words that would be spoken, not the markup around them', async () => {
    const seconds = async (text: string) => {
      const checked = validateWav((await speak(text)).audio);
      return checked.ok ? checked.durationMs : Number.NaN;
    };
    expect(await seconds('**' + 'x'.repeat(75) + '** *sighs*')).toBe(await seconds('x'.repeat(75)));
  });

  it('follows the voice that was asked for: its own pace and texture, and it says which', async () => {
    const provider = createMockSpeechProvider();
    const text = 'Please help me with this problem today, it matters a lot to us.';
    const made = await Promise.all(
      VOICE_IDS.map((voice) =>
        provider.synthesize({
          text,
          direction: voiceDirection({ speaker: 'female', language: 'en-GB', mood: 'calm', voice }),
        }),
      ),
    );
    expect(made.map((spoken) => spoken.voiceId)).toEqual([...VOICE_IDS]);
    // Four different recordings, and the same one again for the same choice.
    expect(new Set(made.map((spoken) => spoken.audio.toString('base64'))).size).toBe(4);
    const again = await provider.synthesize({
      text,
      direction: voiceDirection({
        speaker: 'female',
        language: 'en-GB',
        mood: 'calm',
        voice: 'voice-c',
      }),
    });
    expect(again.audio.equals((made[2] as (typeof made)[number]).audio)).toBe(true);
    // A slower choice makes a longer sound, a quicker one a shorter one.
    const length = (index: number) => (made[index] as (typeof made)[number]).audio.length;
    expect(length(2)).toBeGreaterThan(length(0)); // Measured is slower than Warm
    expect(length(1)).toBeLessThan(length(0)); // Direct is quicker than Warm
    // Without a voice there is no id to report.
    expect((await speak('Hello there.')).voiceId).toBeUndefined();
  });

  it('is soft: quiet, never silent, and the same every time for the same line', async () => {
    const a = (await speak('Please help me with this problem today.')).audio;
    const b = (await speak('Please help me with this problem today.')).audio;
    const c = (await speak('A different line entirely, this time.')).audio;
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
    let peak = 0;
    for (let i = 44; i < a.length; i += 2) peak = Math.max(peak, Math.abs(a.readInt16LE(i)));
    expect(peak).toBeGreaterThan(50);
    expect(peak).toBeLessThan(6000);
  });

  it('fades in and out so there are no clicks', async () => {
    const audio = (await speak('Hello there, how are you today my friend?')).audio;
    expect(Math.abs(audio.readInt16LE(44))).toBeLessThan(10);
    expect(Math.abs(audio.readInt16LE(audio.length - 2))).toBeLessThan(10);
  });
});
