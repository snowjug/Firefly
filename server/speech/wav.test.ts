import { describe, expect, it } from 'vitest';
import { SPEECH_LIMITS } from './types.ts';
import { encodeWav, validateWav } from './wav.ts';

const pcm = (seconds: number) => Buffer.alloc(Math.round(seconds * 16000) * 2, 1);

interface Parts {
  tag?: number;
  channels?: number;
  rate?: number;
  bits?: number;
  byteRate?: number;
  blockAlign?: number;
  dataBytes?: number;
  declaredData?: number;
  fmtFirst?: boolean;
  extra?: Buffer;
}

/** A WAV built by hand, so each field can be made wrong on purpose. */
function wav(parts: Parts = {}): Buffer {
  const rate = parts.rate ?? 16000;
  const channels = parts.channels ?? 1;
  const bits = parts.bits ?? 16;
  const fmt = Buffer.alloc(24);
  fmt.write('fmt ', 0, 'latin1');
  fmt.writeUInt32LE(16, 4);
  fmt.writeUInt16LE(parts.tag ?? 1, 8);
  fmt.writeUInt16LE(channels, 10);
  fmt.writeUInt32LE(rate, 12);
  fmt.writeUInt32LE(parts.byteRate ?? (rate * channels * bits) / 8, 16);
  fmt.writeUInt16LE(parts.blockAlign ?? (channels * bits) / 8, 20);
  fmt.writeUInt16LE(bits, 22);
  const samples = Buffer.alloc(parts.dataBytes ?? 3200, 2);
  const head = Buffer.alloc(8);
  head.write('data', 0, 'latin1');
  head.writeUInt32LE(parts.declaredData ?? samples.length, 4);
  const data = Buffer.concat([head, samples]);
  const riff = Buffer.alloc(12);
  riff.write('RIFF', 0, 'latin1');
  riff.writeUInt32LE(4 + fmt.length + (parts.extra?.length ?? 0) + data.length, 4);
  riff.write('WAVE', 8, 'latin1');
  const body = parts.fmtFirst === false ? [data, fmt] : [fmt, parts.extra ?? Buffer.alloc(0), data];
  return Buffer.concat([riff, ...body]);
}

const message = (input: Buffer) => {
  const result = validateWav(input);
  return result.ok ? null : result.message;
};

describe('validateWav: accepts 16 kHz, 16-bit, mono PCM', () => {
  it('measures the duration from the container', () => {
    for (const [seconds, ms] of [
      [0.1, 100],
      [1.5, 1500],
      [12.34, 12340],
      [30, 30000],
    ] as const) {
      const result = validateWav(encodeWav(pcm(seconds)));
      expect(result.ok && result.durationMs, `${seconds}s`).toBe(ms);
    }
  });

  it('hands on a clean 44-byte-header copy of the audio, whatever extra chunks came with it', () => {
    // An odd-sized LIST chunk (padded to even) between the format and the audio.
    const extra = Buffer.concat([
      Buffer.from('LIST', 'latin1'),
      Buffer.from([3, 0, 0, 0, 65, 66, 67, 0]),
    ]);
    const messy = wav({ extra, dataBytes: 6400 });
    const result = validateWav(messy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.durationMs).toBe(200);
    expect(result.wav).toHaveLength(44 + 6400);
    expect(result.wav.toString('latin1', 0, 4)).toBe('RIFF');
    expect(result.wav.readUInt32LE(4)).toBe(36 + 6400);
    expect(result.wav.readUInt32LE(40)).toBe(6400);
    expect(result.wav.subarray(44).equals(Buffer.alloc(6400, 2))).toBe(true);
    // The clean copy is itself valid.
    expect(validateWav(result.wav).ok).toBe(true);
  });

  it('ignores a wrong RIFF size, which streaming recorders leave unset', () => {
    const input = wav();
    input.writeUInt32LE(0, 4);
    expect(validateWav(input).ok).toBe(true);
  });
});

describe('validateWav: rejects anything else with a plain message', () => {
  it('rejects what is not a WAV file', () => {
    expect(message(Buffer.alloc(0))).toBe('That recording is not a WAV file.');
    expect(message(Buffer.from('hello'))).toBe('That recording is not a WAV file.');
    expect(message(Buffer.from('RIFF....AVI LIST'))).toBe('That recording is not a WAV file.');
    expect(message(Buffer.from('{"not":"audio"}'.padEnd(64, ' ')))).toBe(
      'That recording is not a WAV file.',
    );
  });

  it('rejects another format, channel count, sample rate or sample size', () => {
    const wrong = 'The recording must be 16-bit mono WAV at 16 kHz.';
    expect(message(wav({ tag: 3, bits: 32 }))).toBe(wrong); // floating point
    expect(message(wav({ channels: 2 }))).toBe(wrong);
    expect(message(wav({ rate: 44100 }))).toBe(wrong);
    expect(message(wav({ rate: 8000 }))).toBe(wrong);
    expect(message(wav({ bits: 8 }))).toBe(wrong);
    expect(message(wav({ byteRate: 12345 }))).toBe(wrong);
    expect(message(wav({ blockAlign: 4 }))).toBe(wrong);
  });

  it('rejects a recording with no format, no audio, or damaged audio', () => {
    expect(message(wav({ fmtFirst: false }))).toBe('The recording has no format header.');
    expect(message(wav({ dataBytes: 0 }))).toBe('The recording is empty.');
    // The header promises more audio than the upload holds (a recorder that stopped half way).
    expect(message(wav({ dataBytes: 1000, declaredData: 64000 }))).toBe(
      'The recording looks incomplete.',
    );
    expect(message(wav({ dataBytes: 1001 }))).toBe('The recording looks damaged.');
    expect(message(wav({ dataBytes: 1000, declaredData: 0xffffffff }))).toBe(
      'The recording looks incomplete.',
    );
  });

  it('rejects a recording longer than the limit, and says what the limit is', () => {
    expect(message(encodeWav(pcm(30.5)))).toBe('The recording is longer than 30 seconds.');
    expect(validateWav(encodeWav(pcm(30))).ok).toBe(true);
  });

  it('applies the limits it is given', () => {
    const strict = { ...SPEECH_LIMITS, maxAudioSeconds: 2 };
    expect(validateWav(encodeWav(pcm(2)), strict).ok).toBe(true);
    const long = validateWav(encodeWav(pcm(2.5)), strict);
    expect(long.ok ? null : long.message).toBe('The recording is longer than 2 seconds.');
  });

  it('survives chunk headers that point past the end', () => {
    const input = wav();
    // A chunk before the audio that claims to be enormous.
    const hostile = Buffer.concat([
      input.subarray(0, 12),
      Buffer.from('JUNK', 'latin1'),
      Buffer.from([0xff, 0xff, 0xff, 0x7f]),
      input.subarray(12),
    ]);
    expect(message(hostile)).toBe('The recording has no format header.');
  });
});
