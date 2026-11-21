import type { ReactNode } from 'react';
import { Button, Dialog } from '../../design/index.ts';
import './sheet.css';

export interface DetailsSheetProps {
  open: boolean;
  onClose(): void;
  children: ReactNode;
}

/**
 * The call details below 80em: a side sheet on tablets and a full-height sheet on phones. It is the
 * design system's native dialog, so the call behind it is inert, Escape closes it and focus goes
 * back to the Details button. It holds everything the narrower layout could not fit.
 */
export function DetailsSheet({ open, onClose, children }: DetailsSheetProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Call details"
      size="md"
      mobile="fullscreen"
      className="cw-sheet"
      closeLabel="Close details"
      actions={
        <Button appearance="primary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="cw-sheet__body">{children}</div>
    </Dialog>
  );
}
