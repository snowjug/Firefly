import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { useRouteError } from 'react-router';
import '../styles/boundary.css';

/**
 * What a person sees when a page fails to draw: what happened, that their saved calls are safe,
 * and what to do. Never a message or a stack from the error, which could say more than anyone
 * should see. It needs nothing from the rest of the app (it is plain markup, a button and a link,
 * and its own small sheet), because it may be shown when nothing else has loaded.
 *
 * `inFrame` is for a page that failed inside the app frame: the frame's own `main` holds it and
 * the masthead and dock stay where they are. Without it, the screen stands alone on the field.
 */
export function ErrorScreen({ inFrame = false }: { inFrame?: boolean }) {
  const Root = inFrame ? 'div' : 'main';
  return (
    <Root
      className="eb"
      data-in-frame={inFrame ? '' : undefined}
      {...(inFrame ? {} : { id: 'main', tabIndex: -1 })}
    >
      {inFrame ? null : (
        <p className="eb__brand" aria-hidden="true">
          Firefly
        </p>
      )}
      <div className="eb__frame">
        <div className="eb__body" role="alert">
          <p className="eb__eyebrow">Error</p>
          <h1 className="eb__title">Something went wrong</h1>
          <p className="eb__text">
            The page hit an unexpected problem. Your saved practice calls are safe: nothing on this
            page changes them. Reload to try again, or go back to the start.
          </p>
        </div>
        <div className="eb__actions">
          <button type="button" className="eb__action" onClick={() => window.location.reload()}>
            Reload
          </button>
          <a className="eb__link" href="/">
            Go to the start
          </a>
        </div>
      </div>
    </Root>
  );
}

interface State {
  failed: boolean;
}

/** Catches rendering errors so the user never sees a blank screen or a stack trace. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Development only: keep the details out of the UI. Nothing is sent anywhere.
    if (import.meta.env.DEV) console.error(error, info.componentStack);
  }

  override render() {
    return this.state.failed ? <ErrorScreen /> : this.props.children;
  }
}

/** Notes the error for whoever is developing, in development only, and says nothing of it. */
function useNoted(error: unknown) {
  useEffect(() => {
    if (import.meta.env.DEV) console.error(error);
  }, [error]);
}

/**
 * For a route's `ErrorBoundary` at the root of the router: the router would otherwise show its own
 * default screen, which prints the error and its stack. Replaces the whole app, so it stands alone.
 */
export function RouteError() {
  useNoted(useRouteError());
  return <ErrorScreen />;
}

/** For a route's `ErrorBoundary` inside the app frame, so a failed page keeps the masthead and dock. */
export function PageError() {
  useNoted(useRouteError());
  return <ErrorScreen inFrame />;
}
