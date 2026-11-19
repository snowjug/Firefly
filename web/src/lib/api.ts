import type {
  AppConfigDTO,
  ApiErrorBody,
  CalibrationDTO,
  CreateSessionRequest,
  DemoStatusDTO,
  MentorScoreRequest,
  ProgressDTO,
  PublicScenarioDTO,
  RewardsDTO,
  SendMessageRequest,
  SendMessageResponse,
  SessionDTO,
  SessionListDTO,
  TranscriptDTO,
  TurnDTO,
} from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';

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

/** A user-facing sentence for any thrown value. */
export function errorMessage(error: unknown): string {
  if (isApiError(error)) return error.message;
  if (error instanceof DOMException && error.name === 'AbortError')
    return 'The request was cancelled.';
  return 'Something went wrong. Please try again.';
}

async function request<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(
      0,
      'network',
      "Can't reach Firefly right now. Check that the server is running, then try again.",
      true,
    );
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    throw new ApiError(
      response.status,
      err?.code ?? 'internal',
      err?.message ?? 'Something went wrong on our side. Please try again.',
      err?.retryable ?? response.status >= 500,
      err?.details,
    );
  }
  return data as T;
}

const query = (params: Record<string, string | number | boolean | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};

export const api = {
  config: (signal?: AbortSignal) => request<AppConfigDTO>('GET', '/config', undefined, signal),
  scenarios: (signal?: AbortSignal) =>
    request<{ scenarios: PublicScenarioDTO[] }>('GET', '/scenarios', undefined, signal).then(
      (r) => r.scenarios,
    ),
  scenario: (id: string, signal?: AbortSignal) =>
    request<{ scenario: PublicScenarioDTO }>(
      'GET',
      `/scenarios/${encodeURIComponent(id)}`,
      undefined,
      signal,
    ).then((r) => r.scenario),

  createSession: (req: CreateSessionRequest, signal?: AbortSignal) =>
    request<{ session: SessionDTO }>('POST', '/sessions', req, signal).then((r) => r.session),
  listSessions: (
    params: {
      difficulty?: string;
      scenarioId?: string;
      status?: string;
      includeSamples?: boolean;
      limit?: number;
      offset?: number;
    } = {},
    signal?: AbortSignal,
  ) =>
    request<SessionListDTO>(
      'GET',
      `/sessions${query({ ...params, includeSamples: params.includeSamples === false ? '0' : undefined })}`,
      undefined,
      signal,
    ),
  getSession: (id: string, signal?: AbortSignal) =>
    request<{ session: SessionDTO }>(
      'GET',
      `/sessions/${encodeURIComponent(id)}`,
      undefined,
      signal,
    ).then((r) => r.session),
  deleteSession: (id: string) =>
    request<{ deleted: boolean }>('DELETE', `/sessions/${encodeURIComponent(id)}`),
  transcript: (id: string, signal?: AbortSignal) =>
    request<{ transcript: TranscriptDTO }>(
      'GET',
      `/sessions/${encodeURIComponent(id)}/transcript`,
      undefined,
      signal,
    ).then((r) => r.transcript),
  sendMessage: (id: string, req: SendMessageRequest, signal?: AbortSignal) =>
    request<SendMessageResponse>(
      'POST',
      `/sessions/${encodeURIComponent(id)}/messages`,
      req,
      signal,
    ),
  endSession: (id: string) =>
    request<{ session: SessionDTO }>('POST', `/sessions/${encodeURIComponent(id)}/end`, {}).then(
      (r) => r.session,
    ),
  evaluate: (id: string) =>
    request<{ session: SessionDTO }>(
      'POST',
      `/sessions/${encodeURIComponent(id)}/evaluate`,
      {},
    ).then((r) => r.session),
  report: (id: string) =>
    request<{ report: CoachingReport }>('GET', `/sessions/${encodeURIComponent(id)}/report`).then(
      (r) => r.report,
    ),
  mentorScore: (id: string, req: MentorScoreRequest) =>
    request<{ saved: boolean }>('POST', `/sessions/${encodeURIComponent(id)}/mentor-score`, req),

  progress: (includeSamples: boolean, signal?: AbortSignal) =>
    request<{ progress: ProgressDTO }>(
      'GET',
      `/progress${query({ includeSamples: includeSamples ? '1' : '0' })}`,
      undefined,
      signal,
    ).then((r) => r.progress),
  calibration: (includeSamples: boolean, signal?: AbortSignal) =>
    request<CalibrationDTO>(
      'GET',
      `/calibration${query({ includeSamples: includeSamples ? '1' : '0' })}`,
      undefined,
      signal,
    ),
  // tzOffsetMinutes is Date.getTimezoneOffset() (UTC minus local), so "today" is the learner's.
  rewards: (tzOffsetMinutes: number, signal?: AbortSignal) =>
    request<RewardsDTO>('GET', `/rewards?tzOffset=${tzOffsetMinutes}`, undefined, signal),

  demo: (signal?: AbortSignal) => request<DemoStatusDTO>('GET', '/demo', undefined, signal),
  loadSamples: () => request<{ created: number; skipped: number }>('POST', '/demo/samples', {}),
  resetDemo: (scope: 'practice' | 'samples' | 'all') =>
    request<{ deleted: number }>('POST', '/demo/reset', { scope }),
};

export type { TurnDTO };
