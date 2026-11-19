import type { SessionSummaryDTO } from '#shared/domain/api.ts';
import { SessionRow, type CompareControl } from './SessionRow.tsx';

/** The calls as a table. Narrow screens stack each row into a card (see history.css). */
export function HistoryTable({
  sessions,
  badges,
  busy,
  retryingId,
  compareFor,
  onDelete,
  onRetry,
}: {
  sessions: readonly SessionSummaryDTO[];
  badges: ReadonlyMap<string, readonly string[]>;
  /** True while a new list is loading; the old one stays on screen, slightly dimmed. */
  busy: boolean;
  retryingId: string | null;
  compareFor(session: SessionSummaryDTO): CompareControl | null;
  onDelete(session: SessionSummaryDTO): void;
  onRetry(session: SessionSummaryDTO): void;
}) {
  return (
    <div className="table-wrap hs-table-wrap" aria-busy={busy}>
      <table className="table hs-table" role="table">
        <caption className="sr-only">Practice calls, newest first</caption>
        <thead>
          <tr role="row">
            <th scope="col" className="hs-c-pick" role="columnheader">
              <span className="sr-only">Compare</span>
            </th>
            <th scope="col" className="hs-c-date" role="columnheader">
              Date
            </th>
            <th scope="col" className="hs-c-scenario" role="columnheader">
              Scenario
            </th>
            <th scope="col" className="hs-c-impact" role="columnheader">
              Impact
            </th>
            <th scope="col" className="hs-c-score" role="columnheader">
              Score
            </th>
            <th scope="col" className="hs-c-badges" role="columnheader">
              Badges
            </th>
            <th scope="col" className="hs-c-actions" role="columnheader">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              badges={badges.get(session.id) ?? []}
              compare={compareFor(session)}
              retrying={retryingId === session.id}
              onDelete={onDelete}
              onRetry={onRetry}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
