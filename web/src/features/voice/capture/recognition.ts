import {
  getRecognitionConstructor,
  isChromiumBrowser,
  type RecognitionConstructor,
  type RecognitionLike,
  type RecognitionResultEventLike,
} from '../support.ts';
import type { Capture, CaptureFailure, CaptureHandlers, CaptureSession } from './types.ts';

// Capture with the browser's own speech recognition (Chrome and Edge). It listens for one sentence
// at a time and reports interim words as they come, then the final text. Firefly never sees audio
// on this path: where the audio is processed is up to the browser, which is why `mode` says whether
// recognition is on this device or (the usual case in Chromium) the browser vendor's online service.

export type RecognitionMode = 'on-device' | 'browser-service' | 'unknown';

/** What a SpeechRecognition error code means for the call. */
export function mapRecognitionError(
  code: string | null | undefined,
): CaptureFailure | 'no-speech' | 'aborted' {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return { kind: 'microphone', reason: 'denied' };
    case 'audio-capture':
      return { kind: 'microphone', reason: 'missing' };
    case 'network':
      return { kind: 'service', reason: 'network' };
    case 'no-speech':
      return 'no-speech';
    case 'aborted':
      return 'aborted';
    case 'language-not-supported':
      return { kind: 'service', reason: 'language' };
    default:
      return { kind: 'service', reason: 'unknown' };
  }
}

// ---------------------------------------------------------------------------------------
// On-device recognition (recent Chromium). It is preferred when the browser offers it and is never
// waited for: a pass that starts before the check has finished uses the browser's default engine.

type OnDeviceStatus = 'ready' | 'unavailable' | 'needs-gesture';

interface OnDeviceRecord {
  status: OnDeviceStatus | null;
  pending: Promise<void> | null;
}

// Keyed by the constructor so that what one browser object learns never leaks to another.
const records = new WeakMap<RecognitionConstructor, Map<string, OnDeviceRecord>>();

function recordFor(ctor: RecognitionConstructor, lang: string): OnDeviceRecord {
  let byLang = records.get(ctor);
  if (!byLang) records.set(ctor, (byLang = new Map()));
  let record = byLang.get(lang);
  if (!record) byLang.set(lang, (record = { status: null, pending: null }));
  return record;
}

async function checkOnDevice(ctor: RecognitionConstructor, lang: string): Promise<OnDeviceStatus> {
  try {
    if (typeof ctor.available !== 'function') return 'unavailable';
    const options = { langs: [lang], processLocally: true };
    const availability = await ctor.available(options);
    if (availability === 'available') return 'ready';
    if (availability !== 'downloadable' && availability !== 'downloading') return 'unavailable';
    // Browsers hide whether the speech pack is on the device until install() has been called, and
    // install() only works from a user gesture. It resolves quickly when nothing needs downloading,
    // and false when the language, the storage or the person says no.
    if (typeof ctor.install !== 'function') return 'unavailable';
    return (await ctor.install(options)) === true ? 'ready' : 'unavailable';
  } catch (error) {
    return error instanceof Error && error.name === 'NotAllowedError'
      ? 'needs-gesture'
      : 'unavailable';
  }
}

function prepareOnDevice(ctor: RecognitionConstructor, lang: string): void {
  const record = recordFor(ctor, lang);
  if (record.pending || record.status === 'ready' || record.status === 'unavailable') return;
  record.pending = checkOnDevice(ctor, lang).then((status) => {
    record.status = status;
    record.pending = null;
  });
}

// ---------------------------------------------------------------------------------------

/** How long to wait for the final words once the trainee has stopped speaking. */
export const RESULT_WAIT_MS = 8000;

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

export interface RecognitionOptions {
  /** BCP 47 tag. Read each time a pass starts, so a change applies to the next pass. */
  language(): string;
  /** Use on-device recognition when the browser offers it (default true). */
  preferOnDevice?: boolean;
  onModeChange?(mode: RecognitionMode): void;
}

export interface RecognitionCapture extends Capture {
  readonly engine: 'browser-recognition';
  /** Where recognition happens, as far as the browser says. 'unknown' until a pass has started. */
  mode(): RecognitionMode;
}

export function createRecognitionCapture(options: RecognitionOptions): RecognitionCapture {
  const preferOnDevice = options.preferOnDevice !== false;
  let mode: RecognitionMode = 'unknown';
  let closeOpenPass: (() => void) | null = null;

  const setMode = (next: RecognitionMode) => {
    if (mode === next) return;
    mode = next;
    options.onModeChange?.(next);
  };

  return {
    engine: 'browser-recognition',
    mode: () => mode,
    prepare() {
      const ctor = getRecognitionConstructor();
      if (preferOnDevice && ctor && typeof ctor.available === 'function') {
        prepareOnDevice(ctor, options.language());
      }
    },
    listen(handlers: CaptureHandlers): CaptureSession {
      closeOpenPass?.();
      const ctor = getRecognitionConstructor();
      const lang = options.language();

      let closed = false;
      let started = false; // speech start was reported
      let ended = false; // speech end was reported
      let heard = '';
      let instance: RecognitionLike | null = null;
      let resultTimer: ReturnType<typeof setTimeout> | undefined;

      const release = (target: RecognitionLike | null) => {
        if (!target) return;
        for (const name of HANDLERS) target[name] = null;
        try {
          target.abort();
        } catch {
          // The session may already be over.
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        clearTimeout(resultTimer);
        release(instance);
        instance = null;
        if (closeOpenPass === close) closeOpenPass = null;
      };
      closeOpenPass = close;

      const reportStart = () => {
        if (started) return;
        started = true;
        handlers.onSpeechStart();
      };
      const reportEnd = (reason: 'silence' | 'stopped') => {
        if (ended) return;
        reportStart();
        ended = true;
        handlers.onSpeechEnd({ reason });
        clearTimeout(resultTimer);
        resultTimer = setTimeout(
          () => fail({ kind: 'service', reason: 'network' }),
          RESULT_WAIT_MS,
        );
      };
      const nothing = () => {
        close();
        handlers.onNothing();
      };
      const fail = (failure: CaptureFailure) => {
        if (closed) return;
        close();
        handlers.onFailure(failure);
      };
      const deliver = (raw: string) => {
        const text = raw.replace(/\s+/g, ' ').trim();
        if (!text) {
          nothing();
          return;
        }
        reportEnd('silence');
        close();
        handlers.onText(text);
      };

      const onResult = (event: RecognitionResultEventLike) => {
        if (closed) return;
        let finalText = '';
        let interimText = '';
        let anyFinal = false;
        // Browsers are not always tidy: a missing list or transcript counts as no words.
        const list = event.results as RecognitionResultEventLike['results'] | undefined;
        for (let i = 0; i < (list?.length ?? 0); i++) {
          const result = list?.[i];
          if (!result) continue;
          const transcript: unknown = result[0]?.transcript;
          const words = typeof transcript === 'string' ? transcript : '';
          if (result.isFinal) {
            anyFinal = true;
            finalText += words;
          } else {
            interimText += words;
          }
        }
        heard = finalText + interimText;
        if (finalText.trim() && !interimText.trim()) {
          deliver(finalText);
          return;
        }
        if (heard.trim()) {
          reportStart();
          handlers.onInterim(heard.trim());
          return;
        }
        // Edge ends a pass it could not make anything of with one final result that has no words in
        // it, and a session that is not continuous gives no result after a final one: that is the
        // end, and it is "nothing heard", never an empty message.
        if (anyFinal) nothing();
      };

      const launch = (onDevice: boolean): void => {
        if (!ctor) return;
        let next: RecognitionLike;
        try {
          next = new ctor();
        } catch {
          queueMicrotask(() => fail({ kind: 'microphone', reason: 'unsupported' }));
          return;
        }
        instance = next;
        next.lang = lang;
        next.interimResults = true;
        next.continuous = false;
        next.maxAlternatives = 1;
        let local = false;
        if (onDevice) {
          try {
            next.processLocally = true;
            local = next.processLocally === true;
          } catch {
            local = false;
          }
        }
        next.onspeechstart = () => {
          if (!closed && instance === next) reportStart();
        };
        next.onspeechend = () => {
          if (!closed && instance === next && started) reportEnd('silence');
        };
        next.onresult = (event) => {
          if (instance === next) onResult(event);
        };
        next.onerror = (event) => {
          if (closed || instance !== next) return;
          if (
            local &&
            (event.error === 'service-not-allowed' || event.error === 'language-not-supported')
          ) {
            // On-device recognition was refused after all (the speech pack is missing or was
            // removed). Use the browser's default engine instead, without calling it a failure.
            recordFor(ctor, lang).status = 'unavailable';
            release(next);
            instance = null;
            launch(false);
            return;
          }
          const outcome = mapRecognitionError(event.error);
          // `no-speech` and `aborted` are followed by `end`, which concludes the pass.
          if (outcome !== 'no-speech' && outcome !== 'aborted') fail(outcome);
        };
        next.onend = () => {
          if (closed || instance !== next) return;
          // A session can end with no result at all (Chrome does this when it could not make
          // anything of the audio, with no error either): that is "nothing heard" too.
          if (heard.trim()) deliver(heard);
          else nothing();
        };
        try {
          next.start();
        } catch {
          release(next);
          instance = null;
          queueMicrotask(() => fail({ kind: 'service', reason: 'unknown' }));
          return;
        }
        setMode(local ? 'on-device' : isChromiumBrowser() ? 'browser-service' : 'unknown');
      };

      if (!ctor) {
        queueMicrotask(() => fail({ kind: 'microphone', reason: 'unsupported' }));
      } else {
        const record = recordFor(ctor, lang);
        launch(preferOnDevice && record.status === 'ready');
      }

      return {
        finish() {
          if (closed) return;
          if (!started && !heard.trim()) {
            nothing();
            return;
          }
          reportEnd('stopped');
          try {
            instance?.stop();
          } catch {
            // The session may already be over.
          }
        },
        cancel: close,
      };
    },
    dispose() {
      closeOpenPass?.();
    },
  };
}
