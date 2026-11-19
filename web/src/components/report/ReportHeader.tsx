import type { RefObject } from 'react';
import { Link } from 'react-router';
import type { CoachingReport } from '#shared/domain/report.ts';
import { Icon } from '../Icon.tsx';
import { PRINT_HINT, reportSubline, transcriptHref } from './labels.ts';

/** "Call feedback": the page title, a line that is true for this result and the print button. */
export function ReportHeader({
  sessionId,
  report,
  headingRef,
}: {
  sessionId: string;
  report: CoachingReport;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <header className="rp-head">
      <div className="rp-head-text">
        <h1 id="rp-title" className="t-title rp-title" tabIndex={-1} ref={headingRef}>
          Call feedback
        </h1>
        <p className="t-lead rp-subline">{reportSubline(report)}</p>
      </div>
      <div className="cluster rp-head-actions">
        <Link to={transcriptHref(sessionId)} className="btn btn-ghost" viewTransition>
          <Icon name="notes" size={18} /> Review transcript
        </Link>
        <button
          type="button"
          className="btn btn-secondary rp-download"
          aria-describedby="rp-print-hint"
          onClick={() => window.print()}
        >
          <Icon name="print" size={18} /> Download report
        </button>
        <span id="rp-print-hint" className="sr-only">
          {PRINT_HINT}
        </span>
      </div>
    </header>
  );
}
