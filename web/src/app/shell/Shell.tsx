import { useEffect, useState } from 'react';
import { useNavigation } from 'react-router';
import { MessageBar } from '../../design/primitives/MessageBar.tsx';
import { useAnnouncer } from '../../design/primitives/LiveRegion.tsx';
import { useOnline } from '../../lib/hooks.ts';
import './shell.css';

/** The first link on every page: it jumps past the header to the main content. */
export function SkipLink() {
  return (
    <a className="skip-link" href="#main">
      Skip to main content
    </a>
  );
}

/** Shown under the header while the browser reports no connection. */
export function OfflineNotice() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="ff-offline">
      <div className="l-page">
        <MessageBar intent="warning">
          <strong>You are offline.</strong> Firefly keeps what you have done so far and will
          reconnect when your connection returns.
        </MessageBar>
      </div>
    </div>
  );
}

const SHOW_AFTER_MS = 250;
const ANNOUNCE_AFTER_MS = 1500;

/**
 * A thin line across the top while the next page is on its way, drawn only if the wait is long
 * enough to notice, and announced to screen readers if it is longer still. The old page stays in
 * place meanwhile, so nothing flashes.
 */
export function NavigationProgress() {
  const loading = useNavigation().state !== 'idle';
  const announce = useAnnouncer();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!loading) return;
    const show = window.setTimeout(() => setSlow(true), SHOW_AFTER_MS);
    const say = window.setTimeout(() => announce('Loading the page.'), ANNOUNCE_AFTER_MS);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(say);
      setSlow(false);
    };
  }, [loading, announce]);
  if (!loading || !slow) return null;
  return (
    <div className="ff-progress-line" aria-hidden="true">
      <div className="ff-progress-line__bar" />
    </div>
  );
}
