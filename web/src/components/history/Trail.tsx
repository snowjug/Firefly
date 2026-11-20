import { useMemo } from 'react';
import type { SessionSummaryDTO } from '#shared/domain/api.ts';
import { TrailRow, type CompareControl } from './TrailRow.tsx';
import { groupByMonth, type ScenarioFacts } from './trail-model.ts';

/**
 * The calls as a trail: newest first on a vertical hairline, in runs by month. Each call is a node
 * (its instrument) and a row; the whole trail is one list, and each month is a list inside it with
 * its own heading, so a screen reader can move by month and by call.
 */
export function Trail({
  sessions,
  scenarios,
  badges,
  more,
  retryingId,
  compareFor,
  onDelete,
  onRetry,
}: {
  sessions: readonly SessionSummaryDTO[];
  scenarios: ReadonlyMap<string, ScenarioFacts>;
  badges: ReadonlyMap<string, readonly string[]>;
  /** There are more calls to load: the line runs on to them instead of ending. */
  more: boolean;
  retryingId: string | null;
  compareFor(session: SessionSummaryDTO): CompareControl | null;
  onDelete(session: SessionSummaryDTO): void;
  onRetry(session: SessionSummaryDTO): void;
}) {
  const months = useMemo(() => groupByMonth(sessions), [sessions]);
  return (
    <ol
      className="trail"
      role="list"
      aria-label="Practice calls, newest first"
      data-more={more ? '' : undefined}
    >
      {months.map((month) => (
        <li key={`${month.key}:${month.calls[0]?.id}`} className="trail__month">
          <div className="trail__monthhead">
            <span className="trail__tick" aria-hidden="true" />
            <h3 className="trail__monthname type-label">{month.label}</h3>
          </div>
          <ol className="trail__calls" role="list">
            {month.calls.map((session) => (
              <TrailRow
                key={session.id}
                session={session}
                scenario={scenarios.get(session.scenarioId)}
                badges={badges.get(session.id) ?? []}
                compare={compareFor(session)}
                retrying={retryingId === session.id}
                onDelete={onDelete}
                onRetry={onRetry}
              />
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}
