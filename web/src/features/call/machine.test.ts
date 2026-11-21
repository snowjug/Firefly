import { describe, expect, it } from 'vitest';
import { CALL_PHASES, type CallPhase } from './contract.ts';
import {
  autoListens,
  checkSend,
  initialState,
  isCurrentSend,
  isCurrentTranscription,
  MAX_SILENT_RETRIES,
  reduce,
  targets,
  TIMINGS,
  timerFor,
  WAITING_PHASES,
  type MachineEvent,
  type MachineState,
  type SendFailure,
} from './machine.ts';

// ---------------------------------------------------------------------------------------
// Helpers

const run = (state: MachineState, ...events: MachineEvent[]) => events.reduce(reduce, state);

/** Fires whatever timer the state is waiting on. */
function fire(state: MachineState): MachineState {
  if (!state.timer) throw new Error(`No timer in ${state.phase}`);
  return reduce(state, { type: 'timeout', id: state.timer.id });
}

const LOADED: MachineEvent = {
  type: 'loaded',
  lastCustomerIndex: 1,
  awaiting: null,
  limitReached: false,
  sessionEnded: false,
};

const loaded = (over: Partial<Extract<MachineEvent, { type: 'loaded' }>> = {}): MachineState =>
  reduce(initialState(), { ...LOADED, ...over });

/** A spoken call whose opening line is being played (canSpeak) or that is waiting for the trainee. */
function connected(options: { canSpeak?: boolean; opening?: number | null } = {}): MachineState {
  const { canSpeak = false, opening = null } = options;
  return run(
    loaded(),
    { type: 'begin', voice: true, canSpeak, opening },
    { type: 'permission-granted' },
  );
}

/** The microphone is open and the trainee has not spoken. */
function listening(options: { canSpeak?: boolean } = {}): MachineState {
  return fire(connected(options));
}

const typed = (): MachineState =>
  run(loaded(), { type: 'begin', voice: false, canSpeak: true, opening: null });

function atPhase(phase: CallPhase): MachineState {
  switch (phase) {
    case 'idle':
      return loaded();
    case 'requesting-microphone':
      return run(loaded(), { type: 'begin', voice: true, canSpeak: true, opening: 1 });
    case 'ready':
      return connected({ canSpeak: true, opening: 1 });
    case 'listening':
      return listening();
    case 'transcribing':
      return run(
        listening(),
        { type: 'speech-start' },
        { type: 'speech-end', id: 'u1', createdAt: 'now', reason: 'silence' },
      );
    case 'processing':
      return run(atPhase('transcribing'), { type: 'transcribe-done', id: 'u1', text: 'hello' });
    case 'customer-speaking':
      return run(
        run(connected({ canSpeak: true }), {
          type: 'send-text',
          id: 't1',
          text: 'hi',
          createdAt: 'now',
        }),
        {
          type: 'send-done',
          id: 't1',
          attempt: 1,
          customerIndex: 3,
          turnsRemaining: 5,
          redactions: [],
        },
        { type: 'speak-start', token: 1, estimateMs: 4000 },
      );
    case 'ready-for-next-turn':
      return connected();
    case 'ending':
      return run(connected(), { type: 'end-requested' });
    case 'completed':
      return run(connected(), { type: 'end-requested' }, { type: 'end-done' });
  }
}

// ---------------------------------------------------------------------------------------
// Invariants: checked after every step of every test run below.

function violations(state: MachineState): string[] {
  const out: string[] = [];
  const t = targets(state);
  const bad = (condition: boolean, message: string) => {
    if (condition) out.push(`${message} [${state.phase}]`);
  };

  bad(t.playback !== null && t.capture !== 'off', 'the customer is speaking while recording');
  bad(
    t.capture !== 'off' &&
      !(state.begun && state.voice && state.micHeld && !state.muted && !state.paused),
    'recording without begin, a held microphone, or while muted or paused',
  );
  bad(
    (state.phase === 'idle' || state.phase === 'ending' || state.phase === 'completed') &&
      (t.capture !== 'off' || t.microphone),
    'recording or holding the microphone when idle, ending or completed',
  );
  bad(
    t.capture === 'listen' &&
      (state.phase !== 'listening' || state.exchange !== null || state.speech !== null),
    'listen target outside a clean listening phase',
  );
  bad(state.speechDetected && state.phase !== 'listening', 'speech detected while not listening');
  bad(
    state.phase === 'listening' &&
      !(
        state.begun &&
        state.voice &&
        state.micHeld &&
        !state.muted &&
        !state.paused &&
        !state.exchange &&
        !state.speech
      ),
    'listening in a state that may not listen',
  );
  bad(
    state.speech !== null && state.phase !== 'ready' && state.phase !== 'customer-speaking',
    'a voice outside ready or customer-speaking',
  );
  bad(
    state.phase === 'customer-speaking' && state.speech === null,
    'customer-speaking with no voice',
  );
  bad(
    state.phase === 'processing' && state.exchange?.status !== 'sending',
    'processing without a message being sent',
  );
  bad(
    state.phase === 'transcribing' && state.exchange?.status !== 'transcribing',
    'transcribing without an utterance',
  );
  bad(
    state.exchange?.status === 'sending' &&
      state.phase !== 'processing' &&
      !(state.phase === 'ending' && state.ending === 'draining'),
    'a message in flight outside processing or draining',
  );
  bad(
    state.exchange?.status === 'transcribing' && state.phase !== 'transcribing',
    'an utterance outside transcribing',
  );
  bad(
    WAITING_PHASES.includes(state.phase) && state.timer === null,
    'a waiting phase with no watchdog',
  );
  bad(state.timer !== null && state.timer.id > state.timerSeq, 'a timer from the future');
  bad(
    state.speech !== null && state.speech.token > state.speechSeq,
    'a voice token from the future',
  );
  bad(
    (state.limitReached || state.sessionEnded) &&
      (t.capture !== 'off' || state.phase === 'listening'),
    'listening after the limit or the end',
  );
  bad(
    state.paused &&
      state.voice &&
      (state.micHeld || t.microphone || t.capture !== 'off' || t.playback !== null),
    'a paused call using the microphone or the voice',
  );
  bad(
    !state.begun &&
      state.phase !== 'idle' &&
      state.phase !== 'ending' &&
      state.phase !== 'completed',
    'a phase before begin',
  );
  bad(
    (state.ending !== null) !== (state.phase === 'ending'),
    'ending flag out of step with the phase',
  );
  bad(
    state.phase === 'completed' &&
      (state.timer !== null || t.send !== null || t.end || t.microphone),
    'work after completed',
  );
  bad(
    t.send !== null && state.exchange?.id !== t.send.id,
    'sending a message that is not the exchange',
  );
  bad(t.microphone && !state.voice, 'holding the microphone in a typed call');
  return out;
}

function expectValid(state: MachineState): void {
  expect(violations(state)).toEqual([]);
}

// ---------------------------------------------------------------------------------------
// Flows

describe('a spoken call, start to finish', () => {
  it('asks for the microphone only after begin, plays the opening line, then listens', () => {
    const fresh = loaded();
    expect(fresh.phase).toBe('idle');
    expect(targets(fresh).microphone).toBe(false);

    const asking = reduce(fresh, { type: 'begin', voice: true, canSpeak: true, opening: 1 });
    expect(asking.phase).toBe('requesting-microphone');
    expect(asking.microphone).toBe('prompt');
    expect(targets(asking)).toMatchObject({ microphone: true, capture: 'off', playback: null });

    const ready = reduce(asking, { type: 'permission-granted' });
    expect(ready.phase).toBe('ready');
    expect(ready.microphone).toBe('granted');
    expect(targets(ready).playback).toEqual({ token: 1, turnIndex: 1 });
    expect(targets(ready).capture).toBe('off');

    const speakingOpening = reduce(ready, { type: 'speak-start', token: 1, estimateMs: 3000 });
    expect(speakingOpening.phase).toBe('customer-speaking');
    expect(speakingOpening.timer).toMatchObject({
      kind: 'speak-play',
      ms: 3000 + TIMINGS.speakGrace,
    });

    const turn = reduce(speakingOpening, { type: 'speak-end', token: 1 });
    expect(turn.phase).toBe('ready-for-next-turn');
    // The microphone waits for the customer's voice to fade before it opens.
    expect(targets(turn).capture).toBe('off');
    expect(turn.timer).toMatchObject({ kind: 'settle', ms: TIMINGS.settle });

    const open = fire(turn);
    expect(open.phase).toBe('listening');
    expect(targets(open)).toMatchObject({ capture: 'listen', playback: null, microphone: true });
    expectValid(open);
  });

  it('turns one spoken sentence into one message and one reply', () => {
    let state = listening({ canSpeak: true });
    state = reduce(state, { type: 'speech-start' });
    expect(state.speechDetected).toBe(true);

    state = reduce(state, { type: 'speech-end', id: 'u1', createdAt: 't', reason: 'silence' });
    expect(state.phase).toBe('transcribing');
    expect(state.speechDetected).toBe(false);
    expect(state.exchange).toMatchObject({
      id: 'u1',
      text: '',
      status: 'transcribing',
      inputMode: 'voice',
    });
    expect(targets(state)).toMatchObject({ transcribe: 'u1', capture: 'finish', playback: null });

    state = reduce(state, { type: 'transcribe-done', id: 'u1', text: '  where is   my order ' });
    expect(state.phase).toBe('processing');
    expect(state.exchange).toMatchObject({
      text: 'where is my order',
      status: 'sending',
      attempt: 1,
    });
    expect(targets(state)).toMatchObject({
      send: { id: 'u1', attempt: 1 },
      capture: 'off',
      transcribe: null,
    });

    state = reduce(state, {
      type: 'send-done',
      id: 'u1',
      attempt: 1,
      customerIndex: 3,
      turnsRemaining: 40,
      redactions: [],
    });
    expect(state.exchange).toBeNull();
    expect(state.lastCustomerIndex).toBe(3);
    expect(state.phase).toBe('customer-speaking');
    expect(targets(state).playback).toEqual({ token: 1, turnIndex: 3 });
    expectValid(state);
  });

  it('does not speak replies in a typed call, but replay speaks on request', () => {
    let state = typed();
    expect(state.phase).toBe('ready-for-next-turn');
    expect(targets(state).microphone).toBe(false);
    expect(targets(state).capture).toBe('off');
    expect(state.timer).toBeNull();

    state = run(
      state,
      { type: 'send-text', id: 't1', text: 'hello', createdAt: 't' },
      {
        type: 'send-done',
        id: 't1',
        attempt: 1,
        customerIndex: 3,
        turnsRemaining: 10,
        redactions: [],
      },
    );
    expect(state.phase).toBe('ready-for-next-turn');
    expect(state.speech).toBeNull();
    expect(state.timer).toBeNull();

    state = reduce(state, { type: 'replay' });
    expect(state.phase).toBe('customer-speaking');
    expect(targets(state).playback).toEqual({ token: 1, turnIndex: 3 });
    expect(targets(state).microphone).toBe(false);
    state = run(
      state,
      { type: 'speak-start', token: 1, estimateMs: 2000 },
      { type: 'speak-end', token: 1 },
    );
    expect(state.phase).toBe('ready-for-next-turn');
    expect(autoListens(state)).toBe(false);
  });

  it('ignores the microphone controls in a typed call', () => {
    const state = typed();
    for (const type of ['talk', 'stop-talking', 'toggle-mute', 'toggle-pause'] as const) {
      expect(reduce(state, { type })).toBe(state);
    }
  });

  it('does not re-speak old turns of a resumed call, and says so when nothing can speak', () => {
    const state = run(
      loaded({ lastCustomerIndex: 7 }),
      { type: 'begin', voice: true, canSpeak: false, opening: null },
      { type: 'permission-granted' },
    );
    expect(state.phase).toBe('ready-for-next-turn');
    expect(state.speech).toBeNull();
    expect(state.hint).toEqual({ code: 'captions-only' });
    expect(state.timer?.kind).toBe('settle');
  });

  it('keeps push-to-talk calls closed until the trainee asks to talk', () => {
    let state = run(connected(), { type: 'set-hands-free', on: false });
    expect(state.timer).toBeNull();
    expect(targets(state).capture).toBe('off');
    state = reduce(state, { type: 'talk' });
    expect(state.phase).toBe('listening');
    expect(targets(state).capture).toBe('listen');
    // Talking again ends the utterance now.
    state = reduce(state, { type: 'talk' });
    expect(state.finishing).toBe(true);
    expect(targets(state).capture).toBe('finish');
  });
});

describe('the microphone', () => {
  it('goes back to idle, unbegun, when permission is refused, and a new begin is accepted', () => {
    const asking = run(loaded(), { type: 'begin', voice: true, canSpeak: true, opening: 1 });
    for (const [reason, code, microphone] of [
      ['denied', 'microphone-denied', 'denied'],
      ['missing', 'microphone-missing', 'unavailable'],
      ['busy', 'microphone-busy', 'unavailable'],
      ['unsupported', 'microphone-unsupported', 'unavailable'],
    ] as const) {
      const state = reduce(asking, { type: 'permission-denied', reason });
      expect(state).toMatchObject({ phase: 'idle', begun: false, voice: false, microphone });
      expect(state.problem?.code).toBe(code);
      expect(targets(state).microphone).toBe(false);
      expectValid(state);
      const again = reduce(state, { type: 'begin', voice: true, canSpeak: true, opening: 1 });
      expect(again.phase).toBe('requesting-microphone');
      expect(again.problem).toBeNull();
    }
  });

  it('gives up on a permission prompt nobody answers, so the call is never stuck waiting', () => {
    const asking = run(loaded(), { type: 'begin', voice: true, canSpeak: false, opening: null });
    expect(asking.timer).toMatchObject({ kind: 'permission', ms: TIMINGS.permission });
    const state = fire(asking);
    expect(state.phase).toBe('idle');
    expect(state.problem).toEqual({
      code: 'microphone-busy',
      context: { beforeCall: true, timedOut: true },
    });
    expect(targets(state).microphone).toBe(false);
    // A late answer to the old request changes nothing.
    expect(reduce(state, { type: 'permission-granted' })).toBe(state);
  });

  it('carries on by typing when the microphone is lost mid-call, and can be asked for again', () => {
    let state = listening();
    state = reduce(state, { type: 'mic-lost' });
    expect(state).toMatchObject({ phase: 'ready-for-next-turn', voice: false, micHeld: false });
    expect(state.problem?.code).toBe('microphone-missing');
    expect(targets(state)).toMatchObject({ microphone: false, capture: 'off' });
    expect(autoListens(state)).toBe(false);
    expect(checkSend(state)).toBe('ok');

    state = reduce(state, { type: 'retry-microphone' });
    expect(state.voice).toBe(true);
    expect(state.problem).toBeNull();
    expect(targets(state).microphone).toBe(true);
    state = reduce(state, { type: 'permission-granted' });
    expect(state.micHeld).toBe(true);
    expect(state.timer?.kind).toBe('settle');
    expectValid(state);
  });

  it('turns a typed call into a spoken one when begin is called again with voice', () => {
    const state = reduce(typed(), { type: 'begin', voice: true, canSpeak: true, opening: null });
    expect(state.voice).toBe(true);
    expect(targets(state).microphone).toBe(true);
  });

  it('drops an utterance that was being transcribed when the microphone is lost', () => {
    let state = atPhase('transcribing');
    state = reduce(state, {
      type: 'transcribe-failed',
      id: 'u1',
      failure: { kind: 'microphone', reason: 'denied' },
    });
    expect(state.exchange).toBeNull();
    expect(state.phase).toBe('ready-for-next-turn');
    expect(state.problem?.code).toBe('microphone-denied');
    expect(state.microphone).toBe('denied');
  });
});

describe('mute and pause', () => {
  it('stops recording at once when muted, discards a sentence being transcribed, and resumes on unmute', () => {
    let state = reduce(listening(), { type: 'toggle-mute' });
    expect(state).toMatchObject({ muted: true, phase: 'ready-for-next-turn' });
    expect(targets(state)).toMatchObject({ capture: 'off', trackEnabled: false, microphone: true });
    expect(state.timer).toBeNull();
    expect(reduce(state, { type: 'talk' }).hint).toEqual({ code: 'muted' });

    state = reduce(state, { type: 'toggle-mute' });
    expect(state.muted).toBe(false);
    expect(state.timer?.kind).toBe('settle');

    const transcribing = atPhase('transcribing');
    const muted = reduce(transcribing, { type: 'toggle-mute' });
    expect(muted.exchange).toBeNull();
    expect(muted.phase).toBe('ready-for-next-turn');
    expect(muted.hint).toEqual({ code: 'discarded-muted' });
    expect(targets(muted).transcribe).toBeNull();
    expectValid(muted);
  });

  it('releases the microphone and halts the voice when paused, and gets them back on resume', () => {
    let state = reduce(listening(), { type: 'toggle-pause' });
    expect(state).toMatchObject({ paused: true, micHeld: false, phase: 'ready-for-next-turn' });
    expect(targets(state)).toMatchObject({ microphone: false, capture: 'off', playback: null });
    expect(state.timer).toBeNull();
    expect(reduce(state, { type: 'talk' }).hint).toEqual({ code: 'paused' });

    state = reduce(state, { type: 'toggle-pause' });
    expect(state.paused).toBe(false);
    expect(targets(state).microphone).toBe(true);
    expect(state.timer).toBeNull(); // not listening until the microphone is back
    state = reduce(state, { type: 'permission-granted' });
    expect(state.timer?.kind).toBe('settle');
    expectValid(state);
  });

  it('speaks a reply that arrived while paused when the call resumes, and the turn it cut short again', () => {
    // A reply that arrives while paused is not spoken.
    let state = run(
      connected({ canSpeak: true }),
      { type: 'send-text', id: 't1', text: 'hi', createdAt: 't' },
      { type: 'toggle-pause' },
      {
        type: 'send-done',
        id: 't1',
        attempt: 1,
        customerIndex: 3,
        turnsRemaining: 9,
        redactions: [],
      },
    );
    expect(state).toMatchObject({ phase: 'ready-for-next-turn', pendingSpeech: 3, paused: true });
    expect(targets(state).playback).toBeNull();
    state = reduce(state, { type: 'toggle-pause' });
    expect(state.phase).toBe('customer-speaking');
    expect(targets(state).playback).toEqual({ token: 1, turnIndex: 3 });

    // Pausing while the customer speaks halts the voice and keeps the turn for later.
    const cut = reduce(reduce(state, { type: 'speak-start', token: 1, estimateMs: 3000 }), {
      type: 'toggle-pause',
    });
    expect(cut).toMatchObject({ pendingSpeech: 3, phase: 'ready-for-next-turn' });
    expect(cut.interrupted).toEqual([]);
    expect(targets(cut).playback).toBeNull();
    expectValid(cut);
  });

  it('discards a sentence being transcribed when paused, but lets a message in flight finish', () => {
    const paused = reduce(atPhase('transcribing'), { type: 'toggle-pause' });
    expect(paused.exchange).toBeNull();
    expect(paused.hint).toEqual({ code: 'discarded-paused' });

    const sending = reduce(atPhase('processing'), { type: 'toggle-pause' });
    expect(sending.phase).toBe('processing');
    expect(sending.exchange?.status).toBe('sending');
    expect(targets(sending)).toMatchObject({ send: { id: 'u1', attempt: 1 }, microphone: false });
  });
});

describe('interrupting', () => {
  it('stops the customer at once and gives the turn to the trainee, marking the turn interrupted', () => {
    const state = reduce(atPhase('customer-speaking'), { type: 'interrupt' });
    expect(state.phase).toBe('ready-for-next-turn');
    expect(state.interrupted).toEqual([3]);
    expect(targets(state).playback).toBeNull();
    // Reports about the stopped voice are stale now.
    expect(reduce(state, { type: 'speak-end', token: 1 })).toBe(state);
    expect(reduce(state, { type: 'speak-failed', token: 1, reason: 'playback' })).toBe(state);
    // Hearing it all later clears the mark.
    const replayed = run(
      state,
      { type: 'replay' },
      { type: 'speak-start', token: 2, estimateMs: 100 },
      { type: 'speak-end', token: 2 },
    );
    expect(replayed.interrupted).toEqual([]);
  });

  it('is what talking over the customer does: the voice stops and the microphone opens', () => {
    const state = reduce(atPhase('customer-speaking'), { type: 'talk' });
    expect(state.phase).toBe('listening');
    expect(state.interrupted).toEqual([3]);
    expect(targets(state)).toMatchObject({ playback: null, capture: 'listen' });
    expectValid(state);
  });

  it('is also what typing does while the customer speaks', () => {
    const state = reduce(atPhase('customer-speaking'), {
      type: 'send-text',
      id: 't9',
      text: 'one moment',
      createdAt: 't',
    });
    expect(state.phase).toBe('processing');
    expect(state.interrupted).toEqual([3]);
    expect(targets(state)).toMatchObject({ playback: null, send: { id: 't9', attempt: 1 } });
  });

  it('does nothing when nothing is speaking', () => {
    const state = listening();
    expect(reduce(state, { type: 'interrupt' })).toBe(state);
  });
});

describe('listening that hears nothing', () => {
  it('says so and, hands-free, tries again a bounded number of times before waiting for the trainee', () => {
    let state = listening();
    for (let attempt = 1; attempt <= MAX_SILENT_RETRIES; attempt++) {
      state = fire(state); // nothing heard for 15 s
      expect(state.phase).toBe('ready-for-next-turn');
      expect(state.hint).toEqual({ code: 'nothing-heard' });
      expect(state.timer?.kind).toBe('settle');
      state = fire(state);
      expect(state.phase).toBe('listening');
    }
    state = fire(state);
    expect(state.silentRetries).toBe(MAX_SILENT_RETRIES + 1);
    expect(state.phase).toBe('ready-for-next-turn');
    expect(state.timer).toBeNull();
    expect(autoListens(state)).toBe(false);
    // The trainee can still talk, and that starts afresh.
    expect(reduce(state, { type: 'talk' })).toMatchObject({
      phase: 'listening',
      silentRetries: 0,
      hint: null,
    });
  });

  it('ignores a click or cough (speech dropped) without leaving the listening phase', () => {
    const state = run(listening(), { type: 'speech-start' }, { type: 'speech-dropped' });
    expect(state.phase).toBe('listening');
    expect(state.speechDetected).toBe(false);
  });

  it('finishing with nothing said just closes the microphone', () => {
    const state = run(listening(), { type: 'stop-talking' }, { type: 'nothing-heard' });
    expect(state.phase).toBe('ready-for-next-turn');
    expect(state.finishing).toBe(false);
    expect(targets(state).capture).toBe('off');
  });

  it('a microphone that never answers a finish request is given up on', () => {
    const state = run(listening(), { type: 'stop-talking' });
    expect(state.timer).toMatchObject({ kind: 'finish', ms: TIMINGS.finish });
    expect(fire(state).hint).toEqual({ code: 'nothing-heard' });
  });

  it('forces an utterance that runs on far too long to finish', () => {
    const state = run(listening(), { type: 'speech-start' });
    expect(state.timer).toMatchObject({ kind: 'listen-speech', ms: TIMINGS.listenSpeech });
    const forced = fire(state);
    expect(forced.finishing).toBe(true);
    expect(targets(forced).capture).toBe('finish');
  });

  it('counts speech that holds no words towards the same limit, so an engine that never finds words is not retried for ever', () => {
    const emptyPass = (state: MachineState, n: number) =>
      run(
        state,
        { type: 'speech-start' },
        { type: 'speech-end', id: `u${n}`, createdAt: 'now', reason: 'silence' },
        { type: 'transcribe-empty', id: `u${n}` },
      );
    let state = listening();
    for (let attempt = 1; attempt <= MAX_SILENT_RETRIES; attempt++) {
      state = emptyPass(state, attempt);
      expect(state).toMatchObject({ phase: 'ready-for-next-turn', exchange: null });
      expect(state.hint).toEqual({ code: 'no-words' });
      expect(state.timer?.kind).toBe('settle');
      state = fire(state);
      expect(state.phase).toBe('listening');
    }
    state = emptyPass(state, 9);
    expect(state.silentRetries).toBe(MAX_SILENT_RETRIES + 1);
    expect(state.phase).toBe('ready-for-next-turn');
    expect(state.timer).toBeNull();
    expect(autoListens(state)).toBe(false);
    expect(targets(state).send).toBeNull();

    // Words count as success: the trainee talks, and the count starts again.
    const talking = run(
      reduce(state, { type: 'talk' }),
      { type: 'speech-start' },
      { type: 'speech-end', id: 'w1', createdAt: 'now', reason: 'silence' },
      { type: 'transcribe-done', id: 'w1', text: 'hello' },
    );
    expect(talking.silentRetries).toBe(0);
    expect(talking.phase).toBe('processing');
  });

  it('treats a transcription that finds no words like silence, and says that speech was picked up', () => {
    const state = reduce(atPhase('transcribing'), { type: 'transcribe-empty', id: 'u1' });
    expect(state).toMatchObject({ phase: 'ready-for-next-turn', exchange: null, silentRetries: 1 });
    expect(state.hint).toEqual({ code: 'no-words' });
    // Never an empty message: nothing is sent and nothing is left in the transcript.
    expect(targets(state).send).toBeNull();
    const blank = reduce(atPhase('transcribing'), {
      type: 'transcribe-done',
      id: 'u1',
      text: '  ',
    });
    expect(blank.exchange).toBeNull();
    expect(blank.hint).toEqual({ code: 'no-words' });
  });
});

describe('sending', () => {
  const sending = (): MachineState =>
    run(connected(), { type: 'send-text', id: 't1', text: 'hello', createdAt: 'now' });

  it('keeps the message and shows the right problem for every way a send can fail', () => {
    const cases: Array<[SendFailure, string, 'failed' | null]> = [
      [{ kind: 'conflict', saved: false }, 'reply-failed', 'failed'],
      [{ kind: 'provider', saved: true }, 'reply-failed', 'failed'],
      [{ kind: 'unknown', saved: false }, 'save-failed', 'failed'],
      [{ kind: 'offline', saved: false }, 'offline', 'failed'],
      [{ kind: 'rate-limited', saved: false, retryAfterSeconds: 7 }, 'rate-limited', 'failed'],
      [{ kind: 'turn-limit' }, 'turn-limit', null],
      [{ kind: 'session-ended' }, 'session-ended', null],
      [{ kind: 'validation' }, '', null],
    ];
    for (const [failure, code, kept] of cases) {
      const state = reduce(sending(), { type: 'send-failed', id: 't1', attempt: 1, failure });
      expect(state.phase).toBe('ready-for-next-turn');
      expect(state.exchange?.status ?? null).toBe(kept);
      expect(state.problem?.code ?? '').toBe(code);
      expect(targets(state).send).toBeNull();
      expectValid(state);
    }
    const limited = reduce(sending(), {
      type: 'send-failed',
      id: 't1',
      attempt: 1,
      failure: { kind: 'turn-limit' },
    });
    expect(limited.limitReached).toBe(true);
    const ended = reduce(sending(), {
      type: 'send-failed',
      id: 't1',
      attempt: 1,
      failure: { kind: 'session-ended' },
    });
    expect(ended.sessionEnded).toBe(true);
    const rejected = reduce(sending(), {
      type: 'send-failed',
      id: 't1',
      attempt: 1,
      failure: { kind: 'validation' },
    });
    expect(rejected.hint).toEqual({ code: 'rejected' });
    const limit = reduce(sending(), {
      type: 'send-failed',
      id: 't1',
      attempt: 1,
      failure: { kind: 'rate-limited', saved: false, retryAfterSeconds: 7 },
    });
    expect(limit.problem).toEqual({
      code: 'rate-limited',
      context: { during: 'send', retryAfterSeconds: 7 },
    });
  });

  it('retries the same message with the same id, a new attempt, and nothing else changes', () => {
    let state = reduce(sending(), {
      type: 'send-failed',
      id: 't1',
      attempt: 1,
      failure: { kind: 'offline', saved: false },
    });
    expect(checkSend(state)).toBe('retry-first');
    state = reduce(state, { type: 'retry-send' });
    expect(state.phase).toBe('processing');
    expect(state.exchange).toMatchObject({
      id: 't1',
      text: 'hello',
      status: 'sending',
      attempt: 2,
    });
    expect(state.problem).toBeNull();
    expect(targets(state).send).toEqual({ id: 't1', attempt: 2 });
    // A late answer to the first attempt is for nobody.
    const late = {
      type: 'send-done',
      id: 't1',
      attempt: 1,
      customerIndex: 3,
      turnsRemaining: 5,
      redactions: [],
    } as const;
    expect(reduce(state, late)).toBe(state);
    const answered = reduce(state, { ...late, attempt: 2 });
    expect(answered.exchange).toBeNull();
    expect(answered.problem).toBeNull();
  });

  it('applies a reply once, ignores a repeat, and ignores a reply for another message', () => {
    const state = sending();
    const done = {
      type: 'send-done',
      id: 't1',
      attempt: 1,
      customerIndex: 3,
      turnsRemaining: 5,
      redactions: [],
    } as const;
    const applied = reduce(state, done);
    expect(applied.lastCustomerIndex).toBe(3);
    expect(reduce(applied, done)).toBe(applied);
    expect(reduce(state, { ...done, id: 'other' })).toBe(state);
  });

  it('refuses a second message while one is waiting, or while an earlier one has not been retried', () => {
    const state = sending();
    expect(checkSend(state)).toBe('busy');
    expect(reduce(state, { type: 'send-text', id: 't2', text: 'again', createdAt: 'now' })).toBe(
      state,
    );
    const failed = reduce(state, {
      type: 'send-failed',
      id: 't1',
      attempt: 1,
      failure: { kind: 'provider', saved: true },
    });
    expect(checkSend(failed)).toBe('retry-first');
    expect(reduce(failed, { type: 'send-text', id: 't2', text: 'again', createdAt: 'now' })).toBe(
      failed,
    );
    expect(checkSend(initialState())).toBe('not-started');
  });

  it('shows what was removed from a message, and stops everything at the turn limit', () => {
    const answered = reduce(sending(), {
      type: 'send-done',
      id: 't1',
      attempt: 1,
      customerIndex: 3,
      turnsRemaining: 0,
      redactions: ['email'],
    });
    expect(answered.hint).toEqual({ code: 'redacted', kinds: ['email'] });
    expect(answered.limitReached).toBe(true);
    expect(answered.problem?.code).toBe('turn-limit');
    expect(checkSend(answered)).toBe('limit');
    expect(reduce(answered, { type: 'talk' })).toBe(answered);
    expect(autoListens(answered)).toBe(false);
  });

  it('shows a call that was left waiting for a reply as a failed message to retry', () => {
    const state = run(
      loaded({
        awaiting: {
          id: 'abcdefgh',
          text: 'earlier message',
          createdAt: 'then',
          inputMode: 'voice',
          turnIndex: 4,
        },
      }),
      { type: 'begin', voice: false, canSpeak: true, opening: null },
    );
    expect(state.exchange).toMatchObject({
      id: 'abcdefgh',
      status: 'failed',
      saved: true,
      inputMode: 'voice',
      index: 4,
    });
    expect(state.problem).toEqual({ code: 'reply-failed', context: { saved: true } });
    expect(checkSend(state)).toBe('retry-first');
    expect(reduce(state, { type: 'retry-send' }).exchange?.attempt).toBe(1);
  });

  it('shows a saved, unanswered message in a spoken call too, with Try again before the microphone opens', () => {
    const state = run(
      loaded({
        awaiting: {
          id: 'abcdefgh',
          text: 'earlier message',
          createdAt: 'then',
          inputMode: 'text',
          turnIndex: 4,
        },
      }),
      { type: 'begin', voice: true, canSpeak: true, opening: null },
      { type: 'permission-granted' },
    );
    expect(state.problem).toEqual({ code: 'reply-failed', context: { saved: true } });
    expect(state.phase).toBe('ready-for-next-turn');
    expect(autoListens(state)).toBe(false);
    expect(state.timer).toBeNull();
    expect(reduce(state, { type: 'retry-send' }).phase).toBe('processing');
  });

  it('refuses to begin when the session has already ended', () => {
    const state = loaded({ sessionEnded: true });
    expect(state.problem?.code).toBe('session-ended');
    expect(reduce(state, { type: 'begin', voice: true, canSpeak: true, opening: 1 })).toBe(state);
  });
});

describe("the customer's voice", () => {
  it('moves on when the voice cannot be made, with a problem the call survives', () => {
    const state = reduce(atPhase('customer-speaking'), {
      type: 'speak-failed',
      token: 1,
      reason: 'generation',
    });
    expect(state.phase).toBe('ready-for-next-turn');
    expect(state.problem?.code).toBe('voice-generation-failed');
    // The call keeps listening: a degraded voice does not stop the conversation.
    expect(state.timer?.kind).toBe('settle');
    const playback = reduce(atPhase('customer-speaking'), {
      type: 'speak-failed',
      token: 1,
      reason: 'playback',
    });
    expect(playback.problem?.code).toBe('playback-failed');
  });

  it('stops listening for the trainee while a blocked reply waits for Play, then plays it', () => {
    let state = reduce(atPhase('customer-speaking'), { type: 'speak-blocked', token: 1 });
    expect(state.phase).toBe('ready-for-next-turn');
    expect(state.problem?.code).toBe('playback-blocked');
    expect(state.pendingSpeech).toBe(3);
    expect(state.timer).toBeNull();
    expect(autoListens(state)).toBe(false);

    state = reduce(state, { type: 'replay' });
    expect(state.phase).toBe('customer-speaking');
    expect(state.problem).toBeNull();
    expect(targets(state).playback).toMatchObject({ turnIndex: 3 });
  });

  it('can be dismissed when degraded, and not when blocking', () => {
    const blocked = reduce(atPhase('customer-speaking'), { type: 'speak-blocked', token: 1 });
    expect(reduce(blocked, { type: 'dismiss-problem' }).problem).toBeNull();
    const limit = reduce(
      run(connected(), { type: 'send-text', id: 't1', text: 'x', createdAt: 'n' }),
      { type: 'send-failed', id: 't1', attempt: 1, failure: { kind: 'offline', saved: false } },
    );
    expect(reduce(limit, { type: 'dismiss-problem' })).toBe(limit);
  });

  it('lets go of a blocked reply when its problem is dismissed, so the microphone can open again', () => {
    const blocked = reduce(atPhase('customer-speaking'), { type: 'speak-blocked', token: 1 });
    expect(autoListens(blocked)).toBe(false);
    const dismissed = reduce(blocked, { type: 'dismiss-problem' });
    expect(dismissed.pendingSpeech).toBeNull();
    expect(autoListens(dismissed)).toBe(true);
    expect(dismissed.timer?.kind).toBe('settle');
  });

  it('forgets captions-only after the first time nothing could speak', () => {
    const state = reduce(atPhase('customer-speaking'), {
      type: 'speak-failed',
      token: 1,
      reason: 'unavailable',
    });
    expect(state.canSpeak).toBe(false);
    expect(state.hint).toEqual({ code: 'captions-only' });
    expect(state.problem).toBeNull();
  });

  it('cannot start a second voice while one is playing: replay replaces it with a new request', () => {
    const state = atPhase('customer-speaking');
    const again = reduce(state, { type: 'replay' });
    expect(again.speech?.token).toBe(2);
    expect(targets(again).playback).toEqual({ token: 2, turnIndex: 3 });
    // Reports about the first voice are stale.
    expect(reduce(again, { type: 'speak-end', token: 1 })).toBe(again);
    expect(reduce(again, { type: 'speak-start', token: 1, estimateMs: 10 })).toBe(again);
  });

  it('updates the watchdog when the real length of the audio is known', () => {
    const state = reduce(atPhase('customer-speaking'), {
      type: 'speak-duration',
      token: 1,
      ms: 12_000,
    });
    expect(state.timer).toMatchObject({ kind: 'speak-play', ms: 12_000 + TIMINGS.speakGrace });
  });
});

describe('ending the call', () => {
  it.each(CALL_PHASES.filter((phase) => phase !== 'completed' && phase !== 'ending'))(
    'stops everything at once from %s',
    (phase) => {
      const state = reduce(atPhase(phase), { type: 'end-requested' });
      expect(state.phase).toBe('ending');
      expect(targets(state)).toMatchObject({
        microphone: false,
        capture: 'off',
        playback: null,
        transcribe: null,
      });
      expectValid(state);
    },
  );

  it('waits for a message in flight (up to 8 s), then closes the call', () => {
    let state = reduce(atPhase('processing'), { type: 'end-requested' });
    expect(state.ending).toBe('draining');
    expect(targets(state)).toMatchObject({ send: { id: 'u1', attempt: 1 }, end: false });
    expect(state.timer).toMatchObject({ kind: 'drain', ms: TIMINGS.drain });

    state = reduce(state, {
      type: 'send-done',
      id: 'u1',
      attempt: 1,
      customerIndex: 3,
      turnsRemaining: 5,
      redactions: [],
    });
    expect(state.ending).toBe('closing');
    expect(state.speech).toBeNull();
    expect(targets(state)).toMatchObject({ send: null, end: true });
    state = reduce(state, { type: 'end-done' });
    expect(state.phase).toBe('completed');
    expect(state.timer).toBeNull();
    expect(targets(state)).toMatchObject({ end: false, microphone: false });
  });

  it('stops waiting for a message that takes too long, and keeps it as failed', () => {
    const state = fire(reduce(atPhase('processing'), { type: 'end-requested' }));
    expect(state.ending).toBe('closing');
    expect(state.exchange?.status).toBe('failed');
    expect(targets(state)).toMatchObject({ send: null, end: true });
  });

  it('discards an utterance that was never sent, and keeps a message that was', () => {
    expect(reduce(atPhase('transcribing'), { type: 'end-requested' }).exchange).toBeNull();
    const failed = reduce(
      reduce(atPhase('processing'), {
        type: 'send-failed',
        id: 'u1',
        attempt: 1,
        failure: { kind: 'offline', saved: false },
      }),
      { type: 'end-requested' },
    );
    expect(failed.exchange?.status).toBe('failed');
    expect(failed.ending).toBe('closing');
  });

  it('is safe to ask twice and does nothing once completed', () => {
    const ending = reduce(connected(), { type: 'end-requested' });
    expect(reduce(ending, { type: 'end-requested' })).toBe(ending);
    const done = reduce(ending, { type: 'end-done' });
    for (const event of [
      { type: 'end-requested' },
      { type: 'talk' },
      { type: 'begin', voice: true, canSpeak: true, opening: 1 },
      { type: 'send-text', id: 'late', text: 'late', createdAt: 'x' },
      { type: 'speech-start' },
      { type: 'toggle-pause' },
      { type: 'permission-granted' },
    ] as MachineEvent[]) {
      expect(reduce(done, event)).toBe(done);
    }
  });

  it('keeps the call open, paused and with a problem, when it cannot be ended', () => {
    const closing = reduce(atPhase('listening'), { type: 'end-requested' });
    for (const [failure, code] of [
      [{ kind: 'failed' }, 'end-failed'],
      [{ kind: 'nothing-to-review' }, 'end-failed'],
      [{ kind: 'offline' }, 'offline'],
    ] as const) {
      const state = reduce(closing, { type: 'end-failed', failure });
      expect(state).toMatchObject({ phase: 'ready-for-next-turn', paused: true, ending: null });
      expect(state.problem?.code).toBe(code);
      expect(targets(state)).toMatchObject({ microphone: false, capture: 'off', end: false });
      expectValid(state);
      // ...and ending can be asked for again.
      expect(reduce(state, { type: 'end-requested' }).phase).toBe('ending');
    }
    expect(
      reduce(closing, { type: 'end-failed', failure: { kind: 'nothing-to-review' } }).problem
        ?.context,
    ).toEqual({ nothingToReview: true });
  });

  it('gives up on an end request that never answers', () => {
    const state = fire(reduce(connected(), { type: 'end-requested' }));
    expect(state.phase).toBe('ready-for-next-turn');
    expect(state.problem?.code).toBe('end-failed');
  });
});

describe('watchdogs: no waiting phase can last for ever', () => {
  it('moves each waiting phase to a state the trainee can act in, with a visible reason', () => {
    const processing = fire(atPhase('processing'));
    expect(processing).toMatchObject({ phase: 'ready-for-next-turn' });
    expect(processing.problem?.code).toBe('reply-timeout');
    expect(processing.exchange?.status).toBe('failed');
    expect(atPhase('processing').timer?.ms).toBe(45_000);

    const transcribing = fire(atPhase('transcribing'));
    expect(transcribing).toMatchObject({ phase: 'ready-for-next-turn', exchange: null });
    expect(transcribing.problem).toEqual({
      code: 'transcription-failed',
      context: { timedOut: true },
    });
    expect(atPhase('transcribing').timer?.ms).toBe(20_000);

    // A customer voice that never reports its end is cut off after its estimated length plus 5 s.
    const voice = atPhase('customer-speaking');
    expect(voice.timer).toMatchObject({ kind: 'speak-play', ms: 4000 + 5000 });
    const handedOver = fire(voice);
    expect(handedOver.phase).toBe('ready-for-next-turn');
    expect(handedOver.problem).toBeNull();
    expect(targets(handedOver).playback).toBeNull();

    // A voice that never starts.
    const preparing = reduce(atPhase('ready'), {
      type: 'timeout',
      id: atPhase('ready').timer?.id ?? -1,
    });
    expect(preparing.phase).toBe('ready-for-next-turn');
    expect(preparing.problem?.code).toBe('voice-generation-failed');
  });

  it('ignores a timer that is not the current one', () => {
    const state = atPhase('processing');
    expect(reduce(state, { type: 'timeout', id: (state.timer?.id ?? 0) - 1 })).toBe(state);
    expect(reduce(state, { type: 'timeout', id: 9999 })).toBe(state);
    const moved = reduce(state, {
      type: 'send-failed',
      id: 'u1',
      attempt: 1,
      failure: { kind: 'offline', saved: false },
    });
    expect(reduce(moved, { type: 'timeout', id: state.timer?.id ?? 0 })).toBe(moved);
  });

  it('re-arms a timer when the phase changes, so each wait gets its own full time', () => {
    const a = atPhase('transcribing');
    const b = reduce(a, { type: 'transcribe-done', id: 'u1', text: 'hello' });
    expect(a.timer?.kind).toBe('transcribe');
    expect(b.timer?.kind).toBe('reply');
    expect(b.timer?.id).toBeGreaterThan(a.timer?.id ?? 0);
  });
});

describe('events that make no sense are ignored', () => {
  const EVENTS: MachineEvent[] = [
    {
      type: 'loaded',
      lastCustomerIndex: 1,
      awaiting: null,
      limitReached: false,
      sessionEnded: false,
    },
    { type: 'begin', voice: true, canSpeak: true, opening: 1 },
    { type: 'reset' },
    { type: 'permission-granted' },
    { type: 'permission-denied', reason: 'denied' },
    { type: 'mic-lost' },
    { type: 'retry-microphone' },
    { type: 'talk' },
    { type: 'stop-talking' },
    { type: 'toggle-mute' },
    { type: 'toggle-pause' },
    { type: 'set-hands-free', on: true },
    { type: 'interrupt' },
    { type: 'replay' },
    { type: 'send-text', id: 'x', text: 'x', createdAt: 'n' },
    { type: 'retry-send' },
    { type: 'dismiss-problem' },
    { type: 'hint', hint: null },
    { type: 'end-requested' },
    { type: 'speech-start' },
    { type: 'speech-end', id: 'x', createdAt: 'n', reason: 'silence' },
    { type: 'speech-dropped' },
    { type: 'nothing-heard' },
    { type: 'transcribe-done', id: 'x', text: 'x' },
    { type: 'transcribe-empty', id: 'x' },
    { type: 'transcribe-failed', id: 'x', failure: { kind: 'failed' } },
    { type: 'transcribe-failed', id: null, failure: { kind: 'failed' } },
    { type: 'send-done', id: 'x', attempt: 1, customerIndex: 9, turnsRemaining: 1, redactions: [] },
    { type: 'send-failed', id: 'x', attempt: 1, failure: { kind: 'offline', saved: false } },
    { type: 'speak-start', token: 99, estimateMs: 1 },
    { type: 'speak-duration', token: 99, ms: 1 },
    { type: 'speak-end', token: 99 },
    { type: 'speak-failed', token: 99, reason: 'playback' },
    { type: 'speak-blocked', token: 99 },
    { type: 'end-done' },
    { type: 'end-failed', failure: { kind: 'failed' } },
    { type: 'timeout', id: 424242 },
  ];

  it.each(CALL_PHASES)('never throws in %s, and keeps every invariant', (phase) => {
    for (const event of EVENTS) {
      const before = atPhase(phase);
      const after = reduce(before, event);
      expectValid(after);
      if (after === before) expect(after).toStrictEqual(before);
    }
  });

  it('returns the very same state for events about things that are not happening', () => {
    const state = atPhase('listening');
    for (const event of [
      { type: 'transcribe-done', id: 'x', text: 'x' },
      {
        type: 'send-done',
        id: 'x',
        attempt: 1,
        customerIndex: 9,
        turnsRemaining: 1,
        redactions: [],
      },
      { type: 'speak-end', token: 7 },
      { type: 'speak-blocked', token: 7 },
      { type: 'end-done' },
      { type: 'timeout', id: 424242 },
      { type: 'interrupt' },
      { type: 'retry-send' },
    ] as MachineEvent[]) {
      expect(reduce(state, event)).toBe(state);
    }
  });

  it('knows which transcription and send are current', () => {
    const transcribing = atPhase('transcribing');
    expect(isCurrentTranscription(transcribing, 'u1')).toBe(true);
    expect(isCurrentTranscription(transcribing, 'other')).toBe(false);
    const processing = atPhase('processing');
    expect(isCurrentSend(processing, 'u1', 1)).toBe(true);
    expect(isCurrentSend(processing, 'u1', 2)).toBe(false);
    expect(isCurrentSend(processing, 'other', 1)).toBe(false);
    expect(timerFor(initialState())).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------
// Property tests: random event sequences

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomEvent(
  random: () => number,
  state: MachineState,
  counter: { n: number },
): MachineEvent {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
  const id = () => `id-${++counter.n}`;
  const mostly = <T>(real: T | undefined, other: () => T): T =>
    real !== undefined && random() < 0.75 ? real : other();
  const exchange = state.exchange;
  const speech = state.speech;
  const kinds = [
    'begin',
    'permission-granted',
    'permission-denied',
    'mic-lost',
    'retry-microphone',
    'talk',
    'talk',
    'stop-talking',
    'toggle-mute',
    'toggle-pause',
    'set-hands-free',
    'interrupt',
    'replay',
    'send-text',
    'retry-send',
    'dismiss-problem',
    'end-requested',
    'speech-start',
    'speech-start',
    'speech-end',
    'speech-dropped',
    'nothing-heard',
    'transcribe-done',
    'transcribe-empty',
    'transcribe-failed',
    'send-done',
    'send-done',
    'send-failed',
    'speak-start',
    'speak-end',
    'speak-failed',
    'speak-blocked',
    'speak-duration',
    'end-done',
    'end-failed',
    'timeout',
    'timeout',
    'timeout',
    'hint',
  ] as const;
  const kind = pick(kinds);
  switch (kind) {
    case 'begin':
      return {
        type: 'begin',
        voice: random() < 0.8,
        canSpeak: random() < 0.7,
        opening: random() < 0.5 ? 1 : null,
      };
    case 'permission-denied':
      return {
        type: 'permission-denied',
        reason: pick(['denied', 'missing', 'busy', 'unsupported'] as const),
      };
    case 'set-hands-free':
      return { type: 'set-hands-free', on: random() < 0.6 };
    case 'send-text':
      return { type: 'send-text', id: id(), text: 'hello', createdAt: 'now' };
    case 'speech-end':
      return {
        type: 'speech-end',
        id: id(),
        createdAt: 'now',
        reason: pick(['silence', 'limit', 'stopped'] as const),
      };
    case 'transcribe-done':
      return {
        type: 'transcribe-done',
        id: mostly(exchange?.id, id),
        text: pick(['hello', '', 'where is my order']),
      };
    case 'transcribe-empty':
      return { type: 'transcribe-empty', id: mostly(exchange?.id, id) };
    case 'transcribe-failed':
      return {
        type: 'transcribe-failed',
        id: random() < 0.2 ? null : mostly(exchange?.id, id),
        failure: pick([
          { kind: 'microphone', reason: 'denied' },
          { kind: 'offline' },
          { kind: 'service-unavailable' },
          { kind: 'rate-limited', retryAfterSeconds: 3 },
          { kind: 'failed' },
        ] as const),
      };
    case 'send-done':
      return {
        type: 'send-done',
        id: mostly(exchange?.id, id),
        attempt: mostly(exchange?.attempt, () => 1),
        customerIndex: 3 + Math.floor(random() * 50),
        turnsRemaining: pick([null, 0, 4, 30]),
        redactions: pick([[], ['email']] as const),
      };
    case 'send-failed':
      return {
        type: 'send-failed',
        id: mostly(exchange?.id, id),
        attempt: mostly(exchange?.attempt, () => 1),
        failure: pick<SendFailure>([
          { kind: 'conflict', saved: false },
          { kind: 'provider', saved: true },
          { kind: 'unknown', saved: false },
          { kind: 'offline', saved: false },
          { kind: 'rate-limited', saved: false },
          { kind: 'validation' },
          { kind: 'turn-limit' },
          { kind: 'session-ended' },
        ]),
      };
    case 'speak-start':
      return {
        type: 'speak-start',
        token: mostly(speech?.token, () => 1),
        estimateMs: Math.floor(random() * 9000),
      };
    case 'speak-end':
      return { type: 'speak-end', token: mostly(speech?.token, () => 1) };
    case 'speak-failed':
      return {
        type: 'speak-failed',
        token: mostly(speech?.token, () => 1),
        reason: pick(['generation', 'playback', 'unavailable'] as const),
      };
    case 'speak-blocked':
      return { type: 'speak-blocked', token: mostly(speech?.token, () => 1) };
    case 'speak-duration':
      return {
        type: 'speak-duration',
        token: mostly(speech?.token, () => 1),
        ms: Math.floor(random() * 20_000),
      };
    case 'end-failed':
      return {
        type: 'end-failed',
        failure: pick([
          { kind: 'failed' },
          { kind: 'offline' },
          { kind: 'nothing-to-review' },
        ] as const),
      };
    case 'timeout':
      return { type: 'timeout', id: mostly(state.timer?.id, () => Math.floor(random() * 20)) };
    case 'hint':
      return { type: 'hint', hint: random() < 0.5 ? null : { code: 'empty' } };
    default:
      return { type: kind } as MachineEvent;
  }
}

describe('random event sequences', () => {
  const SEQUENCES = 400;
  const LENGTH = 140;

  it('never throw, keep every invariant after every event, and visit every phase', () => {
    const visited = new Set<CallPhase>();
    for (let seed = 1; seed <= SEQUENCES; seed++) {
      const random = mulberry32(seed);
      const counter = { n: 0 };
      let state = reduce(initialState({ handsFree: random() < 0.7 }), {
        ...LOADED,
        awaiting:
          random() < 0.15
            ? { id: 'awaiting-1', text: 'earlier', createdAt: 't', inputMode: 'text', turnIndex: 2 }
            : null,
        limitReached: random() < 0.05,
      });
      const history: string[] = [];
      for (let i = 0; i < LENGTH; i++) {
        const event = randomEvent(random, state, counter);
        history.push(event.type);
        const next = reduce(state, event);
        const problems = violations(next);
        if (problems.length > 0) {
          throw new Error(
            `seed ${seed}, step ${i}: ${problems.join('; ')} after ${history.slice(-8).join(' > ')}`,
          );
        }
        visited.add(next.phase);
        state = next;
      }
    }
    expect([...visited].sort()).toEqual([...CALL_PHASES].sort());
  }, 60_000);

  it('create one exchange per utterance and apply each reply at most once', () => {
    for (let seed = 1; seed <= SEQUENCES; seed++) {
      const random = mulberry32(seed * 7919);
      const counter = { n: 0 };
      const created = new Set<string>();
      const replied = new Map<string, number>();
      let state = reduce(initialState(), LOADED);
      for (let i = 0; i < LENGTH; i++) {
        const event = randomEvent(random, state, counter);
        const next = reduce(state, event);
        if (
          !state.exchange &&
          next.exchange &&
          (event.type === 'speech-end' || event.type === 'send-text')
        ) {
          expect(created.has(next.exchange.id)).toBe(false);
          created.add(next.exchange.id);
        }
        if (event.type === 'send-done' && state.exchange && !next.exchange && next !== state) {
          const count = (replied.get(event.id) ?? 0) + 1;
          replied.set(event.id, count);
          expect(count).toBe(1);
        }
        // Exactly one message is ever being sent, and it is the one exchange.
        expect([targets(next).send].filter(Boolean).length).toBeLessThanOrEqual(1);
        state = next;
      }
    }
  }, 60_000);

  it('can always be got out of by letting the timers run: no phase sticks for ever', () => {
    for (let seed = 1; seed <= SEQUENCES; seed++) {
      const random = mulberry32(seed * 104729);
      const counter = { n: 0 };
      let state = reduce(initialState(), LOADED);
      for (let i = 0; i < LENGTH; i++) {
        state = reduce(state, randomEvent(random, state, counter));
        if (i % 3 !== 0) continue;
        // From here, with no more events, only time passes.
        let waiting = state;
        let firings = 0;
        while (waiting.timer && firings < 24) {
          waiting = reduce(waiting, { type: 'timeout', id: waiting.timer.id });
          const problems = violations(waiting);
          if (problems.length > 0) {
            throw new Error(`seed ${seed}, step ${i}: ${problems.join('; ')} while waiting`);
          }
          firings++;
        }
        // Every waiting phase reaches rest by itself, and none ends in a waiting phase.
        if (
          waiting.timer ||
          !['idle', 'ready-for-next-turn', 'completed'].includes(waiting.phase)
        ) {
          throw new Error(
            `seed ${seed}, step ${i}: still in ${waiting.phase} after ${firings} timeouts`,
          );
        }
      }
    }
  }, 60_000);
});
