import { useCallback, useEffect, useState } from 'react';
import type { SessionDTO } from '#shared/domain/api.ts';
import { api, isApiError, type ApiError } from '../../lib/api.ts';

const POLL_VISIBLE_MS = 1000;
const POLL_HIDDEN_MS = 5000;
/** After this many failed polls in a row the page says it is struggling (and keeps trying). */
const STALL_AFTER = 3;

interface Loaded {
  session: SessionDTO | null;
  error: ApiError | Error | null;
  loading: boolean;
}

export interface SessionState extends Loaded {
  /** True while polling for a report keeps failing; polling continues quietly. */
  stalled: boolean;
  /** True once a wait for the report (polling, or a retry) has finished in this visit. */
  waited: boolean;
  reload(): void;
  /** Use a fresher copy of the session, for example the answer to a retry request. */
  replace(session: SessionDTO): void;
}

const asError = (error: unknown): ApiError | Error =>
  isApiError(error) ? error : error instanceof Error ? error : new Error('Failed');

/**
 * Loads a session and, while it is still being evaluated, polls about once a second (every few
 * seconds when the tab is hidden) until the report is ready. Everything is cancelled on unmount.
 */
export function useSession(id: string): SessionState {
  const [state, setState] = useState<Loaded>({ session: null, error: null, loading: true });
  const [stalled, setStalled] = useState(false);
  const [waited, setWaited] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api.getSession(id, controller.signal).then(
      (session) => {
        if (!controller.signal.aborted) setState({ session, error: null, loading: false });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setState((s) => ({ session: s.session, error: asError(error), loading: false }));
      },
    );
    return () => controller.abort();
  }, [id, tick]);

  const completing = state.session?.status === 'completing';
  useEffect(() => {
    if (!completing) return;
    const controller = new AbortController();
    let timer = 0;
    let failures = 0;
    let inFlight = false;

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(poll, document.hidden ? POLL_HIDDEN_MS : POLL_VISIBLE_MS);
    };
    function poll() {
      if (inFlight || controller.signal.aborted) return;
      inFlight = true;
      window.clearTimeout(timer);
      api.getSession(id, controller.signal).then(
        (session) => {
          inFlight = false;
          if (controller.signal.aborted) return;
          failures = 0;
          setStalled(false);
          setState({ session, error: null, loading: false });
          if (session.status === 'completing') schedule();
          else setWaited(true);
        },
        () => {
          inFlight = false;
          if (controller.signal.aborted) return;
          failures += 1;
          if (failures >= STALL_AFTER) setStalled(true);
          schedule();
        },
      );
    }
    const onVisible = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    schedule();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [id, completing]);

  const reload = useCallback(() => {
    setState((s) => ({ session: s.session, error: null, loading: true }));
    setTick((t) => t + 1);
  }, []);
  const replace = useCallback((session: SessionDTO) => {
    setState({ session, error: null, loading: false });
    if (session.status !== 'completing') setWaited(true);
  }, []);

  return { ...state, stalled: completing && stalled, waited, reload, replace };
}
