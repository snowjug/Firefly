import type { ReactNode } from 'react';
import { Dialog } from '../Dialog.tsx';

export type ConfirmTone = 'danger' | 'primary';

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

function Group({ heading, items }: { heading: string; items: string[] }): ReactNode {
  return items.length === 0 ? null : (
    <div>
      <p className="t-label" style={{ marginBottom: 'var(--sp-2)' }}>
        {heading}
      </p>
      <ul className="tr-consequences">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A confirmation that states the consequence in full. Destructive styling is used on the confirm
 * button only, and focus starts on Cancel so Enter never deletes by accident.
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
    <Dialog open onClose={onCancel} title={title} description={description} dismissible={!pending}>
      <div className="stack" style={{ ['--stack-gap' as string]: 'var(--sp-4)' }}>
        <Group heading="What happens" items={will} />
        <Group heading="What stays as it is" items={wont} />
        {error ? (
          <p role="alert" className="field-error">
            {error}
          </p>
        ) : null}
        <span className="sr-only" role="status">
          {pending ? pendingLabel : ''}
        </span>
        <div className="tr-dialog-actions">
          <button
            type="button"
            className="btn btn-secondary"
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
            className={`btn ${tone === 'danger' ? 'btn-danger-solid' : 'btn-primary'}`}
            data-autofocus={tone === 'primary' ? '' : undefined}
            aria-disabled={pending || undefined}
            onClick={() => {
              if (!pending) onConfirm();
            }}
          >
            {pending ? <span className="spinner" aria-hidden="true" /> : null}
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
