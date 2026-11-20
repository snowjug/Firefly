import { Link } from 'react-router';
import { ProviderBadge } from '../ProviderBadge.tsx';

/**
 * The training-aid statement, as a quiet line at the foot of every page except a live call. It is
 * part of the page (not fixed), so it never covers anything; the frame leaves room under it for
 * the dock.
 */
export function Colophon() {
  return (
    <footer className="colophon">
      <div className="colophon__rule rule rule--point" aria-hidden="true" />
      <p className="colophon__line">
        Firefly is a training aid. Scenarios are fictional; never enter real customer information.
        Scores are for practice, not performance reviews.
      </p>
      <p className="colophon__links">
        <Link to="/help" className="text-link">
          Responsible AI
        </Link>
        <Link to="/settings" className="text-link">
          Settings
        </Link>
      </p>
      {/* Beside the wordmark on wide screens; here, where there is room, on narrow ones. */}
      <div className="colophon__provider">
        <ProviderBadge />
      </div>
    </footer>
  );
}
