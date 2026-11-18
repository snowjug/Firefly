import { Component, type ErrorInfo, type ReactNode } from 'react';

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
    if (!this.state.failed) return this.props.children;
    return (
      <div className="page page-narrow">
        <div className="state state-negative glass card" role="alert">
          <h1 className="t-section">Something went wrong</h1>
          <p>The page hit an unexpected problem. Your saved practice sessions are safe.</p>
          <div className="cluster">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
            <a className="btn btn-secondary" href="/">
              Go to the start
            </a>
          </div>
        </div>
      </div>
    );
  }
}
