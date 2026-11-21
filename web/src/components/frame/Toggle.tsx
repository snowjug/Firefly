import { useId, type ReactNode } from 'react';
import '../../styles/frame.css';

/**
 * An on/off setting: the label (and an optional hint) on the left, a hairline track with an amber
 * point on the right. It is a real `role="switch"` button, so the state is announced; the point's
 * position, its fill and the words On and Off say the same thing without colour. Clicking the label
 * toggles it too. Pass `id` to tie other text to the switch.
 */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
  id,
}: {
  checked: boolean;
  onChange(checked: boolean): void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  id?: string;
}) {
  const generated = useId();
  const buttonId = id ?? generated;
  const hintId = `${buttonId}-hint`;
  return (
    <div className="ff-toggle">
      <div className="ff-toggle__text">
        <label className="ff-toggle__label" htmlFor={buttonId}>
          {label}
        </label>
        {hint ? (
          <p id={hintId} className="ff-toggle__hint">
            {hint}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        id={buttonId}
        className="ff-toggle__button"
        aria-checked={checked}
        aria-describedby={hint ? hintId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="ff-toggle__state" aria-hidden="true">
          {checked ? 'On' : 'Off'}
        </span>
        <span className="ff-toggle__track" aria-hidden="true" />
      </button>
    </div>
  );
}
