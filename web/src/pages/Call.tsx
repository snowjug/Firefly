import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import type { SessionDTO } from '#shared/domain/api.ts';
import { ActiveCall } from '../components/call/ActiveCall.tsx';
import { EndingView } from '../components/call/EndingView.tsx';
import { EmptyState, ErrorState, LoadingCards, Page } from '../components/Page.tsx';
import { api, isApiError } from '../lib/api.ts';
import { useApi } from '../lib/hooks.ts';
import '../styles/call.css';

// The live call. It shows the conversation while the call is active, the wrap-up while the report
// is being prepared, and hands over to the report once it exists.
export default function Call() {
  const { id = '' } = useParams();
  const loaded = useApi((signal) => api.getSession(id, signal), [id]);
  const [override, setOverride] = useState<SessionDTO | null>(null);
  const session = override?.id === id ? override : loaded.data;

  if (!session) {
    if (loaded.error) {
      if (isApiError(loaded.error) && loaded.error.status === 404) {
        return (
          <Page title="Call not found" width="narrow">
            <EmptyState
              icon="phone"
              level={1}
              title="We cannot find that call"
              action={
                <Link className="btn btn-primary" to="/scenarios">
                  Choose a scenario
                </Link>
              }
            >
              It may have been discarded, or it belongs to a different browser profile.
            </EmptyState>
          </Page>
        );
      }
      return (
        <Page title="Call" width="narrow">
          <ErrorState
            error={loaded.error}
            onRetry={loaded.reload}
            level={1}
            title="We could not open this call"
          />
        </Page>
      );
    }
    return (
      <Page title="Opening your call">
        <LoadingCards count={2} label="Opening your call" />
      </Page>
    );
  }

  if (session.status === 'completed') {
    return <Navigate to={`/sessions/${session.id}/report`} replace />;
  }
  if (session.status === 'completing' || session.status === 'evaluation_failed') {
    return <EndingView key={session.status} session={session} />;
  }
  return <ActiveCall session={session} onEnded={setOverride} />;
}
