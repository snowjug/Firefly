import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// A fake microphone for the browser tests, made from nothing but arithmetic.
//
// Chromium can replace the microphone with a WAV file (`--use-file-for-fake-audio-capture`). The
// file is generated here, written under `test-results/` (which is git-ignored and never committed)
// and played in a loop: a burst of speech-like sound, then silence, again and again. Whenever the
// call's voice-activity detector (web/src/features/voice/capture/vad.ts, whose numbers are in
// capture/tuning.ts) starts listening it finds a burst within a few seconds, and an utterance ends
// after about 1.4 s of the silence that follows (or at once, when the trainee presses "Done
// speaking").
//
// What this proves: the call's microphone, the worklet, the detector, the recording and the upload
// work in a real browser. What it does NOT prove: that anything intelligible was heard. The server's
// mock speech provider ignores the audio and answers with a scripted sentence, so the words of a
// spoken turn never come from this file.
//
// A hands-free call (the default) keeps listening until the person mutes, pauses or ends it, so with
// this file a spoken call that nobody stops takes a turn from every burst, again and again. A journey
// that has to hold a state still (Listening, Hearing you, Paused) uses the tone it controls itself
// instead: `installFakeMicrophone` and `speak` in support/a11y.ts.

/**
 * Where the generated file is written: under the run's output folder (`test-results`, or
 * E2E_OUTPUT_DIR), which is git-ignored and cleared at the start of a run. It is generated again for
 * every run and never committed.
 */
export function fakeMicrophoneDir(): string {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  return resolve(root, process.env.E2E_OUTPUT_DIR?.trim() || 'test-results', 'fake-microphone');
}

export interface SpeechLikeOptions {
  /** Samples per second of the file. The browser converts it to whatever the call asks for. */
  sampleRate?: number;
  /** How long the voiced burst lasts: well over the detector's 400 ms minimum. */
  burstSeconds?: number;
  /** How long the silence lasts. It must be longer than the detector's 1.4 s end-of-speech pause. */
  silenceSeconds?: number;
  /** The RMS of the loudest part of the burst, 0 to 1. The detector wants well over 0.015. */
  peakRms?: number;
}

export const SPEECH_LIKE_DEFAULTS = {
  sampleRate: 48_000,
  burstSeconds: 1.8,
  silenceSeconds: 2.4,
  peakRms: 0.14,
} as const;

// The regions of a vowel that give a voice its colour. Harmonics near them are louder, so the sound
// is a voice-like buzz and not a pure tone (a steady tone is what noise suppression removes).
const FORMANTS_HZ = [650, 1150, 2600] as const;

function harmonicWeight(frequency: number): number {
  let weight = 0.04;
  for (const centre of FORMANTS_HZ) {
    const distance = (frequency - centre) / 220;
    weight += Math.exp(-distance * distance);
  }
  return weight / (1 + frequency / 1500);
}

/**
 * One period of the file: a voiced burst that rises and falls like syllables (never below a quarter
 * of its peak, so the detector does not hear a gap inside a sentence), then exact silence.
 */
export function speechLikeSamples(options: SpeechLikeOptions = {}): Int16Array {
  const { sampleRate, burstSeconds, silenceSeconds, peakRms } = {
    ...SPEECH_LIKE_DEFAULTS,
    ...options,
  };
  const burst = Math.round(sampleRate * burstSeconds);
  const silence = Math.round(sampleRate * silenceSeconds);
  const samples = new Float32Array(burst + silence);

  let phase = 0;
  for (let i = 0; i < burst; i++) {
    const t = i / sampleRate;
    // A pitch that drifts, as a speaking voice does.
    const pitch =
      125 + 22 * Math.sin(2 * Math.PI * 0.9 * t) + 14 * Math.sin(2 * Math.PI * 0.27 * t);
    phase += (2 * Math.PI * pitch) / sampleRate;
    let value = 0;
    for (let k = 1; k <= 28; k++) {
      const frequency = pitch * k;
      if (frequency > sampleRate / 2.4) break;
      value += harmonicWeight(frequency) * Math.sin(k * phase);
    }
    const syllables = 0.25 + 0.75 * Math.sin(Math.PI * ((t * 3.1) % 1)) ** 2;
    const fade = Math.min(1, t / 0.04, (burstSeconds - t) / 0.06);
    samples[i] = value * syllables * fade;
  }

  // Scale so that the loudest 100 ms window of the burst has the requested RMS.
  const window = Math.round(sampleRate * 0.1);
  let loudest = 0;
  for (let start = 0; start + window <= burst; start += window >> 1) {
    let sum = 0;
    for (let i = start; i < start + window; i++) sum += (samples[i] as number) ** 2;
    loudest = Math.max(loudest, Math.sqrt(sum / window));
  }
  const gain = loudest > 0 ? peakRms / loudest : 0;

  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const scaled = Math.max(-1, Math.min(1, (samples[i] as number) * gain));
    pcm[i] = Math.round(scaled * 0x7fff);
  }
  return pcm;
}

/** A mono, 16-bit PCM WAV with the plain 44-byte header every WAV reader accepts. */
export function encodeWav(samples: Int16Array, sampleRate: number): Buffer {
  const dataBytes = samples.length * 2;
  const wav = Buffer.alloc(44 + dataBytes);
  wav.write('RIFF', 0, 'ascii');
  wav.writeUInt32LE(36 + dataBytes, 4);
  wav.write('WAVE', 8, 'ascii');
  wav.write('fmt ', 12, 'ascii');
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); // PCM
  wav.writeUInt16LE(1, 22); // mono
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36, 'ascii');
  wav.writeUInt32LE(dataBytes, 40);
  Buffer.from(samples.buffer, samples.byteOffset, dataBytes).copy(wav, 44);
  return wav;
}

export function speechLikeWav(options: SpeechLikeOptions = {}): Buffer {
  const sampleRate = options.sampleRate ?? SPEECH_LIKE_DEFAULTS.sampleRate;
  return encodeWav(speechLikeSamples(options), sampleRate);
}

/**
 * Writes the speech-like WAV (if it is not already there) and returns its absolute path. Safe to
 * call from the config, a global setup and a test: the content is always the same.
 */
export function writeFakeMicrophoneWav(
  options: SpeechLikeOptions = {},
  directory: string = fakeMicrophoneDir(),
): string {
  const path = resolve(directory, 'speech-like.wav');
  if (!existsSync(path)) {
    mkdirSync(directory, { recursive: true });
    writeFileSync(path, speechLikeWav(options));
  }
  return path;
}

export interface FakeMicrophoneArgs {
  /** Replace the default beep with this WAV file, played in a loop (the default) or once. */
  file?: string;
  loop?: boolean;
  /** Answer the microphone permission prompt by itself (the default). Leave it off to be asked. */
  autoAccept?: boolean;
}

/**
 * Chromium launch arguments for a fake microphone: `launchOptions: { args: fakeMicrophoneArgs(...) }`.
 * With no file the browser's own fake device is used, which beeps for 20 ms twice a second: far
 * too short for the call's detector to take for speech.
 */
export function fakeMicrophoneArgs({
  file,
  loop = true,
  autoAccept = true,
}: FakeMicrophoneArgs = {}): string[] {
  const args = ['--use-fake-device-for-media-stream'];
  if (autoAccept) args.push('--use-fake-ui-for-media-stream');
  if (file) args.push(`--use-file-for-fake-audio-capture=${file}${loop ? '' : '%noloop'}`);
  return args;
}
