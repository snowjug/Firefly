// Turns captured samples into the one recording format the server accepts: 16 kHz, 16-bit, mono PCM
// in a WAV container with a plain 44-byte header. Pure functions, no browser APIs. The audio only
// ever exists in memory; nothing here writes it anywhere.

export const WAV_SAMPLE_RATE = 16000;
const HEADER_BYTES = 44;

/**
 * Converts samples from one rate to another. Shrinking averages the source samples that fall into
 * each new sample (a box filter, so tones above the new limit fold back less); growing interpolates
 * linearly. Returns the input itself when the rates are equal.
 */
export function resample(
  samples: Float32Array,
  fromRate: number,
  toRate: number = WAV_SAMPLE_RATE,
): Float32Array {
  if (!(fromRate > 0) || !(toRate > 0)) throw new RangeError('Sample rates must be positive.');
  if (fromRate === toRate || samples.length === 0) return samples;

  const ratio = fromRate / toRate;
  const length = Math.floor(samples.length / ratio);
  const out = new Float32Array(length);

  if (ratio > 1) {
    for (let i = 0; i < length; i++) {
      const start = i * ratio;
      const end = Math.min(samples.length, start + ratio);
      let sum = 0;
      for (let j = Math.floor(start); j < end; j++) {
        const weight = Math.min(end, j + 1) - Math.max(start, j);
        sum += (samples[j] as number) * weight;
      }
      out[i] = sum / (end - start);
    }
    return out;
  }

  const last = samples.length - 1;
  for (let i = 0; i < length; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const fraction = position - index;
    const a = samples[Math.min(index, last)] as number;
    const b = samples[Math.min(index + 1, last)] as number;
    out[i] = a + (b - a) * fraction;
  }
  return out;
}

/** 16-bit little-endian PCM for samples in the range -1 to 1 (anything outside is clipped). */
export function toPcm16(samples: Float32Array): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i] as number));
    view.setInt16(i * 2, Math.round(value < 0 ? value * 0x8000 : value * 0x7fff), true);
  }
  return bytes;
}

/**
 * A complete WAV file (16 kHz, 16-bit, mono) holding `samples`, which were captured at
 * `sampleRate`. Samples are resampled when the rates differ.
 */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const pcm = toPcm16(resample(samples, sampleRate, WAV_SAMPLE_RATE));
  const bytes = new Uint8Array(HEADER_BYTES + pcm.length);
  const view = new DataView(bytes.buffer);
  const tag = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  tag(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, WAV_SAMPLE_RATE, true);
  view.setUint32(28, WAV_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, 'data');
  view.setUint32(40, pcm.length, true);
  bytes.set(pcm, HEADER_BYTES);
  return bytes;
}

/** The length, in milliseconds, of a WAV produced by `encodeWav`. */
export function wavDurationMs(wav: Uint8Array): number {
  return Math.round(((wav.length - HEADER_BYTES) / (WAV_SAMPLE_RATE * 2)) * 1000);
}

export function wavBlob(wav: Uint8Array): Blob {
  return new Blob([wav as BlobPart], { type: 'audio/wav' });
}
