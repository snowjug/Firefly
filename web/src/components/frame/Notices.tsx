import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { errorMessage, isApiError } from '../../lib/api.ts';
import { Icon } from '../Icon.tsx';
import { PageFrame, PageHead } from './PageFrame.tsx';
import '../../styles/frame.css';

/**
 * Nothing here yet, said as one sentence with at most one action. A hairline rule with a point on
 * it, no icon and no box. Use level 1 when the notice is the whole page so it still has an h1.
 */
export function EmptyNotice({
  title,
  children,
  action,
  level = 2,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <div className="ff-notice ff-notice--empty">
      <Heading className="ff-notice__title type-heading">{title}</Heading>
      {children ? <div className="ff-notice__text">{children}</div> : null}
      {action ? <div className="ff-notice__action">{action}</div> : null}
    </div>
  );
}

/**
 * Says what went wrong (the message is safe to show: see `errorMessage`) and, only when trying again
 * can help, offers "Try again". It is an alert, so it is announced when it appears.
 */
export function ErrorNotice({
  error,
  onRetry,
  title = "We couldn't load this",
  level = 2,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  level?: 1 | 2;
}) {
  const retryable = !isApiError(error) || error.retryable;
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <div className="ff-notice ff-notice--error" role="alert">
      <Heading className="ff-notice__title type-heading">{title}</Heading>
      <p className="ff-notice__text">{errorMessage(error)}</p>
      {onRetry && retryable ? (
        <div className="ff-notice__action">
          <button type="button" className="action action--quiet" onClick={onRetry}>
            <Icon name="refresh" size={18} /> Try again
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Loading, drawn as hairlines with end ticks where the text will be. A point travels along them
 * only while ambient motion is allowed; otherwise they are still. Screen readers hear the label as
 * a polite status.
 */
export function LoadingNotice({
  label = 'Loading',
  lines = 3,
}: {
  label?: string;
  lines?: number;
}) {
  const count = Math.max(1, Math.min(12, Math.round(lines)));
  return (
    <div className="ff-loading" role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="ff-loading__line" aria-hidden="true" data-ambient />
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

/** The 404 page: what happened and the way back (the app's home for someone signed in, else the start). */
export function NotFoundNotice({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <PageFrame title="Page not found" width="narrow">
      <PageHead
        eyebrow="404"
        title="That page does not exist"
        lead={
          signedIn
            ? 'The link may be out of date. Pick up where you left off from Home.'
            : 'The link may be out of date. Pick up where you left off from the start page.'
        }
      />
      <div className="action-row">
        <Link className="action" to={signedIn ? '/home' : '/'}>
          {signedIn ? 'Back to Home' : 'Back to the start'}
          <Icon name="arrow-right" size={18} />
        </Link>
      </div>
    </PageFrame>
  );
}
