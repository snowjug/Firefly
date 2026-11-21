import { useMemo } from 'react';
import type { SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { cx } from '../../design/index.ts';
import { formatDate } from '../../lib/format.ts';
import { useMediaQuery } from '../../lib/hooks.ts';
import { About } from './About.tsx';
import { Actions } from './Actions.tsx';
import { CareSummary } from './Care.tsx';
import { BetterWording, Improvements, Strengths } from './Coaching.tsx';
import { DiscoveryReview } from './Discovery.tsx';
import { ReportHeader } from './Header.tsx';
import { JourneySection } from './Journey.tsx';
import { NextPractice } from './NextPractice.tsx';
import { Scores } from './Scores.tsx';
import { JumpTo, SectionNav } from './SectionNav.tsx';
import { Summary } from './Summary.tsx';
import { TranscriptReview } from './Transcript.tsx';
import { EvidenceProvider } from './evidence.tsx';
import { PrintProvider, usePrintedAt } from './print.tsx';
import { reportSections } from './report-model.ts';
import { useScenarioIndex } from './scenario-index.ts';
import type { ReportClient } from './useReportSession.ts';
import './report.css';

/** On paper only: what this is, and when it was printed. */
function PrintHeader() {
  const printedAt = usePrintedAt();
  return (
    <div className="rp-print-head">
      <p className="rp-print-head__brand">Firefly: coaching report</p>
      <p>
        Printed {formatDate(printedAt.toISOString())}. Practice coaching, not performance
        assessment.
      </p>
    </div>
  );
}

/**
 * The coaching report: one page, in the order a reader needs it. The call in a line, the summary and
 * the six scores, the CARE principles, how the customer moved, what went well and what to change
 * with better wording, the facts found and missed, one scenario to practise next, the actions, the
 * whole transcript and, closed, what the report is. Every quote links to the turn it came from.
 */
export function ReportView({
  session,
  report,
  client,
  reveal,
}: {
  session: SessionDTO;
  report: CoachingReport;
  client: ReportClient;
  /** The report has just been made while the page was open: show it in with a short fade. */
  reveal: boolean;
}) {
  const turnIndexes = useMemo(() => session.turns.map((turn) => turn.index), [session.turns]);
  const sections = useMemo(() => reportSections(report), [report]);
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const index = useScenarioIndex(client.scenarios);
  return (
    <PrintProvider>
      <EvidenceProvider turnIndexes={turnIndexes}>
        <div className={cx('rp-page', 'l-page', reveal && !reduced && 'rp-reveal')}>
          <PrintHeader />
          {/* The title and its actions come first, then the navigation, then the report itself;
              on wide screens the navigation is drawn to the left of both. */}
          <div className="rp-layout">
            <ReportHeader session={session} report={report} onPrint={() => window.print()} />
            <SectionNav items={sections} />
            <JumpTo items={sections} />
            <div className="rp-main">
              <Summary report={report} />
              <Scores report={report} />
              {report.care ? <CareSummary care={report.care} /> : null}
              <JourneySection report={report} />
              <Strengths report={report} />
              <Improvements report={report} />
              <BetterWording report={report} />
              <DiscoveryReview report={report} />
              <NextPractice session={session} report={report} index={index} />
              <Actions
                session={session}
                client={client}
                index={index}
                onPrint={() => window.print()}
              />
              <TranscriptReview session={session} report={report} />
              <About session={session} report={report} />
            </div>
          </div>
        </div>
      </EvidenceProvider>
    </PrintProvider>
  );
}
