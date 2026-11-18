import { isApiError } from '../../lib/api.ts';

/** True when the server said the scenario does not exist (as opposed to a network or server problem). */
export function isNotFoundError(error: unknown): boolean {
  return isApiError(error) && (error.status === 404 || error.code === 'not_found');
}
