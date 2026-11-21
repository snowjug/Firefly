import { ChamberModal } from './ChamberModal.tsx';
import { Icon } from '../Icon.tsx';

/** Confirms ending the call. A call with no messages can only be discarded, never evaluated. */
export function EndCallDialog({
  open,
  onClose,
  traineeTurns,
  replying,
  pending,
  error,
  onConfirm,
  onDiscard,
}: {
  open: boolean;
  onClose(): void;
  traineeTurns: number;
  replying: boolean;
  pending: boolean;
  error: string | null;
  onConfirm(): void;
  onDiscard(): void;
}) {
  const empty = traineeTurns === 0;
  return (
    <ChamberModal
      open={open}
      onClose={onClose}
      dismissible={!pending}
      title={empty ? 'Nothing to review yet' : 'End this call?'}
      description={
        empty
          ? 'You have not said anything yet, so there is nothing to coach. Keep talking, or discard this call.'
          : 'Firefly will save your conversation and build your coaching report. You cannot send more messages after you end the call.'
      }
    >
      <div className="ch-modal__body">
        {!empty && traineeTurns < 3 ? (
          <p className="ch-aside">
            <Icon name="info" size={16} />
            <span>
              You have sent {traineeTurns} {traineeTurns === 1 ? 'message' : 'messages'}. You can
              still end now, but the report will say it rests on limited evidence.
            </span>
          </p>
        ) : null}
        {replying ? (
          <p className="ch-aside">
            <Icon name="info" size={16} />
            <span>The customer is still replying. You can end the call as soon as they have.</span>
          </p>
        ) : null}
        {error ? (
          <p className="ch-aside" data-tone="negative" role="alert">
            <Icon name="alert" size={16} />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
      <div className="ch-modal__actions">
        <button
          type="button"
          className="ch-link"
          onClick={onClose}
          disabled={pending}
          data-autofocus
        >
          Keep talking
        </button>
        {empty ? (
          <button
            type="button"
            className="ch-button"
            data-tone="negative"
            onClick={onDiscard}
            disabled={pending}
          >
            <Icon name="trash" size={16} />
            Discard call
          </button>
        ) : (
          <button
            type="button"
            className="ch-button"
            data-tone="primary"
            onClick={onConfirm}
            disabled={pending || replying}
          >
            {pending ? 'Ending call…' : 'End call and get feedback'}
            <Icon name="arrow-right" size={16} />
          </button>
        )}
      </div>
    </ChamberModal>
  );
}
