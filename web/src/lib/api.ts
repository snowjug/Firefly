import type {
  AppConfigDTO,
  ApiErrorBody,
  ClosingCheckDTO,
  CreateSessionRequest,
  PublicScenarioDTO,
  SendMessageRequest,
  SendMessageResponse,
  SessionDTO,
  TranscriptDTO,
  TurnDTO,
} from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import {
  SPEECH_RESPONSE_HEADERS,
  type SpeechLanguage,
  type TranscribeResponse,
} from '#shared/domain/speech.ts';

// Typed client for the Firefly API. Every failure becomes an ApiError with a message that is safe
// to show, a stable code and a retryable flag, so screens never need to interpret raw responses.

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
  readonly details: unknown;
  constructor(
    status: number,
    code: string,
    message: string,
    retryable: boolean,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** True for the error a cancelled request throws. Callers normally ignore it. */
export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** A user-facing sentence for any thrown value. */
export function errorMessage(error: unknown): string {
  if (isApiError(error)) return error.message;
  if (isAbort(error)) return 'The request was cancelled.';
  return 'Something went wrong. Please try again.';
}

const NETWORK_MESSAGE =
  "Can't reach Firefly right now. Check that the server is running and that you are online, then try again.";

async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`/api${path}`, { credentials: 'same-origin', ...init });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new ApiError(0, 'network', NETWORK_MESSAGE, true);
  }
}

async function failure(response: Response): Promise<ApiError> {
  let data: unknown = null;
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  const err = (data as ApiErrorBody | null)?.error;
  return new ApiError(
    response.status,
    err?.code ?? 'internal',
    err?.message ?? 'Something went wrong on our side. Please try again.',
    err?.retryable ?? response.status >= 500,
    err?.details,
  );
}

async function request<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await send(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw await failure(response);
  const text = await response.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(
      response.status,
      'internal',
      'Something went wrong on our side. Please try again.',
      true,
    );
  }
}

const query = (params: Record<string, string | number | boolean | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};

/** Audio the server spoke for one customer turn, with what the provider really used. */
export interface SpokenTurn {
  audio: Blob;
  contentType: string;
  provider: string | null;
  voice: string | null;
  /** The expressive style applied, or `none` when mood was approximated by rate and pitch. */
  style: string | null;
}

const enc = encodeURIComponent;

export const api = {
  config: (signal?: AbortSignal) => request<AppConfigDTO>('GET', '/config', undefined, signal),
  scenarios: (signal?: AbortSignal) =>
    request<{ scenarios: PublicScenarioDTO[] }>('GET', '/scenarios', undefined, signal).then(
      (r) => r.scenarios,
    ),
  scenario: (id: string, signal?: AbortSignal) =>
    request<{ scenario: PublicScenarioDTO }>(
      'GET',
      `/scenarios/${enc(id)}`,
      undefined,
      signal,
    ).then((r) => r.scenario),

  createSession: (req: CreateSessionRequest, signal?: AbortSignal) =>
    request<{ session: SessionDTO }>('POST', '/sessions', req, signal).then((r) => r.session),
  getSession: (id: string, signal?: AbortSignal) =>
    request<{ session: SessionDTO }>('GET', `/sessions/${enc(id)}`, undefined, signal).then(
      (r) => r.session,
    ),
  deleteSession: (id: string) => request<{ deleted: boolean }>('DELETE', `/sessions/${enc(id)}`),
  transcript: (id: string, signal?: AbortSignal) =>
    request<{ transcript: TranscriptDTO }>(
      'GET',
      `/sessions/${enc(id)}/transcript`,
      undefined,
      signal,
    ).then((r) => r.transcript),
  /**
   * A neutral look at an active call for the moment the trainee presses End call: yes or no for a
   * plan, an owner, an update time and the customer's agreement. It never blocks ending, so callers
   * give it a short deadline (the signal) and leave it out when it does not come.
   */
  closingCheck: (id: string, signal?: AbortSignal) =>
    request<ClosingCheckDTO>('GET', `/sessions/${enc(id)}/closing-check`, undefined, signal),
  sendMessage: (id: string, req: SendMessageRequest, signal?: AbortSignal) =>
    request<SendMessageResponse>('POST', `/sessions/${enc(id)}/messages`, req, signal),
  endSession: (id: string) =>
    request<{ session: SessionDTO }>('POST', `/sessions/${enc(id)}/end`, {}).then((r) => r.session),
  evaluate: (id: string) =>
    request<{ session: SessionDTO }>('POST', `/sessions/${enc(id)}/evaluate`, {}).then(
      (r) => r.session,
    ),
  report: (id: string) =>
    request<{ report: CoachingReport }>('GET', `/sessions/${enc(id)}/report`).then((r) => r.report),

  /**
   * Sends one utterance (16 kHz, 16-bit, mono WAV) to the server's speech provider and returns the
   * text. The audio is not kept. Rejects with a retryable ApiError when the provider fails.
   */
  transcribe: async (
    audio: Blob,
    language: SpeechLanguage,
    signal?: AbortSignal,
  ): Promise<TranscribeResponse> => {
    const response = await send(`/speech/transcribe${query({ lang: language })}`, {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav' },
      body: audio,
      signal,
    });
    if (!response.ok) throw await failure(response);
    return (await response.json()) as TranscribeResponse;
  },

  /**
   * Asks the server's speech provider to speak one stored customer turn. The text comes from the
   * session, never from the browser. Resolves with the audio and what the provider really used.
   */
  speakTurn: async (
    sessionId: string,
    turnIndex: number,
    language: SpeechLanguage,
    signal?: AbortSignal,
  ): Promise<SpokenTurn> => {
    const response = await send(
      `/sessions/${enc(sessionId)}/turns/${turnIndex}/speech${query({ lang: language })}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal,
      },
    );
    if (!response.ok) throw await failure(response);
    return {
      audio: await response.blob(),
      contentType: response.headers.get('content-type') ?? 'audio/mpeg',
      provider: response.headers.get(SPEECH_RESPONSE_HEADERS.provider),
      voice: response.headers.get(SPEECH_RESPONSE_HEADERS.voice),
      style: response.headers.get(SPEECH_RESPONSE_HEADERS.style),
    };
  },
};

export type { TurnDTO };
