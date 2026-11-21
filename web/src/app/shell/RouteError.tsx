import { useEffect } from 'react';
import { isRouteErrorResponse, useLocation, useNavigate, useRouteError } from 'react-router';
import { Button, LinkButton } from '../../design/primitives/Button.tsx';
import { Icon } from '../../design/icons.tsx';
import { Surface } from '../../design/primitives/Surface.tsx';
import { useDocumentTitle, useOnline } from '../../lib/hooks.ts';
import { SkipLink } from './Shell.tsx';
import { Wordmark } from './Wordmark.tsx';
import './route-error.css';

export type RouteErrorKind = 'not-found' | 'load' | 'unknown';

/** Tells a missing page and a page that could not be fetched apart from everything else. */
export function classifyRouteError(error: unknown): RouteErrorKind {
  if (isRouteErrorResponse(error) && error.status === 404) return 'not-found';
  if (error instanceof Error) {
    if (error.name === 'ChunkLoadError') return 'load';
    // Chromium, Firefox and Safari word a failed dynamic import differently.
    if (
      error instanceof TypeError &&
      /dynamically imported module|Importing a module script failed/i.test(error.message)
    ) {
      return 'load';
    }
    // The build fetches a page's stylesheet before its code, and says so with a plain Error when
    // that fetch fails (offline, or a build that has been replaced): the page never arrived either.
    if (/^Unable to preload (CSS|dependency)/i.test(error.message)) return 'load';
  }
  return 'unknown';
}

const SAVED = 'Calls, transcripts and reports that Firefly has already saved are not affected.';

function copyFor(kind: RouteErrorKind, online: boolean) {
  if (kind === 'not-found') {
    return {
      title: 'We cannot find that page',
      body: 'The address may be mistyped, or the page may have moved.',
      saved: SAVED,
    };
  }
  if (kind === 'load') {
    return {
      title: 'This page did not load',
      body: online
        ? 'Firefly could not fetch part of this page. Check your connection, then try again.'
        : 'You are offline, so part of this page could not be fetched. Reconnect, then try again.',
      saved: SAVED,
    };
  }
  return {
    title: 'Something went wrong on this page',
    body: 'Firefly hit a problem while showing this page. Try again, or carry on from the scenarios or the home page.',
    saved: SAVED,
  };
}

/**
 * What a person sees when a page fails: what happened, that saved work is safe, and three ways
 * forward. It never shows the error's message or stack, which could say more than anyone should
 * see; development builds log the error to the console instead.
 */
function ErrorView() {
  const error = useRouteError();
  const online = useOnline();
  const location = useLocation();
  const navigate = useNavigate();
  const kind = classifyRouteError(error);
  const copy = copyFor(kind, online);
  useDocumentTitle(kind === 'not-found' ? 'Page not found' : 'Something went wrong');
  useEffect(() => {
    if (import.meta.env.DEV) console.error(error);
  }, [error]);

  // A page that never arrived is fetched again by reloading. One that threw is drawn again by
  // going to the same address, which makes the router forget the error and run the page afresh.
  const retry = () => {
    if (kind === 'load') window.location.reload();
    else navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true });
  };

  return (
    <div className="ff-errorpage l-page l-page--read">
      <Surface appearance="outlined" padding="xl" className="ff-errorpage__card">
        <span className="ff-errorpage__icon" aria-hidden="true">
          <Icon name="warning" size={28} />
        </span>
        <div className="ff-errorpage__text l-stack l-gap-2" role="alert">
          <h1 className="t-title2">{copy.title}</h1>
          <p className="t-reading t-muted">{copy.body}</p>
          <p className="t-reading t-muted">{copy.saved}</p>
        </div>
        <div className="l-cluster l-gap-3">
          <Button appearance="primary" icon="refresh" onClick={retry}>
            Try again
          </Button>
          <LinkButton to="/scenarios" appearance="outline">
            Go to scenarios
          </LinkButton>
          <LinkButton to="/" appearance="subtle">
            Home
          </LinkButton>
        </div>
      </Surface>
    </div>
  );
}

/** The error boundary of a group of pages: shown inside the layout, so the header and footer stay. */
export function PageError() {
  return <ErrorView />;
}

/** The error boundary of the whole app: used when a layout itself fails, so it stands alone. */
export function RootError() {
  return (
    <>
      <SkipLink />
      <header className="ff-errorbar">
        <div className="l-page">
          <Wordmark to="/" />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="ff-main">
        <ErrorView />
      </main>
    </>
  );
}
