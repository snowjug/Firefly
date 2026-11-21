import type { APIRequestContext, APIResponse } from '@playwright/test';
import type {
  ApiErrorBody,
  AppConfigDTO,
  CreateSessionRequest,
  PublicScenarioDTO,
  SendMessageResponse,
  SessionDTO,
} from '../../shared/domain/api.ts';

// Drives Firefly through its HTTP API, for the parts of a journey that are not what is being tested:
// getting to a call that is already half way through, or finished, without clicking through it.
//
//   const api = new FireflyApi(context.request);          // the fixture `api` does this for you
//   const call = await api.createCall({ scenarioId: 'locked-out-after-password-reset' });
//   await api.send(call.id, 'Hello, my name is Sam. What is happening?');
//   const done = await api.finish(call.id);               // ends the call and waits for the report
//
// IMPORTANT: always build it from `context.request` (or `page.request`), never from the `request`
// fixture. Calls belong to an anonymous profile that is kept in a cookie, and only the browser
// context's own request object shares that cookie with the page. A call made with the `request`
// fixture would be somebody else's call to the browser.

/** Said to the customer in this order, a spoken-or-typed call that covers what the coaching looks for. */
export const GOOD_CALL: readonly string[] = [
  'Hello, thanks for calling. My name is Sam. What is happening?',
  "I'm sorry about the trouble this morning, I know you need the portal for your patients. Can you read me exactly what the sign-in message says?",
  'Thanks. When did it last work, and did anything change before it stopped?',
  'Is your work email or the portal signed in on another device, like a phone or tablet, that might still have your old password?',
  'What have you already tried so far, and what did you see each time?',
  "Let me summarise so I have it right: your account was locked after repeated attempts with the old password. I'll take ownership of this, get the account unlocked and call you back by ten o'clock to confirm you can sign in. Is there anything else I can help with?",
];

export const DEFAULT_SCENARIO = 'locked-out-after-password-reset';

export const FAILURE_TARGETS = [
  'customer',
  'classifier',
  'evaluator',
  'transcribe',
  'synthesize',
] as const;
export type FailureTarget = (typeof FAILURE_TARGETS)[number];

/** A request that did not succeed, with what the server said. */
export class ApiFailure extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, body: ApiErrorBody | null, path: string) {
    super(`${path} failed with ${status}${body ? ` (${body.error.code})` : ''}`);
    this.name = 'ApiFailure';
    this.status = status;
    this.code = body?.error.code ?? 'unknown';
  }
}

export interface CreateCallOptions {
  scenarioId?: string;
  overrides?: CreateSessionRequest['overrides'];
  /** `guided` shows live hints during the call; `immersive` (the default) is the standard call. */
  mode?: CreateSessionRequest['mode'];
  clientRequestId?: string;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function bodyOf<T>(response: APIResponse, path: string): Promise<T> {
  if (!response.ok()) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = null;
    }
    throw new ApiFailure(response.status(), body, path);
  }
  return (await response.json()) as T;
}

export class FireflyApi {
  private readonly request: APIRequestContext;
  private counter = 0;
  /** A failure was queued with `failNext`, so `clearFailures` should run when the test ends. */
  queuedFailures = false;

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  /** The server's settings: provider, speech provider, limits. */
  async config(): Promise<AppConfigDTO> {
    return bodyOf<AppConfigDTO>(await this.request.get('/api/config'), '/api/config');
  }

  async scenarios(): Promise<PublicScenarioDTO[]> {
    const { scenarios } = await bodyOf<{ scenarios: PublicScenarioDTO[] }>(
      await this.request.get('/api/scenarios'),
      '/api/scenarios',
    );
    return scenarios;
  }

  async createCall(options: CreateCallOptions = {}): Promise<SessionDTO> {
    const data: CreateSessionRequest = {
      scenarioId: options.scenarioId ?? DEFAULT_SCENARIO,
      ...(options.overrides ? { overrides: options.overrides } : {}),
      mode: options.mode ?? 'immersive',
      ...(options.clientRequestId ? { clientRequestId: options.clientRequestId } : {}),
    };
    const { session } = await bodyOf<{ session: SessionDTO }>(
      await this.request.post('/api/sessions', { data }),
      '/api/sessions',
    );
    return session;
  }

  async session(id: string): Promise<SessionDTO> {
    const path = `/api/sessions/${encodeURIComponent(id)}`;
    const { session } = await bodyOf<{ session: SessionDTO }>(await this.request.get(path), path);
    return session;
  }

  /** Sends one typed message. A rate limit is waited out, never failed on: a long call is sent quickly. */
  async send(
    id: string,
    text: string,
    options: { clientMessageId?: string; inputMode?: 'text' | 'voice' } = {},
  ): Promise<SendMessageResponse> {
    const path = `/api/sessions/${encodeURIComponent(id)}/messages`;
    const data = {
      text,
      clientMessageId: options.clientMessageId ?? this.nextMessageId(),
      ...(options.inputMode ? { inputMode: options.inputMode } : {}),
    };
    for (let attempt = 0; ; attempt++) {
      const response = await this.request.post(path, { data });
      if (response.status() === 429 && attempt < 40) {
        await sleep(1_100);
        continue;
      }
      return bodyOf<SendMessageResponse>(response, path);
    }
  }

  /** Sends each line in turn and returns the replies. `spoken` marks them as recognised from speech. */
  async play(
    id: string,
    lines: readonly string[],
    options: { inputMode?: 'text' | 'voice' } = {},
  ): Promise<SendMessageResponse[]> {
    const replies: SendMessageResponse[] = [];
    for (const line of lines) replies.push(await this.send(id, line, options));
    return replies;
  }

  /** Ends the call. The report is built in the background; use `waitForReport` or `finish` to see it. */
  async end(id: string): Promise<SessionDTO> {
    const path = `/api/sessions/${encodeURIComponent(id)}/end`;
    const { session } = await bodyOf<{ session: SessionDTO }>(
      await this.request.post(path, { data: {} }),
      path,
    );
    return session;
  }

  /** Waits until the call has a report or the evaluation has failed. */
  async waitForReport(id: string, timeoutMs = 20_000): Promise<SessionDTO> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const session = await this.session(id);
      if (session.status === 'completed' || session.status === 'evaluation_failed') return session;
      if (Date.now() > deadline) throw new Error(`The report for ${id} was not ready in time.`);
      await sleep(150);
    }
  }

  /** Ends the call and waits for its report. */
  async finish(id: string): Promise<SessionDTO> {
    await this.end(id);
    return this.waitForReport(id);
  }

  /** Makes a call, says `lines` in it and, unless told not to, ends it. The common way to get a report. */
  async completedCall(
    options: CreateCallOptions & { lines?: readonly string[]; inputMode?: 'text' | 'voice' } = {},
  ): Promise<SessionDTO> {
    const { lines = GOOD_CALL, inputMode, ...create } = options;
    const call = await this.createCall(create);
    await this.play(call.id, lines, inputMode ? { inputMode } : {});
    return this.finish(call.id);
  }

  /** Makes the next `count` model or speech calls of this kind fail, as a service that is briefly down would. */
  async failNext(target: FailureTarget, count = 1): Promise<void> {
    const response = await this.request.post('/api/test/fail-next', { data: { target, count } });
    if (!response.ok()) throw new ApiFailure(response.status(), null, '/api/test/fail-next');
    if (count > 0) this.queuedFailures = true;
  }

  /** Clears any failure that was queued and not used. */
  async clearFailures(): Promise<void> {
    for (const target of FAILURE_TARGETS) await this.failNext(target, 0);
    this.queuedFailures = false;
  }

  private nextMessageId(): string {
    this.counter += 1;
    return `e2e-${Date.now().toString(36)}-${this.counter}`;
  }
}
