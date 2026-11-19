import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { PromptRequest } from '../prompts/types.ts';
import { rejection, startFakeLlm, type FakeLlm, type Step } from './fake-llm-server.ts';
import { createChatClient, MAX_RETRY_AFTER_MS, type LiveConfig } from './http.ts';
import { ProviderError } from './types.ts';

const KEY = 'sk-test-SECRET-KEY-4f9a1c';
const TRANSCRIPT = 'my printer sheds paper confetti every tuesday';

const request: PromptRequest = {
  messages: [
    { role: 'system', content: 'You are a test.' },
    { role: 'user', content: TRANSCRIPT },
  ],
  temperature: 0.2,
  maxTokens: 50,
  json: false,
};

let llm: FakeLlm;
beforeAll(async () => {
  llm = await startFakeLlm();
});
afterEach(() => llm.reset());
afterAll(() => llm.close());

const azure = (extra: Partial<Extract<LiveConfig, { kind: 'azure-openai' }>> = {}): LiveConfig => ({
  kind: 'azure-openai',
  endpoint: llm.origin,
  apiKey: KEY,
  deployment: 'gpt 4/o',
  apiVersion: '2024-10-21',
  timeoutMs: 2000,
  maxRetries: 2,
  ...extra,
});

const compatible = (
  extra: Partial<Extract<LiveConfig, { kind: 'openai-compatible' }>> = {},
): LiveConfig => ({
  kind: 'openai-compatible',
  baseUrl: llm.baseUrl,
  apiKey: KEY,
  model: 'test-model',
  timeoutMs: 2000,
  maxRetries: 2,
  ...extra,
});

const gemini = (extra: Partial<Extract<LiveConfig, { kind: 'gemini' }>> = {}): LiveConfig => ({
  kind: 'gemini',
  baseUrl: llm.baseUrl,
  apiKey: KEY,
  model: 'gemini-test',
  timeoutMs: 2000,
  maxRetries: 2,
  ...extra,
});

/** A sleep that records the wait instead of waiting. */
function recordedSleep() {
  const waits: number[] = [];
  return {
    waits,
    sleep: (ms: number) => {
      waits.push(ms);
      return Promise.resolve();
    },
  };
}

async function failureOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected the call to fail');
}

async function providerErrorOf(promise: Promise<unknown>): Promise<ProviderError> {
  const error = await failureOf(promise);
  expect(error).toBeInstanceOf(ProviderError);
  return error as ProviderError;
}

describe('request shape', () => {
  it('calls an Azure OpenAI deployment with the api-key header and no model in the body', async () => {
    llm.enqueue({ reply: 'hello' });
    const result = await createChatClient(azure()).complete(request);
    expect(result).toEqual({ content: 'hello', finishReason: 'stop' });

    const sent = llm.requests[0];
    expect(sent?.method).toBe('POST');
    expect(sent?.path).toBe('/openai/deployments/gpt%204%2Fo/chat/completions');
    expect(sent?.query).toEqual({ 'api-version': '2024-10-21' });
    expect(sent?.headers['api-key']).toBe(KEY);
    expect(sent?.headers.authorization).toBeUndefined();
    expect(sent?.headers['content-type']).toBe('application/json');
    expect(sent?.body).toEqual({
      messages: request.messages,
      temperature: 0.2,
      max_tokens: 50,
    });
  });

  it('calls an OpenAI-compatible endpoint with a bearer token and the model in the body', async () => {
    llm.enqueue({ reply: 'hello' });
    await createChatClient(compatible()).complete(request);

    const sent = llm.requests[0];
    expect(sent?.path).toBe('/v1/chat/completions');
    expect(sent?.query).toEqual({});
    expect(sent?.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(sent?.headers['api-key']).toBeUndefined();
    expect(sent?.body?.model).toBe('test-model');
    expect(sent?.body?.messages).toEqual(request.messages);
    // Gemini-only settings are not sent to other endpoints.
    expect(sent?.body?.reasoning_effort).toBeUndefined();
    expect(sent?.body?.max_tokens).toBe(50);
  });

  it('calls Gemini with a bearer token, the lowest reasoning effort and room to think', async () => {
    llm.enqueue({ reply: 'hello' });
    await createChatClient(gemini()).complete(request);

    const sent = llm.requests[0];
    expect(sent?.path).toBe('/v1/chat/completions');
    expect(sent?.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(sent?.headers['x-goog-api-key']).toBeUndefined();
    expect(sent?.body?.model).toBe('gemini-test');
    expect(sent?.body?.reasoning_effort).toBe('minimal');
    // Thinking counts against the limit, so the visible reply keeps its own budget.
    expect(sent?.body?.max_tokens).toBeGreaterThan(request.maxTokens);
  });

  it('asks for a JSON object only when the request wants one', async () => {
    llm.enqueue({ reply: '{}' }, { reply: '{}' });
    const client = createChatClient(compatible());
    await client.complete({ ...request, json: true });
    await client.complete(request);
    expect(llm.requests[0]?.body?.response_format).toEqual({ type: 'json_object' });
    expect(llm.requests[1]?.body?.response_format).toBeUndefined();
  });

  it('tolerates trailing slashes in the configured addresses', async () => {
    llm.enqueue({ reply: 'a' }, { reply: 'b' });
    await createChatClient(azure({ endpoint: `${llm.origin}///` })).complete(request);
    await createChatClient(compatible({ baseUrl: `${llm.baseUrl}/` })).complete(request);
    expect(llm.requests.map((r) => r.path)).toEqual([
      '/openai/deployments/gpt%204%2Fo/chat/completions',
      '/v1/chat/completions',
    ]);
  });

  it('reads replies that arrive as content parts', async () => {
    llm.enqueue({
      status: 200,
      json: {
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: [
                { type: 'text', text: 'one ' },
                { type: 'text', text: 'two' },
              ],
            },
          },
        ],
      },
    });
    expect((await createChatClient(compatible()).complete(request)).content).toBe('one two');
  });

  it('adds headroom for reasoning models once the endpoint asks for max_completion_tokens', async () => {
    llm.enqueue(
      rejection(
        "Unsupported parameter: 'max_tokens' is not supported with this model.",
        'max_tokens',
      ),
      { reply: 'ok' },
    );
    await createChatClient(compatible()).complete(request);
    const retried = llm.requests[1]?.body;
    expect(retried?.max_tokens).toBeUndefined();
    expect(retried?.max_completion_tokens).toBeGreaterThan(request.maxTokens);
  });
});

describe('retries', () => {
  it('retries a rate limit after the Retry-After delay', async () => {
    const { waits, sleep } = recordedSleep();
    llm.enqueue({ status: 429, headers: { 'retry-after': '2' }, json: {} }, { reply: 'ok' });
    const result = await createChatClient(compatible(), { sleep }).complete(request);
    expect(result.content).toBe('ok');
    expect(llm.requests).toHaveLength(2);
    expect(waits).toEqual([2000]);
  });

  it('caps a long Retry-After', async () => {
    const { waits, sleep } = recordedSleep();
    llm.enqueue({ status: 429, headers: { 'retry-after': '120' }, json: {} }, { reply: 'ok' });
    await createChatClient(compatible(), { sleep }).complete(request);
    expect(waits).toEqual([MAX_RETRY_AFTER_MS]);
    expect(MAX_RETRY_AFTER_MS).toBeLessThanOrEqual(5000);
  });

  it('understands a Retry-After in milliseconds', async () => {
    const { waits, sleep } = recordedSleep();
    llm.enqueue({ status: 429, headers: { 'retry-after-ms': '250' }, json: {} }, { reply: 'ok' });
    await createChatClient(compatible(), { sleep }).complete(request);
    expect(waits).toEqual([250]);
  });

  it('understands a Retry-After given as a date, and ignores one it cannot read', async () => {
    const { waits, sleep } = recordedSleep();
    const inThreeSeconds = new Date(Date.now() + 3000).toUTCString();
    llm.enqueue(
      { status: 429, headers: { 'retry-after': inThreeSeconds }, json: {} },
      { status: 429, headers: { 'retry-after': 'soon' }, json: {} },
      { reply: 'ok' },
    );
    await createChatClient(compatible(), { sleep }).complete(request);
    expect(waits[0]).toBeGreaterThan(1000);
    expect(waits[0]).toBeLessThanOrEqual(3000);
    expect(waits[1]).toBe(600); // an unreadable header falls back to the second backoff step
  });

  it('backs off between server errors and stops after maxRetries', async () => {
    const { waits, sleep } = recordedSleep();
    llm.respondWith(() => ({ status: 503, json: {} }));
    const error = await providerErrorOf(
      createChatClient(compatible({ maxRetries: 2 }), { sleep }).complete(request),
    );
    expect(error.code).toBe('provider_unavailable');
    expect(llm.requests).toHaveLength(3);
    expect(waits).toHaveLength(2);
    expect(waits[1]).toBeGreaterThan(waits[0] as number);
  });

  it('recovers when a retry succeeds', async () => {
    const { sleep } = recordedSleep();
    llm.enqueue({ status: 502, json: {} }, { reply: 'back' });
    const result = await createChatClient(compatible(), { sleep }).complete(request);
    expect(result.content).toBe('back');
    expect(llm.requests).toHaveLength(2);
  });

  it('retries a dropped connection', async () => {
    const { sleep } = recordedSleep();
    llm.enqueue({ drop: true }, { reply: 'again' });
    const result = await createChatClient(compatible(), { sleep }).complete(request);
    expect(result.content).toBe('again');
    expect(llm.requests).toHaveLength(2);
  });

  it('retries an unreachable server and then reports it as unavailable', async () => {
    const gone = await startFakeLlm();
    const baseUrl = gone.baseUrl;
    await gone.close();
    const { waits, sleep } = recordedSleep();
    const error = await providerErrorOf(
      createChatClient(compatible({ baseUrl, maxRetries: 1 }), { sleep }).complete(request),
    );
    expect(error.code).toBe('provider_unavailable');
    expect(error.retryable).toBe(true);
    expect(waits).toHaveLength(1);
  });

  it('does not retry when maxRetries is zero', async () => {
    llm.enqueue({ status: 429, json: {} });
    const error = await providerErrorOf(
      createChatClient(compatible({ maxRetries: 0 })).complete(request),
    );
    expect(error.code).toBe('provider_rate_limited');
    expect(llm.requests).toHaveLength(1);
  });

  it.each([
    [
      400,
      { error: { message: 'maximum context length exceeded', code: 'context_length_exceeded' } },
    ],
    [401, {}],
    [403, {}],
    [404, {}],
    [408, {}],
    [422, {}],
  ])('never retries HTTP %i', async (status, json) => {
    llm.respondWith(() => ({ status, json }));
    await failureOf(createChatClient(compatible()).complete(request));
    expect(llm.requests).toHaveLength(1);
  });

  it('never retries a content-filter block', async () => {
    llm.respondWith(() => ({ reply: '', finishReason: 'content_filter' }));
    await failureOf(createChatClient(compatible()).complete(request));
    expect(llm.requests).toHaveLength(1);
  });

  it('does not retry a timeout', async () => {
    llm.respondWith(() => ({ reply: 'late', delayMs: 1000 }));
    const error = await providerErrorOf(
      createChatClient(compatible({ timeoutMs: 100, maxRetries: 2 })).complete(request),
    );
    expect(error.code).toBe('provider_timeout');
    expect(llm.requests).toHaveLength(1);
  });
});

describe('timeouts and cancellation', () => {
  it('times out a slow response', async () => {
    llm.enqueue({ reply: 'late', delayMs: 1000 });
    const started = Date.now();
    const error = await providerErrorOf(
      createChatClient(compatible({ timeoutMs: 100 })).complete(request),
    );
    expect(error.code).toBe('provider_timeout');
    expect(error.retryable).toBe(true);
    expect(Date.now() - started).toBeLessThan(900);
  });

  it('times out a server that never answers', async () => {
    llm.enqueue({ hang: true });
    const error = await providerErrorOf(
      createChatClient(compatible({ timeoutMs: 100 })).complete(request),
    );
    expect(error.code).toBe('provider_timeout');
  });

  it('rejects with an AbortError, not a ProviderError, when the caller cancels', async () => {
    llm.enqueue({ reply: 'late', delayMs: 1000 });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);
    const error = await failureOf(
      createChatClient(compatible()).complete(request, controller.signal),
    );
    expect(error).not.toBeInstanceOf(ProviderError);
    expect((error as Error).name).toBe('AbortError');
  });

  it('does not send a request when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const error = await failureOf(
      createChatClient(compatible()).complete(request, controller.signal),
    );
    expect((error as Error).name).toBe('AbortError');
    expect(llm.requests).toHaveLength(0);
  });

  it('stops waiting to retry when the caller cancels', async () => {
    llm.enqueue({ status: 429, headers: { 'retry-after': '3' }, json: {} }, { reply: 'never' });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);
    const started = Date.now();
    const error = await failureOf(
      createChatClient(compatible()).complete(request, controller.signal),
    );
    expect((error as Error).name).toBe('AbortError');
    expect(Date.now() - started).toBeLessThan(2000);
    expect(llm.requests).toHaveLength(1);
  });

  it('stops before a retry when cancelled during the wait', async () => {
    const controller = new AbortController();
    llm.enqueue({ status: 500, json: {} }, { reply: 'never' });
    const error = await failureOf(
      createChatClient(compatible(), {
        sleep: () => {
          controller.abort();
          return Promise.resolve();
        },
      }).complete(request, controller.signal),
    );
    expect((error as Error).name).toBe('AbortError');
    expect(llm.requests).toHaveLength(1);
  });
});

describe('error mapping', () => {
  const cases: [string, Step, string, boolean][] = [
    ['HTTP 401', { status: 401, json: {} }, 'provider_not_configured', false],
    ['HTTP 403', { status: 403, json: {} }, 'provider_not_configured', false],
    ['HTTP 404', { status: 404, json: {} }, 'provider_not_configured', false],
    ['HTTP 408', { status: 408, json: {} }, 'provider_timeout', true],
    ['HTTP 429', { status: 429, json: {} }, 'provider_rate_limited', true],
    ['HTTP 500', { status: 500, json: {} }, 'provider_unavailable', true],
    ['HTTP 503', { status: 503, json: {} }, 'provider_unavailable', true],
    ['HTTP 400 with an unknown cause', { status: 400, json: {} }, 'provider_unavailable', false],
    [
      'Google rejecting an API key with HTTP 400',
      {
        status: 400,
        json: {
          error: { code: 400, message: 'Please pass a valid API key', status: 'INVALID_ARGUMENT' },
        },
      },
      'provider_not_configured',
      false,
    ],
    [
      'finish_reason content_filter',
      { reply: '', finishReason: 'content_filter' },
      'provider_content_filtered',
      false,
    ],
    [
      'an Azure content_filter error',
      { status: 400, json: { error: { code: 'content_filter', message: 'blocked' } } },
      'provider_content_filtered',
      false,
    ],
    [
      'an Azure ResponsibleAIPolicyViolation error',
      {
        status: 400,
        json: {
          error: { code: 'invalid_prompt', innererror: { code: 'ResponsibleAIPolicyViolation' } },
        },
      },
      'provider_content_filtered',
      false,
    ],
    [
      'a reply that is not JSON',
      { status: 200, text: '<html>oops</html>' },
      'provider_bad_output',
      true,
    ],
    [
      'a reply with no choices',
      { status: 200, json: { choices: [] } },
      'provider_bad_output',
      true,
    ],
  ];

  it.each(cases)('maps %s to %s', async (_name, step, code, retryable) => {
    llm.respondWith(() => step);
    const error = await providerErrorOf(
      createChatClient(compatible({ maxRetries: 0 })).complete(request),
    );
    expect(error.code).toBe(code);
    expect(error.retryable).toBe(retryable);
  });

  it('tells the operator to check the configuration for rejected credentials', async () => {
    llm.enqueue({ status: 401, json: {} });
    const error = await providerErrorOf(createChatClient(azure()).complete(request));
    expect(error.message).toMatch(/rejected the credentials/i);
    expect(error.message).toMatch(/configuration/i);
  });

  describe('a rate limit that says how long to wait', () => {
    const limited = (retryDelay: string) =>
      ({
        status: 429,
        json: {
          error: {
            code: 429,
            message: `Quota exceeded for ${TRANSCRIPT}. Please retry in 39.6s.`,
            status: 'RESOURCE_EXHAUSTED',
            details: [
              { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [] },
              { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay },
            ],
          },
        },
      }) satisfies Step;

    it('passes the wait on, in whole seconds, and nothing else from the error', async () => {
      llm.enqueue(limited('39.651720051s'));
      const error = await providerErrorOf(
        createChatClient(gemini({ maxRetries: 0 })).complete(request),
      );
      expect(error.code).toBe('provider_rate_limited');
      expect(error.retryable).toBe(true);
      expect(error.message).toBe(
        "The AI provider's rate limit was reached. Please try again in about 40 seconds.",
      );
      expect(error.message).not.toContain(TRANSCRIPT);
    });

    it.each(['86400s', '0s', 'soon'])('falls back to the general message for %s', async (delay) => {
      llm.enqueue(limited(delay));
      const error = await providerErrorOf(
        createChatClient(gemini({ maxRetries: 0 })).complete(request),
      );
      expect(error.message).toMatch(/busy right now/i);
    });
  });

  it('returns an empty reply as empty content for the caller to judge', async () => {
    llm.enqueue({ reply: '' });
    expect(await createChatClient(compatible()).complete(request)).toEqual({
      content: '',
      finishReason: 'stop',
    });
  });
});

describe('what never appears in an error', () => {
  const echoes = `upstream said: ${KEY} ${TRANSCRIPT}`;
  const failures: [string, Step][] = [
    ['rejected credentials', { status: 401, text: echoes }],
    ['a server error', { status: 500, text: echoes }],
    ['a rate limit', { status: 429, text: echoes }],
    ['a bad request', { status: 400, text: echoes }],
    [
      'a content-filter error',
      { status: 400, json: { error: { code: 'content_filter', message: echoes } } },
    ],
    ['a reply that is not JSON', { status: 200, text: echoes }],
    ['a dropped connection', { drop: true }],
    ['a timeout', { hang: true }],
  ];

  it.each(failures)('is clean for %s', async (_name, step) => {
    llm.respondWith(() => step);
    const error = await providerErrorOf(
      createChatClient(compatible({ maxRetries: 0, timeoutMs: 150 }), {
        sleep: () => Promise.resolve(),
      }).complete(request),
    );
    const everything = [
      error.message,
      error.name,
      String(error),
      JSON.stringify(error),
      error.stack?.split('\n')[0] ?? '',
      String(error.cause ?? ''),
    ].join('\n');
    expect(everything).not.toContain(KEY);
    expect(everything).not.toContain(TRANSCRIPT);
    expect(everything).not.toContain('upstream said');
    expect(everything).not.toContain('127.0.0.1');
  });

  it('keeps the endpoint out of the message when the server is unreachable', async () => {
    const gone = await startFakeLlm();
    const baseUrl = gone.baseUrl;
    await gone.close();
    const error = await providerErrorOf(
      createChatClient(compatible({ baseUrl, maxRetries: 0 })).complete(request),
    );
    expect(`${error.message} ${String(error.cause ?? '')}`).not.toMatch(/127\.0\.0\.1|http/);
  });
});

describe('compatibility fallbacks', () => {
  const noMaxTokens = rejection(
    "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.",
    'max_tokens',
  );
  const noCompletionTokens = rejection(
    'Unrecognized request argument supplied: max_completion_tokens',
    null,
    'unknown_parameter',
  );
  const noTemperature = rejection(
    "Unsupported value: 'temperature' does not support 0.2 with this model. Only the default (1) value is supported.",
    'temperature',
    'unsupported_value',
  );
  const noResponseFormat = rejection(
    "Invalid parameter: 'response_format' of type 'json_object' is not supported with this model.",
    'response_format',
  );

  it('retries with max_completion_tokens when max_tokens is unsupported, and remembers it', async () => {
    llm.enqueue(noMaxTokens, { reply: 'one' }, { reply: 'two' });
    const client = createChatClient(compatible({ maxRetries: 0 }));
    expect((await client.complete(request)).content).toBe('one');
    expect((await client.complete(request)).content).toBe('two');

    const [first, retried, next] = llm.requests.map((r) => r.body);
    expect(first?.max_tokens).toBe(50);
    expect(retried?.max_tokens).toBeUndefined();
    expect(retried?.max_completion_tokens).toBeDefined();
    expect(next?.max_completion_tokens).toBeDefined();
    expect(llm.requests).toHaveLength(3);
  });

  it('goes back to max_tokens when an endpoint rejects max_completion_tokens', async () => {
    llm.enqueue(noMaxTokens, { reply: 'one' }, noCompletionTokens, { reply: 'two' });
    const client = createChatClient(compatible());
    await client.complete(request);
    expect((await client.complete(request)).content).toBe('two');
    expect(llm.requests.at(-1)?.body?.max_tokens).toBe(50);
    expect(llm.requests.at(-1)?.body?.max_completion_tokens).toBeUndefined();
  });

  it('does not flip between the two token parameters within one call', async () => {
    llm.enqueue(noMaxTokens, noCompletionTokens, { reply: 'never' });
    const error = await providerErrorOf(createChatClient(compatible()).complete(request));
    expect(error.retryable).toBe(false);
    expect(llm.requests).toHaveLength(2);
  });

  it('retries without temperature when it is unsupported, and remembers it', async () => {
    llm.enqueue(noTemperature, { reply: 'one' }, { reply: 'two' });
    const client = createChatClient(compatible({ maxRetries: 0 }));
    await client.complete(request);
    await client.complete(request);
    expect(llm.requests[0]?.body?.temperature).toBe(0.2);
    expect(llm.requests[1]?.body?.temperature).toBeUndefined();
    expect(llm.requests[2]?.body?.temperature).toBeUndefined();
  });

  it('retries without response_format when it is rejected', async () => {
    llm.enqueue(noResponseFormat, { reply: '{}' });
    await createChatClient(compatible({ maxRetries: 0 })).complete({ ...request, json: true });
    expect(llm.requests[0]?.body?.response_format).toBeDefined();
    expect(llm.requests[1]?.body?.response_format).toBeUndefined();
  });

  it('chains independent adjustments for one call', async () => {
    llm.enqueue(noMaxTokens, noTemperature, noResponseFormat, { reply: '{}' });
    const result = await createChatClient(compatible({ maxRetries: 0 })).complete({
      ...request,
      json: true,
    });
    expect(result.content).toBe('{}');
    const last = llm.requests.at(-1)?.body;
    expect(last?.max_tokens).toBeUndefined();
    expect(last?.temperature).toBeUndefined();
    expect(last?.response_format).toBeUndefined();
    expect(llm.requests).toHaveLength(4);
  });

  it('makes each adjustment at most once', async () => {
    llm.respondWith(() => noTemperature);
    const error = await providerErrorOf(createChatClient(compatible()).complete(request));
    expect(error.code).toBe('provider_unavailable');
    expect(llm.requests).toHaveLength(2);
  });

  it('leaves unrelated bad requests alone', async () => {
    llm.respondWith(() =>
      rejection('maximum context length exceeded', 'messages', 'context_length_exceeded'),
    );
    await providerErrorOf(createChatClient(compatible()).complete(request));
    expect(llm.requests).toHaveLength(1);
  });

  describe('a Gemini model that does not take a reasoning effort', () => {
    const googleError = (message: string) =>
      ({
        status: 400,
        json: { error: { code: 400, message, status: 'INVALID_ARGUMENT' } },
      }) satisfies Step;

    it.each([
      ['a bad value', 'Invalid reasoning_effort: minimal. Valid values are: high, low, medium'],
      [
        'an unknown field',
        'Invalid JSON payload received. Unknown name "reasoning_effort": Cannot find field.',
      ],
    ])('retries without it for %s, and remembers that', async (_name, message) => {
      llm.enqueue(googleError(message), { reply: 'one' }, { reply: 'two' });
      const client = createChatClient(gemini({ maxRetries: 0 }));
      expect((await client.complete(request)).content).toBe('one');
      expect((await client.complete(request)).content).toBe('two');

      expect(llm.requests[0]?.body?.reasoning_effort).toBe('minimal');
      expect(llm.requests[1]?.body?.reasoning_effort).toBeUndefined();
      expect(llm.requests[2]?.body?.reasoning_effort).toBeUndefined();
      expect(llm.requests).toHaveLength(3);
    });

    it('does not mistake an unrelated Google 400 for that', async () => {
      llm.respondWith(() => googleError('temperature must be in the range [0.0, 2.0] but was 9'));
      await providerErrorOf(createChatClient(gemini({ maxRetries: 0 })).complete(request));
      expect(llm.requests).toHaveLength(1);
    });
  });
});
