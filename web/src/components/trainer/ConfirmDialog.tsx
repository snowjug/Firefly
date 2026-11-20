import { Dialog, Icon } from './bridge.tsx';
import type { ConfirmTone } from './data-actions.ts';

interface ConfirmDialogProps {
  title: string;
  description: string;
  /** Exactly what will be created or deleted. */
  will: string[];
  /** What is left as it is. */
  wont: string[];
  confirmLabel: string;
  pendingLabel: string;
  tone: ConfirmTone;
  pending: boolean;
  error: string | null;
  onConfirm(): void;
  onCancel(): void;
}

function Group({ heading, items }: { heading: string; items: string[] }) {
  return items.length === 0 ? null : (
    <div className="tr-dialog__group">
      <p className="tr-dialog__label type-label">{heading}</p>
      <ul className="tr-consequences">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A confirmation that states the consequence in full. Danger styling is used on the confirm button
 * only, and focus starts on Cancel so that Enter never deletes by accident. While the request runs,
 * nothing can be pressed twice and the dialog cannot be dismissed.
 */
export function ConfirmDialog({
  title,
  description,
  will,
  wont,
  confirmLabel,
  pendingLabel,
  tone,
  pending,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open
      onClose={onCancel}
      eyebrow="Demo data"
      title={title}
      description={description}
      dismissible={!pending}
    >
      <div className="tr-dialog">
        <Group heading="What happens" items={will} />
        <Group heading="What stays as it is" items={wont} />
        {error ? (
          <p role="alert" className="tr-problem">
            <Icon name="alert" size={16} />
            <span>{error}</span>
          </p>
        ) : null}
        <span className="sr-only" role="status">
          {pending ? pendingLabel : ''}
        </span>
        <div className="action-row tr-dialog__actions">
          <button
            type="button"
            className="action action--quiet"
            data-autofocus={tone === 'danger' ? '' : undefined}
            aria-disabled={pending || undefined}
            onClick={() => {
              if (!pending) onCancel();
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className={tone === 'danger' ? 'action action--danger' : 'action'}
            data-autofocus={tone === 'primary' ? '' : undefined}
            aria-disabled={pending || undefined}
            aria-busy={pending || undefined}
            onClick={() => {
              if (!pending) onConfirm();
            }}
          >
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
