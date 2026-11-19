import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { ScenarioOverrides } from '#shared/domain/scenario.ts';
import type { PracticeMode } from '#shared/domain/vocab.ts';
import { ApiError, api } from '../../lib/api.ts';
import { clearDraft } from '../../lib/draft.ts';
import { useReducedMotion } from '../../lib/theme.tsx';
import { withTimeout } from '../../lib/timeout.ts';

/** Starting a call is quick. If it takes longer than this something is wrong, so say so. */
export const START_TIMEOUT_MS = 20_000;

export interface CallRequest {
  scenarioId: string;
  overrides: ScenarioOverrides;
  mode: PracticeMode;
}

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Starts the call for the current setup. It is safe to press twice, and safe to retry:
 *  - while a request is out, pressing again does nothing;
 *  - a retry of the same setup reuses the request id, so a call that did start is not started twice,
 *    while a changed setup gets a new id, so it is never answered with the earlier call.
 * The launch moment is only for people who have not asked for less motion.
 */
export function useBeginCall(request: CallRequest) {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [launching, setLaunching] = useState(false);
  const [startedId, setStartedId] = useState<string | null>(null);
  const inFlight = useRef(false);
  const attempt = useRef<{ key: string; id: string } | null>(null);

  const openCall = useCallback(
    (id: string) => {
      void navigate(`/calls/${encodeURIComponent(id)}`, { viewTransition: true });
    },
    [navigate],
  );

  const begin = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setFailure(null);
    // While the launch plays, fetch the call screen so the hand-over is instant.
    if (!reducedMotion) {
      setLaunching(true);
      void import('../../pages/Call.tsx').catch(() => undefined);
    }
    const key = JSON.stringify(request);
    if (attempt.current?.key !== key) attempt.current = { key, id: newRequestId() };
    const clientRequestId = attempt.current.id;
    try {
      const session = await withTimeout(
        START_TIMEOUT_MS,
        (signal) => api.createSession({ ...request, clientRequestId }, signal),
        () =>
          new ApiError(
            0,
            'timeout',
            'Starting the call is taking too long. Check that the server is running, then try again.',
            true,
          ),
      );
      clearDraft();
      if (reducedMotion) openCall(session.id);
      else setStartedId(session.id);
    } catch (error) {
      setFailure(error);
      inFlight.current = false;
      setPending(false);
      setLaunching(false);
    }
  };

  return { begin, pending, failure, launching, startedId, openCall };
}
