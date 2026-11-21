import { Link } from 'react-router';
import { cx } from '../../design/cx.ts';
import './wordmark.css';

/**
 * Firefly's mark: a rounded square in brand blue holding a speech bubble and one dot. Plain shapes
 * only, drawn here and in public/favicon.svg. It stays legible at 20 px.
 */
export function WordmarkMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={cx('ff-wordmark__mark', className)}
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <rect className="ff-wordmark__tile" width="32" height="32" rx="8" />
      <path
        className="ff-wordmark__bubble"
        d="M10 7.5h12a3.5 3.5 0 0 1 3.5 3.5v7a3.5 3.5 0 0 1-3.5 3.5h-6.5l-4.5 4v-4H10A3.5 3.5 0 0 1 6.5 18v-7A3.5 3.5 0 0 1 10 7.5z"
      />
      <circle className="ff-wordmark__dot" cx="16" cy="14.5" r="2.2" />
    </svg>
  );
}

export interface WordmarkProps {
  /** Makes it a link (the way home). Without it the wordmark is plain text, as in the footer. */
  to?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** The mark and the word "Firefly" in Segoe UI Semibold. A link when `to` is given. */
export function Wordmark({ to, size = 'md', className }: WordmarkProps) {
  const content = (
    <>
      <WordmarkMark size={size === 'sm' ? 20 : 24} />
      <span className="ff-wordmark__text">Firefly</span>
    </>
  );
  const classes = cx('ff-wordmark', `ff-wordmark--${size}`, className);
  if (to === undefined) return <span className={classes}>{content}</span>;
  return (
    <Link to={to} className={classes} aria-label="Firefly home">
      {content}
    </Link>
  );
}
