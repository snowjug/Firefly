import { Dialog } from '../Dialog.tsx';
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
    <Dialog
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
      <div className="stack" style={{ ['--stack-gap' as string]: 'var(--sp-4)' }}>
        {!empty && traineeTurns < 3 ? (
          <p className="callout callout-caution">
            <Icon name="info" />
            <span>
              You have sent {traineeTurns} {traineeTurns === 1 ? 'message' : 'messages'}. You can
              still end now, but the report will say it rests on limited evidence.
            </span>
          </p>
        ) : null}
        {replying ? (
          <p className="callout">
            <Icon name="info" />
            <span>The customer is still replying. You can end the call as soon as they have.</span>
          </p>
        ) : null}
        {error ? (
          <p className="callout callout-negative" role="alert">
            <Icon name="alert" />
            <span>{error}</span>
          </p>
        ) : null}
        <div className="cluster" style={{ justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={pending}
            data-autofocus
          >
            Keep talking
          </button>
          {empty ? (
            <button
              type="button"
              className="btn btn-danger-solid"
              onClick={onDiscard}
              disabled={pending}
            >
              {pending ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                <Icon name="trash" size={18} />
              )}
              Discard call
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onConfirm}
              disabled={pending || replying}
            >
              {pending ? <span className="spinner" aria-hidden="true" /> : null}
              {pending ? 'Ending call…' : 'End call and get feedback'}
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
