import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import { errorMessage, isApiError } from '../lib/api.ts';
import { useDocumentTitle } from '../lib/hooks.ts';
import { Icon, type IconName } from './Icon.tsx';

export function Page({
  title,
  width = 'default',
  children,
  className = '',
}: {
  title: string;
  width?: 'default' | 'narrow' | 'wide';
  children: ReactNode;
  className?: string;
}) {
  useDocumentTitle(title);
  return (
    <div
      className={`page page-enter ${width === 'narrow' ? 'page-narrow' : width === 'wide' ? 'page-wide' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  lead,
  actions,
}: {
  eyebrow?: string;
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      {eyebrow ? <p className="t-label">{eyebrow}</p> : null}
      <div className="row between" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <h1 className="t-title grow" style={{ minWidth: '14ch' }}>
          {title}
        </h1>
        {actions ? <div className="cluster">{actions}</div> : null}
      </div>
      {lead ? (
        <p className="t-lead" style={{ maxWidth: '62ch' }}>
          {lead}
        </p>
      ) : null}
    </header>
  );
}

export function EmptyState({
  icon = 'spark',
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="state glass card">
      <span className="state-icon">
        <Icon name={icon} size={26} />
      </span>
      <h2 className="t-section">{title}</h2>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title = "We couldn't load this",
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const retryable = !isApiError(error) || error.retryable;
  return (
    <div className="state state-negative glass card" role="alert">
      <span className="state-icon">
        <Icon name="alert" size={26} />
      </span>
      <h2 className="t-section">{title}</h2>
      <p>{errorMessage(error)}</p>
      {onRetry && retryable ? (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          <Icon name="refresh" size={18} /> Try again
        </button>
      ) : null}
    </div>
  );
}

export function SkeletonBlock({
  height = 16,
  width = '100%',
}: {
  height?: number;
  width?: number | string;
}) {
  return <div className="skeleton" style={{ height, width }} aria-hidden="true" />;
}

export function LoadingCards({ count = 6, label = 'Loading' }: { count?: number; label?: string }) {
  return (
    <div className="grid-cards" role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="glass card stack"
          style={{ ['--stack-gap' as string]: 'var(--sp-3)' }}
        >
          <SkeletonBlock height={14} width="38%" />
          <SkeletonBlock height={22} width="82%" />
          <SkeletonBlock height={14} />
          <SkeletonBlock height={14} width="70%" />
          <div className="cluster">
            <SkeletonBlock height={26} width={72} />
            <SkeletonBlock height={26} width={64} />
          </div>
        </div>
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function NotFound() {
  useEffect(() => {
    document.title = 'Page not found · Firefly';
  }, []);
  return (
    <Page title="Page not found" width="narrow">
      <EmptyState
        icon="search"
        title="That page does not exist"
        action={
          <Link className="btn btn-primary" to="/">
            Back to the start
          </Link>
        }
      >
        The link may be out of date. Pick up where you left off from the start page.
      </EmptyState>
    </Page>
  );
}
