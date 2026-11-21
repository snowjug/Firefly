import { useId } from 'react';
import { cx } from '../cx.ts';
import './spinner.css';

export type SpinnerSize = 'tiny' | 'small' | 'medium' | 'large';

export interface SpinnerProps {
  size?: SpinnerSize;
  /** What is loading, for example "Loading scenarios". Always give one unless the spinner is decorative. */
  label?: string;
  /** Show the label beside the spinner as well as naming it. */
  showLabel?: boolean;
  labelPosition?: 'below' | 'after';
  /** `current` draws in the surrounding text colour (inside a button); `brand` in the brand blue. */
  tone?: 'brand' | 'current';
  /** True when text beside it already says what is happening: hidden from assistive technology. */
  decorative?: boolean;
  className?: string;
}

/** Indeterminate progress. It is a progressbar with a name, so it is not just a moving shape. */
export function Spinner({
  size = 'medium',
  label = 'Loading',
  showLabel = false,
  labelPosition = 'below',
  tone = 'brand',
  decorative = false,
  className,
}: SpinnerProps) {
  const labelId = useId();
  const a11y = decorative
    ? ({ 'aria-hidden': true } as const)
    : ({
        role: 'progressbar',
        'aria-busy': true,
        ...(showLabel ? { 'aria-labelledby': labelId } : { 'aria-label': label }),
      } as const);
  return (
    <span
      className={cx(
        'ff-spinner',
        `ff-spinner--${size}`,
        tone === 'current' && 'ff-spinner--current',
        showLabel && `ff-spinner--${labelPosition}`,
        className,
      )}
      {...a11y}
    >
      <svg className="ff-spinner__svg" viewBox="0 0 24 24" fill="none">
        <circle className="ff-spinner__track" cx="12" cy="12" r="9" />
        <circle className="ff-spinner__arc" cx="12" cy="12" r="9" />
      </svg>
      {showLabel ? (
        <span className="ff-spinner__label" id={labelId}>
          {label}
        </span>
      ) : null}
    </span>
  );
}
