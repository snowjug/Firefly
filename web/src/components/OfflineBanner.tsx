import { useOnline } from '../lib/hooks.ts';
import { Icon } from './Icon.tsx';
import '../styles/offline.css';

/**
 * Says so plainly when the browser loses its connection to Firefly. It states only what is true:
 * everything already sent is saved on the server, and nothing new can be sent or saved until the
 * connection is back.
 */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      <Icon name="alert" size={16} />
      <p>
        You appear to be offline. What you have already sent is saved. Sending and saving will work
        again when the connection returns.
      </p>
    </div>
  );
}
