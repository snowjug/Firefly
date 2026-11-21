import { Link, Navigate, useParams } from 'react-router';
import { PageFrame, ErrorNotice } from '../components/report/bridge.tsx';
import {
  EvaluationFailed,
  EvaluationProgress,
  ReportSkeleton,
  ReportUnavailable,
} from '../components/report/EvaluationStates.tsx';
import { ReportView } from '../components/report/ReportView.tsx';
import { useSession } from '../components/report/useSession.ts';
import '../styles/report.css';

function ReportScreen({ id }: { id: string }) {
  const { session, error, loading, stalled, waited, reload, replace } = useSession(id);

  if (!session) {
    if (loading) return <ReportSkeleton />;
    return (
      <PageFrame title="Report not found" width="narrow" className="rp rp--wait">
        <ErrorNotice
          level={1}
          error={error}
          onRetry={reload}
          title={'We couldn\u2019t open this report'}
        />
        <div className="action-row">
          <Link to="/history" className="action action--quiet">
            Back to history
          </Link>
        </div>
      </PageFrame>
    );
  }

  switch (session.status) {
    case 'active':
      return <Navigate replace to={`/calls/${encodeURIComponent(session.id)}`} />;
    case 'completing':
      return <EvaluationProgress session={session} stalled={stalled} />;
    case 'evaluation_failed':
      return <EvaluationFailed session={session} onResult={replace} />;
    case 'completed':
      return session.report ? (
        <ReportView session={session} report={session.report} focusHeading={waited} />
      ) : (
        <ReportUnavailable session={session} />
      );
  }
}

export default function Report() {
  const { id = '' } = useParams();
  // Keyed by id so moving between two reports starts from a clean state.
  return <ReportScreen key={id} id={id} />;
}
