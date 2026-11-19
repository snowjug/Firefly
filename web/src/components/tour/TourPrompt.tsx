import { requestTour, setTourState, useTourState } from '../../lib/tour.ts';
import { Icon } from '../Icon.tsx';

/** Starts downloading the tour while the pointer or focus is on the button that opens it. */
const warmTour = () => void import('./FirstRunTour.tsx');

/** The button that was just pressed is about to disappear, so hand focus to the page first. */
const skipTour = () => {
  document.getElementById('main')?.focus({ preventScroll: true });
  setTourState('skipped');
};

/**
 * A quiet invitation on the home page for someone who has not seen the tour. It is not a modal and
 * never blocks anything; "No thanks" remembers the choice on this device.
 */
export function TourPrompt() {
  const state = useTourState();
  if (state !== 'new') return null;
  return (
    <section className="tour-prompt" aria-labelledby="tour-prompt-title">
      <span className="tour-prompt-icon" aria-hidden="true">
        <Icon name="compass" size={22} />
      </span>
      <div className="tour-prompt-text">
        <h2 id="tour-prompt-title" className="tour-prompt-title">
          New here? Take the 45-second tour.
        </h2>
        <p className="t-small t-muted">
          Five small examples of how a call, a hidden fact and your feedback work. Skip it any time.
        </p>
      </div>
      <div className="cluster tour-prompt-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={requestTour}
          onPointerEnter={warmTour}
          onFocus={warmTour}
        >
          Start the tour
        </button>
        <button type="button" className="btn btn-ghost" onClick={skipTour}>
          No thanks
        </button>
      </div>
    </section>
  );
}
