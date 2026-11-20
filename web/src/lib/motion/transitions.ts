// View Transitions: how an object keeps its identity from one route to the next.
//
// React Router starts the transition (`<Link viewTransition>`, `navigate(..., { viewTransition:
// true })`). Two things are ours:
//   1. names, so the shared object (a mission's instrument, then the scenario core) is the same
//      element to the browser on both sides of the move;
//   2. never letting a transition get in the way: while one runs the browser blocks pointer
//      events, so the first pointerdown or keydown skips the animation (the page still changes).

/**
 * The names an object carries across routes. Only one element may hold a name at a time. The
 * field behind the page must NOT be named: a named group is painted above the page's snapshot.
 */
export const VT_NAME = {
  /** A mission's instrument on the atlas, which becomes the core on the calibration screen. */
  mission: 'signal-mission',
  /** The dock stays put, above the page, while the page changes. */
  dock: 'firefly-dock',
} as const;

type Starter = (callback?: () => void | Promise<void>) => ViewTransition;

interface Skippable {
  skipTransition(): void;
  finished: Promise<void>;
  ready?: Promise<void>;
  updateCallbackDone?: Promise<void>;
}

/** A skipped or superseded transition rejects its promises with an AbortError; nobody is waiting. */
const quiet = (promise: Promise<unknown> | undefined) => promise?.catch(() => undefined);

/**
 * Wraps `document.startViewTransition` so the running transition can be skipped, and skips it on
 * the first pointerdown or keydown. Call once at startup; returns a function that undoes it.
 * Browsers without view transitions are left alone.
 */
export function installViewTransitionSkip(doc: Document = document): () => void {
  const original = (doc as Document & { startViewTransition?: Starter }).startViewTransition;
  if (typeof original !== 'function') return () => {};

  let running: Skippable | null = null;
  const patched: Starter = (callback) => {
    const transition = original.call(doc, callback);
    running = transition;
    const clear = () => {
      if (running === transition) running = null;
    };
    transition.finished.then(clear, clear);
    // Starting a second transition, or skipping one, rejects the first one's `ready` and
    // `updateCallbackDone` with an AbortError. The router only awaits `finished`, so without this
    // the rejections surface as unhandled errors in the console.
    quiet(transition.ready);
    quiet(transition.updateCallbackDone);
    return transition;
  };
  const skip = () => {
    running?.skipTransition();
    running = null;
  };

  (doc as Document & { startViewTransition: Starter }).startViewTransition = patched;
  doc.addEventListener('pointerdown', skip, { capture: true, passive: true });
  doc.addEventListener('keydown', skip, { capture: true, passive: true });
  return () => {
    (doc as Document & { startViewTransition: Starter }).startViewTransition = original;
    doc.removeEventListener('pointerdown', skip, { capture: true });
    doc.removeEventListener('keydown', skip, { capture: true });
    running = null;
  };
}
