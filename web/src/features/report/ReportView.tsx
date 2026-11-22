import { useMemo } from 'react';
import type { SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { cx } from '../../design/index.ts';
import { formatDate } from '../../lib/format.ts';
import { useMediaQuery } from '../../lib/hooks.ts';
import { About } from './About.tsx';
import { Actions } from './Actions.tsx';
import { CareReview } from './Care.tsx';
import { Improvements, Strengths } from './Coaching.tsx';
import { DiscoveryReview } from './Discovery.tsx';
import { ExecutiveSummary } from './Executive.tsx';
import { ExperienceSection } from './Experience.tsx';
import { NextPractice } from './NextPractice.tsx';
import { Scores } from './Scores.tsx';
import { JumpTo, SectionNav } from './SectionNav.tsx';
import { Timeline } from './Timeline.tsx';
import { TranscriptReview } from './Transcript.tsx';
import { EvidenceProvider } from './evidence.tsx';
import { evidenceTurns, turnLookup } from './evidence-model.ts';
import { buildCallEvents } from './events-model.ts';
import { PrintProvider, usePrintedAt } from './print.tsx';
import { reportSections } from './report-model.ts';
import { useScenarioIndex } from './scenario-index.ts';
import { TimelineSyncProvider } from './selection.tsx';
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
 * The coaching report: a debrief that answers what happened, how the customer's experience changed,
 * what went well, what to improve, which facts were found or missed, how CARE showed and what to
 * practise next. The call in one block with its summary, then the call journey, the six scores, the
 * CARE review, the customer's experience, the discovery review, strengths, improvement opportunities
 * with better wording, one scenario to practise next, the actions, the whole transcript and, closed,
 * what the report is. Every quote links to the turn it came from, and none is shown unless the
 * transcript says it.
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
  const turns = useMemo(() => evidenceTurns(session), [session]);
  const events = useMemo(() => buildCallEvents(report, turnLookup(turns)), [report, turns]);
  const sections = useMemo(
    () => reportSections(report, { timeline: events.length > 0 }),
    [report, events],
  );
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const index = useScenarioIndex(client.scenarios);
  return (
    <PrintProvider>
      <EvidenceProvider turns={turns}>
        <TimelineSyncProvider events={events}>
          <div className={cx('rp-page', 'l-page', reveal && !reduced && 'rp-reveal')}>
            <PrintHeader />
            {/* The summary and its actions come first, then the navigation, then the report itself;
                on wide screens the navigation is drawn to the left of both. */}
            <div className="rp-layout">
              <ExecutiveSummary session={session} report={report} onPrint={() => window.print()} />
              <SectionNav items={sections} />
              <JumpTo items={sections} />
              <div className="rp-main">
                <Timeline />
                <Scores report={report} />
                {report.care ? <CareReview report={report} /> : null}
                <ExperienceSection report={report} />
                <DiscoveryReview report={report} />
                <Strengths report={report} />
                <Improvements report={report} />
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
        </TimelineSyncProvider>
      </EvidenceProvider>
    </PrintProvider>
  );
}
