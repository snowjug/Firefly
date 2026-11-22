import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { AppConfigDTO } from '../../shared/domain/api.ts';

// A scripted stand-in for the browser's own speech, so that a journey can run the call the way a
// browser runs it when the server has no speech service (FIREFLY_SPEECH_PROVIDER=none): the browser's
// recogniser hears the trainee and the browser's voice speaks for the customer. The other journeys
// (voice-call.spec.ts) take the server's path, with a fake microphone and the server's mock speech
// provider, and never touch the browser's recogniser at all.
//
//   const speech = await installBrowserSpeech(page);      // before the page is opened
//   await startSpokenCall(page, api);
//   await speech.freeze();                                 // time now only moves when the journey moves it
//   await speech.hear('I would like to cancel', { final: true });
//   await speech.pause(900);                               // the browser says the sound ended; 900 ms pass
//   await speech.hear('my subscription', { final: true });
//   await speech.advance(2000);                            // quiet long enough to end the turn
//
// What it does:
//   - replaces `webkitSpeechRecognition` and `SpeechRecognition` with a recogniser that does what the
//     journey tells it to and nothing else: `start`, `audiostart`, `speechstart`, cumulative `result`
//     lists (finished results first, the words still being worked out last), `speechend`, `error` and
//     `end`, and `start` / `stop` / `abort` that it counts. It never hears the microphone.
//   - replaces `speechSynthesis` and `SpeechSynthesisUtterance` with a voice that is silent and
//     instant: `speak()` reports `start` at once and `end` after a short time, so a journey needs no
//     audio and the customer's reply is "spoken" in a moment.
//   - answers `GET /api/config` with the real body and the speech provider switched to `none` (the
//     server the suite starts has the mock provider), which is what makes the call choose the
//     browser's recogniser and the browser's voice. The page asks `/api/config`, not `/api/health`.
//   - installs the page clock (`page.clock`), so a journey can wait minutes in a moment.
//
// What it proves: the call's own logic, in a real browser engine, with a real page, a real server and
// the real call screen: when the microphone opens, what the screen says, how a turn is cut, what is
// kept when a session ends, what Done speaking does, what shows when the service fails, what Mute,
// Pause and Resume do to the recogniser. What it does NOT prove: that a real recogniser behaves like
// this one. A real Chrome or Edge decides when its sessions end, what a result looks like, how fast
// `stop()` hands back the last words and whether `speechstart` and `speechend` arrive in continuous
// mode; none of that is exercised here, and nothing in this file hears real speech.

/** What the page's fake recogniser has been asked to do so far. */
export interface RecognitionStats {
  /** Recogniser objects the call has made: one for each session the browser gave it. */
  created: number;
  /** Sessions that are open now (started and not ended, a stopped one that is still answering too). */
  running: number;
  starts: number;
  stops: number;
  aborts: number;
  /** What the newest session was set up with, or null before there is one. */
  latest: { lang: string; continuous: boolean; interimResults: boolean } | null;
}

/** What the page's fake voice has been asked to do so far. */
export interface VoiceStats {
  /** What the browser was asked to speak, one entry for each piece of a line (the silent primer is left out). */
  spoken: string[];
  speaking: boolean;
  cancels: number;
}

interface FakeSpeechApi {
  recognition: {
    stats(): RecognitionStats;
    hear(text: string, final: boolean): void;
    speechEnd(): void;
    endSession(): void;
    fail(code: string): void;
  };
  voice: {
    stats(): VoiceStats;
    setDuration(ms: number): void;
  };
}

declare global {
  interface Window {
    __fakeSpeech?: FakeSpeechApi;
    /** What the call's announcer said, in order, one entry each time the region got a sentence. */
    __fakeSpeechSaid?: string[];
  }
}

/** How long, on the page's clock, a spoken piece of the customer's line lasts. */
const VOICE_MS = 80;

/** Runs in the page, before any of the app's code. It must not use anything from this module. */
function installFakeSpeech(voiceMs: number): void {
  if (window.__fakeSpeech) return;

  type Fired = Record<string, unknown>;
  type Handler = ((event: Fired) => void) | null;
  type State = 'idle' | 'running' | 'stopping' | 'ended';
  interface Heard {
    text: string;
    final: boolean;
  }

  const sessions: FakeRecognition[] = [];
  const counts = { starts: 0, stops: 0, aborts: 0 };

  class FakeRecognition {
    lang = '';
    continuous = false;
    interimResults = false;
    maxAlternatives = 1;
    onstart: Handler = null;
    onaudiostart: Handler = null;
    onspeechstart: Handler = null;
    onspeechend: Handler = null;
    onaudioend: Handler = null;
    onresult: Handler = null;
    onerror: Handler = null;
    onend: Handler = null;
    state: State = 'idle';
    heard: Heard[] = [];
    speaking = false;

    constructor() {
      sessions.push(this);
    }

    start(): void {
      if (this.state === 'running' || this.state === 'stopping') {
        throw new DOMException('recognition has already started.', 'InvalidStateError');
      }
      this.state = 'running';
      counts.starts += 1;
      // The browser reports that it started, and that it is capturing audio, a moment later.
      queueMicrotask(() => {
        if (this.state !== 'running') return;
        this.emit('start');
        this.emit('audiostart');
      });
    }

    // A stopped session goes on answering: whatever it had caught arrives, and then it ends. The
    // journey plays that part (`hear`, `endSession`), so that it decides what arrives and when.
    stop(): void {
      counts.stops += 1;
      if (this.state === 'running') this.state = 'stopping';
    }

    abort(): void {
      counts.aborts += 1;
      if (this.state !== 'running' && this.state !== 'stopping') return;
      this.state = 'ended';
      this.speaking = false;
      queueMicrotask(() => {
        this.emit('error', { error: 'aborted' });
        this.emit('end');
      });
    }

    emit(name: string, init: Fired = {}): void {
      const handler = (this as unknown as Record<string, Handler>)[`on${name}`];
      if (typeof handler === 'function') handler.call(this, { type: name, ...init });
    }

    // Continuous mode reports every result so far each time, the finished ones first.
    report(): void {
      const results = this.heard.map(({ text, final }) => {
        const alternative = { transcript: text, confidence: 0.9 };
        return Object.assign([alternative], {
          isFinal: final,
          item: (index: number) => [alternative][index],
        });
      });
      const list = Object.assign([...results], { item: (index: number) => results[index] });
      this.emit('result', { resultIndex: Math.max(0, results.length - 1), results: list });
    }
  }

  /** The session that is listening now. A journey that speaks to none has made a mistake. */
  const current = (): FakeRecognition => {
    const open = [...sessions]
      .reverse()
      .find((s) => s.state === 'running' || s.state === 'stopping');
    if (!open) throw new Error('No recognition session is open: the call is not listening.');
    return open;
  };

  // ---- the customer's voice ------------------------------------------------------------------

  class FakeUtterance {
    text: string;
    lang = '';
    voice: unknown = null;
    rate = 1;
    pitch = 1;
    volume = 1;
    onstart: Handler = null;
    onend: Handler = null;
    onerror: Handler = null;
    onboundary: Handler = null;
    onpause: Handler = null;
    onresume: Handler = null;
    onmark: Handler = null;
    constructor(text = '') {
      this.text = text;
    }
  }

  const voices = [
    {
      name: 'Fake English (United Kingdom)',
      lang: 'en-GB',
      localService: true,
      default: true,
      voiceURI: 'fake-en-gb',
    },
    {
      name: 'Fake English (United States)',
      lang: 'en-US',
      localService: true,
      default: false,
      voiceURI: 'fake-en-us',
    },
  ];

  const voice = { spoken: [] as string[], cancels: 0, duration: voiceMs };
  let active: FakeUtterance | null = null;
  let finishing: ReturnType<typeof setTimeout> | undefined;

  const synthesis = new EventTarget() as EventTarget & {
    speaking: boolean;
    pending: boolean;
    paused: boolean;
    getVoices(): typeof voices;
    speak(utterance: FakeUtterance): void;
    cancel(): void;
    pause(): void;
    resume(): void;
  };
  synthesis.speaking = false;
  synthesis.pending = false;
  synthesis.paused = false;
  synthesis.getVoices = () => voices;
  synthesis.speak = (utterance) => {
    // An empty utterance only unlocks speech: it is not something the customer said.
    if (utterance.text === '') return;
    voice.spoken.push(utterance.text);
    active = utterance;
    synthesis.speaking = true;
    queueMicrotask(() => {
      if (active === utterance) utterance.onstart?.({ type: 'start' });
    });
    finishing = setTimeout(() => {
      if (active !== utterance) return;
      active = null;
      synthesis.speaking = false;
      utterance.onend?.({ type: 'end' });
    }, voice.duration);
  };
  synthesis.cancel = () => {
    voice.cancels += 1;
    const stopped = active;
    active = null;
    synthesis.speaking = false;
    clearTimeout(finishing);
    if (stopped) queueMicrotask(() => stopped.onerror?.({ type: 'error', error: 'canceled' }));
  };
  synthesis.pause = () => {
    synthesis.paused = true;
  };
  synthesis.resume = () => {
    synthesis.paused = false;
  };

  const define = (name: string, value: unknown) =>
    Object.defineProperty(window, name, { value, configurable: true, writable: true });
  define('webkitSpeechRecognition', FakeRecognition);
  define('SpeechRecognition', FakeRecognition);
  define('speechSynthesis', synthesis);
  define('SpeechSynthesisUtterance', FakeUtterance);

  window.__fakeSpeech = {
    recognition: {
      stats() {
        const latest = sessions[sessions.length - 1];
        return {
          created: sessions.length,
          running: sessions.filter((s) => s.state === 'running' || s.state === 'stopping').length,
          starts: counts.starts,
          stops: counts.stops,
          aborts: counts.aborts,
          latest: latest
            ? {
                lang: latest.lang,
                continuous: latest.continuous,
                interimResults: latest.interimResults,
              }
            : null,
        };
      },
      hear(text, final) {
        const session = current();
        if (!session.speaking) {
          session.speaking = true;
          session.emit('speechstart');
        }
        // The result still being worked out grows in place; a finished one is never changed again.
        const last = session.heard[session.heard.length - 1];
        if (last && !last.final) {
          last.text = text;
          last.final = final;
        } else {
          session.heard.push({ text, final });
        }
        session.report();
      },
      speechEnd() {
        const session = current();
        session.speaking = false;
        session.emit('speechend');
      },
      endSession() {
        const session = current();
        session.state = 'ended';
        session.speaking = false;
        session.emit('audioend');
        session.emit('end');
      },
      fail(code) {
        const session = current();
        session.state = 'ended';
        session.speaking = false;
        session.emit('error', { error: code, message: '' });
        session.emit('end');
      },
    },
    voice: {
      stats: () => ({
        spoken: [...voice.spoken],
        speaking: synthesis.speaking,
        cancels: voice.cancels,
      }),
      setDuration(ms) {
        voice.duration = ms;
      },
    },
  };
}

/** What the server's speech provider `none` says about itself (server/speech/index.ts). */
function speechOff(real: AppConfigDTO['speech']): AppConfigDTO['speech'] {
  return {
    provider: 'none',
    label: 'Not configured',
    demo: false,
    transcribe: false,
    synthesize: false,
    expressiveStyles: false,
    notice: null,
    voices: [],
    limits: real.limits,
  };
}

export interface BrowserSpeechOptions {
  /** How long the customer's voice lasts for each piece of a line, on the page's clock (default 80 ms). */
  voiceMs?: number;
}

/**
 * Sets up the page for a call that uses the browser's own speech. Call it before the page is opened:
 * everything it installs runs before the app's own code, and the page clock must be there from the
 * start. Then open the call as any journey does.
 */
export async function installBrowserSpeech(
  page: Page,
  { voiceMs = VOICE_MS }: BrowserSpeechOptions = {},
): Promise<BrowserSpeech> {
  const speech = new BrowserSpeech(page);
  // The clock runs in real time until `freeze`, so that the page and the call start as they do.
  await page.clock.install();
  await page.addInitScript(installFakeSpeech, voiceMs);
  await page.route('**/api/config', async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as AppConfigDTO;
    await route.fulfill({ response, json: { ...body, speech: speechOff(body.speech) } });
  });
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/speech/'))
      speech.serverSpeechRequests += 1;
  });
  return speech;
}

/** The journey's hands on the page's fake recogniser, fake voice and clock. */
export class BrowserSpeech {
  private readonly page: Page;
  /** How many requests the page made to the server's speech endpoints: none, for a call on this path. */
  serverSpeechRequests = 0;

  constructor(page: Page) {
    this.page = page;
  }

  // ---- what the trainee says ---------------------------------------------------------------

  /**
   * The browser hears words. `final: false` is a result still being worked out, which the next call
   * replaces; `final: true` finishes it, and the words after it are a new result. The first words
   * after quiet also say that speech started.
   */
  async hear(text: string, { final = false }: { final?: boolean } = {}): Promise<void> {
    await this.page.evaluate(
      ([words, done]) => {
        const api = window.__fakeSpeech;
        if (!api) throw new Error('The fake speech is not installed.');
        api.recognition.hear(words, done);
      },
      [text, final] as const,
    );
  }

  /** The browser says the sound has ended, as it does a moment after the words stop. */
  async speechEnd(): Promise<void> {
    await this.act('speechEnd');
  }

  /** The sound ends, and then `ms` of quiet pass on the page's clock. */
  async pause(ms: number): Promise<void> {
    await this.speechEnd();
    await this.advance(ms);
  }

  /** The browser ends the session it was running, as it does by itself after some quiet. */
  async endSession(): Promise<void> {
    await this.act('endSession');
  }

  /** The browser's session fails with an error code (`no-speech`, `network`, ...) and then ends. */
  async fail(code: string): Promise<void> {
    await this.page.evaluate((error) => {
      const api = window.__fakeSpeech;
      if (!api) throw new Error('The fake speech is not installed.');
      api.recognition.fail(error);
    }, code);
  }

  private async act(action: 'speechEnd' | 'endSession'): Promise<void> {
    await this.page.evaluate((name) => {
      const api = window.__fakeSpeech;
      if (!api) throw new Error('The fake speech is not installed.');
      api.recognition[name]();
    }, action);
  }

  // ---- what the page did -------------------------------------------------------------------

  async recogniser(): Promise<RecognitionStats> {
    return this.page.evaluate(() => {
      if (!window.__fakeSpeech) throw new Error('The fake speech is not installed.');
      return window.__fakeSpeech.recognition.stats();
    });
  }

  async voice(): Promise<VoiceStats> {
    return this.page.evaluate(() => {
      if (!window.__fakeSpeech) throw new Error('The fake speech is not installed.');
      return window.__fakeSpeech.voice.stats();
    });
  }

  /** Changes how long each piece of the customer's line lasts from now on. */
  async setVoiceMs(ms: number): Promise<void> {
    await this.page.evaluate((duration) => {
      const api = window.__fakeSpeech;
      if (!api) throw new Error('The fake speech is not installed.');
      api.voice.setDuration(duration);
    }, ms);
  }

  // ---- what the call's announcer said ------------------------------------------------------

  /** Starts to keep what the page's polite announcer says. Call it once, after the call page is open. */
  async watchAnnouncements(): Promise<void> {
    await this.page.evaluate(() => {
      const region = document.querySelector(
        '[role="status"][aria-live="polite"][aria-atomic="true"]',
      );
      if (!region) throw new Error('The announcer region is not on the page.');
      const said: string[] = [];
      window.__fakeSpeechSaid = said;
      let last = '';
      new MutationObserver(() => {
        const text = (region.textContent ?? '').trim();
        if (text === last) return;
        last = text;
        // The announcer empties the region between sentences, so a repeat is a second entry.
        if (text) said.push(text);
      }).observe(region, { childList: true, characterData: true, subtree: true });
    });
  }

  /** What the announcer has said since `watchAnnouncements`, in order. */
  async announced(): Promise<string[]> {
    return this.page.evaluate(() => [...(window.__fakeSpeechSaid ?? [])]);
  }

  /**
   * Moves the page's clock on until the announcer has said `sentence`. The announcer reads one
   * sentence at a time and holds each for a moment, so a sentence that comes just after another waits
   * its turn, and a clock that is stopped never reaches it.
   */
  async untilAnnounced(sentence: string): Promise<void> {
    await this.until(async () => {
      expect(await this.announced()).toContain(sentence);
    });
  }

  // ---- time --------------------------------------------------------------------------------

  /**
   * Stops the page's clock where it is. Until now it has run in real time; from here it moves only
   * when the journey says (`advance`, `quiet`, `pause`), so that a pause of 900 ms is 900 ms however
   * slow the machine is.
   */
  async freeze(): Promise<void> {
    // The clock cannot be paused in the past, so look a little ahead, and further if that was late.
    for (let margin = 250; ; margin *= 2) {
      const now = await this.page.evaluate(() => Date.now());
      try {
        await this.page.clock.pauseAt(now + margin);
        return;
      } catch (error) {
        if (margin >= 4_000) throw error;
      }
    }
  }

  /** Moves the page's clock on by `ms`, running every timer that comes due on the way, in order. */
  async advance(ms: number): Promise<void> {
    await this.page.clock.runFor(ms);
  }

  /**
   * A long stretch of quiet in jumps of 15.5 s, each of which runs the call's quiet timer once and
   * lets it set the next (it ticks every 15 s). Cheaper than running every timer for minutes.
   */
  async quiet(totalMs: number): Promise<void> {
    for (let spent = 0; spent < totalMs; spent += 15_500) {
      await this.page.clock.fastForward(15_500);
    }
  }

  /**
   * Moves the page's clock on, a tenth of a second at a time, until `check` passes. For what needs a
   * real answer (the server's reply, the microphone) and then some of the call's own timers (the
   * short settle before the microphone opens, the end of the customer's voice).
   */
  async until(check: () => Promise<void>, { steps = 60 }: { steps?: number } = {}): Promise<void> {
    let last: unknown;
    for (let step = 0; step < steps; step += 1) {
      try {
        await check();
        return;
      } catch (error) {
        last = error;
      }
      await this.advance(100);
    }
    throw last;
  }
}
