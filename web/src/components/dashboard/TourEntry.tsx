import { requestTour, setTourState, useTourState } from '../../lib/tour.ts';

/** Starts downloading the tour while the pointer or focus is on the button that opens it. */
export const warmTour = () => void import('../tour/FirstRunTour.tsx');

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
    <section className="home-tour" aria-labelledby="home-tour-title">
      <div className="home-tour__text">
        <h2 id="home-tour-title" className="home-tour__title">
          New here? Take the 45-second tour.
        </h2>
        <p>
          Five small examples of how a call, a hidden fact and your feedback work. Skip it any time.
        </p>
      </div>
      <div className="home-tour__actions action-row">
        <button
          type="button"
          className="action action--quiet action--compact"
          onClick={requestTour}
          onPointerEnter={warmTour}
          onFocus={warmTour}
        >
          Start the tour
        </button>
        <button type="button" className="text-link" onClick={skipTour}>
          No thanks
        </button>
      </div>
    </section>
  );
}
