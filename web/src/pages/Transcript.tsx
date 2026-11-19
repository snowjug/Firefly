import { useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router';
import type { SessionDTO } from '#shared/domain/api.ts';
import { DifficultyChip } from '../components/Chips.tsx';
import { Icon } from '../components/Icon.tsx';
import { ErrorState, Page, PageHeader, SkeletonBlock } from '../components/Page.tsx';
import { citedTurns, linkedTurn } from '../components/report/citations.ts';
import { reportHref } from '../components/report/labels.ts';
import { Switch } from '../components/report/Switch.tsx';
import { TranscriptList } from '../components/report/TranscriptList.tsx';
import { useSession } from '../components/report/useSession.ts';
import { formatDateTime, formatDuration, plural } from '../lib/format.ts';
import '../styles/report.css';
import '../styles/transcript.css';

const BACK_LABEL: Record<SessionDTO['status'], string> = {
  active: 'Back to the call',
  completing: 'See report progress',
  evaluation_failed: 'Retry the report',
  completed: 'Back to report',
};

const LEAD: Record<SessionDTO['status'], string> = {
  active: '',
  completing: 'Your transcript is saved. The coaching report is still being prepared.',
  evaluation_failed: 'Your transcript is safe. The coaching report could not be built yet.',
  completed:
    'Everything said on the call, in order. Turns that the coaching report quotes or refers to are marked so you can find them.',
};

function TranscriptScreen({ id }: { id: string }) {
  const { session, error, loading, reload } = useSession(id);
  const [search] = useSearchParams();
  const { hash } = useLocation();
  const [showMarkers, setShowMarkers] = useState(true);
  const report = session?.report ?? null;
  const cited = useMemo(() => citedTurns(report), [report]);

  if (!session) {
    if (loading) {
      return (
        <Page title="Loading transcript" width="narrow" className="tx-root">
          <h1 className="sr-only">Transcript</h1>
          <div className="stack" role="status" aria-label="Loading the transcript">
            <SkeletonBlock height={28} width="60%" />
            {Array.from({ length: 5 }, (_, i) => (
              <SkeletonBlock key={i} height={72} width={i % 2 ? '85%' : '92%'} />
            ))}
          </div>
        </Page>
      );
    }
    return (
      <Page title="Transcript not found" width="narrow" className="tx-root">
        <h1 className="sr-only">Transcript</h1>
        <ErrorState
          error={error}
          onRetry={reload}
          title={'We couldn\u2019t open this transcript'}
        />
        <p className="center-text" style={{ marginTop: 'var(--sp-4)' }}>
          <Link to="/history" className="btn btn-secondary">
            Back to history
          </Link>
        </p>
      </Page>
    );
  }

  if (session.status === 'active') {
    return <Navigate replace to={`/calls/${encodeURIComponent(session.id)}`} />;
  }

  const completed = session.status === 'completed';
  const customerName = session.scenario.persona.name;
  return (
    <Page title={`Transcript \u00b7 ${session.scenarioTitle}`} width="narrow" className="tx-root">
      <PageHeader eyebrow="Transcript" title={session.scenarioTitle} lead={LEAD[session.status]} />

      <div className="tx-subbar">
        <ul role="list" className="tx-meta">
          <li>
            <time dateTime={session.startedAt}>{formatDateTime(session.startedAt)}</time>
          </li>
          <li>
            <DifficultyChip difficulty={session.difficulty} />
          </li>
          <li>
            <Icon name="clock" size={15} />
            <span>
              <span className="sr-only">Duration: </span>
              {formatDuration(session.durationSeconds)}
            </span>
          </li>
          <li>{plural(session.turns.length, 'turn')}</li>
          {session.isSample ? (
            <li>
              <span className="chip chip-accent">Sample session</span>
            </li>
          ) : null}
        </ul>
        <div className="cluster tx-actions">
          <Link to={reportHref(session.id)} className="btn btn-secondary" viewTransition>
            <Icon name="arrow-left" size={18} /> {BACK_LABEL[session.status]}
          </Link>
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
            <Icon name="print" size={18} /> Print
          </button>
        </div>
      </div>
      <div className="tx-toolbar">
        {completed ? (
          <Switch checked={showMarkers} onChange={setShowMarkers}>
            Show analysis markers
          </Switch>
        ) : (
          <p className="t-small t-muted" role="note">
            Analysis markers appear once the report is ready.
          </p>
        )}
        <p className="t-meta tx-toolbar-hint">
          Markers show where the customer&rsquo;s mood moved, when a hidden fact came out and when a
          curveball landed.
        </p>
      </div>

      <TranscriptList
        turns={session.turns}
        customerName={customerName}
        cited={cited}
        showMarkers={showMarkers}
        linked={linkedTurn(search, hash)}
      />
      <p className="t-meta tx-end">End of transcript.</p>
    </Page>
  );
}

export default function Transcript() {
  const { id = '' } = useParams();
  // Keyed by id so moving between two transcripts starts from a clean state.
  return <TranscriptScreen key={id} id={id} />;
}
