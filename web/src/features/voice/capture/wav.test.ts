import { describe, expect, it } from 'vitest';
import { levelFromRms, rmsOf, smoothLevel } from './levels.ts';
import { sine } from '../testing/signals.ts';
import { encodeWav, resample, toPcm16, wavBlob, wavDurationMs, WAV_SAMPLE_RATE } from './wav.ts';

function header(wav: Uint8Array) {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const text = (offset: number, length: number) =>
    String.fromCharCode(...wav.subarray(offset, offset + length));
  return {
    riff: text(0, 4),
    size: view.getUint32(4, true),
    wave: text(8, 4),
    fmt: text(12, 4),
    fmtSize: view.getUint32(16, true),
    tag: view.getUint16(20, true),
    channels: view.getUint16(22, true),
    rate: view.getUint32(24, true),
    byteRate: view.getUint32(28, true),
    blockAlign: view.getUint16(32, true),
    bits: view.getUint16(34, true),
    data: text(36, 4),
    dataSize: view.getUint32(40, true),
    sample: (index: number) => view.getInt16(44 + index * 2, true),
  };
}

/** Counts rising zero crossings: for a tone, that is its frequency times its length in seconds. */
function risingCrossings(samples: Float32Array): number {
  let count = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i - 1] as number) < 0 && (samples[i] as number) >= 0) count++;
  }
  return count;
}

describe('encodeWav', () => {
  it('writes the plain 44-byte header the server checks for: 16 kHz, 16-bit, mono PCM', () => {
    const wav = encodeWav(new Float32Array(1600), WAV_SAMPLE_RATE);
    const h = header(wav);
    expect(h).toMatchObject({
      riff: 'RIFF',
      wave: 'WAVE',
      fmt: 'fmt ',
      fmtSize: 16,
      tag: 1,
      channels: 1,
      rate: 16000,
      byteRate: 32000,
      blockAlign: 2,
      bits: 16,
      data: 'data',
      dataSize: 3200,
      size: 36 + 3200,
    });
    expect(wav.length).toBe(44 + 3200);
  });

  it('converts samples to 16-bit values and clips anything outside -1 to 1', () => {
    const wav = encodeWav(Float32Array.of(0, 1, -1, 0.5, 2, -2), WAV_SAMPLE_RATE);
    const h = header(wav);
    expect([0, 1, 2, 3, 4, 5].map((i) => h.sample(i))).toEqual([
      0, 32767, -32768, 16384, 32767, -32768,
    ]);
  });

  it('resamples recordings made at other rates, keeping their length and pitch', () => {
    for (const rate of [48000, 44100, 32000, 8000]) {
      const tone = sine(1000, rate, 0.5, 400);
      const wav = encodeWav(tone, rate);
      expect(header(wav).rate).toBe(16000);
      expect(wavDurationMs(wav)).toBe(1000);
      const pcm = new Float32Array(header(wav).dataSize / 2);
      for (let i = 0; i < pcm.length; i++) pcm[i] = header(wav).sample(i) / 32768;
      // 400 Hz for one second: 400 cycles, give or take the cut at either end.
      expect(Math.abs(risingCrossings(pcm) - 400)).toBeLessThanOrEqual(2);
    }
  });

  it('reports the duration of what it wrote and wraps it as an audio/wav blob', () => {
    const wav = encodeWav(new Float32Array(24000), 16000);
    expect(wavDurationMs(wav)).toBe(1500);
    const blob = wavBlob(wav);
    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBe(wav.length);
  });

  it('writes an empty but valid file for no audio', () => {
    const wav = encodeWav(new Float32Array(0), 48000);
    expect(wav.length).toBe(44);
    expect(header(wav).dataSize).toBe(0);
  });
});

describe('resample', () => {
  it('returns the same samples when the rates match', () => {
    const samples = Float32Array.of(0.1, 0.2);
    expect(resample(samples, 16000, 16000)).toBe(samples);
  });

  it('averages when shrinking, so a steady level stays steady', () => {
    const out = resample(new Float32Array(4800).fill(0.25), 48000, 16000);
    expect(out.length).toBe(1600);
    expect(out.every((value) => Math.abs(value - 0.25) < 1e-6)).toBe(true);
  });

  it('handles rates that are not whole multiples', () => {
    const out = resample(new Float32Array(44100).fill(-0.5), 44100, 16000);
    expect(out.length).toBe(16000);
    expect(out.every((value) => Math.abs(value + 0.5) < 1e-6)).toBe(true);
  });

  it('interpolates when growing', () => {
    const out = resample(Float32Array.of(0, 1, 0, 1), 8000, 16000);
    expect(out.length).toBe(8);
    expect(Array.from(out.subarray(0, 4))).toEqual([0, 0.5, 1, 0.5]);
  });

  it('rejects rates that cannot work', () => {
    expect(() => resample(new Float32Array(4), 0, 16000)).toThrow(RangeError);
    expect(() => resample(new Float32Array(4), 16000, -1)).toThrow(RangeError);
  });
});

describe('toPcm16', () => {
  it('is little-endian', () => {
    expect(Array.from(toPcm16(Float32Array.of(1)))).toEqual([0xff, 0x7f]);
    expect(Array.from(toPcm16(Float32Array.of(-1)))).toEqual([0x00, 0x80]);
  });
});

describe('levels', () => {
  it('measures energy and maps it onto a 0 to 1 meter on a decibel scale', () => {
    expect(rmsOf(new Float32Array(0))).toBe(0);
    expect(rmsOf(Float32Array.of(0.5, -0.5, 0.5, -0.5))).toBeCloseTo(0.5, 6);
    expect(levelFromRms(0)).toBe(0);
    expect(levelFromRms(0.0001)).toBe(0);
    expect(levelFromRms(1)).toBe(1);
    const steps = [0.002, 0.01, 0.05, 0.2].map(levelFromRms);
    expect([...steps].sort((a, b) => a - b)).toEqual(steps);
    expect(steps.every((value) => value >= 0 && value <= 1)).toBe(true);
  });

  it('rises quickly, falls gently and reads zero for near-silence', () => {
    expect(smoothLevel(0, 1)).toBeGreaterThanOrEqual(0.7);
    expect(smoothLevel(1, 0)).toBeGreaterThan(0.6);
    expect(smoothLevel(0.5, 0.5)).toBe(0.5);
    expect(smoothLevel(0.03, 0)).toBe(0);
    expect(smoothLevel(0, 5)).toBeLessThanOrEqual(1);
  });
});
