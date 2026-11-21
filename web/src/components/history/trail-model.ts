import type { SessionSummaryDTO } from '#shared/domain/api.ts';
import type { CallStage } from '#shared/domain/vocab.ts';
import { formatDateTime } from '../../lib/format.ts';
import type { TagTone } from '../frame/Tag.tsx';
import type { GlyphTraits } from '../signal/types.ts';

// What the trail (History) and the "last call" line on Home read from a saved call. All of it comes
// from the call's summary and, where the library knows the scenario, the scenario's own public
// settings. Nothing here can carry a hidden fact: a summary has none.

/** What the library says about a scenario that the summary of a call does not. A mission has both. */
export interface ScenarioFacts {
  stage: CallStage;
  minutes: number;
  /** Who the customer was, when the library has the scenario. */
  customer?: string;
}

/** A call taken all the way to a close. Anything else (open, ended early, waiting) is "attempted". */
export function isFullyCompleted(
  session: Pick<SessionSummaryDTO, 'status' | 'completion'>,
): boolean {
  return session.status === 'completed' && session.completion === 'completed';
}

/**
 * The instrument for one call. Difficulty, impact and how the customer started are this call's own
 * settings (a trainee can change them), the stage and the length come from the scenario. A scenario
 * the library does not know gets the first-contact circle and no lit ticks, rather than a guess.
 */
export function callGlyphTraits(
  session: SessionSummaryDTO,
  scenario: ScenarioFacts | undefined,
): GlyphTraits {
  return {
    difficulty: session.difficulty,
    impact: session.impact,
    start: session.startingTemperature,
    stage: scenario?.stage ?? 'first-contact',
    status: isFullyCompleted(session) ? 'completed' : 'attempted',
    minutes: scenario?.minutes ?? 0,
  };
}

/**
 * The colour of the point in front of a status word. The word always says it; the colour only adds:
 * sage for a finished call, aqua while something is still going on, coral for the one state that
 * needs doing something about, and plain for a call that simply stopped early.
 */
export function statusTone(session: Pick<SessionSummaryDTO, 'status' | 'completion'>): TagTone {
  switch (session.status) {
    case 'active':
    case 'completing':
      return 'aqua';
    case 'evaluation_failed':
      return 'coral';
    case 'completed':
      return session.completion === 'ended-early' ? 'neutral' : 'sage';
  }
}

/** When a call started, in words, for a link name or a line of text. A date it cannot read says so. */
export function formatWhen(iso: string): string {
  return Number.isNaN(Date.parse(iso)) ? 'Date unknown' : formatDateTime(iso);
}

export interface TrailMonth {
  /** Stable across loads: "2026-11". */
  key: string;
  /** "November 2026" in the reader's own language. */
  label: string;
  calls: SessionSummaryDTO[];
}

const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

/**
 * Splits calls (newest first) into runs by the month they started in, the reader's own calendar
 * month. The order never changes: a month holds its calls in the order they came in, and a month
 * that appears again later (a list that is not sorted) starts a new run instead of reordering.
 */
export function groupByMonth(sessions: readonly SessionSummaryDTO[]): TrailMonth[] {
  const months: TrailMonth[] = [];
  for (const session of sessions) {
    const date = new Date(session.startedAt);
    const valid = !Number.isNaN(date.getTime());
    const key = valid
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      : 'unknown';
    const last = months[months.length - 1];
    if (last && last.key === key) {
      last.calls.push(session);
      continue;
    }
    months.push({
      key,
      label: valid ? monthFormat.format(date) : 'Date unknown',
      calls: [session],
    });
  }
  return months;
}
