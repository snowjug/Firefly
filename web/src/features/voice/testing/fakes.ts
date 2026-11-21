import { vi } from 'vitest';
import { CAPTURE_TUNING } from '../capture/tuning.ts';
import { silence, sine } from './signals.ts';

// Silence after a sentence that is long enough for the detector to end the turn by itself.
const END_OF_TURN_TRAIL_MS = CAPTURE_TUNING.endpointSilenceMs + 300;

// Fakes for the browser's audio and speech APIs, installed on `globalThis` and driven from tests:
// a microphone that can be allowed, refused or left hanging; an audio graph with a worklet that
// tests feed samples to; speech recognition and synthesis; an <audio> element with an autoplay
// policy; and blob URLs that can be counted. They prove the call logic, not browser behaviour.

class Emitter {
  private readonly handlers = new Map<string, Set<unknown>>();

  addEventListener(type: string, handler: unknown): void {
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler);
    this.handlers.set(type, set);
  }

  removeEventListener(type: string, handler: unknown): void {
    this.handlers.get(type)?.delete(handler);
  }

  /** Calls every listener for `type`. Tests use this to play the part of the browser. */
  emit(type: string, extra: Record<string, unknown> = {}): void {
    for (const handler of [...(this.handlers.get(type) ?? [])]) {
      const event = { type, target: this, ...extra };
      if (typeof handler === 'function') handler.call(this, event);
      else (handler as { handleEvent(event: unknown): void }).handleEvent(event);
    }
  }

  listenerCount(): number {
    let total = 0;
    for (const set of this.handlers.values()) total += set.size;
    return total;
  }
}

const domError = (name: string) => new DOMException(`${name} (fake)`, name);

// ---------------------------------------------------------------------------------------
// Microphone

export class FakeTrack extends Emitter {
  readonly kind = 'audio';
  enabled = true;
  readyState: 'live' | 'ended' = 'live';

  stop(): void {
    this.readyState = 'ended';
  }

  getSettings(): MediaTrackSettings {
    return {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };
  }

  /** The device was unplugged or access was withdrawn: the browser ends the track by itself. */
  unplug(): void {
    this.readyState = 'ended';
    this.emit('ended');
  }
}

export class FakeStream {
  readonly tracks: FakeTrack[];
  constructor(tracks: FakeTrack[]) {
    this.tracks = tracks;
  }
  getTracks(): FakeTrack[] {
    return [...this.tracks];
  }
  getAudioTracks(): FakeTrack[] {
    return [...this.tracks];
  }
}

export type MicrophoneMode = 'grant' | 'deny' | 'missing' | 'busy' | 'unsupported' | 'hang';

// ---------------------------------------------------------------------------------------
// Web Audio

class FakeNode extends Emitter {
  readonly outputs = new Set<FakeNode>();
  connect(destination: FakeNode): FakeNode {
    this.outputs.add(destination);
    return destination;
  }
  disconnect(destination?: FakeNode): void {
    if (destination) this.outputs.delete(destination);
    else this.outputs.clear();
  }
}

class FakeGain extends FakeNode {
  readonly gain = { value: 1 };
}

class FakeAnalyser extends FakeNode {
  fftSize = 2048;
  smoothingTimeConstant = 0.8;
  private readonly rms: () => number;
  private readonly onRead: () => void;
  constructor(rms: () => number, onRead: () => void) {
    super();
    this.rms = rms;
    this.onRead = onRead;
  }
  getFloatTimeDomainData(array: Float32Array): void {
    this.onRead();
    // A square wave has an RMS equal to its amplitude.
    const level = this.rms();
    for (let i = 0; i < array.length; i++) array[i] = i % 2 === 0 ? level : -level;
  }
}

class FakeSource extends FakeNode {}

export class FakePort {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  readonly sent: unknown[] = [];
  closed = false;
  postMessage(message: unknown): void {
    this.sent.push(message);
  }
  close(): void {
    this.closed = true;
  }
}

export class FakeWorkletNode extends FakeNode {
  readonly port = new FakePort();
  listening = false;
  closed = false;
  readonly name: string;
  constructor(name: string) {
    super();
    this.name = name;
    const post = this.port.postMessage.bind(this.port);
    this.port.postMessage = (message: unknown) => {
      post(message);
      const type = (message as { type?: string } | null)?.type;
      if (type === 'start') this.listening = true;
      else if (type === 'stop') this.listening = false;
      else if (type === 'close') {
        this.listening = false;
        this.closed = true;
      }
    };
  }
  /** What the audio thread does: hands a block of samples to the page. */
  deliver(samples: Float32Array): void {
    if (this.listening && !this.closed) this.port.onmessage?.({ data: samples });
  }
}

export class FakeAudioContext extends Emitter {
  state: 'running' | 'suspended' | 'closed';
  readonly sampleRate: number;
  readonly destination = new FakeNode();
  readonly nodes: FakeNode[] = [];
  readonly workletNodes: FakeWorkletNode[] = [];
  readonly audioWorklet: { addModule: (url: string) => Promise<void> };
  private readonly env: FakeEnv;

  constructor(env: FakeEnv, options?: { sampleRate?: number }) {
    super();
    this.env = env;
    if (options?.sampleRate !== undefined && !env.audio.supportsFixedRate) {
      throw domError('NotSupportedError');
    }
    this.sampleRate = options?.sampleRate ?? env.audio.defaultRate;
    this.state = env.audio.startSuspended ? 'suspended' : 'running';
    this.audioWorklet = {
      addModule: vi.fn(async (url: string) => {
        env.audio.moduleUrls.push(url);
        if (env.audio.workletFails) throw domError('AbortError');
      }),
    };
    env.contexts.push(this);
  }

  async resume(): Promise<void> {
    if (this.state === 'closed') throw domError('InvalidStateError');
    if (this.env.audio.resumeStaysSuspended) return;
    this.state = 'running';
    this.emit('statechange');
  }

  async close(): Promise<void> {
    this.state = 'closed';
    for (const node of this.nodes) node.disconnect();
    this.emit('statechange');
  }

  private track<T extends FakeNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }

  createMediaStreamSource(_stream: unknown): FakeSource {
    if (this.env.audio.sourceNeedsDeviceRate && this.sampleRate !== this.env.audio.defaultRate) {
      throw domError('NotSupportedError');
    }
    return this.track(new FakeSource());
  }

  createMediaElementSource(_element: unknown): FakeSource {
    return this.track(new FakeSource());
  }

  createAnalyser(): FakeAnalyser {
    return this.track(
      new FakeAnalyser(
        () => this.env.audio.analyserRms,
        () => {
          this.env.audio.analyserReads++;
        },
      ),
    );
  }

  createGain(): FakeGain {
    return this.track(new FakeGain());
  }

  registerWorklet(node: FakeWorkletNode): void {
    this.workletNodes.push(node);
    this.nodes.push(node);
  }
}

// ---------------------------------------------------------------------------------------
// Speech recognition

export class FakeRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  processLocally?: boolean;
  onstart: (() => void) | null = null;
  onaudiostart: (() => void) | null = null;
  onspeechstart: (() => void) | null = null;
  onspeechend: (() => void) | null = null;
  onaudioend: (() => void) | null = null;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  running = false;
  stops = 0;
  aborts = 0;

  start(): void {
    if (this.running) throw domError('InvalidStateError');
    this.running = true;
  }
  stop(): void {
    this.stops++;
  }
  abort(): void {
    this.aborts++;
    this.running = false;
  }

  /** The browser begins listening. */
  open(): void {
    this.onstart?.();
    this.onaudiostart?.();
  }
  speechStart(): void {
    this.onspeechstart?.();
  }
  speechEnd(): void {
    this.onspeechend?.();
  }
  /** The browser reports words, interim or final. */
  say(text: string, final = true, confidence = 0.9): void {
    const result = Object.assign([{ transcript: text, confidence }], { isFinal: final });
    this.onresult?.({ resultIndex: 0, results: [result] });
  }
  fail(code: string): void {
    this.onerror?.({ error: code });
  }
  /** The session is over, as the browser reports it. */
  close(): void {
    this.running = false;
    this.onend?.();
  }
}

// ---------------------------------------------------------------------------------------
// Speech synthesis

export class FakeUtterance {
  text: string;
  lang = '';
  voice: unknown = null;
  rate = 1;
  pitch = 1;
  volume = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onboundary: ((event: { name: string; charIndex: number }) => void) | null = null;
  constructor(text = '') {
    this.text = text;
  }
}

export function fakeVoice(name: string, lang: string, localService = true, isDefault = false) {
  return {
    name,
    lang,
    voiceURI: name,
    localService,
    default: isDefault,
  } as SpeechSynthesisVoice;
}

export const DEFAULT_FAKE_VOICES: SpeechSynthesisVoice[] = [
  fakeVoice('Local English (United States)', 'en-US', true, true),
  fakeVoice('Local English (United Kingdom)', 'en-GB', true),
  fakeVoice('Online Natural English (United Kingdom)', 'en-GB', false),
  fakeVoice('Local Français (France)', 'fr-FR', true),
];

class FakeSynthesis extends Emitter {
  voices: SpeechSynthesisVoice[];
  speaking = false;
  pending = false;
  paused = false;
  readonly spoken: FakeUtterance[] = [];
  primes = 0;
  cancels = 0;
  /** Browsers report a cancelled utterance as an error event; real ones do it a moment later. */
  reportCancel = true;
  private active: FakeUtterance | null = null;

  constructor(voices: SpeechSynthesisVoice[]) {
    super();
    this.voices = voices;
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  speak(utterance: FakeUtterance): void {
    // An empty utterance only unlocks speech; it is not something the customer said.
    if (utterance.text === '') {
      this.primes++;
      return;
    }
    this.spoken.push(utterance);
    this.active = utterance;
    this.speaking = true;
  }

  cancel(): void {
    this.cancels++;
    const cancelled = this.active;
    this.active = null;
    this.speaking = false;
    this.pending = false;
    if (cancelled && this.reportCancel) {
      queueMicrotask(() => cancelled.onerror?.({ error: 'canceled' }));
    }
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  /** The latest utterance starts speaking. */
  startLatest(): FakeUtterance {
    const utterance = this.latest();
    utterance.onstart?.();
    return utterance;
  }

  /** The latest utterance finishes (starting first if it had not). */
  finishLatest(during?: (utterance: FakeUtterance) => void): FakeUtterance {
    const utterance = this.latest();
    utterance.onstart?.();
    during?.(utterance);
    this.speaking = false;
    this.active = null;
    utterance.onend?.();
    return utterance;
  }

  latest(): FakeUtterance {
    const utterance = this.spoken[this.spoken.length - 1];
    if (!utterance) throw new Error('Nothing has been spoken.');
    return utterance;
  }
}

// ---------------------------------------------------------------------------------------
// <audio> and blob URLs

export type AutoplayPolicy = 'allow' | 'block' | 'fail' | 'hang';

// What a WAV blob's own size says about its length: 16 kHz, 16-bit, mono, after a 44-byte header
// (32 bytes a millisecond). It is how the fake knows the silent unlock clip is 100 ms long. Anything
// else (a blob that is not a WAV, or is too small to hold one) has no length the fake can know, and
// its end is left to the test.
const WAV_HEADER_BYTES = 44;
const WAV_BYTES_PER_MS = 32;

function wavLengthMs(blob: Blob | undefined): number | null {
  if (!blob || blob.type !== 'audio/wav') return null;
  const body = blob.size - WAV_HEADER_BYTES;
  return body >= WAV_BYTES_PER_MS ? body / WAV_BYTES_PER_MS : null;
}

export class FakeAudioElement extends Emitter {
  preload = '';
  paused = true;
  ended = false;
  duration = Number.NaN;
  currentTime = 0;
  readonly plays: string[] = [];
  private source = '';
  private endTimer: ReturnType<typeof setTimeout> | undefined;
  // The fake set `duration` itself, from the length of a WAV blob: it forgets that with the source.
  private lengthFromBlob = false;
  private pendingPlay: { resolve(): void; reject(error: unknown): void } | null = null;
  private readonly env: FakeEnv;

  constructor(env: FakeEnv) {
    super();
    this.env = env;
    env.elements.push(this);
  }

  get src(): string {
    return this.source;
  }

  /** Like the real element, a new source stops what was playing, so it can no longer reach its end. */
  set src(value: string) {
    this.stopClock();
    this.source = value;
  }

  play(): Promise<void> {
    this.plays.push(this.src);
    const policy = this.env.element.policy;
    if (policy === 'block') return Promise.reject(domError('NotAllowedError'));
    if (policy === 'fail') return Promise.reject(domError('NotSupportedError'));
    this.paused = false;
    this.ended = false;
    this.env.element.noteStarted(this);
    if (policy === 'hang') {
      return new Promise<void>((resolve, reject) => {
        this.pendingPlay = { resolve, reject };
      });
    }
    this.startClock();
    return Promise.resolve();
  }

  pause(): void {
    this.cancelEnd();
    this.paused = true;
    this.pendingPlay?.reject(domError('AbortError'));
    this.pendingPlay = null;
  }

  removeAttribute(name: string): void {
    if (name === 'src') this.src = '';
  }

  load(): void {
    this.stopClock();
    this.paused = true;
  }

  /** Playback really begins (for the `hang` policy). */
  begin(): void {
    const pending = this.pendingPlay;
    this.pendingPlay = null;
    if (!pending) return;
    this.startClock();
    pending.resolve();
  }

  /** The browser knows the length of the audio. */
  setDuration(seconds: number): void {
    this.duration = seconds;
    this.emit('durationchange');
  }

  /** The audio plays to the end. */
  finish(): void {
    this.cancelEnd();
    this.paused = true;
    this.ended = true;
    this.emit('ended');
  }

  /** The browser cannot play the audio. */
  breakDown(): void {
    this.emit('error');
  }

  // A real element reports the length of what it loaded a moment after playing starts, and reaches
  // the end of a short clip by itself, unless it is paused, cleared or given another source first.
  // When the fake can know the length (a WAV blob) it does both, so code that mistakes the silent
  // unlock clip's events for a reply's is caught. `env.element.autoEnd = false` leaves it to the test.
  private startClock(): void {
    if (!this.env.element.autoEnd) return;
    const playing = this.source;
    const ms = wavLengthMs(this.env.urls.blobFor(playing));
    if (ms === null) return;
    queueMicrotask(() => {
      if (this.source !== playing) return;
      this.lengthFromBlob = true;
      this.setDuration(ms / 1000);
    });
    this.endTimer = setTimeout(() => {
      this.endTimer = undefined;
      if (!this.paused && this.source === playing) this.finish();
    }, ms);
  }

  private cancelEnd(): void {
    clearTimeout(this.endTimer);
    this.endTimer = undefined;
  }

  private stopClock(): void {
    this.cancelEnd();
    if (this.lengthFromBlob) {
      this.lengthFromBlob = false;
      this.duration = Number.NaN;
    }
  }
}

// ---------------------------------------------------------------------------------------
// The environment

export interface FakeOptions {
  /** `navigator.mediaDevices` (default true). */
  microphone?: boolean;
  /** AudioContext and AudioWorkletNode (default true). */
  audioContext?: boolean;
  /** SpeechRecognition (default false: tests opt in). */
  recognition?: boolean;
  /** speechSynthesis and SpeechSynthesisUtterance (default false: tests opt in). */
  synthesis?: boolean | SpeechSynthesisVoice[];
  /** Audio and blob URLs (default true). */
  audioElement?: boolean;
  secureContext?: boolean;
  userAgent?: string;
}

export interface FakeEnv {
  readonly mic: {
    mode: MicrophoneMode;
    readonly getUserMedia: ReturnType<typeof vi.fn>;
    readonly streams: FakeStream[];
    readonly tracks: FakeTrack[];
    /** Lets a `hang` request finish as allowed (or refused). */
    settle(outcome?: 'grant' | 'deny'): void;
    /** The tracks that are still live. */
    openTracks(): FakeTrack[];
  };
  readonly audio: {
    defaultRate: number;
    supportsFixedRate: boolean;
    startSuspended: boolean;
    resumeStaysSuspended: boolean;
    workletFails: boolean;
    sourceNeedsDeviceRate: boolean;
    /** The RMS every analyser reads. */
    analyserRms: number;
    /** How many times any analyser was read: a meter's update rate can be counted from this. */
    analyserReads: number;
    readonly moduleUrls: string[];
    /** Hands samples to every worklet that is listening, in blocks like the audio thread's. */
    feed(samples: Float32Array, blockSize?: number): void;
    /** A sentence-like burst: lead-in silence, speech, then enough silence for the pause to end it. */
    speakSentence(options?: { leadMs?: number; speechMs?: number; trailMs?: number }): void;
    openContexts(): FakeAudioContext[];
    listeningWorklets(): FakeWorkletNode[];
  };
  readonly contexts: FakeAudioContext[];
  readonly recognition: {
    readonly instances: FakeRecognition[];
    /** Makes every `start()` throw, as a browser does when a session is already running. */
    startThrows: boolean;
    latest(): FakeRecognition;
    /** What `SpeechRecognition.available` reports; `undefined` removes the method. */
    setOnDevice(availability: 'available' | 'downloadable' | 'unavailable' | undefined): void;
  };
  readonly speech: FakeSynthesis;
  readonly element: {
    policy: AutoplayPolicy;
    /**
     * Whether an element that is playing a WAV blob reaches its end by itself after the length the
     * blob's size gives (default true, as a real element does): the silent unlock clip is 100 ms.
     * Blobs that are not WAVs have no length the fake can know, and are ended by the test.
     */
    autoEnd: boolean;
    noteStarted(element: FakeAudioElement): void;
    /** The most playing at once, ever. */
    maxConcurrent: number;
    playing(): FakeAudioElement[];
    latest(): FakeAudioElement;
  };
  readonly elements: FakeAudioElement[];
  readonly urls: {
    created: number;
    revoked: number;
    live(): string[];
    /** What a blob URL was made from, even after it was revoked (playing goes on after a revoke). */
    blobFor(url: string): Blob | undefined;
  };
  /** Listeners currently attached to every fake object that takes them. */
  listenerCount(): number;
  /** Connections between audio nodes that are still in place. */
  edgeCount(): number;
  uninstall(): void;
}

export function installFakes(options: FakeOptions = {}): FakeEnv {
  const restores: Array<() => void> = [];
  const contexts: FakeAudioContext[] = [];
  const elements: FakeAudioElement[] = [];
  const streams: FakeStream[] = [];
  const tracks: FakeTrack[] = [];
  const liveUrls = new Set<string>();
  const blobsByUrl = new Map<string, Blob>();
  const recognitionInstances: FakeRecognition[] = [];
  let pendingMic: { resolve(stream: FakeStream): void; reject(error: unknown): void } | null = null;
  let urlCounter = 0;
  let playingSet = new Set<FakeAudioElement>();

  const env: FakeEnv = {
    mic: {
      mode: 'grant',
      getUserMedia: vi.fn(),
      streams,
      tracks,
      settle(outcome = 'grant') {
        const pending = pendingMic;
        pendingMic = null;
        if (!pending) return;
        if (outcome === 'grant') pending.resolve(newStream());
        else pending.reject(domError('NotAllowedError'));
      },
      openTracks: () => tracks.filter((track) => track.readyState === 'live'),
    },
    audio: {
      defaultRate: 48000,
      supportsFixedRate: true,
      startSuspended: false,
      resumeStaysSuspended: false,
      workletFails: false,
      sourceNeedsDeviceRate: false,
      analyserRms: 0,
      analyserReads: 0,
      moduleUrls: [],
      feed(samples, blockSize = 320) {
        for (let i = 0; i < samples.length; i += blockSize) {
          const block = samples.slice(i, i + blockSize);
          for (const node of env.audio.listeningWorklets()) node.deliver(block);
        }
      },
      speakSentence({ leadMs = 400, speechMs = 1000, trailMs = END_OF_TURN_TRAIL_MS } = {}) {
        const node = env.audio.listeningWorklets()[0];
        const owner = node ? contexts.find((context) => context.workletNodes.includes(node)) : null;
        const rate = owner?.sampleRate ?? 16000;
        const parts = [silence(leadMs, rate), sine(speechMs, rate, 0.3), silence(trailMs, rate)];
        for (const part of parts) env.audio.feed(part);
      },
      openContexts: () => contexts.filter((context) => context.state !== 'closed'),
      listeningWorklets: () =>
        contexts.flatMap((context) => context.workletNodes).filter((node) => node.listening),
    },
    contexts,
    recognition: {
      instances: recognitionInstances,
      startThrows: false,
      latest() {
        const instance = recognitionInstances[recognitionInstances.length - 1];
        if (!instance) throw new Error('Nothing is recognising.');
        return instance;
      },
      setOnDevice() {},
    },
    speech: new FakeSynthesis(
      Array.isArray(options.synthesis) ? options.synthesis : DEFAULT_FAKE_VOICES,
    ),
    element: {
      policy: 'allow',
      autoEnd: true,
      maxConcurrent: 0,
      noteStarted(element) {
        playingSet.add(element);
        env.element.maxConcurrent = Math.max(
          env.element.maxConcurrent,
          env.element.playing().length,
        );
      },
      playing() {
        playingSet = new Set([...playingSet].filter((element) => !element.paused));
        return [...playingSet];
      },
      latest() {
        const element = elements[elements.length - 1];
        if (!element) throw new Error('No audio element was created.');
        return element;
      },
    },
    elements,
    urls: {
      created: 0,
      revoked: 0,
      live: () => [...liveUrls],
      blobFor: (url) => blobsByUrl.get(url),
    },
    listenerCount() {
      let total = env.speech.listenerCount();
      for (const element of elements) total += element.listenerCount();
      for (const track of tracks) total += track.listenerCount();
      for (const context of contexts) {
        total += context.listenerCount();
        for (const node of context.nodes) total += node.listenerCount();
      }
      return total;
    },
    edgeCount() {
      let total = 0;
      for (const context of contexts) for (const node of context.nodes) total += node.outputs.size;
      return total;
    },
    uninstall() {
      for (const restore of restores.reverse()) restore();
      restores.length = 0;
      vi.unstubAllGlobals();
    },
  };

  function newStream(): FakeStream {
    const track = new FakeTrack();
    tracks.push(track);
    const stream = new FakeStream([track]);
    streams.push(stream);
    return stream;
  }

  const define = (target: object, key: string, value: unknown) => {
    const had = Object.prototype.hasOwnProperty.call(target, key);
    const previous = (target as Record<string, unknown>)[key];
    Object.defineProperty(target, key, { configurable: true, writable: true, value });
    restores.push(() => {
      if (had)
        Object.defineProperty(target, key, { configurable: true, writable: true, value: previous });
      else delete (target as Record<string, unknown>)[key];
    });
  };

  if (options.microphone !== false) {
    env.mic.getUserMedia.mockImplementation((_constraints: unknown) => {
      switch (env.mic.mode) {
        case 'grant':
          return Promise.resolve(newStream());
        case 'deny':
          return Promise.reject(domError('NotAllowedError'));
        case 'missing':
          return Promise.reject(domError('NotFoundError'));
        case 'busy':
          return Promise.reject(domError('NotReadableError'));
        case 'unsupported':
          return Promise.reject(new TypeError('getUserMedia is not supported'));
        case 'hang':
          return new Promise<FakeStream>((resolve, reject) => {
            pendingMic = { resolve, reject };
          });
      }
    });
    define(navigator, 'mediaDevices', { getUserMedia: env.mic.getUserMedia });
  }

  if (options.audioContext !== false) {
    class Context extends FakeAudioContext {
      constructor(contextOptions?: { sampleRate?: number }) {
        super(env, contextOptions);
      }
    }
    class Worklet extends FakeWorkletNode {
      constructor(context: FakeAudioContext, name: string) {
        super(name);
        if (name !== 'firefly-capture') throw domError('InvalidStateError');
        context.registerWorklet(this);
      }
    }
    vi.stubGlobal('AudioContext', Context);
    vi.stubGlobal('AudioWorkletNode', Worklet);
  }

  if (options.recognition) {
    let availability: 'available' | 'downloadable' | 'unavailable' | undefined;
    class Recognition extends FakeRecognition {
      static available: ((o: unknown) => Promise<string>) | undefined = undefined;
      static install: ((o: unknown) => Promise<boolean>) | undefined = undefined;
      constructor() {
        super();
        recognitionInstances.push(this);
      }
      override start(): void {
        if (env.recognition.startThrows) throw domError('InvalidStateError');
        super.start();
      }
    }
    const setOnDevice = (next: typeof availability) => {
      availability = next;
      Recognition.available = next === undefined ? undefined : async () => availability as string;
      Recognition.install = next === undefined ? undefined : async () => true;
    };
    env.recognition.setOnDevice = setOnDevice;
    vi.stubGlobal('SpeechRecognition', Recognition);
  }

  if (options.synthesis) {
    vi.stubGlobal('speechSynthesis', env.speech);
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  }

  if (options.audioElement !== false) {
    vi.stubGlobal(
      'Audio',
      class {
        constructor() {
          return new FakeAudioElement(env);
        }
      },
    );
    const urlApi = URL as unknown as {
      createObjectURL?: (blob: Blob) => string;
      revokeObjectURL?: (url: string) => void;
    };
    const originalCreate = urlApi.createObjectURL;
    const originalRevoke = urlApi.revokeObjectURL;
    urlApi.createObjectURL = (blob: Blob) => {
      const url = `blob:fake/${++urlCounter}`;
      liveUrls.add(url);
      blobsByUrl.set(url, blob);
      env.urls.created++;
      return url;
    };
    urlApi.revokeObjectURL = (url: string) => {
      if (liveUrls.delete(url)) env.urls.revoked++;
    };
    restores.push(() => {
      urlApi.createObjectURL = originalCreate;
      urlApi.revokeObjectURL = originalRevoke;
    });
  } else {
    // jsdom has an <audio> constructor and Node has blob URLs; a bare browser has neither here.
    vi.stubGlobal('Audio', undefined);
    const urlApi = URL as unknown as { createObjectURL?: unknown; revokeObjectURL?: unknown };
    const originalCreate = urlApi.createObjectURL;
    const originalRevoke = urlApi.revokeObjectURL;
    urlApi.createObjectURL = undefined;
    urlApi.revokeObjectURL = undefined;
    restores.push(() => {
      urlApi.createObjectURL = originalCreate;
      urlApi.revokeObjectURL = originalRevoke;
    });
  }

  if (options.secureContext !== undefined) vi.stubGlobal('isSecureContext', options.secureContext);
  if (options.userAgent) {
    const spy = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(options.userAgent);
    restores.push(() => spy.mockRestore());
  }

  return env;
}
