import type { SessionDTO } from '#shared/domain/api.ts';
import { EVALUATION_PHASES } from '#shared/domain/vocab.ts';
import { ApiError } from '../../../lib/api.ts';
import {
  CALLS,
  CALL_NAMES,
  SCENARIO_INDEX,
  SERVER_EVALUATION_ERRORS,
  asVersion1,
  evaluatingSession,
  failedSession,
  unreadableReportSession,
  withReport,
  type CallName,
} from '../fixtures.ts';
import type { ReportClient } from '../useReportSession.ts';

// What the development gallery can show: `?state=<name>`. The reports are written by hand in
// ../fixtures.ts (Microsoft scenarios, fictional people), so this page needs no server.

export const EVALUATING_PHASES = EVALUATION_PHASES.filter((phase) => phase !== 'saved');

export const GALLERY_STATES = [
  ...CALL_NAMES,
  'version-1',
  'no-product',
  'long-text',
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
    scenarios: () => Promise.resolve(SCENARIO_INDEX),
    ...parts,
  };
}

/** Plays the phases one poll at a time, then the finished report. */
function playing(frames: SessionDTO[]): ReportClient['getSession'] {
  let next = 0;
  return () => Promise.resolve(frames[Math.min(next++, frames.length - 1)] as SessionDTO);
}

const WORDS =
  'The call opened well and the customer settled, but the coaching came back with more to say than the page first shows, so the rest waits behind a button where anyone who wants it can read it in full. ';

/** The strong call with every budgeted text longer than its budget, to show what "Show more" does. */
function longTextSession(): SessionDTO {
  const { report } = CALLS.strong;
  const long: typeof report = {
    ...report,
    summary: { ...report.summary, overall: WORDS.repeat(2).trim().slice(0, 1190) },
    strengths: report.strengths.map((s) => ({
      ...s,
      whyItHelped: `${s.whyItHelped} ${WORDS}`.slice(0, 390),
    })),
    improvements: report.improvements.map((i) => ({
      ...i,
      risk: `${i.risk} ${WORDS}`.slice(0, 390),
    })),
  };
  return withReport(CALLS.strong, long);
}

export async function galleryScenario(state: string): Promise<GalleryScenario> {
  const done = (name: CallName) => CALLS[name].session;

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
      client: client({
        getSession: () => Promise.resolve(evaluatingSession(CALLS.strong, phase)),
      }),
    };
  }

  switch (state) {
    case 'version-1':
      return {
        client: client({
          getSession: () =>
            Promise.resolve(withReport(CALLS.strong, asVersion1(CALLS.strong.report))),
        }),
      };
    case 'no-product': {
      const session = {
        ...done('strong'),
        scenario: { ...done('strong').scenario, product: null },
      };
      return { client: client({ getSession: () => Promise.resolve(session) }) };
    }
    case 'long-text':
      return { client: client({ getSession: () => Promise.resolve(longTextSession()) }) };
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
          getSession: () => Promise.resolve(evaluatingSession(CALLS.strong, 'scoring')),
        }),
        slowAfterMs: 1500,
      };
    case 'evaluating-live':
      return {
        client: client({
          getSession: playing([
            ...EVALUATING_PHASES.map((phase) => evaluatingSession(CALLS.strong, phase)),
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
      const failed = failedSession(CALLS.weak, error);
      let retried = false;
      const follow = playing([
        evaluatingSession(CALLS.weak, 'discovery_review'),
        evaluatingSession(CALLS.weak, 'scoring'),
        evaluatingSession(CALLS.weak, 'building_report'),
        done('weak'),
      ]);
      return {
        client: client({
          getSession: (id, signal) => (retried ? follow(id, signal) : Promise.resolve(failed)),
          evaluate: () => {
            retried = true;
            return Promise.resolve(evaluatingSession(CALLS.weak, 'transcript_locked'));
          },
        }),
      };
    }
    case 'failed-final':
      return {
        client: client({
          getSession: () =>
            Promise.resolve(failedSession(CALLS.weak, SERVER_EVALUATION_ERRORS.notConfigured)),
        }),
      };
    case 'unreadable':
      return {
        client: client({
          getSession: () => Promise.resolve(unreadableReportSession(CALLS.strong)),
        }),
      };
    default:
      return { client: client({ getSession: () => Promise.resolve(done('strong')) }) };
  }
}
