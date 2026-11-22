import {
  getRecognitionConstructor,
  isChromiumBrowser,
  type RecognitionConstructor,
  type RecognitionLike,
  type RecognitionResultEventLike,
} from '../support.ts';
import { isUsableTranscript } from '../errors.ts';
import type {
  Capture,
  CaptureFailure,
  CaptureHandlers,
  CaptureSession,
  SpeechEndReason,
} from './types.ts';
import { CAPTURE_TUNING } from './tuning.ts';

// Capture with the browser's own speech recognition (Chrome and Edge). Firefly never sees audio on
// this path: where the audio is processed is up to the browser, which is why `mode` says whether
// recognition is on this device or (the usual case in Chromium) the browser vendor's online service.
//
// One listening pass (one call to `listen`) is a whole turn of the call, and it may span many of the
// browser's own recognising sessions. The browser ends a session by itself after some quiet and after
// a minute or so of listening, and a pass starts the next one without a sound or a change on screen,
// keeping the words already heard. Because the browser's idea of "a sentence is over" would split a
// thought at every pause, the end of the trainee's turn is Firefly's to decide: it comes when the
// trainee has been quiet for `endpointSilenceMs` (or presses Done speaking), and then the words are
// delivered once. Done speaking stops the session instead of abandoning it, so the browser hands back
// the words it had captured but not yet turned into text (`stop()` returns a result, `abort()` none).
//
// A pass never ends because it was quiet, and cannot restart in a tight loop of failing sessions:
// sessions that keep failing without showing that the recogniser works (ended by an error, however
// long they lived, or by themselves at once with no words) end the pass with a failure. The browser's
// own "no speech" is a quiet room, not a failure.

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

const UNKNOWN: CaptureFailure = { kind: 'service', reason: 'unknown' };
const UNSUPPORTED: CaptureFailure = { kind: 'microphone', reason: 'unsupported' };

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

/** Detaches from a browser session and ends it. Whatever it reports afterwards is not heard. */
function release(target: RecognitionLike | null): void {
  if (!target) return;
  for (const name of HANDLERS) target[name] = null;
  try {
    target.abort();
  } catch {
    // The session may already be over.
  }
}

const tidy = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** The words alone, so that "Hello there" and "hello there." read as the same speech. */
const wordsOf = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}']+/gu, ' ')
    .trim();

const WORD = /[\p{L}\p{N}']+/gu;

/**
 * `text` without the words `prefix` begins with (compared without regard to case, spacing or
 * punctuation), or null when it does not begin with them. What follows the prefix is returned as it
 * stands, less the punctuation that joined it.
 */
function withoutLeadingWords(text: string, prefix: string): string | null {
  const wanted = prefix.toLowerCase().match(WORD) ?? [];
  const found = [...text.matchAll(WORD)];
  if (found.length < wanted.length) return null;
  for (let i = 0; i < wanted.length; i++) {
    if (found[i]?.[0].toLowerCase() !== wanted[i]) return null;
  }
  const last = found[wanted.length - 1];
  if (!last) return text;
  return text.slice((last.index ?? 0) + last[0].length).replace(/^[^\p{L}\p{N}']+/u, '');
}

const isInvalidState = (error: unknown): boolean =>
  (error as { name?: unknown } | null)?.name === 'InvalidStateError';

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
      let listening = false; // "the microphone is open" was reported
      let started = false; // the start of the turn in progress was reported
      let finishing = false; // Done speaking: the session was stopped and its last words are awaited
      // The words of the turn in progress: those of sessions that have ended, then those of the
      // session that is running (its finals, then the interim words after them).
      let kept = '';
      let sessionWords = '';
      // A continuous session reports every result so far each time. When what the trainee said was
      // thrown away as not a turn, the results that were already final are skipped from then on. A
      // result that was still being worked out can grow in place, so its dropped words are
      // remembered instead, and left off the front of it if it comes back longer.
      let skip = 0;
      let droppedTail = '';
      let leadingFinals = 0; // how many results at the front of the last report were final
      let tail = ''; // the words after them, in the last report
      let reported = ''; // the last words given to `onInterim`
      let instance: RecognitionLike | null = null;
      let sessionStartedAt = 0;
      let sessionHadWords = false; // the running session has produced words (not just empty results)
      let failedSessions = 0; // sessions in a row that ended without showing the recogniser works
      let lastFailure: CaptureFailure = UNKNOWN; // what to report if they keep ending
      let endpointTimer: ReturnType<typeof setTimeout> | undefined;
      let limitTimer: ReturnType<typeof setTimeout> | undefined;
      let restartTimer: ReturnType<typeof setTimeout> | undefined;
      let finishTimer: ReturnType<typeof setTimeout> | undefined;

      const close = () => {
        if (closed) return;
        closed = true;
        clearTimeout(endpointTimer);
        clearTimeout(limitTimer);
        clearTimeout(restartTimer);
        clearTimeout(finishTimer);
        release(instance);
        instance = null;
        if (closeOpenPass === close) closeOpenPass = null;
      };
      closeOpenPass = close;

      const words = () => tidy(`${kept} ${sessionWords}`);
      const onDeviceReady = () =>
        preferOnDevice && ctor !== null && recordFor(ctor, lang).status === 'ready';

      const reportListening = () => {
        if (listening || closed) return;
        listening = true;
        handlers.onListening?.();
      };
      const reportStart = () => {
        if (started || closed) return;
        reportListening();
        if (closed) return;
        started = true;
        // A very long turn is cut here and delivered, as the server's capture does. (Not while the
        // pass is only waiting for the last words after Done speaking: that already is the end.)
        if (!finishing) limitTimer = setTimeout(onLimit, CAPTURE_TUNING.maxUtteranceMs);
        handlers.onSpeechStart();
      };
      const fail = (failure: CaptureFailure) => {
        if (closed) return;
        close();
        handlers.onFailure(failure);
      };

      // The trainee's turn is over and what they said is delivered, once, and the pass is over.
      const deliver = (reason: SpeechEndReason) => {
        const text = words();
        reportStart();
        if (closed) return;
        handlers.onSpeechEnd({ reason });
        if (closed) return;
        close();
        handlers.onText(text);
      };
      // The pass is over and nothing is to be sent. `afterSpeech`: how the speech that was heard ended,
      // when it was heard but gave no words (otherwise nothing at all was heard).
      const nothing = (afterSpeech: SpeechEndReason | null) => {
        if (afterSpeech) {
          handlers.onSpeechEnd({ reason: afterSpeech });
          if (closed) return;
        }
        close();
        handlers.onNothing();
      };
      // Sound the browser never answered with words (a cough, a click), or answered with only a "hmm",
      // is not a turn. It is forgotten, nothing is sent, and the pass listens on as if it had not
      // happened. (Speech the browser itself gives up on is different: see `nothing`.)
      const quietDrop = () => {
        clearTimeout(endpointTimer);
        clearTimeout(limitTimer);
        endpointTimer = limitTimer = undefined;
        kept = '';
        sessionWords = '';
        // What was final is over for good. What was still being worked out may yet be finished off
        // (or grow into a sentence) in the same place, so it is remembered to be left off its front.
        skip = leadingFinals;
        droppedTail = tail;
        const wasStarted = started;
        started = false;
        if (reported) {
          reported = '';
          handlers.onInterim('');
          if (closed) return;
        }
        if (wasStarted) handlers.onSpeechDropped();
      };
      // Quiet for `endpointSilenceMs`: the turn is over, unless there was nothing in it.
      const onEndpoint = () => {
        endpointTimer = undefined;
        if (closed || finishing) return;
        if (isUsableTranscript(words())) deliver('silence');
        else quietDrop();
      };
      const onLimit = () => {
        limitTimer = undefined;
        if (closed || finishing) return;
        if (isUsableTranscript(words())) deliver('limit');
        else quietDrop();
      };
      // Every new word, and every sign that sound has started, gives the trainee a fresh
      // `endpointSilenceMs` before their turn is taken to be over. So does the end of a sound, if no
      // wait is already running: the browser says so a moment after the words stopped, and that
      // must not push the end of the turn later still.
      const armEndpoint = () => {
        if (finishing) return;
        clearTimeout(endpointTimer);
        endpointTimer = setTimeout(onEndpoint, CAPTURE_TUNING.endpointSilenceMs);
      };

      const onResult = (event: RecognitionResultEventLike) => {
        if (closed) return;
        // Browsers are not always tidy: a missing list or transcript counts as no words.
        const list = event.results as RecognitionResultEventLike['results'] | undefined;
        const total = list?.length ?? 0;
        // A list shorter than what was skipped is not the cumulative list this expects.
        if (total < skip) {
          skip = 0;
          droppedTail = '';
        }
        let text = '';
        let afterFinals = '';
        let finals = skip;
        let leading = true;
        let anyFinal = false;
        for (let i = skip; i < total; i++) {
          const result = list?.[i];
          const transcript: unknown = result?.[0]?.transcript;
          const piece = typeof transcript === 'string' ? transcript.trim() : '';
          const final = result?.isFinal === true;
          if (final) anyFinal = true;
          if (leading && final) finals = i + 1;
          else leading = false;
          if (!piece) continue;
          text = text ? `${text} ${piece}` : piece;
          if (!leading) afterFinals = afterFinals ? `${afterFinals} ${piece}` : piece;
        }
        leadingFinals = finals;
        tail = afterFinals;
        if (droppedTail) {
          const rest = withoutLeadingWords(text, droppedTail);
          // Where the words that were dropped come back longer, only what follows them is new. Where
          // the browser has changed its mind about them, what is there now is.
          if (rest === null) droppedTail = '';
          else text = rest;
        }
        const before = words();
        sessionWords = tidy(text);
        const now = words();
        // Words, not just an answer: an empty result shows that the browser replied, not that it works.
        if (sessionWords) {
          sessionHadWords = true;
          failedSessions = 0;
        }
        if (now) {
          reportStart();
          if (closed) return;
          // A final result that only repeats the words already shown is the browser making up its
          // mind, not the trainee speaking again, so it does not postpone the end of the turn.
          if (wordsOf(now) !== wordsOf(before)) armEndpoint();
        } else if (anyFinal && started) {
          // Edge answers speech it could make nothing of with one final result that has no words in
          // it. That is speech that gave no words, never an empty message.
          if (finishing) completeFinish();
          else nothing('silence');
          return;
        }
        if (now !== reported) {
          reported = now;
          handlers.onInterim(now);
        }
      };

      // The running session is over, by itself or because it was given up on. What it heard is kept.
      const retireSession = () => {
        kept = tidy(`${kept} ${sessionWords}`);
        sessionWords = '';
        skip = 0;
        droppedTail = '';
        leadingFinals = 0;
        tail = '';
        release(instance);
        instance = null;
      };
      // The browser ended a session while the pass is still wanted: start another a moment later,
      // unless sessions keep ending without showing that the recogniser works. A session shows it by
      // producing words, by ending with the browser's own "no speech" (a quiet room: a call can be
      // quiet for ever, so that never counts against the pass, however soon it comes), or by living
      // long enough before it ends by itself. One that ended with an error did not, however long it
      // lived, and neither did one that ended by itself almost at once without a word.
      // `ending` is the error it ended with, 'quiet' for "no speech", or null when it just ended.
      const sessionEnded = (ending: CaptureFailure | 'quiet' | null) => {
        const lived = Date.now() - sessionStartedAt;
        retireSession();
        if (
          ending === 'quiet' ||
          (ending === null && (sessionHadWords || lived >= CAPTURE_TUNING.recognitionMinLifeMs))
        ) {
          failedSessions = 0;
        } else {
          failedSessions++;
          lastFailure = ending ?? UNKNOWN;
        }
        // Words that are waiting for the end of the turn are delivered first, then the failure shows.
        if (
          failedSessions >= CAPTURE_TUNING.recognitionMaxFailedSessions &&
          !isUsableTranscript(words())
        ) {
          fail(lastFailure);
          return;
        }
        restartTimer = setTimeout(() => {
          restartTimer = undefined;
          startSession(onDeviceReady());
        }, CAPTURE_TUNING.recognitionRestartMs);
      };

      // Done speaking has had its answer, or has waited long enough for one: what is held is the turn.
      const completeFinish = () => {
        clearTimeout(finishTimer);
        finishTimer = undefined;
        if (closed) return;
        if (isUsableTranscript(words())) deliver('stopped');
        else nothing(started ? 'stopped' : null);
      };

      const startSession = (onDevice: boolean): void => {
        if (!ctor || closed) return;
        let next: RecognitionLike;
        try {
          next = new ctor();
        } catch {
          queueMicrotask(() => fail(UNSUPPORTED));
          return;
        }
        instance = next;
        sessionHadWords = false;
        sessionStartedAt = Date.now();
        next.lang = lang;
        next.interimResults = true;
        next.continuous = true;
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
        const live = () => !closed && instance === next;
        // The recognising service started, and then the browser began to capture audio: either is
        // the sign that the microphone is open. (Not every engine reports both.)
        next.onstart = () => {
          if (live()) reportListening();
        };
        next.onaudiostart = () => {
          if (live()) reportListening();
        };
        next.onspeechstart = () => {
          if (!live()) return;
          reportStart();
          if (!closed) armEndpoint();
        };
        next.onspeechend = () => {
          // The browser says the sound ended a moment after the words did. A wait for the end of the
          // turn that is already running is not started again from here.
          if (live() && started && endpointTimer === undefined) armEndpoint();
        };
        next.onresult = (event) => {
          if (live()) onResult(event);
        };
        next.onerror = (event) => {
          if (!live()) return;
          if (
            local &&
            (event.error === 'service-not-allowed' || event.error === 'language-not-supported')
          ) {
            // On-device recognition was refused after all (the speech pack is missing or was
            // removed). Use the browser's default engine instead, without calling it a failure.
            recordFor(ctor, lang).status = 'unavailable';
            if (finishing) {
              completeFinish();
              return;
            }
            retireSession();
            startSession(false);
            return;
          }
          const outcome = mapRecognitionError(event.error);
          if (finishing) {
            // Nothing is started again after Done speaking: the words the session had are the turn,
            // unless the error means it could not hear the trainee at all.
            if (outcome === 'no-speech' || outcome === 'aborted' || isUsableTranscript(words()))
              completeFinish();
            else fail(outcome);
            return;
          }
          // Quiet is normal: the browser ends a session by itself after a while without speech, and
          // that never counts against the pass. An abandoned session and a network error may pass,
          // but each counts however long the session lived, and a recogniser that keeps failing is
          // caught by the restart limit. Anything else cannot be mended by trying again.
          if (outcome === 'no-speech') sessionEnded('quiet');
          else if (outcome === 'aborted') sessionEnded(UNKNOWN);
          else if (outcome.kind === 'service' && outcome.reason === 'network')
            sessionEnded(outcome);
          else fail(outcome);
        };
        next.onend = () => {
          if (!live()) return;
          if (finishing) {
            completeFinish();
            return;
          }
          // A session that ends by itself after sound, with no result and no error, is what Chrome
          // does when it could make nothing of speech: that is speech that gave no words. Quiet
          // alone, or sound that was already let go of as not a turn, is only a session to restart.
          if (started && !words()) nothing('silence');
          else sessionEnded(null);
        };
        try {
          next.start();
        } catch (error) {
          release(next);
          instance = null;
          // A session that has not finished stopping refuses a new one: the next try may work.
          if (isInvalidState(error)) sessionEnded(UNKNOWN);
          else queueMicrotask(() => fail(UNKNOWN));
          return;
        }
        setMode(local ? 'on-device' : isChromiumBrowser() ? 'browser-service' : 'unknown');
      };

      if (!ctor) queueMicrotask(() => fail(UNSUPPORTED));
      else startSession(onDeviceReady());

      return {
        // "Done speaking": the browser is asked to stop (not to abandon the session), because it then
        // hands back the words it had caught but not yet turned into text. The turn is delivered
        // when the session ends, fails, or has been given `recognitionStopWaitMs`.
        finish() {
          if (closed || finishing) return;
          const running = instance;
          // Between two of the browser's sessions nothing is running to wait for.
          if (!running) {
            completeFinish();
            return;
          }
          finishing = true;
          clearTimeout(endpointTimer);
          clearTimeout(limitTimer);
          clearTimeout(restartTimer);
          endpointTimer = limitTimer = restartTimer = undefined;
          try {
            running.stop();
          } catch {
            completeFinish();
            return;
          }
          finishTimer = setTimeout(completeFinish, CAPTURE_TUNING.recognitionStopWaitMs);
        },
        cancel: close,
      };
    },
    dispose() {
      closeOpenPass?.();
    },
  };
}
