// View Transitions: how an object keeps its identity from one route to the next.
//
// React Router starts the transition (`<Link viewTransition>`, `navigate(..., { viewTransition:
// true })`). Two things are ours:
//   1. names, so the shared object (a mission's instrument, then the scenario core) is the same
//      element to the browser on both sides of the move;
//   2. never letting a transition get in the way: while one runs the browser blocks pointer
//      events, so the first pointerdown or keydown skips the animation (the page still changes),
//      and a click that began during the transition is delivered to the control it was meant for.

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

/** What a click is meant for: the things a person presses. */
const PRESSABLE =
  'a[href], button, summary, label, select, input, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"]';

/**
 * Wraps `document.startViewTransition` so the running transition can be skipped, and skips it on
 * the first pointerdown or keydown. Call once at startup; returns a function that undoes it.
 * Browsers without view transitions are left alone.
 *
 * A press that begins while a transition runs lands on `<html>`, because the page is not
 * hit-testable until the transition is gone. Skipping it frees the page, but the browser has
 * already decided that the press began on `<html>`, so it sends the click there too and the link
 * under the pointer never hears it: someone who clicks twice in quick succession loses the second
 * click. So a click that arrives at `<html>` after such a press is handed to the control that is
 * under the pointer once the transition has gone.
 */
export function installViewTransitionSkip(doc: Document = document): () => void {
  const original = (doc as Document & { startViewTransition?: Starter }).startViewTransition;
  if (typeof original !== 'function') return () => {};

  let running: Skippable | null = null;
  let pressedDuringTransition = false;
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
  const onPointerDown = () => {
    pressedDuringTransition = running !== null;
    skip();
  };
  const onClick = (event: MouseEvent) => {
    if (!pressedDuringTransition) return;
    pressedDuringTransition = false;
    // The page heard it, so nothing was lost.
    if (event.target !== doc.documentElement && event.target !== doc.body) return;
    const { clientX: x, clientY: y } = event;
    const view = doc.defaultView;
    // The skipped transition is gone after the next frame; only then is the page under the pointer.
    view?.requestAnimationFrame(() =>
      view.requestAnimationFrame(() => {
        const control = doc.elementFromPoint(x, y)?.closest<HTMLElement>(PRESSABLE);
        if (control && !control.matches(':disabled, [aria-disabled="true"]')) control.click();
      }),
    );
  };

  (doc as Document & { startViewTransition: Starter }).startViewTransition = patched;
  doc.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
  doc.addEventListener('keydown', skip, { capture: true, passive: true });
  doc.addEventListener('click', onClick, { capture: true, passive: true });
  return () => {
    (doc as Document & { startViewTransition: Starter }).startViewTransition = original;
    doc.removeEventListener('pointerdown', onPointerDown, { capture: true });
    doc.removeEventListener('keydown', skip, { capture: true });
    doc.removeEventListener('click', onClick, { capture: true });
    running = null;
    pressedDuringTransition = false;
  };
}
