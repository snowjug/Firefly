import type { SessionDTO } from '#shared/domain/api.ts';
import { EVALUATION_PHASES } from '#shared/domain/vocab.ts';
import { ApiError } from '../../../lib/api.ts';
import {
  CALL_NAMES,
  SERVER_EVALUATION_ERRORS,
  callFixtures,
  evaluatingSession,
  failedSession,
  unreadableReportSession,
  type CallName,
} from '../fixtures.ts';
import type { ReportClient } from '../useReportSession.ts';

// What the development gallery can show: `?state=<name>`. Every completed report is a call made by
// the real engine and evaluator (see ../fixtures.ts).

export const EVALUATING_PHASES = EVALUATION_PHASES.filter((phase) => phase !== 'saved');

export const GALLERY_STATES = [
  ...CALL_NAMES,
  'loading',
  'not-found',
  'unreachable',
  ...EVALUATING_PHASES.map((phase) => `evaluating-${phase}`),
  'evaluating-slow',
  'evaluating-live',
  'failed',
  'failed-provider',
  'failed-final',
  'unreadable',
] as const;

export type GalleryState = (typeof GALLERY_STATES)[number];

export interface GalleryScenario {
  client: ReportClient;
  /** Shortens the wait before "this is taking longer than usual". */
  slowAfterMs?: number;
}

const pending = <T>() => new Promise<T>(() => undefined);

function client(parts: Partial<ReportClient>): ReportClient {
  return {
    getSession: () => pending<SessionDTO>(),
    evaluate: () => pending<SessionDTO>(),
    deleteSession: () => Promise.resolve({ deleted: true }),
    ...parts,
  };
}

/** Plays the phases one poll at a time, then the finished report. */
function playing(frames: SessionDTO[]): ReportClient['getSession'] {
  let next = 0;
  return () => Promise.resolve(frames[Math.min(next++, frames.length - 1)] as SessionDTO);
}

export async function galleryScenario(state: string): Promise<GalleryScenario> {
  const calls = await callFixtures();
  const done = (name: CallName) => calls[name].session;

  if ((CALL_NAMES as readonly string[]).includes(state)) {
    return { client: client({ getSession: () => Promise.resolve(done(state as CallName)) }) };
  }
  if (
    state.startsWith('evaluating-') &&
    state !== 'evaluating-slow' &&
    state !== 'evaluating-live'
  ) {
    const phase = EVALUATING_PHASES.find((p) => `evaluating-${p}` === state) ?? 'scoring';
    return {
      client: client({ getSession: () => Promise.resolve(evaluatingSession(calls.strong, phase)) }),
    };
  }

  switch (state) {
    case 'loading':
      return { client: client({}) };
    case 'not-found':
      return {
        client: client({
          getSession: () =>
            Promise.reject(new ApiError(404, 'not_found', 'That session was not found.', false)),
        }),
      };
    case 'unreachable':
      return {
        client: client({
          getSession: () =>
            Promise.reject(
              new ApiError(
                0,
                'network',
                "Can't reach Firefly right now. Check that the server is running and that you are online, then try again.",
                true,
              ),
            ),
        }),
      };
    case 'evaluating-slow':
      return {
        client: client({
          getSession: () => Promise.resolve(evaluatingSession(calls.strong, 'scoring')),
        }),
        slowAfterMs: 1500,
      };
    case 'evaluating-live':
      return {
        client: client({
          getSession: playing([
            ...EVALUATING_PHASES.map((phase) => evaluatingSession(calls.strong, phase)),
            done('strong'),
          ]),
        }),
      };
    case 'failed':
    case 'failed-provider': {
      const error =
        state === 'failed'
          ? SERVER_EVALUATION_ERRORS.internal
          : SERVER_EVALUATION_ERRORS.providerBusy;
      const failed = failedSession(calls.weak, error);
      let retried = false;
      const recovery = [
        evaluatingSession(calls.weak, 'discovery_review'),
        evaluatingSession(calls.weak, 'scoring'),
        evaluatingSession(calls.weak, 'building_report'),
        done('weak'),
      ];
      const follow = playing(recovery);
      return {
        client: client({
          getSession: (id, signal) => (retried ? follow(id, signal) : Promise.resolve(failed)),
          evaluate: () => {
            retried = true;
            return Promise.resolve(evaluatingSession(calls.weak, 'transcript_locked'));
          },
        }),
      };
    }
    case 'failed-final':
      return {
        client: client({
          getSession: () =>
            Promise.resolve(failedSession(calls.weak, SERVER_EVALUATION_ERRORS.notConfigured)),
        }),
      };
    case 'unreadable':
      return {
        client: client({
          getSession: () => Promise.resolve(unreadableReportSession(calls.strong)),
        }),
      };
    default:
      return { client: client({ getSession: () => Promise.resolve(done('strong')) }) };
  }
}
