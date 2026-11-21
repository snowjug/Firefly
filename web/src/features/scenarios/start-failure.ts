import { isApiError } from '../../lib/api.ts';

// What the trainee reads when a call could not be started. Every message says what happened, that
// nothing was started (or that trying again cannot start two calls), and what to do next.

/** Starting a call is quick. If it takes longer than this, something is wrong, so say so. */
export const START_TIMEOUT_MS = 20_000;

export interface StartFailure {
  title: string;
  detail: string;
  /** "Try again" can help. When false the settings or the scenario have to change. */
  retryable: boolean;
}

export function describeStartFailure(error: unknown, online: boolean): StartFailure {
  if (!online) {
    return {
      title: 'You are offline.',
      detail: 'Nothing was started. Reconnect, then try again.',
      retryable: true,
    };
  }
  if (isApiError(error)) {
    if (error.code === 'timeout') {
      return {
        title: 'Starting the call took too long.',
        detail:
          'The call may still be starting. Try again: Firefly will not create a second call for the same request.',
        retryable: true,
      };
    }
    if (error.code === 'network' || error.status === 0) {
      return {
        title: 'Firefly could not be reached.',
        detail:
          'Nothing was started. Check that you are online and that Firefly is running, then try again.',
        retryable: true,
      };
    }
    if (error.status === 429 || error.code === 'rate_limited') {
      return {
        title: 'Too many calls were started in a short time.',
        detail: 'Nothing was started. Wait a moment, then try again.',
        retryable: true,
      };
    }
    if (error.status === 404 || error.code === 'not_found') {
      return {
        title: 'This scenario is no longer available.',
        detail: 'Nothing was started. Choose another scenario.',
        retryable: false,
      };
    }
    if (error.code === 'validation_failed' || error.code === 'bad_request') {
      return {
        title: 'These settings were not accepted.',
        detail: 'Nothing was started. Go back to the scenario, check the settings and try again.',
        retryable: false,
      };
    }
    return {
      title: 'The call could not be started.',
      detail: `Nothing was started. ${error.message}`,
      retryable: error.retryable,
    };
  }
  return {
    title: 'The call could not be started.',
    detail: 'Nothing was started. Please try again.',
    retryable: true,
  };
}
