import { useId } from 'react';
import { cx } from '../cx.ts';
import './progress-bar.css';

export interface ProgressBarProps {
  /** 0 to `max`. Leave it out when the amount of work is not known (an indeterminate bar). */
  value?: number;
  max?: number;
  /** What is progressing, for example "Evaluating the call". Always names the bar. */
  label: string;
  /** Show the label above the bar as well as naming it. */
  showLabel?: boolean;
  /** Show the amount as text beside the label. */
  showValue?: boolean;
  /** The amount in words, for example "Step 3 of 5". Defaults to a percentage. */
  valueText?: string;
  size?: 'small' | 'medium' | 'large';
  tone?: 'brand' | 'success' | 'warning' | 'danger';
  className?: string;
}

/**
 * Progress made. Determinate when it has a value (it says how far in text as well), indeterminate
 * when it does not. A still striped bar replaces the moving one when motion is reduced.
 */
export function ProgressBar({
  value,
  max = 100,
  label,
  showLabel = false,
  showValue = false,
  valueText,
  size = 'medium',
  tone = 'brand',
  className,
}: ProgressBarProps) {
  const labelId = useId();
  const determinate = value !== undefined;
  const clamped = determinate ? Math.min(max, Math.max(0, value)) : 0;
  const percent = max > 0 ? Math.round((clamped / max) * 100) : 0;
  const text = valueText ?? `${percent}%`;
  return (
    <div
      className={cx(
        'ff-progress',
        `ff-progress--${size}`,
        `ff-progress--${tone}`,
        !determinate && 'ff-progress--indeterminate',
        className,
      )}
    >
      {showLabel || (showValue && determinate) ? (
        <div className="ff-progress__head">
          {showLabel ? (
            <span className="ff-progress__label" id={labelId}>
              {label}
            </span>
          ) : null}
          {showValue && determinate ? <span className="ff-progress__value">{text}</span> : null}
        </div>
      ) : null}
      <div
        className="ff-progress__track"
        role="progressbar"
        aria-label={showLabel ? undefined : label}
        aria-labelledby={showLabel ? labelId : undefined}
        aria-valuemin={determinate ? 0 : undefined}
        aria-valuemax={determinate ? max : undefined}
        aria-valuenow={determinate ? clamped : undefined}
        aria-valuetext={determinate ? text : undefined}
      >
        <div
          className="ff-progress__fill"
          style={determinate ? { inlineSize: `${percent}%` } : undefined}
        />
      </div>
    </div>
  );
}
