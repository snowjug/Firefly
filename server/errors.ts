import type { ApiErrorCode } from '#shared/domain/api.ts';

// Errors that map directly to an HTTP response. The message is always safe to show to a user.

export class AppError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly retryable: boolean;
  readonly details: unknown;
  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    options: { retryable?: boolean; details?: unknown } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}

export const notFound = (what: string) => new AppError(404, 'not_found', `${what} was not found.`);
export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'bad_request', message, { details });
export const conflict = (message: string, retryable = false) =>
  new AppError(409, 'conflict', message, { retryable });

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: string }).name === 'AbortError'
  );
}
