import type { ReactNode } from 'react';
import '../../styles/report.css';

/** An on/off switch built on a native checkbox (role="switch"), with a visible label. */
export function Switch({
  checked,
  onChange,
  children,
  className = '',
  describedBy,
}: {
  checked: boolean;
  onChange(checked: boolean): void;
  children: ReactNode;
  className?: string;
  describedBy?: string;
}) {
  return (
    <label className={`sw ${className}`.trim()}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="sw-track" aria-hidden="true">
        <span className="sw-thumb" />
      </span>
      <span>{children}</span>
    </label>
  );
}
