import type { PublicStateDTO, SendMessageResponse, SessionDTO } from '#shared/domain/api.ts';
import {
  DEFAULT_SPEECH_LANGUAGE,
  SPEECH_LANGUAGES,
  type SpeechLanguage,
} from '#shared/domain/speech.ts';
import { MAX_MESSAGE_CHARS } from '#shared/domain/text.ts';
import { api, isAbort } from '../../lib/api.ts';
import {
  acquireMicrophone,
  mapMicrophoneError,
  type MicrophoneHandle,
} from '../voice/capture/microphone.ts';
import { LEVEL_INTERVAL_MS, smoothLevel } from '../voice/capture/levels.ts';
import { createRecognitionCapture, type RecognitionCapture } from '../voice/capture/recognition.ts';
import { createServerCapture } from '../voice/capture/server-capture.ts';
import { MicrophoneError, type Capture, type CaptureSession } from '../voice/capture/types.ts';
import { createBrowserPlayback } from '../voice/playback/browser-playback.ts';
import { createServerPlayback } from '../voice/playback/server-playback.ts';
import type { Playback, PlaybackJob } from '../voice/playback/types.ts';
import { speakTurnWithVoice } from '../voice/speech-client.ts';
import {
  browserFamily,
  chooseCapture,
  choosePlayback,
  detectFeatures,
  isChromiumBrowser,
  type CaptureKind,
  type PlaybackKind,
} from '../voice/support.ts';
import {
  createTranscriber,
  type TranscribeOutcome,
  type Transcriber,
} from '../voice/transcriber.ts';
import { createTurnGate, gatePlayback, guardCapture, type TurnGate } from '../voice/turn-taking.ts';
import { announcementFor, listeningAnnouncement, type Announcement } from './announce.ts';
import type {
  CallActions,
  CallSnapshot,
  CallStatePoint,
  CallTurn,
  UseCallOptions,
} from './contract.ts';
import {
  classifyCaptureFailure,
  classifyEndError,
  classifyLoadError,
  classifySendError,
  CONFLICT_RETRY_DELAYS_MS,
  failureFromVoice,
  isRetryableConflict,
} from './errors.ts';
import { hintText } from './hints.ts';
import { newId, sleep } from './ids.ts';
import {
  checkSend,
  initialState,
  isCurrentSend,
  isCurrentTranscription,
  isTranscriptionProblem,
  reduce,
  targets,
  TIMINGS,
  type Exchange,
  type MachineEvent,
  type MachineState,
  type MicReason,
  type ProblemState,
  type Targets,
} from './machine.ts';
import { describeProblem } from './problems.ts';
import { stageOf } from './stage.ts';
import { describeCallSupport } from './support.ts';
import {
  appendStatePoint,
  applyReply,
  exchangeTurn,
  initialStateHistory,
  statePoint,
  turnsFromSession,
  withInterrupted,
} from './transcript.ts';

// The call engine: it owns one call's session, transcript, timers and every browser resource, and
// publishes a snapshot for the call screen. It holds no rules of its own. Everything that happens
// (a click, audio from the microphone, a reply from the server, a timer) becomes an event for the
// pure machine, and after every event `sync` makes the world match what the machine says it should
// be (`targets`): the microphone held or released, an utterance recorded, a customer voice playing,
// a request in flight, a timer running. Each of those is idempotent, so a missed or repeated call can
// never leave two recordings or two voices behind.

export interface CallController {
  subscribe(listener: () => void): () => void;
  getSnapshot(): CallSnapshot;
  readonly actions: CallActions;
  /** The latest options from the screen (the server's speech capabilities may arrive late). */
  setOptions(options: UseCallOptions): void;
  /** Loads the session. */
  attach(): void;
  /** Stops and releases everything and returns to the start. Safe to follow with `attach`. */
  detach(): void;
}

/** What the server accepts, less a margin so rounding never makes a recording too long. */
const MAX_UTTERANCE_MARGIN_MS = 100;

type Resolver = (accepted: boolean) => void;

// The screen may build its options anew on every render. Only a real change matters, and acting on
// anything else would publish a new snapshot, and so another render, for ever.
function sameOptions(a: UseCallOptions, b: UseCallOptions): boolean {
  const x = a.serverSpeech;
  const y = b.serverSpeech;
  return (
    a.maxTraineeTurns === b.maxTraineeTurns &&
    x.provider === y.provider &&
    x.label === y.label &&
    x.transcribe === y.transcribe &&
    x.synthesize === y.synthesize &&
    x.limits?.maxAudioSeconds === y.limits?.maxAudioSeconds
  );
}

interface Store {
  loading: boolean;
  loadProblem: ProblemState | null;
  session: SessionDTO | null;
  confirmed: CallTurn[];
  customerState: PublicStateDTO | null;
  stateHistory: CallStatePoint[];
  turnsRemaining: number | null;
  interim: string;
  micLevel: number;
  customerLevel: number;
  elapsed: number;
  language: SpeechLanguage;
  captureKind: CaptureKind;
  playbackKind: PlaybackKind;
  voice: {
    name: string | null;
    style: string | null;
    local: boolean | null;
    lang: string | null;
    /** A reply has been spoken, so the details above are what really spoke. */
    spoken: boolean;
  };
  announcement: ({ id: number } & Announcement) | null;
}

export function createCallController(
  sessionId: string,
  initialOptions: UseCallOptions,
): CallController {
  let options = initialOptions;
  let machine: MachineState = initialState();
  let features = detectFeatures();
  let store: Store = freshStore();
  let attached = false;
  // Whose turn it is to make sound. The capture and the playback are both wrapped by it, so the
  // microphone never opens while the customer's voice is wanted or has only just stopped, whatever
  // asks it to: the machine refuses too, and this is the part that holds even if it were wrong.
  let gate: TurnGate = createTurnGate();

  function freshStore(): Store {
    features = detectFeatures();
    return {
      loading: true,
      loadProblem: null,
      session: null,
      confirmed: [],
      customerState: null,
      stateHistory: [],
      turnsRemaining: null,
      interim: '',
      micLevel: 0,
      customerLevel: 0,
      elapsed: 0,
      language: options.language ?? DEFAULT_SPEECH_LANGUAGE,
      captureKind: chooseCapture(options.serverSpeech, features),
      playbackKind: choosePlayback(options.serverSpeech, features),
      voice: { name: null, style: null, local: null, lang: null, spoken: false },
      announcement: null,
    };
  }

  // ---- snapshot --------------------------------------------------------------------------

  const listeners = new Set<() => void>();
  let snapshot: CallSnapshot;
  let announcementSeq = 0;
  let turnsCache: {
    confirmed: CallTurn[];
    exchange: Exchange | null;
    interrupted: readonly number[];
    interim: string;
    value: CallTurn[];
  } | null = null;
  let problemCache: { source: ProblemState | null; value: CallSnapshot['problem'] } | null = null;
  const phaseWaiters = new Set<() => void>();

  function turnsView(): CallTurn[] {
    const exchange = machine.exchange;
    const interim = exchange?.status === 'transcribing' ? store.interim : '';
    const cache = turnsCache;
    if (
      cache &&
      cache.confirmed === store.confirmed &&
      cache.exchange === exchange &&
      cache.interrupted === machine.interrupted &&
      cache.interim === interim
    ) {
      return cache.value;
    }
    const confirmed = withInterrupted(store.confirmed, machine.interrupted);
    const value = exchange ? [...confirmed, exchangeTurn(exchange, interim)] : confirmed;
    turnsCache = {
      confirmed: store.confirmed,
      exchange,
      interrupted: machine.interrupted,
      interim,
      value,
    };
    return value;
  }

  function problemView(): CallSnapshot['problem'] {
    if (problemCache && problemCache.source === machine.problem) return problemCache.value;
    const source = machine.problem;
    const value = source
      ? describeProblem(source.code, { browser: browserFamily(), ...source.context })
      : null;
    problemCache = { source, value };
    return value;
  }

  function buildSnapshot(): CallSnapshot {
    const recognition = mic.recognition;
    return {
      loading: store.loading,
      loadProblem: store.loadProblem
        ? describeProblem(store.loadProblem.code, store.loadProblem.context)
        : null,
      session: store.session,
      phase: machine.phase,
      stage: stageOf(machine),
      mode: machine.voice ? 'voice' : 'text',
      microphone: machine.microphone,
      muted: machine.muted,
      paused: machine.paused,
      handsFree: machine.handsFree,
      audio:
        store.playbackKind === 'none' ? 'none' : machine.begun && !machine.canSpeak ? 'off' : 'on',
      speechDetected: machine.speechDetected,
      micOpen: machine.phase === 'listening' && pass.open,
      micLevel: store.micLevel,
      customerLevel: store.customerLevel,
      interim: store.interim,
      turns: turnsView(),
      customerState: store.customerState,
      stateHistory: store.stateHistory,
      problem: problemView(),
      hint: machine.hint ? hintText(machine.hint) : null,
      elapsedSeconds: store.elapsed,
      turnsRemaining: store.turnsRemaining,
      support: describeCallSupport({
        speech: options.serverSpeech,
        features,
        capture: store.captureKind,
        playback: store.playbackKind,
        recognitionMode: recognition?.mode() ?? 'unknown',
        chromium: isChromiumBrowser(),
        language: store.language,
        voice: store.voice.spoken
          ? { name: store.voice.name, lang: store.voice.lang, local: store.voice.local }
          : null,
      }),
      voiceDetails: { voice: store.voice.name, style: store.voice.style, language: store.language },
      announcement: store.announcement,
    };
  }

  function emit(): void {
    snapshot = buildSnapshot();
    for (const listener of [...listeners]) listener();
    if (machine.phase !== 'requesting-microphone') {
      for (const waiter of [...phaseWaiters]) waiter();
      phaseWaiters.clear();
    }
  }

  // ---- the machine and the world ---------------------------------------------------------

  // Events are handled strictly one after another, and in the order they were raised, even when one
  // is raised while another is being handled (`sync` starts things that can answer at once). Work
  // that must see the state after earlier events (a recording that arrives straight after the
  // event that ends it) is queued the same way.
  const queue: Array<MachineEvent | (() => void)> = [];
  let draining = false;

  function dispatch(event: MachineEvent): void {
    enqueue(event);
  }

  function later(work: () => void): void {
    enqueue(work);
  }

  function enqueue(item: MachineEvent | (() => void)): void {
    queue.push(item);
    if (draining) return;
    draining = true;
    try {
      for (let next = queue.shift(); next; next = queue.shift()) {
        if (typeof next === 'function') next();
        else apply(next);
      }
    } finally {
      draining = false;
    }
  }

  function apply(event: MachineEvent): void {
    const previous = machine;
    const next = reduce(previous, event);
    if (next === previous) return;
    machine = next;
    const said = announcementFor(previous, next);
    if (said) store.announcement = { id: ++announcementSeq, ...said };
    if (next.phase !== 'listening' && next.phase !== 'transcribing') store.interim = '';
    sync();
    settleResolvers();
    settleEnd(previous, next);
    if (next.phase === 'completed') releasePlayback();
    emit();
  }

  /** Lets go of the audio element, the audio context and any speech: the call is over. */
  function releasePlayback(): void {
    speaking.job?.stop();
    speaking.job = null;
    speaking.token = null;
    speaking.turnIndex = null;
    speaking.engine?.dispose();
    speaking.engine = null;
    setCustomerLevel(0);
  }

  function sync(): void {
    const want = targets(machine);
    // First let go of whatever is no longer wanted, so that nothing ever overlaps...
    stopPlayback(want);
    stopCapture(want);
    stopTranscription(want);
    stopSend(want);
    stopEnd(want);
    syncTimer(want);
    // ...then start what is wanted.
    syncMicrophone(want);
    startCapture(want);
    startPlayback(want);
    startTranscription(want);
    startSend(want);
    startEnd(want);
    syncMeter();
  }

  // ---- timers ----------------------------------------------------------------------------

  let timer: { id: number; handle: ReturnType<typeof setTimeout> } | null = null;

  function syncTimer(want: Targets): void {
    if ((timer?.id ?? null) === (want.timer?.id ?? null)) return;
    if (timer) clearTimeout(timer.handle);
    timer = null;
    const wanted = want.timer;
    if (!wanted) return;
    const handle = setTimeout(() => {
      if (timer?.id !== wanted.id) return;
      timer = null;
      dispatch({ type: 'timeout', id: wanted.id });
    }, wanted.ms);
    timer = { id: wanted.id, handle };
  }

  // ---- the microphone --------------------------------------------------------------------

  const mic: {
    status: 'none' | 'acquiring' | 'held';
    handle: MicrophoneHandle | null;
    attempt: { cancelled: boolean; abort: AbortController } | null;
    offEnded: (() => void) | null;
    /** The capture that listens, behind the turn gate. */
    capture: Capture | null;
    /** The browser's own recognition, when that is what listens (it reports where it runs). */
    recognition: RecognitionCapture | null;
    /** Browser recognition, made inside the click so it can get on-device recognition ready. */
    prepared: RecognitionCapture | null;
  } = {
    status: 'none',
    handle: null,
    attempt: null,
    offEnded: null,
    capture: null,
    recognition: null,
    prepared: null,
  };

  function newRecognition(): RecognitionCapture {
    const created = createRecognitionCapture({
      language: () => store.language,
      onModeChange: () => emit(),
    });
    created.prepare();
    return created;
  }

  function recognitionCapture(): RecognitionCapture {
    const prepared = mic.prepared;
    mic.prepared = null;
    return prepared ?? newRecognition();
  }

  function maxUtteranceMs(): number {
    const seconds = options.serverSpeech.limits?.maxAudioSeconds ?? 30;
    return Math.max(5000, Math.min(30_000, seconds * 1000) - MAX_UTTERANCE_MARGIN_MS);
  }

  function deny(reason: MicReason): void {
    mic.status = 'none';
    mic.attempt = null;
    dispatch({ type: 'permission-denied', reason });
  }

  function syncMicrophone(want: Targets): void {
    if (!want.microphone) {
      releaseMicrophone();
      return;
    }
    if (mic.status === 'none') acquireNow();
    else if (mic.status === 'held') mic.handle?.setEnabled(want.trackEnabled);
  }

  function acquireNow(): void {
    features = detectFeatures();
    let kind = store.captureKind;
    if (kind === 'none' || !features.secureContext) {
      mic.status = 'acquiring';
      deny('unsupported');
      return;
    }
    const attempt = { cancelled: false, abort: new AbortController() };
    mic.status = 'acquiring';
    mic.attempt = attempt;

    if (!features.microphone) {
      // The browser's own recognition can ask for the microphone by itself.
      const recognition = recognitionCapture();
      mic.recognition = recognition;
      mic.capture = guardCapture(recognition, gate);
      mic.status = 'held';
      mic.attempt = null;
      dispatch({ type: 'permission-granted' });
      return;
    }

    acquireMicrophone({ worklet: kind === 'server-speech', signal: attempt.abort.signal })
      .then((handle) => {
        if (attempt.cancelled) {
          handle.release();
          return;
        }
        let engine: Capture | null = null;
        let recognition: RecognitionCapture | null = null;
        if (kind === 'server-speech') {
          if (handle.worklet) {
            engine = createServerCapture({ microphone: handle, maxUtteranceMs: maxUtteranceMs() });
          } else {
            // The worklet could not be loaded: use the browser's recognition if there is any.
            kind = features.recognition ? 'browser-recognition' : 'none';
          }
        }
        if (kind === 'browser-recognition') {
          recognition = recognitionCapture();
          engine = recognition;
        }
        if (!engine) {
          handle.release();
          store.captureKind = 'none';
          deny('unsupported');
          return;
        }
        store.captureKind = kind;
        mic.handle = handle;
        mic.recognition = recognition;
        mic.capture = guardCapture(engine, gate);
        mic.status = 'held';
        mic.attempt = null;
        mic.offEnded = handle.onEnded(() => dispatch({ type: 'mic-lost' }));
        handle.setEnabled(!machine.muted);
        dispatch({ type: 'permission-granted' });
      })
      .catch((error: unknown) => {
        if (attempt.cancelled) return;
        deny(error instanceof MicrophoneError ? error.reason : mapMicrophoneError(error));
      });
  }

  function releaseMicrophone(): void {
    if (mic.status === 'none') return;
    if (mic.attempt) {
      mic.attempt.cancelled = true;
      mic.attempt.abort.abort();
    }
    mic.attempt = null;
    cancelCapturePass();
    mic.capture?.dispose();
    mic.capture = null;
    mic.recognition = null;
    mic.offEnded?.();
    mic.offEnded = null;
    mic.handle?.release();
    mic.handle = null;
    mic.status = 'none';
    setMicLevel(0);
  }

  // ---- capture ---------------------------------------------------------------------------

  const pass: {
    session: CaptureSession | null;
    id: number;
    finishRequested: boolean;
    language: SpeechLanguage | null;
    utterance: string | null;
    /** The capture said the microphone is really open for this pass (`onListening`). */
    open: boolean;
  } = {
    session: null,
    id: 0,
    finishRequested: false,
    language: null,
    utterance: null,
    open: false,
  };
  let pendingAudio: { id: string; blob: Blob } | null = null;
  /** A pass that was refused because it was not yet the trainee's turn is tried again then. */
  let listenRetry: ReturnType<typeof setTimeout> | null = null;

  function clearListenRetry(): void {
    if (listenRetry !== null) clearTimeout(listenRetry);
    listenRetry = null;
  }

  function cancelCapturePass(): void {
    if (pass.session) pass.session.cancel();
    clearListenRetry();
    pass.session = null;
    pass.id++;
    pass.finishRequested = false;
    pass.language = null;
    pass.utterance = null;
    pass.open = false;
  }

  function stopCapture(want: Targets): void {
    if (want.capture === 'off') {
      if (pass.session) cancelCapturePass();
      return;
    }
    if (
      pass.session &&
      want.capture === 'listen' &&
      mic.capture?.engine === 'browser-recognition'
    ) {
      // The language changed while listening: the recogniser takes it when a pass starts.
      if (pass.language !== store.language) cancelCapturePass();
    }
  }

  function startCapture(want: Targets): void {
    if (want.capture === 'off') return;
    if (!pass.session) {
      if (want.capture !== 'listen') return;
      const engine = mic.capture;
      if (!engine) {
        dispatch({
          type: 'transcribe-failed',
          id: null,
          failure: { kind: 'microphone', reason: 'unsupported' },
        });
        return;
      }
      const mine = ++pass.id;
      const current = () => pass.id === mine;
      pass.finishRequested = false;
      pass.language = store.language;
      pass.utterance = null;
      pass.open = false;
      pass.session = engine.listen({
        onListening: () => {
          if (!current()) return;
          // Only now may the screen say "Listening": the recording indicator is on.
          pass.open = true;
          const said = listeningAnnouncement();
          if (said) store.announcement = { id: ++announcementSeq, ...said };
          emit();
        },
        onBlocked: () => {
          later(() => {
            if (!current()) return;
            // It is not yet the trainee's turn to make sound (the customer's voice has only just
            // stopped), so nothing was opened: the pass is tried again when it is.
            pass.session = null;
            pass.id++;
            const wait = gate.waitMs();
            if (!Number.isFinite(wait)) return;
            clearListenRetry();
            listenRetry = setTimeout(() => {
              listenRetry = null;
              later(() => sync());
            }, wait + 10);
          });
        },
        onSpeechStart: () => {
          if (current()) dispatch({ type: 'speech-start' });
        },
        onSpeechEnd: ({ reason }) => {
          if (!current()) return;
          const id = newId();
          pass.utterance = id;
          dispatch({ type: 'speech-end', id, createdAt: new Date().toISOString(), reason });
        },
        onSpeechDropped: () => {
          if (current()) dispatch({ type: 'speech-dropped' });
        },
        onInterim: (text) => {
          if (!current()) return;
          store.interim = text;
          emit();
        },
        onAudio: (blob) => {
          later(() => {
            const id = pass.utterance;
            if (!current() || !id || !isCurrentTranscription(machine, id)) return;
            pendingAudio = { id, blob };
            sync();
          });
        },
        onText: (text) => {
          later(() => {
            const id = pass.utterance;
            if (current() && id) dispatch({ type: 'transcribe-done', id, text });
          });
        },
        onNothing: () => {
          later(() => {
            if (!current()) return;
            const id = pass.utterance;
            if (id && isCurrentTranscription(machine, id))
              dispatch({ type: 'transcribe-empty', id });
            else dispatch({ type: 'nothing-heard' });
          });
        },
        onFailure: (failure) => {
          later(() => {
            if (!current()) return;
            const id = pass.utterance;
            dispatch({
              type: 'transcribe-failed',
              id: id && isCurrentTranscription(machine, id) ? id : null,
              failure: classifyCaptureFailure(failure),
            });
          });
        },
      });
    }
    if (want.capture === 'finish' && machine.finishing && !pass.finishRequested && pass.session) {
      pass.finishRequested = true;
      pass.session.finish();
    }
  }

  // ---- turning speech into text ----------------------------------------------------------

  // One utterance is turned into words once, under its id, however often it is asked for: the
  // transcriber shares a request that is running, remembers an answer it already has, gives up after
  // a timeout, and holds the recording only while Retry could still send it again.
  let transcriber: Transcriber = newTranscriber();
  /** The utterance being turned into text now. */
  let transcribing: string | null = null;
  /** The utterance whose recording is kept for Retry, after a failure that sending again could fix. */
  let kept: string | null = null;

  function newTranscriber(): Transcriber {
    return createTranscriber({
      transcribe: (audio, language, signal) => api.transcribe(audio, language, signal),
      // A little before the machine's own deadline, so the failure that comes back can keep the recording.
      timeoutMs: TIMINGS.transcribe - 1000,
    });
  }

  function stopTranscription(want: Targets): void {
    if (transcribing && transcribing !== want.transcribe) {
      transcriber.discard(transcribing);
      transcribing = null;
    }
    // Audio that is no longer wanted is dropped, so it can be garbage collected.
    if (pendingAudio && pendingAudio.id !== want.transcribe) pendingAudio = null;
    // A recording is only worth keeping while the problem that Retry would fix is on the screen.
    if (kept && kept !== want.transcribe && !isTranscriptionProblem(machine.problem)) {
      transcriber.discard(kept);
      kept = null;
    }
  }

  function startTranscription(want: Targets): void {
    const id = want.transcribe;
    if (!id || transcribing === id) return;
    let work: Promise<TranscribeOutcome | null>;
    if (pendingAudio?.id === id) {
      const audio = pendingAudio.blob;
      pendingAudio = null;
      work = transcriber.run(id, audio, store.language);
    } else if (kept === id) {
      work = transcriber.retry(id);
    } else {
      return;
    }
    transcribing = id;
    void work.then((outcome) => settleTranscription(id, outcome));
  }

  function settleTranscription(id: string, outcome: TranscribeOutcome | null): void {
    if (transcribing !== id) return;
    transcribing = null;
    if (outcome?.kind === 'cancelled') return;
    if (!isCurrentTranscription(machine, id)) {
      transcriber.discard(id);
      return;
    }
    // Nothing left to send again (the recording was let go): the trainee speaks again.
    if (outcome === null) {
      kept = null;
      dispatch({ type: 'transcribe-failed', id, failure: { kind: 'failed' } });
      return;
    }
    switch (outcome.kind) {
      case 'transcript':
        kept = null;
        dispatch({ type: 'transcribe-done', id, text: outcome.text });
        return;
      case 'no-speech':
        kept = null;
        dispatch({ type: 'transcribe-empty', id });
        return;
      case 'failed':
        // Words that were only filler sounds are the same as hearing nothing.
        if (outcome.error.code === 'poor-transcription') {
          kept = null;
          dispatch({ type: 'transcribe-empty', id });
          return;
        }
        kept = transcriber.holds(id) ? id : null;
        dispatch({ type: 'transcribe-failed', id, failure: failureFromVoice(outcome.error) });
        return;
    }
  }

  // ---- sending ---------------------------------------------------------------------------

  let sending: { id: string; attempt: number; controller: AbortController } | null = null;
  const resolvers = new Map<string, Resolver>();

  function resolveSend(id: string, accepted: boolean): void {
    const resolve = resolvers.get(id);
    if (!resolve) return;
    resolvers.delete(id);
    resolve(accepted);
  }

  // A message that stays in the transcript as failed was still taken in: its sender is not told "no".
  function settleResolvers(): void {
    const exchange = machine.exchange;
    for (const id of [...resolvers.keys()]) {
      if (exchange?.id === id && exchange.status === 'failed') resolveSend(id, true);
    }
  }

  function stopSend(want: Targets): void {
    if (!sending) return;
    if (want.send && want.send.id === sending.id && want.send.attempt === sending.attempt) return;
    sending.controller.abort();
    sending = null;
  }

  async function sendWithRetries(
    exchange: Exchange,
    signal: AbortSignal,
  ): Promise<SendMessageResponse> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await api.sendMessage(
          sessionId,
          { text: exchange.text, clientMessageId: exchange.id, inputMode: exchange.inputMode },
          signal,
        );
      } catch (error) {
        const wait = CONFLICT_RETRY_DELAYS_MS[attempt];
        if (isAbort(error) || !isRetryableConflict(error) || wait === undefined) throw error;
        await sleep(wait, signal);
      }
    }
  }

  function startSend(want: Targets): void {
    const target = want.send;
    const exchange = machine.exchange;
    if (!target || sending || !exchange || exchange.id !== target.id) return;
    const job = { id: target.id, attempt: target.attempt, controller: new AbortController() };
    sending = job;
    sendWithRetries(exchange, job.controller.signal).then(
      (response) => {
        if (sending !== job) return;
        sending = null;
        if (!isCurrentSend(machine, job.id, job.attempt)) return;
        applyResponse(response, exchange);
        resolveSend(job.id, true);
        dispatch({
          type: 'send-done',
          id: job.id,
          attempt: job.attempt,
          customerIndex: response.customerTurn.index,
          turnsRemaining: response.turnsRemaining,
          redactions: response.redactions,
        });
      },
      (error: unknown) => {
        if (isAbort(error) || sending !== job) return;
        sending = null;
        if (!isCurrentSend(machine, job.id, job.attempt)) return;
        const failure = classifySendError(error);
        const refused =
          failure.kind === 'validation' ||
          failure.kind === 'turn-limit' ||
          failure.kind === 'session-ended';
        resolveSend(job.id, !refused);
        dispatch({ type: 'send-failed', id: job.id, attempt: job.attempt, failure });
      },
    );
  }

  /** Puts the server's answer into the transcript, the mood trace and the counters, once. */
  function applyResponse(response: SendMessageResponse, exchange: Exchange): void {
    store.confirmed = applyReply(store.confirmed, response, exchange);
    store.customerState = response.state;
    store.stateHistory = appendStatePoint(
      store.stateHistory,
      statePoint(response.customerTurn.index, response.state),
    );
    store.turnsRemaining = response.turnsRemaining;
  }

  // ---- the customer's voice --------------------------------------------------------------

  const speaking: {
    engine: Playback | null;
    job: PlaybackJob | null;
    token: number | null;
    /** The customer turn the job speaks, so a cut-off can be said of the right one. */
    turnIndex: number | null;
  } = {
    engine: null,
    job: null,
    token: null,
    turnIndex: null,
  };

  function playbackEngine(kind: PlaybackKind): Playback | null {
    if (speaking.engine) return speaking.engine;
    let engine: Playback | null = null;
    if (kind === 'server-speech') {
      engine = createServerPlayback({
        // The chosen language goes to the server, which picks a voice for it. A voice the trainee
        // chose is named too; without one the request is the plain one it always was.
        speakTurn: (id, turnIndex, language, signal, speakOptions) =>
          speakOptions?.voice
            ? speakTurnWithVoice(id, turnIndex, language, signal, speakOptions)
            : api.speakTurn(id, turnIndex, language, signal),
      });
    } else if (kind === 'browser-synthesis') {
      engine = createBrowserPlayback();
    }
    // Behind the gate, so the microphone is shut from the moment the voice is asked for.
    speaking.engine = engine ? gatePlayback(engine, gate) : null;
    return speaking.engine;
  }

  function stopPlayback(want: Targets): void {
    if (speaking.token === null) return;
    if (want.playback && want.playback.token === speaking.token) return;
    const turnIndex = speaking.turnIndex;
    const stopped = speaking.job?.stop();
    speaking.job = null;
    speaking.token = null;
    speaking.turnIndex = null;
    setCustomerLevel(0);
    // The customer was cut off only if the voice was audible and had not ended: whatever made it
    // stop (Stop customer audio, typing, pausing), a voice that never began has nothing to cut off.
    if (stopped?.interrupted && turnIndex !== null) {
      dispatch({ type: 'customer-cut-off', turnIndex });
    }
  }

  function startPlayback(want: Targets): void {
    const target = want.playback;
    if (!target || speaking.token !== null) return;
    const token = target.token;
    speaking.token = token;
    speaking.turnIndex = target.turnIndex;
    const turn = store.confirmed.find(
      (candidate) => candidate.role === 'customer' && candidate.index === target.turnIndex,
    );
    const engine = playbackEngine(store.playbackKind);
    if (!turn || !engine) {
      dispatch({ type: 'speak-failed', token, reason: 'unavailable' });
      return;
    }
    const live = () => speaking.token === token;
    speaking.job = engine.play(
      {
        sessionId,
        turnIndex: turn.index ?? target.turnIndex,
        text: turn.text,
        language: store.language,
        mood: store.customerState?.band.id ?? 'calm',
        voiceSeed: store.session?.scenario.persona.name ?? sessionId,
        ...(options.voice ? { voice: options.voice } : {}),
      },
      {
        onStart: ({ estimateMs }) => {
          if (live()) dispatch({ type: 'speak-start', token, estimateMs });
        },
        onDuration: (ms) => {
          if (live()) dispatch({ type: 'speak-duration', token, ms });
        },
        onEnd: () => {
          if (live()) dispatch({ type: 'speak-end', token });
        },
        onBlocked: () => {
          if (live()) dispatch({ type: 'speak-blocked', token });
        },
        onFailure: (kind) => {
          if (live()) dispatch({ type: 'speak-failed', token, reason: kind });
        },
        onLevel: (level) => {
          if (live()) setCustomerLevel(level);
        },
        onDetails: (details) => {
          if (!live()) return;
          store.voice = {
            name: details.voice,
            style: details.style,
            local: details.local,
            lang: details.lang,
            spoken: true,
          };
          emit();
        },
      },
    );
  }

  // ---- meters ----------------------------------------------------------------------------

  let meter: ReturnType<typeof setInterval> | undefined;

  function setMicLevel(level: number): void {
    if (store.micLevel === level) return;
    store.micLevel = level;
    if (attached) emit();
  }

  function setCustomerLevel(level: number): void {
    if (store.customerLevel === level) return;
    store.customerLevel = level;
    if (attached) emit();
  }

  function syncMeter(): void {
    const listening = machine.phase === 'listening' && !machine.muted && mic.handle !== null;
    // The speech service's capture opens and closes its own tap on the microphone. The browser's
    // recogniser listens by itself, so the level meter's tap is switched here.
    if (mic.capture?.engine === 'browser-recognition') mic.handle?.setListening(listening);
    if (listening && meter === undefined) {
      meter = setInterval(() => {
        const handle = mic.handle;
        if (!handle) return;
        setMicLevel(smoothLevel(store.micLevel, handle.readLevel()));
      }, LEVEL_INTERVAL_MS);
    } else if (!listening && meter !== undefined) {
      clearInterval(meter);
      meter = undefined;
      setMicLevel(0);
    }
  }

  // ---- ending ----------------------------------------------------------------------------

  let ending: { controller: AbortController } | null = null;
  let endPromise: Promise<{ sessionId: string } | null> | null = null;
  let endResolve: ((value: { sessionId: string } | null) => void) | null = null;

  function stopEnd(want: Targets): void {
    if (want.end || !ending) return;
    ending.controller.abort();
    ending = null;
  }

  function startEnd(want: Targets): void {
    if (!want.end || ending) return;
    const job = { controller: new AbortController() };
    ending = job;
    (async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await api.endSession(sessionId);
        } catch (error) {
          const wait = CONFLICT_RETRY_DELAYS_MS[attempt];
          if (!isRetryableConflict(error) || wait === undefined) throw error;
          await sleep(wait, job.controller.signal);
        }
      }
    })().then(
      (session) => {
        if (ending !== job) return;
        ending = null;
        store.session = session;
        freezeElapsed(session);
        dispatch({ type: 'end-done' });
        const resolve = endResolve;
        endResolve = null;
        resolve?.({ sessionId: session.id });
      },
      (error: unknown) => {
        if (isAbort(error) || ending !== job) return;
        ending = null;
        dispatch({ type: 'end-failed', failure: classifyEndError(error) });
      },
    );
  }

  // Ending ended without completing (it failed, or its watchdog gave up): the caller is told "no",
  // and may ask again.
  function settleEnd(previous: MachineState, next: MachineState): void {
    if (previous.phase !== 'ending' || next.phase === 'ending' || next.phase === 'completed')
      return;
    const resolve = endResolve;
    endResolve = null;
    endPromise = null;
    resolve?.(null);
  }

  // ---- elapsed time ----------------------------------------------------------------------

  let clock: ReturnType<typeof setInterval> | undefined;

  function elapsedSince(session: SessionDTO): number {
    return Math.max(0, Math.floor((Date.now() - Date.parse(session.startedAt)) / 1000));
  }

  function startClock(session: SessionDTO): void {
    stopClock();
    store.elapsed = elapsedSince(session);
    if (session.status !== 'active') {
      store.elapsed = session.durationSeconds ?? store.elapsed;
      return;
    }
    clock = setInterval(() => {
      if (machine.phase === 'completed') {
        stopClock();
        return;
      }
      const seconds = elapsedSince(session);
      if (seconds !== store.elapsed) {
        store.elapsed = seconds;
        emit();
      }
    }, 1000);
  }

  function stopClock(): void {
    clearInterval(clock);
    clock = undefined;
  }

  function freezeElapsed(session: SessionDTO): void {
    stopClock();
    store.elapsed = session.durationSeconds ?? elapsedSince(session);
  }

  // ---- loading ---------------------------------------------------------------------------

  let loading: { controller: AbortController; done: Promise<void> } | null = null;

  function load(): Promise<void> {
    loading?.controller.abort();
    const controller = new AbortController();
    store.loading = true;
    store.loadProblem = null;
    emit();
    const done = api.getSession(sessionId, controller.signal).then(
      (session) => {
        if (controller.signal.aborted) return;
        applySession(session);
      },
      (error: unknown) => {
        if (isAbort(error) || controller.signal.aborted) return;
        store.loading = false;
        const kind = classifyLoadError(error);
        store.loadProblem = {
          code: kind === 'offline' ? 'offline' : 'session-unavailable',
          context: kind === 'not-found' ? { during: 'load', notFound: true } : { during: 'load' },
        };
        emit();
      },
    );
    loading = { controller, done };
    return done;
  }

  function applySession(session: SessionDTO): void {
    const max = options.maxTraineeTurns ?? null;
    const awaiting = session.awaitingReply;
    const awaitingTurn = awaiting
      ? session.turns.find((t) => t.index === awaiting.turnIndex)
      : undefined;
    const lastCustomer = session.turns.findLast((turn) => turn.role === 'customer');
    store.session = session;
    store.confirmed = turnsFromSession(session);
    store.customerState = session.state;
    store.stateHistory = initialStateHistory(session);
    store.turnsRemaining = max === null ? null : Math.max(0, max - session.traineeTurns);
    store.loading = false;
    store.loadProblem = null;
    startClock(session);
    const ended = session.status !== 'active';
    dispatch({
      type: 'loaded',
      lastCustomerIndex: lastCustomer?.index ?? null,
      awaiting:
        awaiting && awaitingTurn
          ? {
              id: awaiting.clientMessageId,
              text: awaitingTurn.text,
              createdAt: awaitingTurn.createdAt,
              inputMode: awaitingTurn.inputMode ?? 'text',
              turnIndex: awaiting.turnIndex,
            }
          : null,
      limitReached: !ended && max !== null && session.traineeTurns >= max,
      sessionEnded: ended,
    });
    emit();
  }

  // ---- actions ---------------------------------------------------------------------------

  /** Chooses who captures and who speaks, and gets playback ready: inside the click that began the call. */
  function prepareEngines(voice: boolean): void {
    features = detectFeatures();
    store.captureKind = chooseCapture(options.serverSpeech, features);
    store.playbackKind = choosePlayback(options.serverSpeech, features);
    if (speaking.engine && speaking.engine.engine !== playbackEngineFor(store.playbackKind)) {
      speaking.job?.stop();
      speaking.engine.dispose();
      speaking.engine = null;
    }
    // Priming plays a silent clip, so it is only done for a call that will be spoken; a typed call
    // can still replay a reply, and a browser that refuses is told so (and offered a Play button).
    if (voice) playbackEngine(store.playbackKind)?.prime();
    // On-device recognition can only be made ready from a gesture, so it is started here.
    if (voice && store.captureKind === 'browser-recognition') mic.prepared ??= newRecognition();
  }

  function playbackEngineFor(kind: PlaybackKind): Playback['engine'] | null {
    return kind === 'none' ? null : kind;
  }

  function begin({ voice }: { voice: boolean }): Promise<void> {
    if (!machine.loaded) {
      const pending = loading?.done ?? Promise.resolve();
      return pending.then(() => (machine.loaded ? begin({ voice }) : undefined));
    }
    const fresh = machine.phase === 'idle' && !machine.begun;
    const upgrade =
      machine.begun && !machine.voice && voice && machine.phase === 'ready-for-next-turn';
    if (fresh || upgrade) {
      prepareEngines(voice);
      const opening =
        store.session !== null &&
        store.session.traineeTurns === 0 &&
        machine.exchange === null &&
        machine.lastCustomerIndex !== null
          ? machine.lastCustomerIndex
          : null;
      dispatch({ type: 'begin', voice, canSpeak: store.playbackKind !== 'none', opening });
    }
    return machine.phase === 'requesting-microphone'
      ? new Promise<void>((resolve) => {
          phaseWaiters.add(resolve);
        })
      : Promise.resolve();
  }

  function sendText(raw: string): Promise<boolean> {
    const text = raw.trim();
    if (!text) {
      dispatch({ type: 'hint', hint: { code: 'empty' } });
      return Promise.resolve(false);
    }
    if (text.length > MAX_MESSAGE_CHARS) {
      dispatch({ type: 'hint', hint: { code: 'too-long' } });
      return Promise.resolve(false);
    }
    const check = checkSend(machine);
    if (check !== 'ok') {
      const hint =
        check === 'busy'
          ? ({ code: 'busy' } as const)
          : check === 'retry-first'
            ? ({ code: 'retry-first' } as const)
            : check === 'not-started'
              ? ({ code: 'not-started' } as const)
              : null;
      if (hint) dispatch({ type: 'hint', hint });
      return Promise.resolve(false);
    }
    const id = newId();
    const outcome = new Promise<boolean>((resolve) => resolvers.set(id, resolve));
    dispatch({ type: 'send-text', id, text, createdAt: new Date().toISOString() });
    if (machine.exchange?.id !== id) {
      resolvers.delete(id);
      return Promise.resolve(false);
    }
    return outcome;
  }

  function endCall(): Promise<{ sessionId: string } | null> {
    if (endPromise) return endPromise;
    const promise = new Promise<{ sessionId: string } | null>((resolve) => {
      endResolve = resolve;
    });
    endPromise = promise;
    dispatch({ type: 'end-requested' });
    // Ending is only ever refused when it is already under way, which the cached promise covers.
    if (machine.phase !== 'ending' && machine.phase !== 'completed' && endPromise === promise) {
      const resolve = endResolve;
      endResolve = null;
      endPromise = null;
      (resolve as ((value: null) => void) | null)?.(null);
    }
    return promise;
  }

  function retry(): void {
    if (store.loadProblem) {
      void load();
      return;
    }
    const problem = machine.problem;
    if (!problem) return;
    switch (describeProblem(problem.code, problem.context).retry) {
      case 'microphone':
        if (machine.begun) dispatch({ type: 'retry-microphone' });
        else void begin({ voice: true });
        return;
      case 'transcribe': {
        // A recording that was kept is sent again, as it was; otherwise the trainee says it again.
        const before = machine;
        if (kept && transcriber.holds(kept)) {
          dispatch({ type: 'transcribe-retry', id: kept, createdAt: new Date().toISOString() });
        }
        if (machine === before) dispatch({ type: 'talk' });
        return;
      }
      case 'send':
        dispatch({ type: 'retry-send' });
        return;
      case 'speak':
        dispatch({ type: 'replay' });
        return;
      case 'load':
        void load();
        return;
      case 'end':
        void endCall();
        return;
      case null:
        return;
    }
  }

  const actions: CallActions = {
    begin,
    talk: () => dispatch({ type: 'talk' }),
    stopTalking: () => dispatch({ type: 'stop-talking' }),
    toggleMute: () => dispatch({ type: 'toggle-mute' }),
    togglePause: () => dispatch({ type: 'toggle-pause' }),
    setHandsFree: (on) => dispatch({ type: 'set-hands-free', on }),
    setLanguage(language) {
      if (!SPEECH_LANGUAGES.includes(language) || language === store.language) return;
      store.language = language;
      sync();
      emit();
    },
    useText: () => dispatch({ type: 'use-text' }),
    setAudio: (on) => dispatch({ type: 'set-audio', on, available: store.playbackKind !== 'none' }),
    interrupt: () => dispatch({ type: 'interrupt' }),
    replay: () => dispatch({ type: 'replay' }),
    sendText,
    retry,
    dismissProblem: () => dispatch({ type: 'dismiss-problem' }),
    endCall,
  };

  // ---- coming back online ----------------------------------------------------------------

  // A message that could not be sent because the network was gone is sent again, by itself, the
  // moment the browser says it is back. It is the same message under the same id, so the server
  // never holds it twice. Anything else that failed for the same reason waits for the trainee.
  function onOnline(): void {
    const failed = machine.problem;
    if (failed?.code !== 'offline') return;
    if (describeProblem(failed.code, failed.context).retry === 'send') {
      dispatch({ type: 'retry-send' });
    }
  }

  // ---- leaving the page ------------------------------------------------------------------

  // Nothing is recorded out of sight. When the page is hidden a spoken call is paused, which lets go
  // of the microphone and stops the customer's voice; coming back does not open the microphone
  // again, Resume does. A typed call has no microphone, so there is nothing to pause.
  function onVisibility(): void {
    if (typeof document === 'undefined' || !document.hidden) return;
    if (machine.begun && machine.voice && !machine.paused) dispatch({ type: 'toggle-pause' });
  }

  // ---- lifecycle -------------------------------------------------------------------------

  function dispose(): void {
    if (typeof window !== 'undefined') window.removeEventListener('online', onOnline);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility);
    }
    loading?.controller.abort();
    loading = null;
    transcriber.dispose();
    transcriber = newTranscriber();
    transcribing = null;
    kept = null;
    pendingAudio = null;
    sending?.controller.abort();
    sending = null;
    ending?.controller.abort();
    ending = null;
    if (timer) clearTimeout(timer.handle);
    timer = null;
    clearInterval(meter);
    meter = undefined;
    stopClock();
    cancelCapturePass();
    releaseMicrophone();
    mic.prepared?.dispose();
    mic.prepared = null;
    releasePlayback();
    gate = createTurnGate();
    queue.length = 0;
    phaseWaiters.clear();
    for (const id of [...resolvers.keys()]) resolveSend(id, false);
    const resolve = endResolve;
    endResolve = null;
    endPromise = null;
    resolve?.(null);
  }

  snapshot = buildSnapshot();

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    actions,
    setOptions(next) {
      const unchanged = sameOptions(options, next);
      options = next;
      if (unchanged) return;
      if (!machine.begun) {
        features = detectFeatures();
        store.captureKind = chooseCapture(next.serverSpeech, features);
        store.playbackKind = choosePlayback(next.serverSpeech, features);
      }
      emit();
    },
    attach() {
      attached = true;
      features = detectFeatures();
      if (typeof window !== 'undefined') window.addEventListener('online', onOnline);
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', onVisibility);
      }
      void load();
    },
    detach() {
      attached = false;
      dispose();
      machine = initialState();
      store = freshStore();
      turnsCache = null;
      problemCache = null;
      snapshot = buildSnapshot();
      for (const listener of [...listeners]) listener();
    },
  };
}
