import { getAudioContextConstructor } from './support.ts';

// Short synthesised call tones (no audio files). They are quiet on purpose, and they never throw: when
// Web Audio is missing, or the browser has not yet allowed sound, they simply make no sound.

export type CallTone = 'ring' | 'connect' | 'hangup' | 'listening';

export interface CallToneOptions {
  /** 0 to 0.2 (the quietest to a gentle level). Defaults to 0.12. */
  volume?: number;
}

const MAX_VOLUME = 0.2;
const DEFAULT_VOLUME = 0.12;
const ATTACK_S = 0.02;
const RELEASE_S = 0.08;
const RESUME_WAIT_MS = 250;

interface Note {
  /** Seconds after the tone starts. */
  at: number;
  length: number;
  /** Frequencies sounded together. */
  hz: readonly number[];
  /** Loudness of the whole note, 0 to 1, relative to the master volume. */
  gain: number;
}

interface Pattern {
  notes: readonly Note[];
  /** Seconds until the tone is over (the promise resolves then). */
  duration: number;
}

const PATTERNS: Record<CallTone, Pattern> = {
  // A ringback: two soft bursts, then a pause.
  ring: {
    duration: 2,
    notes: [
      { at: 0, length: 0.6, hz: [440, 480], gain: 0.8 },
      { at: 0.8, length: 0.6, hz: [440, 480], gain: 0.8 },
    ],
  },
  // Two notes a fifth apart: "the line is open".
  connect: {
    duration: 0.7,
    notes: [
      { at: 0, length: 0.3, hz: [523.25], gain: 0.7 },
      { at: 0.14, length: 0.45, hz: [783.99], gain: 0.6 },
    ],
  },
  // A low double beep.
  hangup: {
    duration: 0.55,
    notes: [
      { at: 0, length: 0.16, hz: [330], gain: 0.7 },
      { at: 0.24, length: 0.16, hz: [330], gain: 0.7 },
    ],
  },
  // A tiny tick: "your turn".
  listening: { duration: 0.12, notes: [{ at: 0, length: 0.07, hz: [880], gain: 0.4 }] },
};

interface Playback {
  stop(): void;
}

let context: AudioContext | null = null;
let contextConstructor: unknown = null;
// stopCallTones() bumps this so a tone that was still waiting for sound to be allowed is dropped.
let generation = 0;
const playing = new Set<Playback>();

function hasUserActivation(): boolean {
  const nav = globalThis.navigator as
    (Navigator & { userActivation?: { hasBeenActive: boolean } }) | undefined;
  return nav?.userActivation ? nav.userActivation.hasBeenActive : true;
}

// A context that starts suspended is resumed by the first tap, key press or click.
function resumeOnGesture(ctx: AudioContext) {
  if (ctx.state === 'running' || typeof document === 'undefined') return;
  const events = ['pointerdown', 'keydown', 'touchend'] as const;
  const stopWatching = () => {
    for (const name of events) document.removeEventListener(name, unlock, true);
  };
  function unlock() {
    try {
      void Promise.resolve(ctx.resume()).then(
        () => {
          if (ctx.state === 'running') stopWatching();
        },
        () => undefined,
      );
    } catch {
      // Try again on the next gesture.
    }
  }
  for (const name of events) document.addEventListener(name, unlock, true);
}

function getContext(): AudioContext | null {
  const Ctor = getAudioContextConstructor();
  if (!Ctor) return null;
  if (context && contextConstructor === Ctor && context.state !== 'closed') return context;
  try {
    context = new Ctor();
    contextConstructor = Ctor;
    resumeOnGesture(context);
  } catch {
    context = null;
  }
  return context;
}

const isRunning = (ctx: AudioContext) => ctx.state === 'running';

async function canPlay(ctx: AudioContext): Promise<boolean> {
  if (isRunning(ctx)) return true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      ctx.resume(),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, RESUME_WAIT_MS);
      }),
    ]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
  return isRunning(ctx);
}

function schedule(
  ctx: AudioContext,
  destination: AudioNode,
  pattern: Pattern,
  start: number,
): OscillatorNode[] {
  const oscillators: OscillatorNode[] = [];
  for (const note of pattern.notes) {
    const from = start + note.at;
    const to = from + note.length;
    const peak = note.gain / note.hz.length;
    for (const hz of note.hz) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = hz;
      // A short fade in and out, so there is never a click.
      gain.gain.setValueAtTime(0, from);
      gain.gain.linearRampToValueAtTime(peak, from + ATTACK_S);
      gain.gain.setValueAtTime(peak, Math.max(from + ATTACK_S, to - RELEASE_S));
      gain.gain.linearRampToValueAtTime(0, to);
      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.start(from);
      oscillator.stop(to + 0.02);
      oscillators.push(oscillator);
    }
  }
  return oscillators;
}

function silence(ctx: AudioContext, master: GainNode, oscillators: readonly OscillatorNode[]) {
  try {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + 0.03);
    for (const oscillator of oscillators) oscillator.stop(now + 0.05);
  } catch {
    // The tones are already over.
  }
}

/**
 * Plays a call tone and resolves when it has finished. Never rejects. Resolves straight away, silently,
 * when Web Audio is unavailable or the browser has not yet allowed sound (before the first tap or click).
 */
export async function playCallTone(kind: CallTone, options: CallToneOptions = {}): Promise<void> {
  const pattern = PATTERNS[kind];
  const ctx = pattern && hasUserActivation() ? getContext() : null;
  if (!pattern || !ctx) return;
  const requested = generation;
  if (!(await canPlay(ctx)) || requested !== generation) return;
  const volume = Math.min(
    MAX_VOLUME,
    Math.max(0, Number.isFinite(options.volume) ? (options.volume as number) : DEFAULT_VOLUME),
  );
  let master: GainNode;
  let oscillators: OscillatorNode[];
  try {
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    oscillators = schedule(ctx, master, pattern, ctx.currentTime + 0.03);
  } catch {
    return;
  }
  await new Promise<void>((resolve) => {
    const playback: Playback = {
      stop() {
        clearTimeout(timer);
        playing.delete(playback);
        silence(ctx, master, oscillators);
        resolve();
      },
    };
    const timer = setTimeout(
      () => {
        playing.delete(playback);
        try {
          master.disconnect();
        } catch {
          // Already disconnected.
        }
        resolve();
      },
      (pattern.duration + 0.03) * 1000,
    );
    playing.add(playback);
  });
}

/** Cuts off any tone that is playing (and any that was about to start). */
export function stopCallTones(): void {
  generation++;
  for (const playback of [...playing]) playback.stop();
}
