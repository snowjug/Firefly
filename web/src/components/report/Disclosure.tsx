import { useState, type ReactNode } from 'react';
import { Icon } from '../Icon.tsx';
import { usePrinting } from './usePrinting.ts';

/**
 * A native disclosure that always shows its content on paper. The open state is controlled so the
 * print override never overwrites what the reader chose.
 */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  className = '',
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const printing = usePrinting();
  return (
    <details
      className={`rp-disclosure ${className}`.trim()}
      open={open || printing}
      onToggle={(event) => {
        if (!printing) setOpen(event.currentTarget.open);
      }}
    >
      <summary className="rp-disclosure-summary">
        <span className="rp-disclosure-title">{summary}</span>
        <Icon name="chevron-down" size={18} className="rp-chevron" />
      </summary>
      <div className="rp-disclosure-body">{children}</div>
    </details>
  );
}
