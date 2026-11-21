import { useState, useSyncExternalStore, type ReactNode } from 'react';
import '../../styles/frame.css';

// True between the browser's beforeprint and afterprint events, so a collapsed disclosure shows its
// content on paper.
const printListeners = new Set<() => void>();
let printing = false;

function setPrinting(value: boolean) {
  if (printing === value) return;
  printing = value;
  printListeners.forEach((listener) => listener());
}
const onBeforePrint = () => setPrinting(true);
const onAfterPrint = () => setPrinting(false);

function subscribePrinting(listener: () => void): () => void {
  if (printListeners.size === 0) {
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
  }
  printListeners.add(listener);
  return () => {
    printListeners.delete(listener);
    if (printListeners.size === 0) {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    }
  };
}

/**
 * Something to open only when you want it: a native `details`, with a tick that turns from a plus
 * into a minus. The summary is the control (a real button for the keyboard and screen readers),
 * and on paper the content is always open. The open state is controlled here so printing never
 * overwrites what the reader chose.
 */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const onPaper = useSyncExternalStore(
    subscribePrinting,
    () => printing,
    () => false,
  );
  return (
    <details
      className="ff-disclosure"
      open={open || onPaper}
      onToggle={(event) => {
        if (!onPaper) setOpen(event.currentTarget.open);
      }}
    >
      <summary>
        <span className="ff-disclosure__mark" aria-hidden="true" />
        <span>{summary}</span>
      </summary>
      <div className="ff-disclosure__body">{children}</div>
    </details>
  );
}
