import { Link } from 'react-router';
import { requestTour, useTourState } from '../../lib/tour.ts';
import { warmTour } from './TourEntry.tsx';

/**
 * Four ways on, as words with a line of what is there. They repeat the dock on purpose: the page
 * says where each one goes, which a bare label cannot. The tour is listed here only once it has
 * been seen or skipped; before that it is offered at the top of the page.
 */
export function QuickLinks() {
  const tour = useTourState();
  return (
    <nav className="home-links" aria-label="Quick links">
      <ul role="list" className="home-links__list">
        <li className="home-links__item">
          <Link to="/scenarios" className="home-links__link" viewTransition>
            Missions
          </Link>
          <p>The whole atlas of practice calls, and a way to search it.</p>
        </li>
        <li className="home-links__item">
          <Link to="/history" className="home-links__link" viewTransition>
            History
          </Link>
          <p>Every call you have practised, newest first.</p>
        </li>
        <li className="home-links__item">
          <Link to="/progress" className="home-links__link" viewTransition>
            Progress
          </Link>
          <p>Your six skills, lit only by what your calls showed.</p>
        </li>
        {tour === 'new' ? null : (
          <li className="home-links__item">
            <button
              type="button"
              className="home-links__link"
              onClick={requestTour}
              onPointerEnter={warmTour}
              onFocus={warmTour}
            >
              Take the tour
            </button>
            <p>Forty-five seconds on how a call, a hidden fact and feedback work.</p>
          </li>
        )}
      </ul>
    </nav>
  );
}
