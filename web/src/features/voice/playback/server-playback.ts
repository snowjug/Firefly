import type { SpeechLanguage } from '#shared/domain/speech.ts';
import type { VoiceId } from '#shared/domain/voices.ts';
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
  PlaybackStop,
  PlayRequest,
  VoiceDetails,
} from './types.ts';

// Playback for the server's speech service: the audio for one stored customer turn is fetched, put
// behind a blob URL and played through a single, reused <audio> element. The element is unlocked
// inside the click that began the call (so later replies may play without another gesture), every
// blob URL is revoked as soon as it is no longer needed, and a browser that still refuses to play
// is reported as `blocked` so the page can offer a Play button instead of an error.

/** What a request for a voice may carry besides the turn: the voice the trainee chose. */
export interface SpeakOptions {
  voice?: VoiceId;
}

/**
 * Fetches the speech for one stored customer turn. The text comes from the call, never the browser.
 * The fifth argument is only passed when the trainee chose a voice, so a function that predates voice
 * choice (and ignores it) is still called exactly as it always was.
 */
export type SpeakTurn = (
  sessionId: string,
  turnIndex: number,
  language: SpeechLanguage,
  signal: AbortSignal,
  options?: SpeakOptions,
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
  /**
   * The reply's own audio is on the element. Until then the element's events are not this reply's:
   * it may hold the silent unlock clip, or nothing at all.
   */
  onElement: boolean;
  meter: ReturnType<typeof setInterval> | undefined;
  /** When the voice became audible, or null while it has not. */
  startedAt: number | null;
  /** How much of the voice had played when the job ended, was stopped or failed. */
  playedMs: number | null;
  /** What the first `stop` said, so a second one says the same. */
  stopResult: PlaybackStop | null;
}

interface Kept {
  key: string;
  url: string;
  details: VoiceDetails;
}

const keyOf = (request: PlayRequest) =>
  `${request.sessionId}:${request.turnIndex}:${request.voice ?? ''}`;

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
    // The one element also plays the silent unlock clip and rests between replies, and what it
    // reports then belongs to nobody: a reply that is still being fetched must not be finished,
    // failed or given a length by it. Only a reply whose own audio is on the element is heard.
    const owner = (): Job | null =>
      current && !current.settled && current.onElement ? current : null;
    const onEnded = () => {
      const job = owner();
      if (job) finish(job);
    };
    const onError = () => {
      const job = owner();
      if (job) fail(job, 'playback');
    };
    const onDuration = () => {
      const job = owner();
      if (!job) return;
      const seconds = created.duration;
      if (Number.isFinite(seconds) && seconds > 0) job.handlers.onDuration(seconds * 1000);
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

  function rest(el: HTMLAudioElement): void {
    try {
      el.pause();
      el.removeAttribute('src');
      el.load();
    } catch {
      // Nothing more to release.
    }
  }

  function releaseElement(): void {
    if (element) rest(element);
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
    // How much was heard, taken before anything is released: the element forgets it when it is.
    if (job.playedMs === null) job.playedMs = playedSoFar(job);
    job.settled = true;
    clearInterval(job.meter);
    job.meter = undefined;
    if (current === job) current = null;
  }

  function playedSoFar(job: Job): number {
    if (job.startedAt === null) return 0;
    const seconds = element?.currentTime;
    const fromElement =
      typeof seconds === 'number' && Number.isFinite(seconds) ? seconds * 1000 : 0;
    return Math.round(fromElement > 0 ? fromElement : Math.max(0, Date.now() - job.startedAt));
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

  function stop(job: Job): PlaybackStop {
    if (job.stopResult) return job.stopResult;
    // Cut off only if the voice was audible and had not already ended by itself.
    const interrupted = job.startedAt !== null && !job.settled;
    job.stopped = true;
    job.controller.abort();
    const wasLoaded = job.url !== null;
    settle(job);
    dropUrl(job);
    if (wasLoaded) releaseElement();
    job.stopResult = { interrupted, playedMs: job.playedMs ?? 0 };
    return job.stopResult;
  }

  // Lets sound play later without a gesture: a short silent clip is played inside the click. The clip
  // is nobody's reply, so it is let go of as soon as it has started (or been refused), whether or not
  // a reply has already been asked for: otherwise it would run on, reach its end a moment later and
  // be taken for the end of that reply. A reply that has already put its own audio on the element
  // is left alone.
  function unlock(el: HTMLAudioElement): void {
    if (unlocking || current) return;
    const url = createObjectUrl(wavBlob(encodeWav(new Float32Array(1600), 16000)));
    if (!url) return;
    unlocking = true;
    el.src = url;
    const done = () => {
      unlocking = false;
      revokeObjectUrl(url);
      if (el.src === url) rest(el);
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
        const signal = job.controller.signal;
        // The fifth argument is only there when a voice was chosen.
        spoken = request.voice
          ? await options.speakTurn(
              request.sessionId,
              request.turnIndex,
              request.language,
              signal,
              {
                voice: request.voice,
              },
            )
          : await options.speakTurn(request.sessionId, request.turnIndex, request.language, signal);
      } catch {
        clearTimeout(timer);
        if (!job.stopped) fail(job, 'generation');
        return;
      }
      clearTimeout(timer);
      if (job.stopped || job.settled) return;
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
    // From here the element is this reply's: it replaces whatever it held, such as the unlock clip.
    job.onElement = true;
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
    job.startedAt = Date.now();
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
        onElement: false,
        meter: undefined,
        startedAt: null,
        playedMs: null,
        stopResult: null,
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
