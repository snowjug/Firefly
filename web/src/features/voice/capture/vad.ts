import { rmsOf } from './levels.ts';
import { CAPTURE_TUNING } from './tuning.ts';

// A voice-activity detector for one microphone, fed with blocks of samples. It is pure and
// deterministic: time is measured in samples, never read from a clock, so the same audio always
// gives the same result. Every number it uses is in `CAPTURE_TUNING` (./tuning.ts).
//
// How it decides:
// - Audio is cut into short frames (20 ms) and each frame's energy (RMS) is compared with a
//   threshold that follows the room's noise floor. The floor starts from the quietest of the first
//   frames, falls quickly when the room gets quieter and rises slowly when it gets louder; it never
//   moves while someone is speaking.
// - Speech starts after about 120 ms of frames above the start threshold. The stop threshold is
//   lower than the start threshold (hysteresis), so a word that dips does not end the speech.
// - Speech ends after `endSilenceMs` (1.4 s) below the stop threshold: long enough that a pause to
//   think is not the end of the turn. The utterance keeps 300 ms from before the start (so the
//   first word is not clipped) and a short tail after the last speech.
// - What is not a turn is dropped: speech shorter than 400 ms from first sound to last, speech of
//   which less than 250 ms is actually voiced (scattered clicks), and an utterance whose loudest
//   frame is barely above the noise. An utterance reaching the maximum length is cut and emitted,
//   and listening continues.

export interface VadOptions {
  /** Sample rate of the blocks passed to `push`. */
  sampleRate: number;
  frameMs?: number;
  /** How long the energy must stay above the start threshold before speech starts. */
  startMs?: number;
  /** How long the energy must stay below the stop threshold before speech ends. */
  endSilenceMs?: number;
  /** Audio kept from before the detected start. */
  preRollMs?: number;
  /** Silence kept after the last speech. */
  tailMs?: number;
  /** Speech shorter than this (first speech frame to last) is dropped. */
  minUtteranceMs?: number;
  /** Speech of which less than this much is voiced (frames above the stop threshold) is dropped. */
  minVoicedMs?: number;
  /** An utterance is cut and emitted when everything in it adds up to this length. */
  maxUtteranceMs?: number;
  /** An utterance whose loudest frame is quieter than this (RMS, 0 to 1) is only noise. */
  minSpeechRms?: number;
  /** The start threshold is this many times the noise floor. */
  startRatio?: number;
  /** The stop threshold is this many times the noise floor (below the start threshold). */
  stopRatio?: number;
  /** The start threshold is never lower than this (RMS, 0 to 1). */
  minStartRms?: number;
}

export const VAD_DEFAULTS = {
  frameMs: CAPTURE_TUNING.frameMs,
  startMs: CAPTURE_TUNING.speechStartMs,
  endSilenceMs: CAPTURE_TUNING.endpointSilenceMs,
  preRollMs: CAPTURE_TUNING.preRollMs,
  tailMs: CAPTURE_TUNING.tailMs,
  minUtteranceMs: CAPTURE_TUNING.minSpeechMs,
  minVoicedMs: CAPTURE_TUNING.minVoicedMs,
  maxUtteranceMs: CAPTURE_TUNING.maxUtteranceMs,
  minSpeechRms: CAPTURE_TUNING.minSpeechRms,
  startRatio: CAPTURE_TUNING.startRatio,
  stopRatio: CAPTURE_TUNING.stopRatio,
  minStartRms: CAPTURE_TUNING.minStartRms,
} as const;

export type VadDropReason = 'too-short' | 'low-level';
export type VadEndReason = 'silence' | 'limit' | 'flush';

export type VadEvent =
  | { type: 'speech-start' }
  | {
      type: 'utterance';
      samples: Float32Array;
      sampleRate: number;
      /** Everything in `samples`, including the pre-roll and the tail. */
      durationMs: number;
      /** From the first speech frame to the last. */
      speechMs: number;
      reason: VadEndReason;
    }
  | { type: 'dropped'; reason: VadDropReason };

export interface Vad {
  /** Feeds samples (any block size) and returns what happened, in order. */
  push(samples: Float32Array): VadEvent[];
  /** Ends the utterance in progress now, as if the silence had been long enough. */
  flush(): VadEvent[];
  /** Forgets everything heard so far, including the noise floor. */
  reset(): void;
  readonly speaking: boolean;
  /** The current estimate of the room's noise (RMS), for diagnostics and tests. */
  readonly noiseFloor: number;
}

interface Frame {
  samples: Float32Array;
  rms: number;
}

const MIN_FLOOR = 0.0003;
// A floor measured while someone is already talking would hide them, so it is capped.
const MAX_INITIAL_FLOOR = 0.01;
const CALIBRATION_MS = 300;
const FLOOR_FALL = 0.25;
const FLOOR_RISE = 0.03;

function join(frames: readonly Frame[]): Float32Array {
  const out = new Float32Array(frames.reduce((total, frame) => total + frame.samples.length, 0));
  let offset = 0;
  for (const frame of frames) {
    out.set(frame.samples, offset);
    offset += frame.samples.length;
  }
  return out;
}

export function createVad(options: VadOptions): Vad {
  const cfg = { ...VAD_DEFAULTS, ...options };
  const sampleRate = cfg.sampleRate;
  const frameLength = Math.max(1, Math.round((sampleRate * cfg.frameMs) / 1000));
  const frameMs = (frameLength / sampleRate) * 1000;
  const startFrames = Math.max(1, Math.round(cfg.startMs / frameMs));
  const endFrames = Math.max(1, Math.round(cfg.endSilenceMs / frameMs));
  const preRollFrames = Math.max(0, Math.round(cfg.preRollMs / frameMs));
  const tailFrames = Math.max(0, Math.round(cfg.tailMs / frameMs));
  const maxFrames = Math.max(1, Math.floor(cfg.maxUtteranceMs / frameMs));
  const calibrationFrames = Math.max(1, Math.round(CALIBRATION_MS / frameMs));

  let partial = new Float32Array(frameLength);
  let filled = 0;

  let floor = MIN_FLOOR;
  let calibrated = 0;
  let quietest = Number.POSITIVE_INFINITY;

  let speaking = false;
  let recent: Frame[] = []; // while idle: the frames that may become the start of an utterance
  let above = 0;
  let utterance: Frame[] = [];
  let firstSpeech = -1;
  let lastSpeech = -1;
  let voiced = 0; // frames of the utterance above the stop threshold
  let peak = 0;
  let silent = 0;

  const startThreshold = () => Math.max(cfg.minStartRms, floor * cfg.startRatio);
  const stopThreshold = () => Math.max(cfg.minStartRms * 0.6, floor * cfg.stopRatio);

  function clearUtterance(): void {
    utterance = [];
    firstSpeech = -1;
    lastSpeech = -1;
    voiced = 0;
    peak = 0;
    silent = 0;
  }

  function finish(reason: VadEndReason, out: VadEvent[]): void {
    const keep = Math.min(utterance.length, lastSpeech + 1 + tailFrames);
    const frames = utterance.slice(0, Math.max(0, keep));
    const speechMs = firstSpeech < 0 ? 0 : (lastSpeech - firstSpeech + 1) * frameMs;
    const voicedMs = voiced * frameMs;
    const loudest = peak;
    clearUtterance();
    if (reason !== 'limit') {
      speaking = false;
      recent = [];
      above = 0;
    }
    if (speechMs < cfg.minUtteranceMs || voicedMs < cfg.minVoicedMs) {
      out.push({ type: 'dropped', reason: 'too-short' });
    } else if (loudest < cfg.minSpeechRms) out.push({ type: 'dropped', reason: 'low-level' });
    else {
      const samples = join(frames);
      out.push({
        type: 'utterance',
        samples,
        sampleRate,
        durationMs: (samples.length / sampleRate) * 1000,
        speechMs,
        reason,
      });
    }
  }

  function onFrame(frame: Frame, out: VadEvent[]): void {
    if (speaking) {
      utterance.push(frame);
      const index = utterance.length - 1;
      if (frame.rms >= stopThreshold()) {
        if (firstSpeech < 0) firstSpeech = index;
        lastSpeech = index;
        voiced++;
        peak = Math.max(peak, frame.rms);
        silent = 0;
      } else {
        silent++;
      }
      if (silent >= endFrames) finish('silence', out);
      else if (utterance.length >= maxFrames) finish('limit', out);
      return;
    }

    if (calibrated < calibrationFrames) {
      calibrated++;
      quietest = Math.min(quietest, frame.rms);
      floor = Math.min(MAX_INITIAL_FLOOR, Math.max(MIN_FLOOR, quietest));
    } else if (frame.rms < floor) {
      floor += (frame.rms - floor) * FLOOR_FALL;
    } else if (frame.rms < startThreshold()) {
      floor += (frame.rms - floor) * FLOOR_RISE;
    }

    recent.push(frame);
    if (recent.length > preRollFrames + startFrames) recent.shift();
    if (frame.rms >= startThreshold()) above++;
    else if (frame.rms < stopThreshold()) above = 0;
    if (above < startFrames) return;

    speaking = true;
    utterance = recent;
    recent = [];
    above = 0;
    const stop = stopThreshold();
    utterance.forEach((candidate, index) => {
      if (candidate.rms < stop) return;
      if (firstSpeech < 0) firstSpeech = index;
      lastSpeech = index;
      voiced++;
      peak = Math.max(peak, candidate.rms);
    });
    silent = utterance.length - 1 - lastSpeech;
    out.push({ type: 'speech-start' });
  }

  return {
    push(samples) {
      const out: VadEvent[] = [];
      let offset = 0;
      while (offset < samples.length) {
        const count = Math.min(frameLength - filled, samples.length - offset);
        partial.set(samples.subarray(offset, offset + count), filled);
        filled += count;
        offset += count;
        if (filled === frameLength) {
          onFrame({ samples: partial, rms: rmsOf(partial) }, out);
          partial = new Float32Array(frameLength);
          filled = 0;
        }
      }
      return out;
    },
    flush() {
      const out: VadEvent[] = [];
      if (speaking) finish('flush', out);
      partial = new Float32Array(frameLength);
      filled = 0;
      recent = [];
      above = 0;
      return out;
    },
    reset() {
      partial = new Float32Array(frameLength);
      filled = 0;
      floor = MIN_FLOOR;
      calibrated = 0;
      quietest = Number.POSITIVE_INFINITY;
      speaking = false;
      recent = [];
      above = 0;
      clearUtterance();
    },
    get speaking() {
      return speaking;
    },
    get noiseFloor() {
      return floor;
    },
  };
}
