import type { PublicScenarioDTO } from '#shared/domain/api.ts';
import { api } from '../../lib/api.ts';
import { useApi, type AsyncState } from '../../lib/hooks.ts';

// The scenario library, kept for the length of the visit. The missions page and the calibration
// page both need it, and the calibration page has to be able to draw its first frame at once: a
// mission's instrument flies from the plate into the calibration core as a view transition, and
// that only works if the core is on screen when the page arrives, not after a request. So the last
// library that was read is shown straight away while a fresh one is fetched; the library is
// written by the scenario files, so it does not change while the app is open.

let kept: PublicScenarioDTO[] | null = null;

/** Forgets the kept library. For tests. */
export function forgetScenarioLibrary(): void {
  kept = null;
}

export function useScenarioLibrary(): AsyncState<PublicScenarioDTO[]> {
  const fetched = useApi(async (signal) => {
    const library = await api.scenarios(signal);
    kept = library;
    return library;
  }, []);
  if (kept && fetched.data === null) {
    // Nothing fresh yet, or the refresh failed: what is already known is still true.
    return { ...fetched, data: kept, error: null, loading: false };
  }
  return fetched;
}
