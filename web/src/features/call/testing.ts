import { act, cleanup, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { vi } from 'vitest';
import type {
  PublicStateDTO,
  SendMessageRequest,
  SendMessageResponse,
  SessionDTO,
  TurnDTO,
} from '#shared/domain/api.ts';
import type { SpeechCapabilitiesDTO, TranscribeResponse } from '#shared/domain/speech.ts';
import { redactSensitive } from '#shared/domain/text.ts';
import { TEMPERATURE_BANDS, type TemperatureBandId } from '#shared/domain/vocab.ts';
import { ApiError, type SpokenTurn } from '../../lib/api.ts';
import { installFakes, type FakeEnv, type FakeOptions } from '../voice/testing/fakes.ts';
import type { CallActions, CallSnapshot, UseCallOptions } from './contract.ts';
import { useCall } from './useCall.ts';

// Test support for the call engine: a fake server that behaves like the real one where it matters
// (a message is saved before its reply, sending the same client message id again never duplicates,
// one message is handled at a time) and can be told to fail, hang or be slow, plus helpers for
// mounting the hook with fake timers.

export const SESSION_ID = 'session-abcdef12';

export const apiError = (
  status: number,
  code: string,
  retryable: boolean,
  details?: unknown,
): ApiError => new ApiError(status, code, `Server said: ${code}`, retryable, details);

export const networkError = (): ApiError => new ApiError(0, 'network', 'offline', true);

export function speechCapabilities(
  overrides: Partial<SpeechCapabilitiesDTO> = {},
): SpeechCapabilitiesDTO {
  return {
    provider: 'azure-speech',
    label: 'Azure AI Speech',
    demo: false,
    transcribe: true,
    synthesize: true,
    expressiveStyles: true,
    notice: null,
    limits: { maxAudioBytes: 1_500_000, maxAudioSeconds: 30, sampleRate: 16000 },
    ...overrides,
  };
}

export const NO_SERVER_SPEECH = speechCapabilities({
  provider: 'none',
  label: 'No speech service',
  transcribe: false,
  synthesize: false,
  expressiveStyles: false,
});

const REPLIES = [
  'Hello, thanks for calling. My account is locked and I cannot sign in at all.',
  'It started this morning after I changed my password.',
  'Just me, but I have a deadline today so it is quite urgent.',
  'I tried the reset link twice and it says the link has expired.',
  'Yes, that would be really helpful, thank you.',
  'Okay, I will wait for that email.',
];

function band(id: TemperatureBandId): PublicStateDTO['band'] {
  const found = TEMPERATURE_BANDS.find((candidate) => candidate.id === id) ?? TEMPERATURE_BANDS[0];
  return { id: found.id, label: found.label };
}

export function publicState(mood: TemperatureBandId = 'calm'): PublicStateDTO {
  return { band: band(mood), trend: 'steady', discoveredCount: 0, silent: false, shifts: 0 };
}

type FailureStep = (request: SendMessageRequest) => ApiError | 'hang' | null;

/** The part of the Firefly server that a call talks to, in memory. */
export class FakeServer {
  readonly id = SESSION_ID;
  status: SessionDTO['status'] = 'active';
  startedAt = '2026-03-02T10:00:00.000Z';
  mood: TemperatureBandId = 'calm';
  maxTurns = 60;
  turns: TurnDTO[] = [];
  private readonly clientIds = new Map<number, string>();
  private replyCount = 0;

  // What the next requests do.
  sendSteps: FailureStep[] = [];
  /** Messages are saved, but this many attempts fail with a retryable conflict first. */
  conflicts = 0;
  sendDelayMs = 0;
  /**
   * A request abandoned by the client (aborted) is still finished by the server, as a real server
   * finishes work it has already started: the message and its reply are saved.
   */
  finishAbandoned = false;
  transcripts: Array<TranscribeResponse | ApiError | 'hang'> = [];
  speakSteps: Array<ApiError | 'hang' | null> = [];
  endSteps: Array<ApiError | null> = [];
  getSteps: Array<ApiError | null> = [];
  /** Lets a call with no messages be ended (the real server refuses: there is nothing to review). */
  allowEmptyEnd = false;

  // What the call did.
  readonly sent: SendMessageRequest[] = [];
  transcribeCalls = 0;
  readonly spoken: number[] = [];
  /** The language each spoken turn was asked for in, in the same order as `spoken`. */
  readonly spokenLanguages: string[] = [];
  endCalls = 0;
  getCalls = 0;
  readonly transcribeSignals: AbortSignal[] = [];
  readonly sendSignals: AbortSignal[] = [];
  readonly speakSignals: AbortSignal[] = [];
  readonly getSignals: AbortSignal[] = [];
  /** The signals of the requests that have not finished yet. */
  readonly openSignals = new Set<AbortSignal>();

  constructor(options: { opening?: boolean; traineeTurns?: number } = {}) {
    if (options.opening !== false) this.addCustomer(REPLIES[0] as string, 'opening');
    for (let i = 0; i < (options.traineeTurns ?? 0); i++) {
      this.addTrainee(`Earlier message ${i + 1}`, `earlier-message-${i + 1}`);
      this.addCustomer(REPLIES[(i + 1) % REPLIES.length] as string, 'live');
    }
  }

  private addCustomer(text: string, source: TurnDTO['source']): TurnDTO {
    const turn: TurnDTO = {
      index: this.turns.length + 1,
      role: 'customer',
      text,
      createdAt: new Date(Date.parse(this.startedAt) + this.turns.length * 1000).toISOString(),
      source,
      inputMode: 'text',
    };
    this.turns.push(turn);
    return turn;
  }

  private addTrainee(text: string, clientMessageId: string, inputMode: 'text' | 'voice' = 'text') {
    const turn: TurnDTO = {
      index: this.turns.length + 1,
      role: 'trainee',
      text,
      createdAt: new Date(Date.parse(this.startedAt) + this.turns.length * 1000).toISOString(),
      source: 'trainee',
      inputMode,
    };
    this.turns.push(turn);
    this.clientIds.set(turn.index, clientMessageId);
    return turn;
  }

  get traineeTurns(): number {
    return this.turns.filter((turn) => turn.role === 'trainee').length;
  }

  /** The trainee's message that was saved but has no reply, as the real session reports it. */
  private awaitingReply(): SessionDTO['awaitingReply'] {
    const last = this.turns[this.turns.length - 1];
    const id = last ? this.clientIds.get(last.index) : undefined;
    return this.status === 'active' && last?.role === 'trainee' && id
      ? { clientMessageId: id, turnIndex: last.index }
      : null;
  }

  /** Saves a trainee message that never got a reply, as a failed customer response leaves it. */
  leaveAwaiting(text: string, clientMessageId: string, inputMode: 'text' | 'voice' = 'text'): void {
    this.addTrainee(text, clientMessageId, inputMode);
  }

  session(): SessionDTO {
    return {
      id: this.id,
      scenarioId: 'locked-out-after-password-reset',
      scenarioTitle: 'Locked out after a password reset',
      issueType: 'sign-in-access',
      difficulty: 'standard',
      startingTemperature: 'frustrated',
      impact: 'medium',
      style: 'talkative',
      mode: 'immersive',
      providerKind: 'mock',
      providerLabel: 'Demo mode',
      status: this.status,
      startedAt: this.startedAt,
      endedAt: this.status === 'active' ? null : '2026-03-02T10:20:00.000Z',
      durationSeconds: this.status === 'active' ? null : 1200,
      traineeTurns: this.traineeTurns,
      completion: null,
      overallScore: null,
      dimensionScores: null,
      scenario: {
        scenarioId: 'locked-out-after-password-reset',
        title: 'Locked out after a password reset',
        summary: 'A customer cannot sign in.',
        issueType: 'sign-in-access',
        tags: [],
        estimatedMinutes: 8,
        persona: { name: 'Priya Nair', role: 'Office manager', organisation: 'Northwind Traders' },
        brief: { situation: 'A customer is locked out.', goal: 'Restore access.', groundRules: [] },
        config: {
          impact: 'medium',
          startingTemperature: 'frustrated',
          proficiency: 'intermediate',
          style: 'talkative',
          callStage: 'first-contact',
          difficulty: 'standard',
          mode: 'immersive',
          curveballsEnabled: false,
        },
        expectedDiscoveryAreas: [],
        coachingFocus: [],
      },
      turns: this.turns.map((turn) => ({ ...turn })),
      state: publicState(this.mood),
      awaitingReply: this.awaitingReply(),
      evaluationPhase: null,
      evaluationError: null,
      report: null,
    };
  }

  private response(trainee: TurnDTO, reply: TurnDTO, redactions: string[]): SendMessageResponse {
    return {
      traineeTurn: { ...trainee },
      customerTurn: { ...reply },
      state: publicState(this.mood),
      redactions: redactions as SendMessageResponse['redactions'],
      turnsRemaining: Math.max(0, this.maxTurns - this.traineeTurns),
    };
  }

  // ---- what the API client calls ----------------------------------------------------------

  /** Remembers a request's signal until the request has finished, however it finishes. */
  private async open<T>(signal: AbortSignal | undefined, work: () => Promise<T>): Promise<T> {
    if (signal) this.openSignals.add(signal);
    try {
      return await work();
    } finally {
      if (signal) this.openSignals.delete(signal);
    }
  }

  async getSession(_id: string, signal?: AbortSignal): Promise<SessionDTO> {
    return this.open(signal, async () => {
      this.getCalls++;
      if (signal) this.getSignals.push(signal);
      const step = this.getSteps.shift();
      if (step) throw step;
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      return this.session();
    });
  }

  async sendMessage(
    _id: string,
    request: SendMessageRequest,
    signal?: AbortSignal,
  ): Promise<SendMessageResponse> {
    return this.open(signal, () => this.receive(request, signal));
  }

  private async receive(
    request: SendMessageRequest,
    signal?: AbortSignal,
  ): Promise<SendMessageResponse> {
    this.sent.push({ ...request });
    if (signal) this.sendSignals.push(signal);
    const planned = this.sendSteps.shift()?.(request) ?? null;
    if (planned === 'hang') {
      // Never answers: it only ends when the caller abandons it.
      return new Promise<never>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    }
    const step = planned;
    if (this.sendDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.sendDelayMs));
    }
    const abandoned = signal?.aborted === true;
    if (abandoned && !this.finishAbandoned) throw new DOMException('Aborted', 'AbortError');
    if (step) {
      // A failed reply still leaves the message saved, like the real server.
      if (step.code.startsWith('provider_') && !this.hasMessage(request.clientMessageId)) {
        const saved = this.addTrainee(
          redactSensitive(request.text.trim()).text,
          request.clientMessageId,
          request.inputMode ?? 'text',
        );
        throw apiError(step.status, step.code, step.retryable, { traineeTurn: saved });
      }
      throw step;
    }
    if (this.status !== 'active') throw apiError(409, 'session_not_active', false);

    const existing = this.turns.find(
      (turn) => this.clientIds.get(turn.index) === request.clientMessageId,
    );
    if (existing) {
      const reply = this.turns.find((turn) => turn.index === existing.index + 1);
      if (reply) return this.response(existing, reply, []);
    } else {
      if (this.conflicts > 0) {
        this.conflicts--;
        throw apiError(409, 'conflict', true);
      }
      if (this.turns[this.turns.length - 1]?.role === 'trainee') {
        throw apiError(409, 'conflict', false);
      }
      if (this.traineeTurns >= this.maxTurns) throw apiError(409, 'turn_limit_reached', false);
    }

    const cleaned = redactSensitive(request.text.trim());
    const trainee =
      existing ??
      this.addTrainee(cleaned.text, request.clientMessageId, request.inputMode ?? 'text');
    const reply = this.addCustomer(REPLIES[++this.replyCount % REPLIES.length] as string, 'live');
    if (abandoned) throw new DOMException('Aborted', 'AbortError');
    return this.response(trainee, reply, existing ? [] : cleaned.redactions);
  }

  private hasMessage(clientMessageId: string): boolean {
    return this.turns.some((turn) => this.clientIds.get(turn.index) === clientMessageId);
  }

  async transcribe(
    _audio: Blob,
    _language: string,
    signal?: AbortSignal,
  ): Promise<TranscribeResponse> {
    return this.open(signal, async () => {
      this.transcribeCalls++;
      if (signal) this.transcribeSignals.push(signal);
      const step = this.transcripts.shift() ?? {
        status: 'recognised' as const,
        text: `Spoken message ${this.transcribeCalls}`,
        durationMs: 1500,
      };
      if (step === 'hang') {
        return new Promise<never>((_resolve, reject) => {
          signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        });
      }
      if (step instanceof Error) throw step;
      return step;
    });
  }

  async speakTurn(
    _id: string,
    turnIndex: number,
    language: string,
    signal?: AbortSignal,
  ): Promise<SpokenTurn> {
    return this.open(signal, async () => {
      this.spoken.push(turnIndex);
      this.spokenLanguages.push(language);
      if (signal) this.speakSignals.push(signal);
      const step = this.speakSteps.shift() ?? null;
      if (step === 'hang') {
        return new Promise<never>((_resolve, reject) => {
          signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        });
      }
      if (step) throw step;
      return {
        audio: new Blob(['audio']),
        contentType: 'audio/mpeg',
        provider: 'azure-speech',
        voice: 'en-GB-SoniaNeural',
        style: 'none',
      };
    });
  }

  async endSession(_id: string): Promise<SessionDTO> {
    this.endCalls++;
    const step = this.endSteps.shift();
    if (step) throw step;
    if (this.status === 'active') {
      if (this.traineeTurns === 0 && !this.allowEmptyEnd) {
        throw apiError(422, 'no_conversation', false);
      }
      this.status = 'completing';
    }
    return this.session();
  }
}

interface Stubbable {
  mockImplementation(implementation: (...args: never[]) => unknown): unknown;
}

export interface MockedApi {
  getSession: Stubbable;
  sendMessage: Stubbable;
  endSession: Stubbable;
  transcribe: Stubbable;
  speakTurn: Stubbable;
}

/** Points the mocked API client at the fake server. */
export function connect(api: MockedApi, server: FakeServer): void {
  api.getSession.mockImplementation((id: string, signal?: AbortSignal) =>
    server.getSession(id, signal),
  );
  api.sendMessage.mockImplementation(
    (id: string, request: SendMessageRequest, signal?: AbortSignal) =>
      server.sendMessage(id, request, signal),
  );
  api.transcribe.mockImplementation((audio: Blob, language: string, signal?: AbortSignal) =>
    server.transcribe(audio, language, signal),
  );
  api.speakTurn.mockImplementation(
    (id: string, turnIndex: number, language: string, signal?: AbortSignal) =>
      server.speakTurn(id, turnIndex, language, signal),
  );
  api.endSession.mockImplementation((id: string) => server.endSession(id));
}

// ---------------------------------------------------------------------------------------
// Mounting

export interface Mounted {
  result: { current: ReturnType<typeof useCall> };
  env: FakeEnv;
  unmount(): void;
  rerender(next?: { sessionId?: string; options?: UseCallOptions }): void;
}

export const defaultOptions = (overrides: Partial<UseCallOptions> = {}): UseCallOptions => ({
  serverSpeech: speechCapabilities(),
  language: 'en-GB',
  maxTraineeTurns: 60,
  ...overrides,
});

/** Lets promises and zero-delay timers run. */
export async function flush(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 4; i++) await vi.advanceTimersByTimeAsync(0);
  });
}

export async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Mounts `useCall` with the fakes installed, and waits for the session to load. */
export async function mountCall(
  options: {
    fakes?: FakeOptions;
    call?: Partial<UseCallOptions>;
    strict?: boolean;
    load?: boolean;
  } = {},
): Promise<Mounted> {
  const env = installFakes({
    recognition: false,
    synthesis: false,
    secureContext: true,
    ...options.fakes,
  });
  const rendered = renderHook(
    (props: { sessionId: string; options: UseCallOptions }) =>
      useCall(props.sessionId, props.options),
    {
      initialProps: { sessionId: SESSION_ID, options: defaultOptions(options.call) },
      ...(options.strict ? { wrapper: StrictMode } : {}),
    },
  );
  if (options.load !== false) await flush();
  return {
    result: rendered.result,
    env,
    unmount: rendered.unmount,
    rerender: (next) =>
      rendered.rerender({
        sessionId: next?.sessionId ?? SESSION_ID,
        options: next?.options ?? defaultOptions(options.call),
      }),
  };
}

/**
 * Everything a call test needs in one place: the fake server, the mounted hook and the fake
 * browser, with the steps a trainee takes (click start, speak a sentence, hear the customer finish).
 */
export class Harness {
  server = new FakeServer();
  private mountedCall: Mounted | null = null;
  private readonly api: MockedApi;

  constructor(api: MockedApi) {
    this.api = api;
  }

  /** Call before each test (after `vi.useFakeTimers()`). */
  setup(serverOptions?: ConstructorParameters<typeof FakeServer>[0]): void {
    this.server = new FakeServer(serverOptions);
    connect(this.api, this.server);
  }

  /** Replaces the server, for a test that needs a call in another state. */
  useServer(server: FakeServer): void {
    this.server = server;
    connect(this.api, server);
  }

  teardown(): void {
    cleanup();
    this.mountedCall?.env.uninstall();
    this.mountedCall = null;
  }

  async mount(options: Parameters<typeof mountCall>[0] = {}): Promise<void> {
    this.mountedCall?.unmount();
    this.mountedCall?.env.uninstall();
    this.mountedCall = await mountCall(options);
  }

  get env(): FakeEnv {
    if (!this.mountedCall) throw new Error('Mount the call first.');
    return this.mountedCall.env;
  }

  get call(): Mounted {
    if (!this.mountedCall) throw new Error('Mount the call first.');
    return this.mountedCall;
  }

  snap(): CallSnapshot {
    return this.call.result.current.snapshot;
  }

  actions(): CallActions {
    return this.call.result.current.actions;
  }

  /** Clicks "start call". */
  async begin(voice = true): Promise<void> {
    await act(async () => {
      await this.actions().begin({ voice });
    });
    await flush();
  }

  /** The customer's voice plays to its end. */
  async customerFinishes(): Promise<void> {
    await act(async () => {
      this.env.element.latest().finish();
    });
  }

  /** The trainee says a sentence into the microphone, and the call is given time to react. */
  async say(options?: Parameters<FakeEnv['audio']['speakSentence']>[0]): Promise<void> {
    await act(async () => {
      this.env.audio.speakSentence(options);
    });
    await flush();
  }

  /** A started voice call: the opening line has been spoken and the microphone is open. */
  async openCall(): Promise<void> {
    await this.begin(true);
    await this.customerFinishes();
    await advance(400);
  }

  /** One full spoken exchange, ending with the trainee's microphone open again. */
  async exchange(): Promise<void> {
    await this.say();
    await this.customerFinishes();
    await advance(400);
  }

  async endCall(): Promise<{ sessionId: string } | null> {
    let outcome: { sessionId: string } | null = null;
    await act(async () => {
      outcome = await this.actions().endCall();
    });
    await flush();
    return outcome;
  }

  /** Does something that changes the call, inside `act`. */
  do(work: () => void): void {
    act(work);
  }
}
