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
//   statuses        every change of the call's status line (its text and its `data-status`), in order
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
  /** The status line's `data-status`: `listening`, `speech-detected`, `customer-speaking` ... */
  status: string;
  /** The words the status line showed: "Listening", "Hearing you", "Customer speaking" ... */
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
    const element = document.querySelector('.cw-status[data-status]');
    const status = element?.getAttribute('data-status') ?? '';
    const label = element?.querySelector('.cw-status__label')?.textContent?.trim() ?? '';
    const key = `${status}|${label}`;
    if (key === last) return;
    last = key;
    if (status || label) state.statuses.push({ at: now(), status, label, turns: turnsShown() });
  };
  new MutationObserver(record).observe(document, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['data-status'],
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

// ---- Waiting for movement to end -----------------------------------------------------------------
//
// An axe contrast scan taken while something fades in measures a blended colour and fails for no
// real reason, and Playwright's `toBeVisible` is true at opacity 0. So a scan, a measurement or a
// screenshot is taken only after the page has settled. The scan helpers in `a11y.ts` call `settled`
// first; call it yourself before measuring a box that may still be moving.

export interface SettledOptions {
  /** How long the page may take to come to rest, in milliseconds. */
  timeout?: number;
}

/** One animation or transition that is still going: what it is, where it is and how long is left. */
interface Moving {
  what: string;
  where: string;
  left: number;
}

/**
 * Runs in the page, so it must not use anything from this module. After two animation frames (a
 * change that was just made may only start to move at the next paint) it waits, for at most `budget`
 * ms, for every finite animation and transition that is running, and returns those still running.
 * An endless one (a spinner, a shimmer, a listening pulse) is the state itself and is not waited for,
 * and nor is a paused animation or one driven by scrolling: none of them ends by itself.
 */
async function stillMoving(budget: number): Promise<Moving[]> {
  // A page in the background runs no frames, so a timer is the way out.
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    setTimeout(resolve, 120);
  });
  const running = () =>
    document.getAnimations().filter((animation) => {
      const timing = animation.effect?.getComputedTiming();
      return (
        timing !== undefined &&
        Number.isFinite(timing.endTime) &&
        animation.playState === 'running' &&
        animation.timeline === document.timeline
      );
    });
  const going = running();
  if (going.length > 0) {
    await Promise.race([
      Promise.all(going.map((animation) => animation.finished.catch(() => undefined))),
      new Promise((resolve) => setTimeout(resolve, budget)),
    ]);
  }
  const ms = (value: unknown) => (typeof value === 'number' ? value : 0);
  return running().map((animation) => {
    const effect = animation.effect as KeyframeEffect;
    const target = effect.target;
    const classes = target ? [...target.classList].slice(0, 3).map((name) => `.${name}`) : [];
    const where = target
      ? `${target.localName}${target.id ? `#${target.id}` : ''}${classes.join('')}${effect.pseudoElement ?? ''}`
      : 'the document';
    const what =
      animation instanceof CSSAnimation
        ? `animation ${animation.animationName}`
        : animation instanceof CSSTransition
          ? `transition of ${animation.transitionProperty}`
          : `animation ${animation.id || '(from script)'}`;
    const end = ms(effect.getComputedTiming().endTime);
    return { what, where, left: Math.max(0, Math.round(end - ms(animation.currentTime))) };
  });
}

/**
 * Resolves once every finite animation and transition on the page has finished, and stays that way
 * for two looks a frame or two apart (so one that starts as another ends is seen). Endless ones, such
 * as a spinner, a shimmer or a listening pulse, are ignored. Gives up after `timeout` (5 s) with an
 * error that names what was still moving. Under reduced motion there is almost nothing to wait for.
 */
export async function settled(page: Page, { timeout = 5_000 }: SettledOptions = {}): Promise<void> {
  const deadline = Date.now() + timeout;
  let calm = 0;
  while (calm < 2) {
    let moving: Moving[];
    try {
      moving = await page.evaluate(stillMoving, Math.max(0, deadline - Date.now()));
    } catch (error) {
      // The page was replaced while it was being watched: watch the new one.
      if (/context was destroyed|navigation/i.test(String(error)) && Date.now() < deadline) {
        calm = 0;
        continue;
      }
      throw error;
    }
    if (moving.length === 0) {
      calm += 1;
      continue;
    }
    calm = 0;
    if (Date.now() >= deadline) {
      const list = moving.map((item) => `${item.what} on ${item.where} (${item.left} ms left)`);
      throw new Error(
        `The page did not settle within ${timeout} ms. Still moving: ${list.join('; ')}.`,
      );
    }
  }
}
