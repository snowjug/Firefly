import { vi } from 'vitest';
import type { FakeEnv } from './fakes.ts';

// What a voice session may still be holding, read off the fakes. After every way a call can end (it
// finished, failed, was abandoned, the screen was left, the call was ended) all of it must be let go:
// the browser's recording indicator would otherwise stay on, sound would play on, and memory would
// grow. `heldBy` counts; `pairs` shows each acquire next to its release so a test can also prove that
// the path under test acquired something (a path that never acquired anything proves nothing).

export interface Held {
  /** Microphone tracks still live. */
  tracks: number;
  /** Audio contexts not closed. */
  contexts: number;
  /** Capture worklets still reading the microphone. */
  worklets: number;
  /** Blob URLs created and not revoked. */
  urls: number;
  /** Audio elements still playing. */
  playing: number;
  /** Listeners still attached to any fake. */
  listeners: number;
  /** Connections between audio nodes still in place. */
  edges: number;
  /** Browser recognition sessions still running. */
  recognitions: number;
  /** The browser's synthesis is still speaking. */
  speaking: boolean;
  /** Timers still scheduled (only when fake timers are on, otherwise 0). */
  timers: number;
}

export const NOTHING_HELD: Held = {
  tracks: 0,
  contexts: 0,
  worklets: 0,
  urls: 0,
  playing: 0,
  listeners: 0,
  edges: 0,
  recognitions: 0,
  speaking: false,
  timers: 0,
};

export function heldBy(env: FakeEnv): Held {
  return {
    tracks: env.mic.openTracks().length,
    contexts: env.audio.openContexts().length,
    worklets: env.audio.listeningWorklets().length,
    urls: env.urls.live().length,
    playing: env.element.playing().length,
    listeners: env.listenerCount(),
    edges: env.edgeCount(),
    recognitions: env.recognition.instances.filter((instance) => instance.running).length,
    speaking: env.speech.speaking,
    timers: vi.isFakeTimers() ? vi.getTimerCount() : 0,
  };
}

/** Each thing acquired, next to how many of them were let go: `[acquired, released]`. */
export function pairs(env: FakeEnv): {
  microphoneTracks: [number, number];
  audioContexts: [number, number];
  objectUrls: [number, number];
} {
  return {
    microphoneTracks: [
      env.mic.tracks.length,
      env.mic.tracks.filter((track) => track.readyState === 'ended').length,
    ],
    audioContexts: [
      env.contexts.length,
      env.contexts.filter((context) => context.state === 'closed').length,
    ],
    objectUrls: [env.urls.created, env.urls.revoked],
  };
}
