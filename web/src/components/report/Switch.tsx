import type { ReactNode } from 'react';

/** An on/off switch built on a native checkbox (role="switch"), with a visible label. */
export function Switch({
  checked,
  onChange,
  children,
  className = '',
  describedBy,
  disabled = false,
}: {
  checked: boolean;
  onChange(checked: boolean): void;
  children: ReactNode;
  className?: string;
  describedBy?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`sw ${className}`.trim()} aria-disabled={disabled || undefined}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
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
