import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { CreateSessionRequest } from '#shared/domain/api.ts';
import type { ScenarioOverrides } from '#shared/domain/scenario.ts';
import type { PracticeMode } from '#shared/domain/vocab.ts';
import { ApiError, api } from '../../lib/api.ts';
import { withTimeout } from '../../lib/timeout.ts';
import { START_TIMEOUT_MS, describeStartFailure, type StartFailure } from './start-failure.ts';
import type { VoiceId } from './voice-choice.ts';

export type StartInput = 'voice' | 'text';

export type TimeOfDay = NonNullable<CreateSessionRequest['timeOfDay']>;

/**
 * The part of the day where the trainee is, from their own clock, so the customer's greeting fits:
 * morning before 12:00, afternoon from 12:00 to 17:59, evening from 18:00.
 */
export function timeOfDayFor(now: Date = new Date()): TimeOfDay {
  const hour = now.getHours();
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
}

export interface CallRequest {
  scenarioId: string;
  overrides: ScenarioOverrides;
  mode: PracticeMode;
  /** The customer's voice. It is not part of the request to the server: the call is opened with it. */
  voice?: VoiceId;
}

/** A request id the server accepts (8 to 64 letters, digits, dashes). Works without a secure page. */
export function newRequestId(): string {
  const crypto = globalThis.crypto;
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto?.getRandomValues === 'function') crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return `req-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Starts the call for a request. It is safe to press twice and safe to retry:
 *  - while a request is out, pressing again does nothing;
 *  - the request id is made once and reused by every retry of the same request, with the time of
 *    day it was first made with, so a call that did start is never started twice, while a different
 *    request gets a new id.
 * The page the person is on stays as it is until the call exists; then it opens the call, saying
 * whether it is spoken (`?input=voice`) or typed (`?input=text`), and which voice was chosen
 * (`&voice=voice-b`).
 */
export function useStartCall(request: CallRequest) {
  const navigate = useNavigate();
  const [pending, setPending] = useState<StartInput | null>(null);
  const [failure, setFailure] = useState<StartFailure | null>(null);
  const inFlight = useRef(false);
  const lastInput = useRef<StartInput>('voice');
  const attempt = useRef<{ key: string; id: string; timeOfDay: TimeOfDay } | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The voice is not part of what makes a request the same request.
  const requestKey = JSON.stringify([request.scenarioId, request.overrides, request.mode]);
  const requestRef = useRef(request);
  useEffect(() => {
    requestRef.current = request;
  });

  const start = useCallback(
    async (input: StartInput) => {
      if (inFlight.current) return;
      inFlight.current = true;
      lastInput.current = input;
      setPending(input);
      setFailure(null);
      if (attempt.current?.key !== requestKey) {
        attempt.current = { key: requestKey, id: newRequestId(), timeOfDay: timeOfDayFor() };
      }
      const { id: clientRequestId, timeOfDay } = attempt.current;
      const { voice, ...body } = requestRef.current;
      try {
        const session = await withTimeout(
          START_TIMEOUT_MS,
          (signal) => api.createSession({ ...body, timeOfDay, clientRequestId }, signal),
          () =>
            new ApiError(
              0,
              'timeout',
              'Starting the call is taking too long. Please try again.',
              true,
            ),
        );
        // Someone who has left the page is not pulled into a call they walked away from.
        if (mounted.current) {
          const chosen = voice ? `&voice=${voice}` : '';
          void navigate(`/calls/${encodeURIComponent(session.id)}?input=${input}${chosen}`);
        }
      } catch (error) {
        inFlight.current = false;
        if (!mounted.current) return;
        setFailure(
          describeStartFailure(error, typeof navigator === 'undefined' || navigator.onLine),
        );
        setPending(null);
      }
    },
    [navigate, requestKey],
  );

  /** Repeats the last attempt with the same request id. */
  const retry = useCallback(() => start(lastInput.current), [start]);

  return { start, retry, pending, failure, busy: pending !== null };
}
