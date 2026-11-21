import type { CSSProperties } from 'react';
import { cx } from '../cx.ts';
import './progress-shimmer.css';

export interface ProgressShimmerProps {
  /** What is in progress, for example "Transcribing your reply". It names the bar. */
  label: string;
  size?: 'small' | 'medium';
  /** A CSS length or a number of pixels. Defaults to the width of the container. */
  width?: string | number;
  className?: string;
}

/**
 * Work in progress with no way of knowing how far: a thin track with a soft band that sweeps
 * across it. It never shows a percentage, because there is none to show. The label is the state in
 * words, and under reduced motion the band is a still, striped track.
 */
export function ProgressShimmer({
  label,
  size = 'medium',
  width,
  className,
}: ProgressShimmerProps) {
  const style: CSSProperties | undefined = width === undefined ? undefined : { inlineSize: width };
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-busy="true"
      className={cx('ff-shimmer', `ff-shimmer--${size}`, className)}
      style={style}
    >
      <span className="ff-shimmer__band" aria-hidden="true" />
    </span>
  );
}
