import type { SpeechLanguage } from '#shared/domain/speech.ts';
import type { SpokenTurn } from '../../../lib/api.ts';
import { LEVEL_INTERVAL_MS, levelFromRms, rmsOf, smoothLevel } from '../capture/levels.ts';
import { encodeWav, wavBlob } from '../capture/wav.ts';
import {
  createAudioElement,
  createObjectUrl,
  getAudioContextConstructor,
  revokeObjectUrl,
} from '../support.ts';
import { createLevelShaper, estimateSpeechMs } from './speech-text.ts';
import type {
  Playback,
  PlaybackHandlers,
  PlaybackJob,
  PlayRequest,
  VoiceDetails,
} from './types.ts';

// Playback for the server's speech service: the audio for one stored customer turn is fetched, put
// behind a blob URL and played through a single, reused <audio> element. The element is unlocked
// inside the click that began the call (so later replies may play without another gesture), every
// blob URL is revoked as soon as it is no longer needed, and a browser that still refuses to play
// is reported as `blocked` so the page can offer a Play button instead of an error.

/** Fetches the speech for one stored customer turn. The text comes from the call, never the browser. */
export type SpeakTurn = (
  sessionId: string,
  turnIndex: number,
  language: SpeechLanguage,
  signal: AbortSignal,
) => Promise<SpokenTurn>;

export interface ServerPlaybackOptions {
  speakTurn: SpeakTurn;
  /** How long to wait for the audio before giving up on the voice (default 15 s). */
  generationTimeoutMs?: number;
}

export const GENERATION_TIMEOUT_MS = 15_000;

interface Job {
  request: PlayRequest;
  handlers: PlaybackHandlers;
  controller: AbortController;
  stopped: boolean;
  settled: boolean;
  url: string | null;
  meter: ReturnType<typeof setInterval> | undefined;
}

interface Kept {
  key: string;
  url: string;
  details: VoiceDetails;
}

const keyOf = (request: PlayRequest) => `${request.sessionId}:${request.turnIndex}`;

function isBlocked(error: unknown): boolean {
  return (error as { name?: unknown } | null)?.name === 'NotAllowedError';
}

export function createServerPlayback(options: ServerPlaybackOptions): Playback {
  const timeoutMs = options.generationTimeoutMs ?? GENERATION_TIMEOUT_MS;

  let element: HTMLAudioElement | null = null;
  let detach: (() => void) | null = null;
  let context: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let buffer: Float32Array<ArrayBuffer> | null = null;
  let current: Job | null = null;
  // Audio that was made but refused by the browser, kept for the Play button.
  let kept: Kept | null = null;
  let unlocking = false;

  function ensureElement(): HTMLAudioElement | null {
    if (element) return element;
    const created = createAudioElement();
    if (!created) return null;
    element = created;
    created.preload = 'auto';
    const onEnded = () => {
      if (current && !current.settled) finish(current);
    };
    const onError = () => {
      if (current && !current.settled) fail(current, 'playback');
    };
    const onDuration = () => {
      if (!current || current.settled) return;
      const seconds = created.duration;
      if (Number.isFinite(seconds) && seconds > 0) current.handlers.onDuration(seconds * 1000);
    };
    created.addEventListener('ended', onEnded);
    created.addEventListener('error', onError);
    created.addEventListener('durationchange', onDuration);
    detach = () => {
      created.removeEventListener('ended', onEnded);
      created.removeEventListener('error', onError);
      created.removeEventListener('durationchange', onDuration);
    };
    return created;
  }

  function releaseElement(): void {
    const el = element;
    if (!el) return;
    try {
      el.pause();
      el.removeAttribute('src');
      el.load();
    } catch {
      // Nothing more to release.
    }
  }

  function dropUrl(job: Job): void {
    if (job.url) revokeObjectUrl(job.url);
    job.url = null;
  }

  function dropKept(): void {
    if (kept) revokeObjectUrl(kept.url);
    kept = null;
  }

  function settle(job: Job): void {
    job.settled = true;
    clearInterval(job.meter);
    job.meter = undefined;
    if (current === job) current = null;
  }

  function finish(job: Job): void {
    settle(job);
    dropUrl(job);
    releaseElement();
    job.handlers.onEnd();
  }

  function fail(job: Job, kind: 'generation' | 'playback'): void {
    if (job.settled) return;
    settle(job);
    dropUrl(job);
    releaseElement();
    job.handlers.onFailure(kind);
  }

  function stop(job: Job): void {
    if (job.stopped) return;
    job.stopped = true;
    job.controller.abort();
    const wasLoaded = job.url !== null;
    settle(job);
    dropUrl(job);
    if (wasLoaded) releaseElement();
  }

  // Lets sound play later without a gesture: a short silent clip is played inside the click.
  function unlock(el: HTMLAudioElement): void {
    if (unlocking || current) return;
    const url = createObjectUrl(wavBlob(encodeWav(new Float32Array(1600), 16000)));
    if (!url) return;
    unlocking = true;
    el.src = url;
    const done = () => {
      unlocking = false;
      revokeObjectUrl(url);
      if (!current && el.src === url) {
        try {
          el.pause();
          el.removeAttribute('src');
          el.load();
        } catch {
          // Nothing more to release.
        }
      }
    };
    try {
      void Promise.resolve(el.play()).then(done, done);
    } catch {
      done();
    }
  }

  // The level meter listens to the element through an analyser. The audio context is made when the
  // first reply plays (it only serves the meter), and wiring an element into a context that is not
  // running would silence it, so the wiring only happens once the context is running.
  function wireMeter(el: HTMLAudioElement): void {
    if (analyser) return;
    if (!context) {
      const Context = getAudioContextConstructor();
      try {
        context = Context ? new Context() : null;
      } catch {
        context = null;
      }
    }
    if (!context) return;
    if (context.state !== 'running') {
      void context.resume().catch(() => undefined);
      return;
    }
    try {
      const source = context.createMediaElementSource(el);
      const node = context.createAnalyser();
      node.fftSize = 512;
      node.smoothingTimeConstant = 0;
      source.connect(node);
      node.connect(context.destination);
      analyser = node;
      buffer = new Float32Array(node.fftSize);
    } catch {
      analyser = null;
    }
  }

  function startMeter(job: Job, el: HTMLAudioElement): void {
    const shaped = createLevelShaper(job.request.text);
    let level = 0;
    job.meter = setInterval(() => {
      let next: number;
      if (analyser && buffer) {
        analyser.getFloatTimeDomainData(buffer);
        next = levelFromRms(rmsOf(buffer));
      } else {
        next = shaped(el.currentTime * 1000);
      }
      level = smoothLevel(level, next);
      job.handlers.onLevel(level);
    }, LEVEL_INTERVAL_MS);
  }

  async function run(job: Job): Promise<void> {
    const { request, handlers } = job;
    const el = ensureElement();
    if (!el) {
      fail(job, 'playback');
      return;
    }

    let url: string;
    let details: VoiceDetails;
    if (kept && kept.key === keyOf(request)) {
      ({ url, details } = kept);
      kept = null;
    } else {
      dropKept();
      const timer = setTimeout(() => job.controller.abort(), timeoutMs);
      let spoken: SpokenTurn;
      try {
        spoken = await options.speakTurn(
          request.sessionId,
          request.turnIndex,
          request.language,
          job.controller.signal,
        );
      } catch {
        clearTimeout(timer);
        if (!job.stopped) fail(job, 'generation');
        return;
      }
      clearTimeout(timer);
      if (job.stopped) return;
      const created = createObjectUrl(spoken.audio);
      if (!created) {
        fail(job, 'playback');
        return;
      }
      url = created;
      details = { voice: spoken.voice, style: spoken.style, local: null, lang: null };
    }
    job.url = url;
    handlers.onDetails(details);

    wireMeter(el);
    el.src = url;
    try {
      await Promise.resolve(el.play());
    } catch (error) {
      if (job.stopped || job.settled) return;
      if (isBlocked(error)) {
        kept = { key: keyOf(request), url, details };
        job.url = null;
        settle(job);
        releaseElement();
        handlers.onBlocked();
        return;
      }
      fail(job, 'playback');
      return;
    }
    if (job.stopped || job.settled) return;
    const seconds = el.duration;
    handlers.onStart({
      estimateMs:
        Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : estimateSpeechMs(request.text),
    });
    startMeter(job, el);
  }

  return {
    engine: 'server-speech',
    prime() {
      const el = ensureElement();
      if (el) unlock(el);
    },
    play(request, handlers): PlaybackJob {
      if (current) stop(current);
      const job: Job = {
        request,
        handlers,
        controller: new AbortController(),
        stopped: false,
        settled: false,
        url: null,
        meter: undefined,
      };
      current = job;
      void run(job);
      return { stop: () => stop(job) };
    },
    dispose() {
      if (current) stop(current);
      dropKept();
      releaseElement();
      detach?.();
      detach = null;
      element = null;
      analyser = null;
      buffer = null;
      const closing = context;
      context = null;
      try {
        if (closing && closing.state !== 'closed') void closing.close().catch(() => undefined);
      } catch {
        // Already closed.
      }
    },
  };
}
