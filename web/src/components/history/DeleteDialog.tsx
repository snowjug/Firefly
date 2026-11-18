import { useState } from 'react';
import type { SessionSummaryDTO } from '#shared/domain/api.ts';
import { api, errorMessage, isApiError } from '../../lib/api.ts';
import { formatDateTime } from '../../lib/format.ts';
import { Dialog } from '../Dialog.tsx';
import { Icon } from '../Icon.tsx';

function DeleteBody({
  session,
  onCancel,
  onDeleted,
}: {
  session: SessionSummaryDTO;
  onCancel(): void;
  onDeleted(session: SessionSummaryDTO): void;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<unknown>(null);

  const confirm = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await api.deleteSession(session.id);
      onDeleted(session);
    } catch (error) {
      // Already gone (for example deleted in another tab): the list should match.
      if (isApiError(error) && error.status === 404) {
        onDeleted(session);
        return;
      }
      setProblem(error);
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ ['--stack-gap' as string]: 'var(--sp-4)' }}>
      <p className="hs-delete-target">
        <strong>{session.scenarioTitle}</strong>
        <span className="t-meta">{formatDateTime(session.startedAt)}</span>
      </p>
      {problem ? (
        <p className="field-error" role="alert">
          {errorMessage(problem)}
        </p>
      ) : null}
      <div className="cluster" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} data-autofocus>
          Cancel
        </button>
        <button type="button" className="btn btn-danger-solid" onClick={confirm} disabled={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="trash" size={16} />}
          Delete session
        </button>
      </div>
    </div>
  );
}

/** Confirmation that says exactly what is deleted. Cancel has initial focus. */
export function DeleteDialog({
  session,
  onCancel,
  onDeleted,
}: {
  session: SessionSummaryDTO | null;
  onCancel(): void;
  onDeleted(session: SessionSummaryDTO): void;
}) {
  return (
    <Dialog
      open={session !== null}
      onClose={onCancel}
      title="Delete this session?"
      description="This permanently deletes the transcript and the coaching report for this session. It can’t be undone."
    >
      {session ? <DeleteBody session={session} onCancel={onCancel} onDeleted={onDeleted} /> : null}
    </Dialog>
  );
}
