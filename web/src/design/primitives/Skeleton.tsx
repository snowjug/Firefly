import type { CSSProperties } from 'react';
import { cx } from '../cx.ts';
import './skeleton.css';

export interface SkeletonProps {
  variant?: 'text' | 'rect' | 'circle';
  /** A CSS length or a number of pixels. */
  width?: string | number;
  height?: string | number;
  /** For `text`: how many lines. The last one is shorter. */
  lines?: number;
  className?: string;
}

/**
 * A grey placeholder shaped like the content that is coming. It is decorative and hidden from
 * assistive technology, so the region that holds it must say it is loading (aria-busy, or a
 * labelled Spinner or live message beside it). The shimmer stops under reduced motion.
 */
export function Skeleton({ variant = 'text', width, height, lines = 1, className }: SkeletonProps) {
  const style: CSSProperties = {};
  if (width !== undefined) style.inlineSize = width;
  if (height !== undefined) style.blockSize = height;
  if (variant === 'text' && lines > 1) {
    return (
      <span className={cx('ff-skeleton-lines', className)} aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => (
          <span
            key={index}
            className="ff-skeleton ff-skeleton--text"
            style={index === lines - 1 ? { inlineSize: '60%' } : style}
          />
        ))}
      </span>
    );
  }
  return (
    <span
      className={cx('ff-skeleton', `ff-skeleton--${variant}`, className)}
      style={style}
      aria-hidden="true"
    />
  );
}
