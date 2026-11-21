// Synthetic audio for tests: tones that stand in for speech, noise that stands in for a room, and
// silence. Deterministic, so the same call always gives the same samples.

export function silence(ms: number, rate: number): Float32Array {
  return new Float32Array(Math.round((ms / 1000) * rate));
}

export function sine(ms: number, rate: number, amplitude = 0.3, hz = 220): Float32Array {
  const out = new Float32Array(Math.round((ms / 1000) * rate));
  for (let i = 0; i < out.length; i++) out[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / rate);
  return out;
}

/** Steady noise with the given RMS (uniform noise from a fixed seed). */
export function noise(ms: number, rate: number, rms: number, seed = 1): Float32Array {
  const out = new Float32Array(Math.round((ms / 1000) * rate));
  let state = seed >>> 0 || 1;
  const peak = rms * Math.sqrt(3);
  for (let i = 0; i < out.length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    out[i] = (state / 0xffffffff - 0.5) * 2 * peak;
  }
  return out;
}

/** A tone that gets quieter and louder like syllables do: `dipMs` of quiet every `periodMs`. */
export function syllables(
  ms: number,
  rate: number,
  amplitude = 0.3,
  periodMs = 260,
  dipMs = 60,
): Float32Array {
  const tone = sine(ms, rate, amplitude);
  const period = Math.round((periodMs / 1000) * rate);
  const dip = Math.round((dipMs / 1000) * rate);
  for (let i = 0; i < tone.length; i++) {
    if (i % period >= period - dip) tone[i] = (tone[i] as number) * 0.01;
  }
  return tone;
}

export function concat(...parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Splits samples into blocks of `size`, the way an audio thread hands them over. */
export function blocks(samples: Float32Array, size: number): Float32Array[] {
  const out: Float32Array[] = [];
  for (let i = 0; i < samples.length; i += size) out.push(samples.slice(i, i + size));
  return out;
}
