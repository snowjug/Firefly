import type { PromptRequest } from '../prompts/types.ts';
import { ProviderError, type ProviderConfig } from './types.ts';

// The chat-completions client for Azure OpenAI and OpenAI-compatible servers.
//
// Safety rules for this file: errors and thrown messages are fixed strings. They never contain the
// API key, the endpoint, request or response bodies, or any transcript text. Response bodies are read
// only to recognise a few well-known error shapes, and are never logged or forwarded.

export type LiveConfig = Exclude<ProviderConfig, { kind: 'mock' }>;

export interface ChatCompletion {
  content: string;
  finishReason: string | null;
}

export interface ChatClient {
  complete(request: PromptRequest, signal?: AbortSignal): Promise<ChatCompletion>;
}

export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

export interface ChatClientOptions {
  /** Replaces the real wait between retries (tests). */
  sleep?: Sleep;
}

/** Longest wait honoured from a Retry-After header. */
export const MAX_RETRY_AFTER_MS = 5000;
const BACKOFF_BASE_MS = 300;
const BACKOFF_MAX_MS = 2000;
// Models that reason before answering count that hidden reasoning against the completion limit.
const REASONING_HEADROOM_TOKENS = 4096;

const MESSAGES = {
  credentials:
    'The AI provider rejected the credentials. Check the Firefly provider configuration.',
  notFound:
    'The AI provider could not find the configured model or deployment. Check the Firefly provider configuration.',
  rateLimited: 'The AI provider is busy right now. Please try again in a moment.',
  timeout: 'The AI provider took too long to respond. Please try again.',
  unavailable: 'The AI provider is not available right now. Please try again in a moment.',
  unreachable: 'Could not reach the AI provider. Check the endpoint and network, then try again.',
  filtered: "The AI provider's content filter blocked this reply. Try rephrasing your message.",
  badOutput: 'The AI provider returned a reply Firefly could not use. Please try again.',
};

export const badOutput = () => new ProviderError('provider_bad_output', MESSAGES.badOutput, true);
const contentFiltered = () =>
  new ProviderError('provider_content_filtered', MESSAGES.filtered, false);
const abortError = () => new DOMException('The request was cancelled.', 'AbortError');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// ---------------------------------------------------------------------------------------
// Where and how to call

interface Target {
  url: string;
  headers: Record<string, string>;
  model: string | null; // Azure selects the model through the deployment instead
}

function targetFor(config: LiveConfig): Target {
  if (config.kind === 'azure-openai') {
    const deployment = encodeURIComponent(config.deployment);
    const version = encodeURIComponent(config.apiVersion);
    return {
      url: `${config.endpoint.replace(/\/+$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${version}`,
      headers: { 'api-key': config.apiKey },
      model: null,
    };
  }
  return {
    url: `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`,
    headers: { authorization: `Bearer ${config.apiKey}` },
    model: config.model,
  };
}

// What this endpoint has told us it does not accept. Learned from a 400 and remembered, so the
// adjustment is paid for once rather than on every call.
interface Quirks {
  tokenParam: 'max_tokens' | 'max_completion_tokens';
  temperature: boolean;
  responseFormat: boolean;
}

function bodyFor(request: PromptRequest, model: string | null, quirks: Quirks): string {
  const body: Record<string, unknown> = {};
  if (model) body.model = model;
  body.messages = request.messages;
  if (quirks.temperature) body.temperature = request.temperature;
  if (quirks.tokenParam === 'max_tokens') body.max_tokens = request.maxTokens;
  else body.max_completion_tokens = request.maxTokens + REASONING_HEADROOM_TOKENS;
  if (request.json && quirks.responseFormat) body.response_format = { type: 'json_object' };
  return JSON.stringify(body);
}

// ---------------------------------------------------------------------------------------
// One HTTP exchange

type Exchange =
  | { kind: 'response'; status: number; text: string; retryAfterMs: number | null }
  | { kind: 'timeout' }
  | { kind: 'network'; code: string | null };

function retryAfter(headers: Headers): number | null {
  const millis = headers.get('retry-after-ms');
  if (millis !== null && millis.trim() !== '' && Number.isFinite(Number(millis))) {
    return Math.max(0, Number(millis));
  }
  const value = headers.get('retry-after');
  if (value === null || value.trim() === '') return null;
  if (Number.isFinite(Number(value))) return Math.max(0, Number(value)) * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

// A short, safe description of a network failure: its code (for example ECONNREFUSED), nothing else.
function networkCode(error: unknown): string | null {
  const source = isRecord(error) && isRecord(error.cause) ? error.cause : error;
  return isRecord(source) && typeof source.code === 'string' ? source.code : null;
}

async function exchange(
  target: Target,
  body: string,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<Exchange> {
  const timeout = AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetch(target.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...target.headers,
      },
      body,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    const text = await response.text();
    return {
      kind: 'response',
      status: response.status,
      text,
      retryAfterMs: retryAfter(response.headers),
    };
  } catch (error) {
    if (signal?.aborted) throw abortError();
    if (timeout.aborted) return { kind: 'timeout' };
    return { kind: 'network', code: networkCode(error) };
  }
}

const defaultSleep: Sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

// ---------------------------------------------------------------------------------------
// Reading what came back

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function contentOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value
    .map((part) => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
    .join('');
}

function readCompletion(text: string): ChatCompletion {
  const json = parseJson(text);
  const choice = isRecord(json) && Array.isArray(json.choices) ? json.choices[0] : undefined;
  if (!isRecord(choice)) throw badOutput();
  const finishReason = typeof choice.finish_reason === 'string' ? choice.finish_reason : null;
  if (finishReason === 'content_filter') throw contentFiltered();
  const message = isRecord(choice.message) ? choice.message : {};
  return { content: contentOf(message.content), finishReason };
}

// The provider's own description of an error, used only to recognise it and never shown.
function errorText(json: unknown): string {
  if (!isRecord(json)) return '';
  const parts: string[] = [];
  const add = (value: unknown) => {
    if (typeof value === 'string') parts.push(value);
    else if (Array.isArray(value)) parts.push(value.filter((v) => typeof v === 'string').join('.'));
  };
  if (isRecord(json.error)) {
    add(json.error.message);
    add(json.error.param);
    add(json.error.code);
  } else {
    add(json.error);
  }
  add(json.message);
  if (Array.isArray(json.detail)) {
    for (const item of json.detail) {
      if (isRecord(item)) {
        add(item.msg);
        add(item.loc);
      }
    }
  } else {
    add(json.detail);
  }
  return parts.join(' ').toLowerCase();
}

function isContentFilterError(json: unknown): boolean {
  if (!isRecord(json) || !isRecord(json.error)) return false;
  const inner = isRecord(json.error.innererror) ? json.error.innererror : {};
  return [json.error.code, inner.code].some(
    (code) =>
      typeof code === 'string' &&
      ['content_filter', 'responsibleaipolicyviolation'].includes(code.toLowerCase()),
  );
}

function failureFor(status: number, json: unknown): ProviderError {
  if (isContentFilterError(json)) return contentFiltered();
  if (status === 401 || status === 403) {
    return new ProviderError('provider_not_configured', MESSAGES.credentials, false);
  }
  if (status === 404) return new ProviderError('provider_not_configured', MESSAGES.notFound, false);
  if (status === 408) return new ProviderError('provider_timeout', MESSAGES.timeout, true);
  if (status === 429) return new ProviderError('provider_rate_limited', MESSAGES.rateLimited, true);
  if (status >= 500) return new ProviderError('provider_unavailable', MESSAGES.unavailable, true);
  return new ProviderError(
    'provider_unavailable',
    `The AI provider rejected the request (HTTP ${status}). Check the Firefly provider configuration.`,
    false,
  );
}

// ---------------------------------------------------------------------------------------
// Compatibility: models differ in the parameters they accept

type Fix = 'completion-tokens' | 'max-tokens' | 'no-temperature' | 'no-response-format';

const REJECTION =
  /unsupported|not supported|does not support|unrecognized|unknown (?:parameter|argument|field)|invalid (?:parameter|value|argument)|extra inputs|not permitted|not allowed|only the default/;

/** Which single adjustment a 400 asks for, if any. Each adjustment is made at most once per call. */
function detectFix(status: number, json: unknown, quirks: Quirks, made: Set<Fix>): Fix | null {
  if (status !== 400 && status !== 422) return null;
  if (isContentFilterError(json)) return null;
  const text = errorText(json);
  if (!REJECTION.test(text)) return null;
  if (!made.has('completion-tokens') && !made.has('max-tokens')) {
    if (quirks.tokenParam === 'max_tokens' && text.includes('max_tokens'))
      return 'completion-tokens';
    if (quirks.tokenParam === 'max_completion_tokens' && text.includes('max_completion_tokens')) {
      return 'max-tokens';
    }
  }
  if (quirks.temperature && text.includes('temperature')) return 'no-temperature';
  if (quirks.responseFormat && /response_format|json_object/.test(text))
    return 'no-response-format';
  return null;
}

function applyFix(fix: Fix, quirks: Quirks): void {
  if (fix === 'completion-tokens') quirks.tokenParam = 'max_completion_tokens';
  else if (fix === 'max-tokens') quirks.tokenParam = 'max_tokens';
  else if (fix === 'no-temperature') quirks.temperature = false;
  else quirks.responseFormat = false;
}

// ---------------------------------------------------------------------------------------
// Retries: rate limits, server errors and network failures only

const backoff = (retries: number) => Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** retries);

/** How long to wait before trying again, or null when the failure is not worth retrying. */
function retryDelay(result: Exchange, retries: number): number | null {
  if (result.kind === 'network') return backoff(retries);
  if (result.kind !== 'response') return null;
  if (result.status !== 429 && result.status < 500) return null;
  return result.retryAfterMs === null
    ? backoff(retries)
    : Math.min(MAX_RETRY_AFTER_MS, result.retryAfterMs);
}

export function createChatClient(config: LiveConfig, options: ChatClientOptions = {}): ChatClient {
  const target = targetFor(config);
  const sleep = options.sleep ?? defaultSleep;
  const maxRetries = Math.max(0, Math.floor(config.maxRetries));
  const quirks: Quirks = { tokenParam: 'max_tokens', temperature: true, responseFormat: true };

  return {
    async complete(request, signal) {
      const made = new Set<Fix>();
      let retries = 0;
      for (;;) {
        if (signal?.aborted) throw abortError();
        const result = await exchange(
          target,
          bodyFor(request, target.model, quirks),
          signal,
          config.timeoutMs,
        );
        if (result.kind === 'timeout') {
          throw new ProviderError('provider_timeout', MESSAGES.timeout, true);
        }
        if (result.kind === 'response' && result.status >= 200 && result.status < 300) {
          return readCompletion(result.text);
        }

        const json = result.kind === 'response' ? parseJson(result.text) : null;
        if (result.kind === 'response') {
          const fix = detectFix(result.status, json, quirks, made);
          if (fix) {
            applyFix(fix, quirks);
            made.add(fix);
            continue;
          }
        }

        const delay = retryDelay(result, retries);
        if (delay !== null && retries < maxRetries) {
          retries += 1;
          await sleep(delay, signal);
          continue;
        }
        if (result.kind === 'network') {
          throw new ProviderError(
            'provider_unavailable',
            MESSAGES.unreachable,
            true,
            result.code ? new Error(result.code) : undefined,
          );
        }
        throw failureFor(result.status, json);
      }
    },
  };
}
