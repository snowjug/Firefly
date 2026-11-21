import type { BrowserContext, Page } from '@playwright/test';

// Instruments the page before the app starts, so that a journey can prove what the app did with the
// microphone and with sound, and in which order the call's status line moved, without sleeping.
// `fixtures.ts` installs it for every test. Read it with `readProbe(page)`.
//
//   mediaRequests   how many times the page asked for a microphone (getUserMedia), including refusals
//   micTracks       the state of every microphone track it was given ('live' until it is stopped)
//   mediaElements   how many different <audio> or <video> elements were asked to play (the call
//                   should only ever use one, so two voices cannot overlap)
//   playCalls       every play() call, with the address it played and the length once it had ended
//   synthesisCalls  how many times the browser's own text-to-speech was asked to speak
//   statuses        every change of the call's status line (its text and its `data-stage`), in order
//
// The state lives in the page, so a full reload starts it again; moving around inside the app (which
// is a single page) keeps it.

export interface PlayCall {
  at: number;
  element: number;
  src: string;
  /** How many turns the transcript showed at that moment. */
  turns: number;
}

export interface StatusChange {
  at: number;
  stage: string;
  label: string;
  /** How many turns the transcript showed at that moment. */
  turns: number;
}

export interface ProbeSnapshot {
  mediaRequests: number;
  micTracks: Array<'live' | 'ended'>;
  mediaElements: number;
  playCalls: PlayCall[];
  /** The length in seconds of each recording that played to its end, in order. */
  endedDurations: number[];
  maxPlayingAtOnce: number;
  synthesisCalls: number;
  statuses: StatusChange[];
}

interface ProbeApi {
  snapshot(): ProbeSnapshot;
  reset(): void;
}

declare global {
  interface Window {
    __fireflyE2E?: ProbeApi;
    /** Set by `refuseMicrophone`: the name of the error getUserMedia fails with, or null to allow it. */
    __fireflyE2ERefuse?: string | null;
  }
}

/** Runs in the page, before any of the app's own code. It must not use anything from this module. */
function installProbe(): void {
  if (window.__fireflyE2E) return;
  const start = performance.now();
  const now = () => Math.round(performance.now() - start);

  const tracks: MediaStreamTrack[] = [];
  const elements = new WeakMap<HTMLMediaElement, number>();
  const playing = new Set<HTMLMediaElement>();
  const state = {
    mediaRequests: 0,
    playCalls: [] as PlayCall[],
    endedDurations: [] as number[],
    maxPlayingAtOnce: 0,
    synthesisCalls: 0,
    statuses: [] as StatusChange[],
  };
  let seenElements = 0;
  const turnsShown = () => document.querySelectorAll('[role="log"] li').length;

  const devices = navigator.mediaDevices;
  if (devices && typeof devices.getUserMedia === 'function') {
    const original = devices.getUserMedia.bind(devices);
    devices.getUserMedia = async (constraints?: MediaStreamConstraints) => {
      state.mediaRequests += 1;
      const refusal = window.__fireflyE2ERefuse;
      if (refusal) throw new DOMException('The microphone was refused (simulated).', refusal);
      const stream = await original(constraints);
      for (const track of stream.getAudioTracks()) tracks.push(track);
      return stream;
    };
  }

  const originalPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement) {
    let id = elements.get(this);
    if (id === undefined) {
      seenElements += 1;
      id = seenElements;
      elements.set(this, id);
      const stopped = () => playing.delete(this);
      // The call lets go of the element (and so of its length) as soon as it has ended, before this
      // listener runs, so the length is remembered while the recording plays.
      let length = Number.NaN;
      const remember = () => {
        if (Number.isFinite(this.duration)) length = this.duration;
      };
      this.addEventListener('durationchange', remember);
      this.addEventListener('timeupdate', remember);
      this.addEventListener('ended', () => {
        stopped();
        remember();
        if (Number.isFinite(length)) state.endedDurations.push(length);
        length = Number.NaN;
      });
      this.addEventListener('pause', stopped);
      this.addEventListener('error', stopped);
    }
    state.playCalls.push({
      at: now(),
      element: id,
      src: this.currentSrc || this.src,
      turns: turnsShown(),
    });
    playing.add(this);
    state.maxPlayingAtOnce = Math.max(state.maxPlayingAtOnce, playing.size);
    return originalPlay.call(this);
  };

  const synthesis = window.speechSynthesis;
  if (synthesis && typeof synthesis.speak === 'function') {
    const originalSpeak = synthesis.speak.bind(synthesis);
    synthesis.speak = (utterance: SpeechSynthesisUtterance) => {
      state.synthesisCalls += 1;
      originalSpeak(utterance);
    };
  }

  let last = '';
  const record = () => {
    const element = document.querySelector('[data-stage]');
    const stage = element?.getAttribute('data-stage') ?? '';
    const label = element?.querySelector('.cw-voice__label')?.textContent?.trim() ?? '';
    const key = `${stage}|${label}`;
    if (key === last) return;
    last = key;
    if (stage || label) state.statuses.push({ at: now(), stage, label, turns: turnsShown() });
  };
  new MutationObserver(record).observe(document, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['data-stage'],
  });

  window.__fireflyE2E = {
    snapshot: () => ({
      mediaRequests: state.mediaRequests,
      micTracks: tracks.map((track) => (track.readyState === 'live' ? 'live' : 'ended')),
      mediaElements: seenElements,
      playCalls: [...state.playCalls],
      endedDurations: [...state.endedDurations],
      maxPlayingAtOnce: state.maxPlayingAtOnce,
      synthesisCalls: state.synthesisCalls,
      statuses: [...state.statuses],
    }),
    reset: () => {
      state.playCalls.length = 0;
      state.endedDurations.length = 0;
      state.statuses.length = 0;
      state.maxPlayingAtOnce = 0;
      last = '';
    },
  };
}

export async function installProbes(context: BrowserContext): Promise<void> {
  await context.addInitScript(installProbe);
}

/**
 * Makes the page's request for a microphone fail the way a browser's does when the person chooses
 * Block (`NotAllowedError`), until `allowMicrophone` is called. The browser's own prompt cannot be
 * refused the same way everywhere (Playwright's Chromium and Edge answer differently), so this
 * stands in for it: what it tests is how the call reacts to a refusal, not the browser's prompt.
 */
export async function refuseMicrophone(
  context: BrowserContext,
  error: 'NotAllowedError' | 'NotFoundError' | 'NotReadableError' = 'NotAllowedError',
): Promise<void> {
  await context.addInitScript((name) => {
    window.__fireflyE2ERefuse = name;
  }, error);
}

/** Lets the page have the (fake) microphone again, as if the person had unblocked it. */
export async function allowMicrophone(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__fireflyE2ERefuse = null;
  });
}

export async function readProbe(page: Page): Promise<ProbeSnapshot> {
  return page.evaluate(() => {
    if (!window.__fireflyE2E) throw new Error('The page probe is not installed.');
    return window.__fireflyE2E.snapshot();
  });
}

export async function resetProbe(page: Page): Promise<void> {
  await page.evaluate(() => window.__fireflyE2E?.reset());
}

/** The labels of the status line, one after the other, each once. */
export function statusLabels(snapshot: ProbeSnapshot): string[] {
  return snapshot.statuses.map((change) => change.label);
}

/**
 * Whether `expected` appears in `actual` in this order (other entries may come in between). Used to
 * check the stages of a turn, which must come one after another but are not the only things shown.
 */
export function containsInOrder(actual: readonly string[], expected: readonly string[]): boolean {
  let next = 0;
  for (const item of actual) {
    if (item === expected[next]) next += 1;
    if (next === expected.length) return true;
  }
  return expected.length === 0;
}
