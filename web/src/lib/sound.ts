import { useSyncExternalStore } from 'react';
import { readStorage, writeStorage } from './storage.ts';

// Optional sound. It is off until the person turns it on, it never autoplays, nothing depends on
// it, and every sound is synthesised here (short sine tones), so there are no audio files and no
// licensing questions. The preference is stored on this device only.

export type SoundName = 'discovery' | 'connect' | 'reveal' | 'earned';

const KEY = 'firefly.sound';
const listeners = new Set<() => void>();

let enabled: boolean | null = null;

function current(): boolean {
  if (enabled === null) enabled = readStorage<boolean>(KEY, false) === true;
  return enabled;
}

export function isSoundOn(): boolean {
  return current();
}

export function setSoundOn(on: boolean): void {
  enabled = on;
  writeStorage(KEY, on);
  for (const listener of listeners) listener();
  if (on) play('connect'); // a short confirmation, and it unlocks audio inside this gesture
}

/** Test helper: forget the cached preference so it is re-read from storage. */
export function resetSoundForTests(): void {
  enabled = null;
  context = null;
}

export function useSound(): readonly [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    current,
    () => false,
  );
  return [on, setSoundOn] as const;
}

type AudioContextCtor = typeof AudioContext;
let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (context) return context;
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    context = null;
  }
  return context;
}

interface Tone {
  at: number;
  hz: number;
  length: number;
  gain: number;
}

const PATTERNS: Record<SoundName, Tone[]> = {
  // Two soft pings, the second a fifth above: "something was found".
  discovery: [
    { at: 0, hz: 659.25, length: 0.45, gain: 0.05 },
    { at: 0.11, hz: 987.77, length: 0.55, gain: 0.04 },
  ],
  // A short, warm "line open".
  connect: [
    { at: 0, hz: 523.25, length: 0.3, gain: 0.04 },
    { at: 0.09, hz: 783.99, length: 0.4, gain: 0.035 },
  ],
  // A slow swell for the report.
  reveal: [
    { at: 0, hz: 392, length: 0.7, gain: 0.03 },
    { at: 0.14, hz: 587.33, length: 0.8, gain: 0.03 },
    { at: 0.28, hz: 783.99, length: 0.9, gain: 0.025 },
  ],
  earned: [
    { at: 0, hz: 587.33, length: 0.4, gain: 0.04 },
    { at: 0.1, hz: 880, length: 0.5, gain: 0.035 },
    { at: 0.2, hz: 1174.66, length: 0.6, gain: 0.03 },
  ],
};

/** Plays a sound if (and only if) the person has turned sound on. Never throws. */
export function play(name: SoundName): void {
  if (!current()) return;
  const ctx = audio();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') void ctx.resume();
    const start = ctx.currentTime + 0.01;
    for (const tone of PATTERNS[name]) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = tone.hz;
      const t0 = start + tone.at;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(tone.gain, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.length);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(t0);
      oscillator.stop(t0 + tone.length + 0.05);
    }
  } catch {
    // Sound is a nicety; never let it break the app.
  }
}
