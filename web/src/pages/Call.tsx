import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router';
import type { SessionDTO } from '#shared/domain/api.ts';
import { ActiveCall } from '../components/call/ActiveCall.tsx';
import { CallNotice } from '../components/call/CallNotice.tsx';
import { ConnectingView } from '../components/call/ConnectingView.tsx';
import { EndingView } from '../components/call/EndingView.tsx';
import { api, errorMessage, isApiError } from '../lib/api.ts';
import { useApi, useDocumentTitle } from '../lib/hooks.ts';
import '../styles/chamber-kit.css';
import '../styles/chamber.css';

/** After this long a call that is still opening says so, instead of looking like it is nearly there. */
const SLOW_AFTER_MS = 6000;

/** Who is calling, when the page that began the call already knew. Used only to name the wait. */
function hintedCustomer(state: unknown): { name: string; role?: string } | null {
  if (typeof state !== 'object' || state === null) return null;
  const customer = (state as { customer?: unknown }).customer;
  if (typeof customer !== 'object' || customer === null) return null;
  const { name, role } = customer as { name?: unknown; role?: unknown };
  if (typeof name !== 'string' || name.trim() === '') return null;
  return typeof role === 'string' && role !== '' ? { name, role } : { name };
}

function Opening({ name, role }: { name: string; role?: string }) {
  const [slow, setSlow] = useState(false);
  useDocumentTitle('Opening your call');
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <ConnectingView name={name} {...(role ? { role } : {})} phase={slow ? 'slow' : 'opening'} />
  );
}

// The live call. It shows the conversation while the call is active, the wrap-up while the report
// is being prepared, and hands over to the report once it exists.
export default function Call() {
  const { id = '' } = useParams();
  const location = useLocation();
  const loaded = useApi((signal) => api.getSession(id, signal), [id]);
  const [override, setOverride] = useState<SessionDTO | null>(null);
  const session = override?.id === id ? override : loaded.data;

  if (!session) {
    if (loaded.error) {
      if (isApiError(loaded.error) && loaded.error.status === 404) {
        return (
          <div className="ch-page">
            <CallNotice
              title="We cannot find that call"
              documentTitle="Call not found"
              actions={
                <>
                  <Link className="ch-button" data-tone="primary" to="/scenarios">
                    Choose a scenario
                  </Link>
                  <Link className="ch-link" to="/home">
                    Back to home
                  </Link>
                </>
              }
            >
              It may have been discarded, or it belongs to a different browser profile.
            </CallNotice>
          </div>
        );
      }
      const retryable = !isApiError(loaded.error) || loaded.error.retryable;
      return (
        <div className="ch-page">
          <CallNotice
            title="We could not open this call"
            documentTitle="Call"
            tone="negative"
            actions={
              retryable ? (
                <button
                  type="button"
                  className="ch-button"
                  data-tone="primary"
                  onClick={loaded.reload}
                >
                  Try again
                </button>
              ) : null
            }
          >
            {errorMessage(loaded.error)}
          </CallNotice>
        </div>
      );
    }
    const hinted = hintedCustomer(location.state);
    return (
      <div className="ch-page">
        <Opening name={hinted?.name ?? ''} role={hinted?.role} />
      </div>
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
