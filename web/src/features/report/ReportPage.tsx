import { useEffect, useRef } from 'react';
import { Navigate } from 'react-router';
import { useAnnouncer } from '../../design/index.ts';
import { api } from '../../lib/api.ts';
import { useDocumentTitle } from '../../lib/hooks.ts';
import { useAppSection } from '../../app/section.tsx';
import { EvaluatingView, FailedView, LoadingView, UnavailableView } from './states.tsx';
import { ReportView } from './ReportView.tsx';
import { SLOW_AFTER_MS } from './evaluation.ts';
import { useReportSession, type ReportClient, type ReportViewState } from './useReportSession.ts';

const TITLES: Record<ReportViewState['kind'], string> = {
  loading: 'Coaching report',
  unavailable: 'Report unavailable',
  active: 'Coaching report',
  evaluating: 'Building your coaching report',
  failed: 'Coaching report',
  report: 'Coaching report',
};

/** What a screen reader hears when the page changes from one state to another. */
const ARRIVAL: Partial<Record<ReportViewState['kind'], string>> = {
  report: 'Your coaching report is ready.',
  failed: 'The coaching report could not be finished. Your transcript is saved.',
  evaluating: 'Building your coaching report.',
};

export interface ReportPageProps {
  /** The call to show. Give the page a `key` of this so changing it starts afresh. */
  sessionId: string;
  /** What to ask the server. Defaults to the real API; the gallery and the tests pass their own. */
  client?: ReportClient;
  /** How long to wait for the evaluation before saying it is taking longer than usual. */
  slowAfterMs?: number;
}

/**
 * Everything after a call ends, at one address: the evaluation under way, a failure that can be
 * recovered from, or the coaching report. A call that is still active goes back to the call.
 */
export function ReportPage({
  sessionId,
  client = api,
  slowAfterMs = SLOW_AFTER_MS,
}: ReportPageProps) {
  const { view, retry, retrying, retryError, reload } = useReportSession(sessionId, client);
  const announce = useAnnouncer();
  useAppSection('Report', { backTo: '/scenarios' });
  useDocumentTitle(TITLES[view.kind]);

  // When the page changes state under the person's hands (the evaluation finishes, fails, or is
  // tried again) the thing they were looking at is gone: say so, and put focus on the new heading.
  const before = useRef<ReportViewState['kind']>(view.kind);
  useEffect(() => {
    const was = before.current;
    before.current = view.kind;
    if (was === view.kind || (was !== 'evaluating' && was !== 'failed')) return;
    const sentence = ARRIVAL[view.kind];
    if (sentence) announce(sentence);
    const heading = document.getElementById('report-title');
    // A heading is not a control: like the app's own focus moves, it takes focus without a ring.
    heading?.setAttribute('data-route-target', '');
    heading?.focus({ preventScroll: true });
  }, [view.kind, announce]);

  switch (view.kind) {
    case 'loading':
      return <LoadingView />;
    case 'unavailable':
      return <UnavailableView notFound={view.notFound} message={view.message} onRetry={reload} />;
    case 'active':
      return <Navigate to={`/calls/${encodeURIComponent(sessionId)}`} replace />;
    case 'evaluating':
      return (
        <EvaluatingView session={view.session} trouble={view.trouble} slowAfterMs={slowAfterMs} />
      );
    case 'failed':
      return (
        <FailedView
          state={view}
          onRetry={retry}
          retrying={retrying}
          retryError={retryError}
          client={client}
        />
      );
    case 'report':
      return (
        <ReportView
          session={view.session}
          report={view.report}
          client={client}
          reveal={view.reveal}
        />
      );
  }
}
