import { act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../lib/api.ts';
import type { FakeEnv } from '../voice/testing/fakes.ts';
import {
  advance,
  apiError,
  connect,
  FakeServer,
  flush,
  mountCall,
  NO_SERVER_SPEECH,
  networkError,
  SESSION_ID,
  speechCapabilities,
  type Mounted,
} from './testing.ts';

vi.mock('../../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    api: {
      getSession: vi.fn(),
      sendMessage: vi.fn(),
      endSession: vi.fn(),
      transcribe: vi.fn(),
      speakTurn: vi.fn(),
    },
  };
});

const mocked = vi.mocked(api);

let server: FakeServer;
let mounted: Mounted;
let env: FakeEnv;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-02T10:00:30.000Z'));
  vi.clearAllMocks();
  server = new FakeServer();
  connect(mocked, server);
});

afterEach(() => {
  cleanup();
  mounted?.env.uninstall();
  vi.useRealTimers();
});

const now = () => mounted.result.current;
const snap = () => mounted.result.current.snapshot;
const actions = () => mounted.result.current.actions;

async function mount(options: Parameters<typeof mountCall>[0] = {}) {
  mounted = await mountCall(options);
  env = mounted.env;
}

/** Clicks "start call". */
async function begin(voice = true) {
  await act(async () => {
    await actions().begin({ voice });
  });
  await flush();
}

/** The customer finishes speaking (the audio element reports the end). */
async function customerFinishes() {
  await act(async () => {
    env.element.latest().finish();
  });
}

/** The trainee says a sentence into the microphone, and the call is given time to react. */
async function say(options?: Parameters<FakeEnv['audio']['speakSentence']>[0]) {
  await act(async () => {
    env.audio.speakSentence(options);
  });
  await flush();
}

/** A started voice call: the opening line has been spoken and the microphone is open. */
async function openCall() {
  await begin(true);
  await customerFinishes();
  await advance(400);
}

describe('loading', () => {
  it('loads the session without touching the microphone, counting time from the server start', async () => {
    await mount();
    const { snapshot } = now();
    expect(snapshot.loading).toBe(false);
    expect(snapshot.loadProblem).toBeNull();
    expect(snapshot.session?.id).toBe(SESSION_ID);
    expect(snapshot.phase).toBe('idle');
    expect(snapshot.mode).toBe('text');
    expect(snapshot.microphone).toBe('unknown');
    expect(snapshot.turns).toEqual([
      expect.objectContaining({
        key: 't1',
        index: 1,
        role: 'customer',
        status: 'sent',
        inputMode: 'text',
        clientMessageId: null,
        interrupted: false,
      }),
    ]);
    expect(snapshot.customerState?.band.id).toBe('calm');
    expect(snapshot.stateHistory).toEqual([{ turnIndex: 1, band: 'calm', label: 'Calm' }]);
    expect(snapshot.turnsRemaining).toBe(60);
    // Thirty seconds after the server's start time, not after the page loaded.
    expect(snapshot.elapsedSeconds).toBe(30);
    await advance(5000);
    expect(snap().elapsedSeconds).toBe(35);
    // Nothing was asked for yet.
    expect(env.mic.getUserMedia).not.toHaveBeenCalled();
    expect(env.contexts).toHaveLength(0);
    expect(env.elements).toHaveLength(0);
    expect(snapshot.announcement).toBeNull();
  });

  it('reports what this browser and server can do before the call begins', async () => {
    await mount({ fakes: { recognition: true, synthesis: true } });
    expect(snap().support).toEqual({
      capture: 'server-speech',
      playback: 'server-speech',
      provider: 'azure-speech',
      chromium: false,
      secureContext: true,
      reason: null,
      captureLabel: 'Azure AI Speech',
      playbackLabel: 'Azure AI Speech',
      speechDemo: false,
    });
  });

  it("falls back to the browser's recognition and voices when the server has no speech service", async () => {
    await mount({
      fakes: { recognition: true, synthesis: true },
      call: { serverSpeech: NO_SERVER_SPEECH },
    });
    expect(snap().support).toMatchObject({
      capture: 'browser-recognition',
      playback: 'browser-synthesis',
      reason: null,
      captureLabel: 'Browser speech recognition',
      playbackLabel: 'Browser voice',
    });
  });

  it('says plainly why a voice call is not possible, and that typing still is', async () => {
    await mount({ call: { serverSpeech: NO_SERVER_SPEECH } });
    expect(snap().support).toMatchObject({ capture: 'none', playback: 'none' });
    expect(snap().support.reason).toMatch(/type your replies/);
    await mount({ fakes: { secureContext: false } });
    expect(snap().support.reason).toMatch(/secure/);
  });

  it('says a call that does not exist cannot be found, without offering a retry that cannot help', async () => {
    server.getSteps.push(apiError(404, 'not_found', false));
    await mount();
    expect(snap().loading).toBe(false);
    expect(snap().session).toBeNull();
    expect(snap().loadProblem).toMatchObject({
      code: 'session-unavailable',
      title: 'We could not find this call.',
      retry: null,
    });
  });

  it('shows a call that cannot be opened as a problem with a way to try again', async () => {
    server.getSteps.push(apiError(500, 'internal', true));
    await mount();
    expect(snap().loading).toBe(false);
    expect(snap().session).toBeNull();
    expect(snap().loadProblem).toMatchObject({ code: 'session-unavailable', retry: 'load' });

    act(() => actions().retry());
    await flush();
    expect(snap().loadProblem).toBeNull();
    expect(snap().session?.id).toBe(SESSION_ID);
  });

  it('shows being offline while loading as offline', async () => {
    server.getSteps.push(networkError());
    await mount();
    expect(snap().loadProblem).toMatchObject({ code: 'offline', retry: 'load' });
  });

  it('shows a call that has already ended as ended, and will not begin', async () => {
    server = new FakeServer({ traineeTurns: 2 });
    server.status = 'completed';
    connect(mocked, server);
    await mount();
    expect(snap().problem).toMatchObject({ code: 'session-ended', retry: null });
    await begin(true);
    expect(snap().phase).toBe('idle');
    expect(env.mic.getUserMedia).not.toHaveBeenCalled();
    // Ending is still fine: it opens the report.
    let ended: { sessionId: string } | null = null;
    await act(async () => {
      ended = await actions().endCall();
    });
    expect(ended).toEqual({ sessionId: SESSION_ID });
  });

  it('knows how many messages are left from the start, and shows a resumed call in full', async () => {
    server = new FakeServer({ traineeTurns: 3 });
    connect(mocked, server);
    await mount({ call: { maxTraineeTurns: 5 } });
    expect(snap().turnsRemaining).toBe(2);
    expect(snap().turns.map((turn) => [turn.index, turn.role])).toEqual([
      [1, 'customer'],
      [2, 'trainee'],
      [3, 'customer'],
      [4, 'trainee'],
      [5, 'customer'],
      [6, 'trainee'],
      [7, 'customer'],
    ]);
    await mount({ call: { maxTraineeTurns: null } });
    expect(snap().turnsRemaining).toBeNull();
  });

  it('refuses everything once a call has reached its message limit', async () => {
    server = new FakeServer({ traineeTurns: 2 });
    connect(mocked, server);
    await mount({ call: { maxTraineeTurns: 2 } });
    expect(snap().problem).toMatchObject({ code: 'turn-limit', retry: null });
    await begin(false);
    let accepted = true;
    await act(async () => {
      accepted = await actions().sendText('one more');
    });
    expect(accepted).toBe(false);
    expect(mocked.sendMessage).not.toHaveBeenCalled();
  });
});

describe('starting a spoken call', () => {
  it('asks for the microphone only when begun, then plays the opening line and opens the microphone', async () => {
    await mount();
    expect(env.mic.getUserMedia).not.toHaveBeenCalled();

    await act(async () => {
      void actions().begin({ voice: true });
    });
    // The microphone was requested inside the click, with the settings that make calls usable.
    expect(env.mic.getUserMedia).toHaveBeenCalledTimes(1);
    expect(env.mic.getUserMedia.mock.calls[0]?.[0]).toMatchObject({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
    await flush();
    expect(snap()).toMatchObject({ mode: 'voice', microphone: 'granted' });
    // Audio playback was unlocked inside the same click.
    expect(env.elements).toHaveLength(1);
    expect(env.element.latest().plays.length).toBeGreaterThan(0);
    // The opening line (turn 1) is being spoken, and nothing is being recorded while it is.
    expect(snap().phase).toBe('customer-speaking');
    expect(server.spoken).toEqual([1]);
    expect(env.audio.listeningWorklets()).toHaveLength(0);
    expect(snap().announcement?.text).toBe(
      'The customer is speaking. You can stop the customer audio at any time.',
    );
    expect(snap().voiceDetails).toMatchObject({
      voice: 'en-GB-SoniaNeural',
      style: 'none',
      language: 'en-GB',
    });

    await customerFinishes();
    expect(snap().phase).toBe('ready-for-next-turn');
    // A short pause so the microphone does not hear the tail of the customer's voice.
    expect(env.audio.listeningWorklets()).toHaveLength(0);
    await advance(349);
    expect(snap().phase).toBe('ready-for-next-turn');
    await advance(2);
    expect(snap().phase).toBe('listening');
    expect(env.audio.listeningWorklets()).toHaveLength(1);
    // Said once the capture reports that the microphone is open, and not before.
    expect(snap().micOpen).toBe(true);
    expect(snap().announcement).toMatchObject({
      text: 'Listening. Speak when you are ready.',
      politeness: 'polite',
    });
  });

  it('does not speak old turns again when a call is resumed', async () => {
    server = new FakeServer({ traineeTurns: 2 });
    connect(mocked, server);
    await mount();
    await begin(true);
    expect(server.spoken).toEqual([]);
    expect(snap().phase).toBe('ready-for-next-turn');
    await advance(400);
    expect(snap().phase).toBe('listening');
  });

  it('never touches the microphone in a typed call', async () => {
    await mount();
    await begin(false);
    expect(snap()).toMatchObject({
      phase: 'ready-for-next-turn',
      mode: 'text',
      microphone: 'unknown',
    });
    expect(env.mic.getUserMedia).not.toHaveBeenCalled();
    expect(env.contexts).toHaveLength(0);
    // The customer is not spoken to a typed call, but audio was unlocked so Replay can work.
    expect(server.spoken).toEqual([]);
    act(() => actions().talk());
    act(() => actions().toggleMute());
    act(() => actions().togglePause());
    expect(snap()).toMatchObject({ phase: 'ready-for-next-turn', muted: false, paused: false });
  });

  it('goes back to the start, with how to allow the microphone, when permission is refused', async () => {
    await mount({
      fakes: { userAgent: 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0' },
    });
    env.mic.mode = 'deny';
    await begin(true);
    expect(snap()).toMatchObject({ phase: 'idle', mode: 'text', microphone: 'denied' });
    expect(snap().problem).toMatchObject({
      code: 'microphone-denied',
      retry: 'microphone',
      textFallback: true,
      severity: 'blocking',
    });
    expect(snap().problem?.advice).toMatch(/lock icon in the address bar/);
    expect(snap().problem?.advice).toMatch(/Permissions for this site/);
    expect(env.mic.openTracks()).toHaveLength(0);
    expect(env.audio.openContexts()).toHaveLength(0);
    // A blocked microphone is the one thing said assertively, in the voice layer's own sentence.
    expect(snap().announcement).toMatchObject({
      text: 'The microphone is blocked. You can type your replies instead.',
      politeness: 'assertive',
    });
    expect(snap().problem?.announce).toBe('assertive');

    // Allowed after all: Retry starts the call.
    env.mic.mode = 'grant';
    act(() => actions().retry());
    await flush();
    expect(snap().problem).toBeNull();
    expect(snap().phase).toBe('customer-speaking');
  });

  it('explains a missing or busy microphone, and carries on typing from the start screen', async () => {
    await mount();
    env.mic.mode = 'missing';
    await begin(true);
    expect(snap().problem?.code).toBe('microphone-missing');
    env.mic.mode = 'busy';
    await begin(true);
    expect(snap().problem?.code).toBe('microphone-busy');
    // "Continue by typing" is simply a typed begin.
    await begin(false);
    expect(snap()).toMatchObject({ phase: 'ready-for-next-turn', mode: 'text' });
  });

  it('gives up on a permission prompt nobody answers, and ignores a late answer', async () => {
    await mount();
    env.mic.mode = 'hang';
    await act(async () => {
      void actions().begin({ voice: true });
    });
    expect(snap().phase).toBe('requesting-microphone');
    expect(snap().microphone).toBe('prompt');
    await advance(60_000);
    expect(snap()).toMatchObject({ phase: 'idle', microphone: 'unavailable' });
    expect(snap().problem?.code).toBe('microphone-busy');
    // The prompt is answered at last: the stream is stopped at once, nothing starts.
    await act(async () => {
      env.mic.settle('grant');
    });
    await flush();
    expect(snap().phase).toBe('idle');
    expect(env.mic.openTracks()).toHaveLength(0);
    expect(env.audio.openContexts()).toHaveLength(0);
  });

  it('is unsupported, with a problem, when no way of capturing speech exists', async () => {
    await mount({ call: { serverSpeech: NO_SERVER_SPEECH } });
    await begin(true);
    expect(snap().phase).toBe('idle');
    expect(snap().problem).toMatchObject({
      code: 'microphone-unsupported',
      retry: null,
      textFallback: true,
    });
    expect(env.mic.getUserMedia).not.toHaveBeenCalled();
  });

  it('falls back to the browser recognition when the worklet cannot load, and to typing when there is none', async () => {
    await mount({ fakes: { recognition: true } });
    env.audio.workletFails = true;
    await begin(true);
    expect(snap().support.capture).toBe('browser-recognition');
    expect(snap().problem).toBeNull();
    expect(snap().phase).toBe('customer-speaking');
    cleanup();
    mounted.env.uninstall();

    await mount();
    env.audio.workletFails = true;
    await begin(true);
    expect(snap().phase).toBe('idle');
    expect(snap().problem?.code).toBe('microphone-unsupported');
    expect(env.mic.openTracks()).toHaveLength(0);
  });
});

describe('a spoken turn', () => {
  it('goes listening, transcribing, processing, customer-speaking and back to the trainee', async () => {
    await mount();
    server.transcripts.push({
      status: 'recognised',
      text: 'Hello Priya, how can I help?',
      durationMs: 1700,
    });
    await openCall();
    expect(snap().phase).toBe('listening');
    expect(snap().speechDetected).toBe(false);

    // The trainee starts speaking: the level meter moves and speech is detected.
    env.audio.analyserRms = 0.1;
    await act(async () => {
      env.audio.feed(new Float32Array(16000 * 0.6).fill(0.2));
    });
    await advance(200);
    expect(snap().speechDetected).toBe(true);
    expect(snap().micLevel).toBeGreaterThan(0.4);

    // They stop: the silence ends the utterance and it goes to the speech service as a WAV.
    await say({ leadMs: 0, speechMs: 600, trailMs: 1500 });
    expect(mocked.transcribe).toHaveBeenCalledTimes(1);
    const sent = mocked.transcribe.mock.calls[0] as [Blob, string, AbortSignal];
    expect(sent[0].type).toBe('audio/wav');
    expect(sent[1]).toBe('en-GB');
    expect(snap().speechDetected).toBe(false);
    expect(snap().micLevel).toBe(0);
    // ... and the transcript has a place for it, then the words, then the reply.
    expect(mocked.sendMessage).toHaveBeenCalledTimes(1);
    const request = mocked.sendMessage.mock.calls[0]?.[1];
    expect(request).toMatchObject({ text: 'Hello Priya, how can I help?', inputMode: 'voice' });
    expect(request.clientMessageId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);

    const turns = snap().turns;
    expect(turns.map((turn) => [turn.role, turn.status, turn.inputMode])).toEqual([
      ['customer', 'sent', 'text'],
      ['trainee', 'sent', 'voice'],
      ['customer', 'sent', 'text'],
    ]);
    expect(turns[1]).toMatchObject({
      index: 2,
      text: 'Hello Priya, how can I help?',
      key: request.clientMessageId,
      clientMessageId: request.clientMessageId,
    });
    expect(snap().phase).toBe('customer-speaking');
    expect(server.spoken).toEqual([1, 3]);
    expect(snap().stateHistory.map((point) => point.turnIndex)).toEqual([1, 3]);
    expect(snap().turnsRemaining).toBe(59);
    expect(env.audio.listeningWorklets()).toHaveLength(0);

    await customerFinishes();
    await advance(400);
    expect(snap().phase).toBe('listening');
  });

  it('shows each stage as it happens: a placeholder while transcribing, then sending, then sent', async () => {
    await mount();
    let finishTranscription: (value: {
      status: 'recognised';
      text: string;
      durationMs: number;
    }) => void = () => undefined;
    mocked.transcribe.mockImplementationOnce(
      () => new Promise((resolve) => (finishTranscription = resolve)),
    );
    server.sendDelayMs = 500;
    await openCall();
    await say();
    expect(snap().phase).toBe('transcribing');
    expect(snap().turns.at(-1)).toMatchObject({
      role: 'trainee',
      status: 'transcribing',
      text: '',
      index: null,
    });
    const key = snap().turns.at(-1)?.key;

    await act(async () => {
      finishTranscription({
        status: 'recognised',
        text: 'Let me look into that',
        durationMs: 1000,
      });
    });
    await flush();
    expect(snap().phase).toBe('processing');
    expect(snap().turns.at(-1)).toMatchObject({
      status: 'sending',
      text: 'Let me look into that',
      key,
    });

    await advance(500);
    await flush();
    expect(snap().turns.at(-2)).toMatchObject({
      status: 'sent',
      text: 'Let me look into that',
      key,
      index: 2,
    });
  });

  it('shows what the server stored, with personal details removed, and says so', async () => {
    await mount();
    server.transcripts.push({
      status: 'recognised',
      text: 'My email is sam@example.com',
      durationMs: 1000,
    });
    await openCall();
    await say();
    expect(snap().turns.at(-2)?.text).toBe('My email is [email removed]');
    expect(snap().hint).toMatch(/removed an email address before saving/i);
  });

  describe('with the server’s speech service, hands-free listening is never ended by quiet', () => {
    it('stays listening through minutes of silence, says once that it is still listening, and the next sentence is sent exactly once and answered', async () => {
      await mount();
      await openCall();
      await advance(15_000 - 100);
      expect(snap().hint).toBeNull();
      await advance(100);
      expect(snap().hint).toBe('Still listening. Speak when you are ready.');
      expect(snap().announcement?.text).toBe('Still listening. Speak when you are ready.');
      const said = snap().announcement?.id;

      // Five minutes of nothing: the same pass is still open, nothing is counted and nothing is said again.
      await advance(5 * 60_000);
      expect(snap()).toMatchObject({
        phase: 'listening',
        paused: false,
        problem: null,
        micOpen: true,
        autoListening: true,
        hint: 'Still listening. Speak when you are ready.',
      });
      expect(snap().announcement?.id).toBe(said);
      expect(env.audio.listeningWorklets()).toHaveLength(1);
      expect(mocked.transcribe).not.toHaveBeenCalled();

      await say();
      expect(mocked.transcribe).toHaveBeenCalledTimes(1);
      expect(mocked.sendMessage).toHaveBeenCalledTimes(1);
      expect(snap().phase).toBe('customer-speaking');
      expect(snap().turns.map((turn) => turn.role)).toEqual(['customer', 'trainee', 'customer']);
      expect(snap().hint).toBeNull();
      await customerFinishes();
      await advance(400);
      expect(snap().phase).toBe('listening');
    });

    it('pauses the call by itself after ten minutes of quiet, lets go of the microphone, and listens again on Resume', async () => {
      await mount();
      await openCall();
      await advance(10 * 60_000 - 100);
      expect(snap()).toMatchObject({ phase: 'listening', paused: false });
      await advance(100);
      expect(snap()).toMatchObject({
        paused: true,
        stage: 'paused',
        hint: 'Paused after 10 minutes without sound. Press Resume to carry on.',
        announcement: {
          text: 'Paused after 10 minutes without sound. Press Resume to carry on.',
        },
      });
      expect(env.mic.openTracks()).toHaveLength(0);
      expect(env.audio.listeningWorklets()).toHaveLength(0);
      await advance(60_000);
      expect(snap().paused).toBe(true);

      act(() => actions().togglePause());
      await advance(400);
      expect(snap()).toMatchObject({ paused: false, phase: 'listening', hint: null });
      expect(env.mic.openTracks()).toHaveLength(1);
      expect(env.audio.listeningWorklets()).toHaveLength(1);
      await say();
      expect(mocked.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('starts the ten minutes again whenever the trainee makes a sound, so only unbroken quiet pauses the call', async () => {
      await mount();
      await openCall();
      await advance(9 * 60_000);
      expect(snap().hint).toBe('Still listening. Speak when you are ready.');
      // A cough: heard, and let go of as not a turn.
      await say({ speechMs: 200 });
      expect(mocked.transcribe).not.toHaveBeenCalled();
      expect(snap()).toMatchObject({ phase: 'listening', hint: null, speechDetected: false });
      await advance(9 * 60_000);
      expect(snap().paused).toBe(false);
      await advance(60_000);
      expect(snap().paused).toBe(true);
    });

    it('still gives up on a recogniser that hears speech but never finds words: three tries, then Talk', async () => {
      await mount();
      server.transcripts.push(
        { status: 'no-speech', text: '', durationMs: 900 },
        { status: 'no-speech', text: '', durationMs: 900 },
        { status: 'no-speech', text: '', durationMs: 900 },
        { status: 'no-speech', text: '', durationMs: 900 },
      );
      await openCall();
      for (let attempt = 1; attempt <= 3; attempt++) {
        await say();
        expect(snap().hint).toMatch(/no words could be made out/i);
        expect(snap().autoListening).toBe(true);
        await advance(400);
        expect(snap().phase).toBe('listening');
      }
      await say();
      expect(snap().phase).toBe('ready-for-next-turn');
      expect(snap().autoListening).toBe(false);
      await advance(60_000);
      expect(snap().phase).toBe('ready-for-next-turn');
      expect(env.audio.listeningWorklets()).toHaveLength(0);
      expect(mocked.sendMessage).not.toHaveBeenCalled();
      act(() => actions().talk());
      expect(snap().phase).toBe('listening');
      expect(snap().hint).toBeNull();
    });
  });

  it('treats a transcription with no words as nothing heard: no message, no empty turn, and typing is offered', async () => {
    await mount();
    server.transcripts.push({ status: 'no-speech', text: '', durationMs: 900 });
    await openCall();
    await say();
    expect(mocked.sendMessage).not.toHaveBeenCalled();
    expect(snap().turns).toHaveLength(1);
    expect(snap().hint).toMatch(/no words could be made out/i);
    expect(snap().hint).toMatch(/use text/);
    expect(snap().problem).toBeNull();
    expect(snap().phase).toBe('ready-for-next-turn');
  });

  it('treats a transcription that is only spaces the same way', async () => {
    await mount();
    server.transcripts.push({ status: 'recognised', text: '   ', durationMs: 900 });
    await openCall();
    await say();
    expect(mocked.sendMessage).not.toHaveBeenCalled();
    expect(snap().turns).toHaveLength(1);
    expect(snap().hint).toMatch(/no words could be made out/i);
  });

  it('keeps push-to-talk calls closed until the trainee presses Talk, and Talk again finishes', async () => {
    await mount();
    act(() => actions().setHandsFree(false));
    await begin(true);
    await customerFinishes();
    await advance(5000);
    expect(snap().phase).toBe('ready-for-next-turn');
    expect(snap().handsFree).toBe(false);
    expect(env.audio.listeningWorklets()).toHaveLength(0);

    act(() => actions().talk());
    expect(snap().phase).toBe('listening');
    await act(async () => {
      env.audio.feed(new Float32Array(16000 * 1).fill(0.2));
    });
    // Pressing Talk again ends the utterance now instead of waiting for silence.
    act(() => actions().stopTalking());
    await flush();
    expect(mocked.transcribe).toHaveBeenCalledTimes(1);
    expect(snap().phase).toBe('customer-speaking');
  });

  it('cuts an utterance sent from a long speech at the limit and carries on', async () => {
    await mount();
    await openCall();
    await act(async () => {
      env.audio.feed(new Float32Array(16000 * 31).fill(0.2));
    });
    await flush();
    expect(mocked.transcribe).toHaveBeenCalledTimes(1);
    expect(snap().turns.at(-2)?.status).toBe('sent');
  });
});

describe('typing during a spoken call', () => {
  it('lets the trainee type instead, taking the turn from the microphone and the customer', async () => {
    await mount();
    await openCall();
    expect(env.audio.listeningWorklets()).toHaveLength(1);

    let accepted = false;
    await act(async () => {
      accepted = await actions().sendText('  Typed instead  ');
    });
    expect(accepted).toBe(true);
    expect(mocked.sendMessage).toHaveBeenCalledTimes(1);
    expect(mocked.sendMessage.mock.calls[0]?.[1]).toMatchObject({
      text: 'Typed instead',
      inputMode: 'text',
    });
    expect(snap().turns.at(-2)).toMatchObject({
      role: 'trainee',
      inputMode: 'text',
      status: 'sent',
    });
    expect(env.audio.listeningWorklets()).toHaveLength(0);

    // Typing over the customer's voice stops it and marks the turn.
    await flush();
    expect(snap().phase).toBe('customer-speaking');
    let again = false;
    await act(async () => {
      again = await actions().sendText('Another thought');
    });
    expect(again).toBe(true);
    expect(snap().turns.find((turn) => turn.index === 3)?.interrupted).toBe(true);
    // The first voice was stopped, not left to play on beside the next one.
    expect(env.element.maxConcurrent).toBeLessThanOrEqual(1);
    expect(env.urls.live().length).toBeLessThanOrEqual(1);
  });

  it('refuses empty, too long and badly timed messages without losing anything', async () => {
    await mount();
    await begin(false);
    const results: boolean[] = [];
    await act(async () => {
      results.push(await actions().sendText('   '));
    });
    expect(snap().hint).toBe('Type a message first.');
    await act(async () => {
      results.push(await actions().sendText('x'.repeat(1501)));
    });
    expect(snap().hint).toMatch(/up to 1,500 characters/);
    expect(results).toEqual([false, false]);
    expect(mocked.sendMessage).not.toHaveBeenCalled();
  });

  it('will not send before the call has begun', async () => {
    await mount();
    let accepted = true;
    await act(async () => {
      accepted = await actions().sendText('hello');
    });
    expect(accepted).toBe(false);
    expect(snap().hint).toBe('Start the call first.');
  });

  it('resolves false, with a hint, when the server refuses the message itself', async () => {
    await mount();
    await begin(false);
    server.sendSteps.push(() => apiError(400, 'validation_failed', false));
    let accepted = true;
    await act(async () => {
      accepted = await actions().sendText('hello');
    });
    expect(accepted).toBe(false);
    expect(snap().turns).toHaveLength(1);
    expect(snap().hint).toBe('That message could not be sent. Check it and retry.');
    expect(snap().phase).toBe('ready-for-next-turn');
  });
});

describe('support for a caption-only browser', () => {
  it('says once that replies are captions only, and carries on', async () => {
    await mount({ fakes: { audioElement: false } });
    await begin(true);
    expect(snap().support.playback).toBe('none');
    expect(snap().phase).toBe('ready-for-next-turn');
    expect(snap().hint).toMatch(/captions/);
    expect(server.spoken).toEqual([]);
    expect(speechCapabilities().synthesize).toBe(true);
  });
});
