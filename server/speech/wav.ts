import { SPEECH_LIMITS } from './types.ts';

// The recordings the web app uploads are 16 kHz, 16-bit, mono PCM in a WAV container. This reads
// the container and nothing else: it does not decode, store or look inside the audio.

export const WAV_SAMPLE_RATE = 16000;
const BYTES_PER_SECOND = WAV_SAMPLE_RATE * 2;

export type WavCheck =
  | {
      ok: true;
      /** The same audio as a clean WAV with a plain 44-byte header, which is what gets forwarded. */
      wav: Buffer;
      durationMs: number;
    }
  | { ok: false; message: string };

const fail = (message: string): WavCheck => ({ ok: false, message });

/** A WAV file holding these 16-bit mono samples. */
export function encodeWav(pcm: Uint8Array, sampleRate = WAV_SAMPLE_RATE): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'latin1');
  header.write('fmt ', 12, 'latin1');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'latin1');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

interface Format {
  tag: number;
  channels: number;
  sampleRate: number;
  byteRate: number;
  blockAlign: number;
  bits: number;
}

/**
 * Checks that these bytes are a complete 16 kHz, 16-bit, mono PCM WAV recording no longer than the
 * limit. The messages are plain sentences that are safe to show.
 */
export function validateWav(input: Buffer, limits = SPEECH_LIMITS): WavCheck {
  if (input.length < 12 || input.toString('latin1', 0, 4) !== 'RIFF') {
    return fail('That recording is not a WAV file.');
  }
  if (input.toString('latin1', 8, 12) !== 'WAVE') return fail('That recording is not a WAV file.');

  let format: Format | null = null;
  let data: { start: number; length: number } | null = null;
  let offset = 12;
  while (offset + 8 <= input.length) {
    const id = input.toString('latin1', offset, offset + 4);
    const size = input.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      if (size < 16 || body + 16 > input.length) return fail('The recording has a damaged header.');
      format = {
        tag: input.readUInt16LE(body),
        channels: input.readUInt16LE(body + 2),
        sampleRate: input.readUInt32LE(body + 4),
        byteRate: input.readUInt32LE(body + 8),
        blockAlign: input.readUInt16LE(body + 12),
        bits: input.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      data = { start: body, length: size };
      break;
    }
    // Chunks are padded to an even length.
    offset = body + size + (size % 2);
  }

  if (!format) return fail('The recording has no format header.');
  const plain =
    format.tag === 1 &&
    format.channels === 1 &&
    format.sampleRate === limits.sampleRate &&
    format.bits === 16 &&
    format.blockAlign === 2 &&
    format.byteRate === BYTES_PER_SECOND;
  if (!plain) return fail('The recording must be 16-bit mono WAV at 16 kHz.');

  if (!data || data.length === 0) return fail('The recording is empty.');
  if (data.start + data.length > input.length) return fail('The recording looks incomplete.');
  if (data.length % 2 !== 0) return fail('The recording looks damaged.');

  const durationMs = Math.round((data.length / BYTES_PER_SECOND) * 1000);
  if (durationMs > limits.maxAudioSeconds * 1000) {
    return fail(`The recording is longer than ${limits.maxAudioSeconds} seconds.`);
  }
  return {
    ok: true,
    wav: encodeWav(input.subarray(data.start, data.start + data.length)),
    durationMs,
  };
}
