// Level maths shared by the microphone meter and the customer's voice meter. Pure.

/** Root-mean-square of a block of samples (0 for an empty block). */
export function rmsOf(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const value = samples[i] as number;
    sum += value * value;
  }
  return Math.sqrt(sum / samples.length);
}

const QUIET_DB = -60;
const LOUD_DB = -15;

/** Maps an RMS value (0 to 1) onto a 0 to 1 meter on a decibel scale: -60 dBFS is 0, -15 dBFS is 1. */
export function levelFromRms(rms: number): number {
  if (!(rms > 0)) return 0;
  const db = 20 * Math.log10(rms);
  return Math.min(1, Math.max(0, (db - QUIET_DB) / (LOUD_DB - QUIET_DB)));
}

/** Rises quickly and falls gently, so a meter reads as a level and not as a flicker. */
export function smoothLevel(previous: number, next: number): number {
  const weight = next > previous ? 0.7 : 0.35;
  const value = previous + (next - previous) * weight;
  // Two decimals are enough for a meter, and fewer distinct values means fewer renders.
  const rounded = Math.round(value * 100) / 100;
  return rounded <= 0.02 ? 0 : Math.min(1, rounded);
}

/** The interval that gives about 15 meter updates a second. */
export const LEVEL_INTERVAL_MS = 66;
