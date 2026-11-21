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
//   const call = await api.createCall({ scenarioId: 'outlook-shared-mailbox-missing' });
//   await api.send(call.id, 'Hello, my name is Sam. What is happening?');
//   const done = await api.finish(call.id);               // ends the call and waits for the report
//
// IMPORTANT: always build it from `context.request` (or `page.request`), never from the `request`
// fixture. Calls belong to an anonymous profile that is kept in a cookie, and only the browser
// context's own request object shares that cookie with the page. A call made with the `request`
// fixture would be somebody else's call to the browser.

// The conversations below are written for DEFAULT_SCENARIO (Marcus Bell, an Outlook shared mailbox:
// a starter, first-contact scenario with a calm, terse, not very technical customer). The customer
// opens with a greeting and gives the reason for the call only after the first line said to them, so
// every call starts with a greeting. Which wording the customer uses to answer is the engine's; what
// is fixed is which hidden fact a question uncovers.

/**
 * Said to the customer in this order: a call that covers what the coaching looks for. It asks for
 * every hidden fact in DEFAULT_SCENARIO (when he last saw the mailbox, what changed while he was
 * away, who else can see it, what he has tried), shows empathy, takes ownership, gives a time for the
 * next contact and summarises correctly before it ends.
 */
export const GOOD_CALL: readonly string[] = [
  'Hello, thanks for calling Microsoft support. My name is Sam. How can I help you today?',
  "I'm sorry to hear that, I know your team relies on that mailbox. When did you last see it in your list, and what had happened since then?",
  'Thanks. Did anything change while you were away, for example who has access to the shared mailbox?',
  'Can anyone else on the team still see the mailbox, and how are the enquiries being handled for now?',
  'What have you already tried so far, and what happened each time?',
  "Let me make sure I have this right: the shared mailbox went missing from your Outlook while you were on leave, the office manager changed who has access, and Jen can still see it. I'll take ownership of this, ask the office manager to check your access, and call you back by three o'clock today with an update. Is there anything else I can help with?",
];

/**
 * A good call that leaves two of the four hidden facts of DEFAULT_SCENARIO unasked (when he last saw
 * the mailbox, and what he has tried), so its report has facts that were found and facts that were
 * missed.
 */
export const PARTIAL_CALL: readonly string[] = [
  GOOD_CALL[0] as string,
  "I'm sorry to hear that, I know your team relies on that mailbox. Did anything change while you were away, for example who has access to the shared mailbox?",
  GOOD_CALL[3] as string,
  "Let me make sure I have this right: the shared mailbox is missing from your Outlook, the office manager changed who has access, and Jen can still see it. I'll take ownership of this, ask the office manager to check your access, and call you back by three o'clock today with an update. Is there anything else I can help with?",
];

/** A greeting and one question: the shortest call that has anything to report, and a report with limited evidence. */
export const SHORT_CALL: readonly string[] = [
  GOOD_CALL[0] as string,
  'Which mailbox is it, and what do you see in your list instead?',
];

export const DEFAULT_SCENARIO = 'outlook-shared-mailbox-missing';

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
  /** The part of the day the customer's greeting fits ("Good morning"); the browser sends its own. */
  timeOfDay?: CreateSessionRequest['timeOfDay'];
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
      ...(options.timeOfDay ? { timeOfDay: options.timeOfDay } : {}),
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

  /** Deletes a call (and its report) from this profile. */
  async remove(id: string): Promise<void> {
    const path = `/api/sessions/${encodeURIComponent(id)}`;
    const response = await this.request.delete(path);
    if (!response.ok()) throw new ApiFailure(response.status(), null, path);
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
