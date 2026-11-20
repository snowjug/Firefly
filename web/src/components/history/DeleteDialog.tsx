import { useState } from 'react';
import type { SessionSummaryDTO } from '#shared/domain/api.ts';
import { api, errorMessage, isApiError } from '../../lib/api.ts';
import { formatWhen } from './trail-model.ts';
import { Dialog } from '../Dialog.tsx';
import { Icon } from '../Icon.tsx';
import '../../styles/history.css';

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
    <div className="trail-dialog">
      <p className="trail-delete-target">
        <strong>{session.scenarioTitle}</strong>
        <span>{formatWhen(session.startedAt)}</span>
      </p>
      {problem ? (
        <p className="trail-dialog__problem" role="alert">
          <Icon name="alert" size={16} />
          <span>{errorMessage(problem)}</span>
        </p>
      ) : null}
      <div className="action-row trail-dialog__actions">
        <button type="button" className="action action--quiet" onClick={onCancel} data-autofocus>
          Cancel
        </button>
        <button
          type="button"
          className="action action--danger"
          onClick={confirm}
          disabled={busy}
          aria-busy={busy || undefined}
        >
          <Icon name="trash" size={16} />
          Delete call
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
      title="Delete this call?"
      description="This permanently deletes the transcript and the coaching report for this call. It can’t be undone."
    >
      {session ? <DeleteBody session={session} onCancel={onCancel} onDeleted={onDeleted} /> : null}
    </Dialog>
  );
}
