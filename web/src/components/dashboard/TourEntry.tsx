import { requestTour, setTourState, useTourState } from '../../lib/tour.ts';
import { Icon } from '../Icon.tsx';

/** Starts downloading the tour while the pointer or focus is on the button that opens it. */
const warmTour = () => void import('../tour/FirstRunTour.tsx');

/** The button that was just pressed is about to disappear, so hand focus to the page first. */
const skipTour = () => {
  document.getElementById('main')?.focus({ preventScroll: true });
  setTourState('skipped');
};

/**
 * A quiet, optional invitation for someone who has not seen the tour. It never opens by itself and
 * never blocks anything; "No thanks" is remembered on this device.
 */
export function TourEntry() {
  const state = useTourState();
  if (state !== 'new') return null;
  return (
    <section className="dash-tour" aria-labelledby="dash-tour-title">
      <span className="tone-icon" data-tone="blue" aria-hidden="true">
        <Icon name="compass" size={20} />
      </span>
      <div className="dash-tour-text">
        <h2 id="dash-tour-title" className="dash-tour-title">
          New here? Take the 45-second tour.
        </h2>
        <p className="t-small t-muted">
          Five small examples of how a call, a hidden fact and your feedback work. Skip it any time.
        </p>
      </div>
      <div className="cluster dash-tour-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={requestTour}
          onPointerEnter={warmTour}
          onFocus={warmTour}
        >
          Start the tour
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={skipTour}>
          No thanks
        </button>
      </div>
    </section>
  );
}
