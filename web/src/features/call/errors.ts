import { isApiError, type ApiError } from '../../lib/api.ts';
import type { EndFailure, SendFailure, TranscribeFailure } from './machine.ts';

// What the server's and the network's errors mean for the call. Pure: an `ApiError` (or anything
// else that was thrown) goes in, and a failure the machine understands comes out. The machine alone
// decides what the trainee sees.

/** Waits before each retry of a request that failed because another message was still being handled. */
export const CONFLICT_RETRY_DELAYS_MS: readonly number[] = [400, 800, 1600, 3200];

const isNetwork = (error: ApiError) => error.code === 'network' || error.status === 0;

function retryAfterSeconds(error: ApiError): number | undefined {
  const value = (error.details as { retryAfterSeconds?: unknown } | null | undefined)
    ?.retryAfterSeconds;
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.ceil(value)
    : undefined;
}

/** The server stored the trainee's message and only the reply failed. */
function savedByServer(error: ApiError): boolean {
  return Boolean((error.details as { traineeTurn?: unknown } | null | undefined)?.traineeTurn);
}

/** A conflict that goes away by itself: another message in this call was still being processed. */
export function isRetryableConflict(error: unknown): boolean {
  return isApiError(error) && error.code === 'conflict' && error.retryable;
}

export function classifySendError(error: unknown): SendFailure {
  if (!isApiError(error)) return { kind: 'unknown', saved: false };
  const saved = savedByServer(error);
  if (isNetwork(error)) return { kind: 'offline', saved: false };
  switch (error.code) {
    case 'conflict':
      // Retried automatically while it can pass; one that cannot pass means this call cannot go on.
      return error.retryable ? { kind: 'conflict', saved } : { kind: 'session-ended' };
    case 'validation_failed':
    case 'bad_request':
    case 'payload_too_large':
      return { kind: 'validation' };
    case 'rate_limited': {
      const wait = retryAfterSeconds(error);
      return {
        kind: 'rate-limited',
        saved: false,
        ...(wait === undefined ? {} : { retryAfterSeconds: wait }),
      };
    }
    case 'session_not_active':
    case 'not_found':
      return { kind: 'session-ended' };
    case 'turn_limit_reached':
      return { kind: 'turn-limit' };
    default:
      return error.code.startsWith('provider_')
        ? { kind: 'provider', saved }
        : { kind: 'unknown', saved };
  }
}

export function classifyTranscribeError(error: unknown): TranscribeFailure {
  if (!isApiError(error)) return { kind: 'failed' };
  if (isNetwork(error)) return { kind: 'offline' };
  switch (error.code) {
    case 'rate_limited':
    case 'speech_rate_limited': {
      const wait = retryAfterSeconds(error);
      return wait === undefined
        ? { kind: 'rate-limited' }
        : { kind: 'rate-limited', retryAfterSeconds: wait };
    }
    case 'speech_unavailable':
    case 'provider_not_configured':
      return { kind: 'service-unavailable' };
    default:
      return { kind: 'failed' };
  }
}

export function classifyEndError(error: unknown): EndFailure {
  if (!isApiError(error)) return { kind: 'failed' };
  if (isNetwork(error)) return { kind: 'offline' };
  return error.code === 'no_conversation' ? { kind: 'nothing-to-review' } : { kind: 'failed' };
}

/** What a session that could not be loaded means for the screen. */
export function classifyLoadError(error: unknown): 'offline' | 'unavailable' | 'not-found' {
  if (!isApiError(error)) return 'unavailable';
  if (isNetwork(error)) return 'offline';
  return error.status === 404 || error.code === 'not_found' ? 'not-found' : 'unavailable';
}
