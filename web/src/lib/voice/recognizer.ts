import {
  DEFAULT_VOICE_LANG,
  getRecognitionConstructor,
  isChromiumBrowser,
  type RecognitionConstructor,
  type RecognitionErrorEventLike,
  type RecognitionLike,
  type RecognitionResultEventLike,
} from './support.ts';

// A thin wrapper around the browser's SpeechRecognition. It listens for one sentence at a time, reports
// plain text (never audio), and turns the browser's error codes into a few plain-English outcomes.
// Firefly never records or uploads audio itself; where the audio is processed is up to the browser,
// which is why `mode` says which kind of recognition is in use.

export type RecognizerState = 'idle' | 'starting' | 'listening' | 'processing';

/**
 * Where recognition happens. 'on-device': the browser confirmed it runs on this device.
 * 'browser-service': the browser's default engine, which in Chromium browsers is an online service run
 * by the browser's vendor (audio leaves the device). 'unknown': the browser does not say.
 */
export type RecognitionMode = 'on-device' | 'browser-service' | 'unknown';

export type VoiceErrorCode =
  'mic-denied' | 'no-mic' | 'network' | 'no-speech' | 'aborted' | 'unsupported' | 'unknown';

export interface VoiceError {
  code: VoiceErrorCode;
  /** A plain-English sentence that can be shown to the learner. */
  message: string;
}

const MESSAGES: Record<VoiceErrorCode, string> = {
  'mic-denied':
    'Microphone access is blocked. Allow it for this site in your browser settings, then try again.',
  'no-mic': 'No microphone was found. Check that one is connected and not in use by another app.',
  network: 'The speech service could not be reached. Check your connection and try again.',
  'no-speech': 'No speech was heard.',
  aborted: 'Listening was stopped.',
  unsupported: 'Voice input is not available in this browser.',
  unknown: 'Voice input stopped unexpectedly. Please try again.',
};

const voiceError = (code: VoiceErrorCode, message: string = MESSAGES[code]): VoiceError => ({
  code,
  message,
});

/** Maps a SpeechRecognition error code to one of the outcomes above. */
export function normalizeRecognitionError(code: string | null | undefined): VoiceError {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return voiceError('mic-denied');
    case 'audio-capture':
      return voiceError('no-mic');
    case 'network':
      return voiceError('network');
    case 'no-speech':
      return voiceError('no-speech');
    case 'aborted':
      return voiceError('aborted');
    case 'language-not-supported':
      return voiceError(
        'unsupported',
        'Voice input is not available for this language in your browser.',
      );
    default:
      return voiceError('unknown');
  }
}

// ---------------------------------------------------------------------------------------
// On-device recognition (recent Chromium). It is preferred when the browser offers it and never waited
// for: the first sentence may be recognised the usual way while the browser prepares it.

type OnDeviceStatus = 'ready' | 'unavailable' | 'needs-gesture';

interface OnDeviceRecord {
  status: OnDeviceStatus | null;
  pending: Promise<void> | null;
  /** A start already waited for the check and gave up, so later starts do not wait again. */
  waited: boolean;
}

// Keyed by the constructor so that what one browser object learns never leaks to another.
const records = new WeakMap<RecognitionConstructor, Map<string, OnDeviceRecord>>();

function recordFor(ctor: RecognitionConstructor, lang: string): OnDeviceRecord {
  let byLang = records.get(ctor);
  if (!byLang) records.set(ctor, (byLang = new Map()));
  let record = byLang.get(lang);
  if (!record) byLang.set(lang, (record = { status: null, pending: null, waited: false }));
  return record;
}

async function checkOnDevice(ctor: RecognitionConstructor, lang: string): Promise<OnDeviceStatus> {
  try {
    if (typeof ctor.available !== 'function') return 'unavailable';
    const options = { langs: [lang], processLocally: true };
    const availability = await ctor.available(options);
    if (availability === 'available') return 'ready';
    if (availability !== 'downloadable' && availability !== 'downloading') return 'unavailable';
    // Browsers hide whether the speech pack is already on the device until install() has been
    // called, and install() only works from a user gesture. It resolves quickly when nothing needs
    // downloading, and false when the language, the storage or the person says no.
    if (typeof ctor.install !== 'function') return 'unavailable';
    return (await ctor.install(options)) === true ? 'ready' : 'unavailable';
  } catch (error) {
    return error instanceof Error && error.name === 'NotAllowedError'
      ? 'needs-gesture'
      : 'unavailable';
  }
}

function prepareOnDevice(ctor: RecognitionConstructor, lang: string): Promise<void> {
  const record = recordFor(ctor, lang);
  if (record.pending) return record.pending;
  if (record.status === 'ready' || record.status === 'unavailable') return Promise.resolve();
  record.pending = checkOnDevice(ctor, lang).then((status) => {
    record.status = status;
    record.pending = null;
  });
  return record.pending;
}

// ---------------------------------------------------------------------------------------

const PREPARE_WAIT_MS = 1500;
const SPEECH_WAIT_MS = 15_000;
const RESULT_WAIT_MS = 8000;
const END_WAIT_MS = 1500;

const HANDLERS = [
  'onstart',
  'onaudiostart',
  'onspeechstart',
  'onspeechend',
  'onaudioend',
  'onresult',
  'onerror',
  'onend',
] as const;

export interface RecognizerOptions {
  /** BCP 47 language tag. Defaults to British English. */
  lang?: string;
  /** Use on-device recognition when the browser offers it (default true). */
  preferOnDevice?: boolean;
  /** Live text while the person is still speaking. */
  onInterim?: (text: string) => void;
  /** The recognised sentence. Called once per listening session that heard something. */
  onFinal?: (text: string, confidence: number | null) => void;
  onStateChange?: (state: RecognizerState) => void;
  /** Called at most once per session. `no-speech` is not a failure: the caller can listen again. */
  onError?: (error: VoiceError) => void;
  onModeChange?: (mode: RecognitionMode) => void;
}

export interface Recognizer {
  readonly state: RecognizerState;
  readonly mode: RecognitionMode;
  /** Gets on-device recognition ready if the browser offers it. Call it from a click or tap. */
  prepare(): void;
  /** Starts listening for one sentence. Ignored unless the recognizer is idle. */
  start(): void;
  /** Stops listening and delivers what was heard so far. */
  stop(): void;
  /** Stops listening and throws away anything heard. Nothing is reported. */
  abort(): void;
  /** Aborts and detaches from the browser. Nothing is reported afterwards. */
  dispose(): void;
}

interface Session {
  ctor: RecognitionConstructor;
  instance: RecognitionLike;
  onDevice: boolean;
  /** The caller has been given this session's outcome (a sentence or an error). */
  done: boolean;
  /** The browser is finished with the session. */
  closed: boolean;
  aborting: boolean;
  /** Everything recognised so far, for browsers that end without marking the last result final. */
  heard: string;
  confidence: number | null;
}

export function createRecognizer(options: RecognizerOptions = {}): Recognizer {
  const lang = options.lang ?? DEFAULT_VOICE_LANG;
  const preferOnDevice = options.preferOnDevice !== false;
  let state: RecognizerState = 'idle';
  let mode: RecognitionMode = 'unknown';
  let session: Session | null = null;
  let launchId = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const setState = (next: RecognizerState) => {
    if (disposed || state === next) return;
    state = next;
    options.onStateChange?.(next);
  };
  const setMode = (next: RecognitionMode) => {
    if (disposed || mode === next) return;
    mode = next;
    options.onModeChange?.(next);
  };
  const clearTimer = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const arm = (ms: number, onTimeout: () => void) => {
    clearTimer();
    timer = setTimeout(onTimeout, ms);
  };
  const live = (s: Session) => session === s && !s.aborting && !s.closed;

  const release = (s: Session) => {
    for (const name of HANDLERS) s.instance[name] = null;
    if (session === s) session = null;
  };

  // The browser is done with the session (or we stopped waiting for it). Whatever was heard but not
  // yet reported is reported now; a session that heard nothing counts as silence.
  const finish = (s: Session, nothingHeard: VoiceError) => {
    if (s.closed) return;
    s.closed = true;
    clearTimer();
    release(s);
    if (!s.done) {
      s.done = true;
      const heard = s.heard.trim();
      if (heard) options.onFinal?.(heard, s.confidence);
      else options.onError?.(nothingHeard);
    }
    setState('idle');
  };

  const giveUp = (s: Session, nothingHeard: VoiceError) => {
    if (s.closed) return;
    s.aborting = true;
    try {
      s.instance.abort();
    } catch {
      // The session may already be over.
    }
    finish(s, nothingHeard);
  };

  // Reports the outcome as soon as it is known, then waits for the browser's own "end".
  const conclude = (s: Session, report: () => void) => {
    if (s.done) return;
    s.done = true;
    clearTimer();
    setState('processing');
    arm(END_WAIT_MS, () => finish(s, voiceError('no-speech')));
    report();
  };

  const onResult = (s: Session, event: RecognitionResultEventLike) => {
    if (!live(s) || s.done) return;
    let finalText = '';
    let interimText = '';
    let confidence: number | null = null;
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      const best = result?.[0];
      if (!result || !best) continue;
      if (result.isFinal) {
        finalText += best.transcript;
        if (Number.isFinite(best.confidence) && best.confidence > 0) confidence = best.confidence;
      } else {
        interimText += best.transcript;
      }
    }
    s.heard = finalText + interimText;
    if (confidence !== null) s.confidence = confidence;
    if (finalText.trim() && !interimText.trim()) {
      conclude(s, () => options.onFinal?.(finalText.trim(), confidence));
      return;
    }
    // Something was said: stop waiting for the person to start, but do not wait for ever for more.
    arm(RESULT_WAIT_MS, () => giveUp(s, voiceError('network')));
    if (s.heard.trim()) options.onInterim?.(s.heard.trim());
  };

  const onError = (s: Session, event: RecognitionErrorEventLike) => {
    if (!live(s) || s.done) return;
    const code = event.error;
    if (s.onDevice && (code === 'service-not-allowed' || code === 'language-not-supported')) {
      // On-device recognition was refused after all (the speech pack is missing or was removed).
      // Use the browser's default engine instead, without telling the person it was a failure.
      recordFor(s.ctor, lang).status = 'unavailable';
      s.aborting = true;
      s.closed = true;
      release(s);
      try {
        s.instance.abort();
      } catch {
        // The session may already be over.
      }
      launch(s.ctor, false, launchId);
      return;
    }
    const error = normalizeRecognitionError(code);
    conclude(s, () => options.onError?.(error));
  };

  const launch = (ctor: RecognitionConstructor, onDevice: boolean, id: number) => {
    if (disposed || launchId !== id) return;
    let instance: RecognitionLike;
    try {
      instance = new ctor();
    } catch {
      setState('idle');
      options.onError?.(voiceError('unsupported'));
      return;
    }
    instance.lang = lang;
    instance.interimResults = true;
    instance.continuous = false;
    instance.maxAlternatives = 1;
    let local = false;
    if (onDevice) {
      try {
        instance.processLocally = true;
        local = instance.processLocally === true;
      } catch {
        local = false;
      }
    }
    const s: Session = {
      ctor,
      instance,
      onDevice: local,
      done: false,
      closed: false,
      aborting: false,
      heard: '',
      confidence: null,
    };
    session = s;
    instance.onstart = () => {
      if (live(s) && state === 'starting') setState('listening');
    };
    instance.onaudiostart = () => {
      if (!live(s)) return;
      if (state === 'starting') setState('listening');
      arm(SPEECH_WAIT_MS, () => giveUp(s, voiceError('no-speech')));
    };
    instance.onspeechstart = () => {
      if (live(s)) clearTimer();
    };
    const speechEnded = () => {
      if (!live(s) || s.done) return;
      setState('processing');
      arm(RESULT_WAIT_MS, () => giveUp(s, voiceError('network')));
    };
    instance.onspeechend = speechEnded;
    instance.onaudioend = speechEnded;
    instance.onresult = (event) => onResult(s, event);
    instance.onerror = (event) => onError(s, event);
    instance.onend = () => finish(s, voiceError('no-speech'));
    try {
      instance.start();
    } catch {
      release(s);
      setState('idle');
      options.onError?.(voiceError('unknown'));
      return;
    }
    setMode(local ? 'on-device' : isChromiumBrowser() ? 'browser-service' : 'unknown');
  };

  const start = () => {
    if (disposed || state !== 'idle') return;
    const ctor = getRecognitionConstructor();
    if (!ctor) {
      options.onError?.(voiceError('unsupported'));
      return;
    }
    const id = ++launchId;
    setState('starting');
    // Browsers without on-device support (and a start that has nothing to wait for) begin right
    // away, inside the click or tap that asked for it.
    if (!preferOnDevice || typeof ctor.available !== 'function') {
      launch(ctor, false, id);
      return;
    }
    const record = recordFor(ctor, lang);
    if (record.status === 'ready') {
      launch(ctor, true, id);
      return;
    }
    if (record.status !== null || (record.pending && record.waited)) {
      launch(ctor, false, id);
      return;
    }
    let giveUpWaiting: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'timeout'>((resolve) => {
      giveUpWaiting = setTimeout(() => resolve('timeout'), PREPARE_WAIT_MS);
    });
    void Promise.race([prepareOnDevice(ctor, lang).then(() => 'done' as const), timeout]).then(
      (outcome) => {
        clearTimeout(giveUpWaiting);
        if (outcome === 'timeout') record.waited = true;
        launch(ctor, record.status === 'ready', id);
      },
    );
  };

  const abort = () => {
    launchId++;
    clearTimer();
    const s = session;
    if (s) {
      s.aborting = true;
      s.closed = true;
      release(s);
      try {
        s.instance.abort();
      } catch {
        // The session may already be over.
      }
    }
    setState('idle');
  };

  return {
    get state() {
      return state;
    },
    get mode() {
      return mode;
    },
    prepare() {
      if (disposed || !preferOnDevice) return;
      const ctor = getRecognitionConstructor();
      if (ctor && typeof ctor.available === 'function') void prepareOnDevice(ctor, lang);
    },
    start,
    stop() {
      if (disposed || state === 'idle') return;
      // Nothing has been heard yet, so there is nothing to deliver.
      if (state === 'starting') {
        abort();
        return;
      }
      const s = session;
      if (!s || s.done || s.aborting) return;
      setState('processing');
      arm(RESULT_WAIT_MS, () => giveUp(s, voiceError('network')));
      try {
        s.instance.stop();
      } catch {
        // The session may already be over.
      }
    },
    abort() {
      if (!disposed) abort();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      launchId++;
      clearTimer();
      const s = session;
      if (s) {
        s.aborting = true;
        s.closed = true;
        release(s);
        try {
          s.instance.abort();
        } catch {
          // The session may already be over.
        }
      }
      state = 'idle';
    },
  };
}
