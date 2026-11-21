import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { errorMessage, isAbort, isApiError } from '../../lib/api.ts';
import { POLL_HIDDEN_MS, POLL_MS, safeEvaluationMessage } from './evaluation.ts';
import type { ScenarioRef } from './scenario-index.ts';

/** What the page needs from the server. `api` from `lib/api.ts` satisfies it; the gallery and the tests pass others. */
export interface ReportClient {
  getSession(id: string, signal?: AbortSignal): Promise<SessionDTO>;
  evaluate(id: string): Promise<SessionDTO>;
  deleteSession(id: string): Promise<unknown>;
  /**
   * The scenarios that exist now, so a link to one that was retired is never offered. Optional: a
   * client without it is treated as not knowing, and the page decides from the call alone.
   */
  scenarios?(signal?: AbortSignal): Promise<readonly ScenarioRef[]>;
}

export type ReportViewState =
  | { kind: 'loading' }
  | { kind: 'unavailable'; notFound: boolean; message: string }
  | { kind: 'active' }
  | { kind: 'evaluating'; session: SessionDTO; trouble: boolean }
  | {
      kind: 'failed';
      session: SessionDTO;
      /** Whether trying again can help. A report that cannot be read is not something a retry fixes. */
      retryable: boolean;
      /** The server's sentence, only when it is plain and safe to show. */
      message: string | null;
      unreadable: boolean;
    }
  | { kind: 'report'; session: SessionDTO; report: CoachingReport; reveal: boolean };

export interface ReportSessionState {
  view: ReportViewState;
  /** Asks the server to evaluate the call again, then follows it. */
  retry(): void;
  retrying: boolean;
  retryError: string | null;
  /** Loads the call again after it could not be loaded. */
  reload(): void;
}

const RETRY_FAILED = 'Firefly could not start the evaluation again. Please try again.';

/**
 * Loads the call and follows it. While the server is still evaluating it asks again every
 * 800 ms (every 3 s in a background tab) until the report is saved or the evaluation fails, and
 * it stops the moment the page is left. A poll that fails is not fatal once the call has loaded:
 * the page keeps trying and says it is having trouble.
 */
export function useReportSession(id: string, client: ReportClient): ReportSessionState {
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [problem, setProblem] = useState<{ notFound: boolean; message: string } | null>(null);
  const [trouble, setTrouble] = useState(false);
  // True once this page has seen the call being evaluated: only then is the report "revealed".
  const [watched, setWatched] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const status = session?.status ?? null;

  useEffect(() => {
    // Once the call is finished (or failed) there is nothing to follow.
    if (status !== null && status !== 'completing') return;
    const controller = new AbortController();
    let timer: number | undefined;
    let failures = 0;
    let busy = false;

    const tick = async () => {
      busy = true;
      try {
        const next = await client.getSession(id, controller.signal);
        if (controller.signal.aborted) return;
        failures = 0;
        setProblem(null);
        setTrouble(false);
        if (next.status === 'completing') setWatched(true);
        setSession(next);
        if (next.status !== 'completing') return;
      } catch (error) {
        if (controller.signal.aborted || isAbort(error)) return;
        if (status === null || (isApiError(error) && error.status === 404)) {
          setProblem({
            notFound: isApiError(error) && error.status === 404,
            message: errorMessage(error),
          });
          return;
        }
        failures += 1;
        if (failures >= 3) setTrouble(true);
      } finally {
        busy = false;
      }
      timer = window.setTimeout(tick, document.hidden ? POLL_HIDDEN_MS : POLL_MS);
    };

    // A tab that comes back to the front checks straight away instead of waiting out its slow beat.
    const onVisible = () => {
      if (document.hidden || busy || timer === undefined) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(tick, 0);
    };
    document.addEventListener('visibilitychange', onVisible);

    if (status === null) void tick();
    else timer = window.setTimeout(tick, document.hidden ? POLL_HIDDEN_MS : POLL_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [id, client, status, attempt]);

  const retry = useCallback(() => {
    setRetrying(true);
    setRetryError(null);
    client
      .evaluate(id)
      .then((next) => {
        setWatched(true);
        setSession(next);
      })
      .catch((error: unknown) => {
        setRetryError(safeEvaluationMessage(errorMessage(error)) ?? RETRY_FAILED);
      })
      .finally(() => setRetrying(false));
  }, [client, id]);

  const reload = useCallback(() => {
    setProblem(null);
    setAttempt((n) => n + 1);
  }, []);

  const view = useMemo((): ReportViewState => {
    if (problem) return { kind: 'unavailable', ...problem };
    if (!session) return { kind: 'loading' };
    switch (session.status) {
      case 'active':
        return { kind: 'active' };
      case 'completing':
        return { kind: 'evaluating', session, trouble };
      case 'evaluation_failed':
        return {
          kind: 'failed',
          session,
          retryable: session.evaluationError?.retryable ?? true,
          message: safeEvaluationMessage(session.evaluationError?.message),
          unreadable: false,
        };
      case 'completed':
        return session.report
          ? { kind: 'report', session, report: session.report, reveal: watched }
          : { kind: 'failed', session, retryable: false, message: null, unreadable: true };
    }
  }, [problem, session, trouble, watched]);

  return { view, retry, retrying, retryError, reload };
}
