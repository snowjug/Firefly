import { useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router';
import type { SessionDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  ErrorNotice,
  LoadingNotice,
  PageFrame,
  PageHead,
  Tag,
  Toggle,
} from '../components/report/bridge.tsx';
import { citationsByTurn, linkedTurn } from '../components/report/citations.ts';
import { reportHref } from '../components/report/labels.ts';
import { TranscriptList } from '../components/report/TranscriptList.tsx';
import { turnLines } from '../components/report/turn-lines.ts';
import { useSession } from '../components/report/useSession.ts';
import { Icon } from '../components/Icon.tsx';
import { formatDateTime, formatDuration, plural } from '../lib/format.ts';
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
  const citations = useMemo(() => citationsByTurn(report), [report]);
  const turns = session?.turns;
  const lines = useMemo(
    () =>
      turnLines(report?.journey.points ?? [], turns ?? [], report?.curveball?.firedAtTurn ?? null),
    [report, turns],
  );

  if (!session) {
    if (loading) {
      return (
        <PageFrame title="Loading transcript" className="tx">
          <h1 className="sr-only">Transcript</h1>
          <LoadingNotice label="Loading the transcript" lines={6} />
        </PageFrame>
      );
    }
    return (
      <PageFrame title="Transcript not found" width="narrow" className="tx">
        <ErrorNotice
          level={1}
          error={error}
          onRetry={reload}
          title={'We couldn\u2019t open this transcript'}
        />
        <div className="action-row">
          <Link to="/history" className="action action--quiet">
            Back to history
          </Link>
        </div>
      </PageFrame>
    );
  }

  if (session.status === 'active') {
    return <Navigate replace to={`/calls/${encodeURIComponent(session.id)}`} />;
  }

  const completed = session.status === 'completed';
  const { persona } = session.scenario;
  return (
    <PageFrame title={`Transcript \u00b7 ${session.scenarioTitle}`} className="tx">
      <PageHead
        eyebrow="Practice call"
        title="Transcript"
        lead={LEAD[session.status]}
        actions={
          <>
            <Link to={reportHref(session.id)} className="action action--quiet" viewTransition>
              <Icon name="arrow-left" size={18} /> {BACK_LABEL[session.status]}
            </Link>
            <button type="button" className="action action--quiet" onClick={() => window.print()}>
              <Icon name="print" size={18} /> Print
            </button>
          </>
        }
      />

      <div className="tx-page">
        <section className="tx-call" aria-labelledby="tx-call-title">
          <h2 id="tx-call-title" className="tx-call__title">
            {session.scenarioTitle}
          </h2>
          <p className="tx-call__who">
            {persona.name}, {persona.role}, {persona.organisation}
          </p>
          <ul role="list" className="tx-call__facts">
            <li>
              <time dateTime={session.startedAt}>{formatDateTime(session.startedAt)}</time>
            </li>
            <li>
              <span>
                <span className="sr-only">Duration: </span>
                {formatDuration(session.durationSeconds)}
              </span>
            </li>
            <li>{plural(session.turns.length, 'turn')}</li>
            <li>{DIFFICULTY_PROFILES[session.difficulty].label}</li>
            {session.isSample ? (
              <li>
                <Tag tone="amber">Sample session</Tag>
              </li>
            ) : null}
          </ul>
        </section>

        <div className="tx-toolbar">
          {completed ? (
            <Toggle
              checked={showMarkers}
              onChange={setShowMarkers}
              label="Show analysis markers"
              hint="Markers show where the customer’s mood moved, when a hidden fact came out and when a curveball landed."
            />
          ) : (
            <>
              <p className="tx-toolbar__note" role="note">
                Analysis markers appear once the report is ready.
              </p>
              <p className="tx-toolbar__hint">
                Markers show where the customer&rsquo;s mood moved, when a hidden fact came out and
                when a curveball landed.
              </p>
            </>
          )}
        </div>

        <TranscriptList
          turns={session.turns}
          customerName={persona.name}
          lines={lines}
          citations={citations}
          showMarkers={showMarkers && completed}
          linked={linkedTurn(search, hash)}
        />
        <p className="tx-end">End of transcript.</p>
      </div>
    </PageFrame>
  );
}

export default function Transcript() {
  const { id = '' } = useParams();
  // Keyed by id so moving between two transcripts starts from a clean state.
  return <TranscriptScreen key={id} id={id} />;
}
