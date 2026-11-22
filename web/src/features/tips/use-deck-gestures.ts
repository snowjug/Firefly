import { useEffect, useRef, type RefObject } from 'react';
import { decideSwipe, type SwipeDecision } from '../../design/index.ts';

// Dragging the tip cards, with a mouse, a finger or a pen. The deck is not a scroll container, so it
// does not use the carousel's `useDragScroll`: the card here follows the pointer at about 60 percent
// (a little resistance, as if it were being pulled through something), and on release it settles on a
// spring. What it does share with the carousel is the decision: `decideSwipe`, which needs distance
// as well as speed and so never mistakes a twitch for a swipe.

/** Movement under this is a press, not a drag, in px. */
export const DRAG_THRESHOLD_PX = 6;
/** How much of the pointer's movement beyond the threshold the card follows. */
export const DRAG_FOLLOW = 0.6;
/** The same, when the card is pulled past the first or the last tip. */
export const EDGE_FOLLOW = 0.25;
const VELOCITY_WINDOW_MS = 80;

/**
 * How far the card travels, in px, for a pointer that has moved `dx` px sideways since it went down:
 * none inside the threshold, then 60 percent of what lies beyond it (25 percent if the card is being
 * pulled past the first or last tip). The sign is the pointer's: positive is to the right.
 */
export function dragShift(dx: number, edge: { first: boolean; last: boolean }): number {
  const beyond = Math.max(0, Math.abs(dx) - DRAG_THRESHOLD_PX);
  if (beyond === 0) return 0;
  const against = (dx > 0 && edge.first) || (dx < 0 && edge.last);
  return Math.sign(dx) * beyond * (against ? EDGE_FOLLOW : DRAG_FOLLOW);
}

interface Sample {
  t: number;
  x: number;
}

/** Px per ms over the last 80 ms; positive when the pointer moved toward the start (the left). */
export function velocityOf(samples: readonly Sample[]): number {
  const last = samples[samples.length - 1];
  if (!last) return 0;
  const first = samples.find((sample) => last.t - sample.t <= VELOCITY_WINDOW_MS);
  if (!first || last.t <= first.t) return 0;
  return (first.x - last.x) / (last.t - first.t);
}

export interface DeckGestureOptions {
  /** The deck is showing its first or its last tip: pulling further meets more resistance. */
  first: boolean;
  last: boolean;
  /** A drag ended. `none` means it was not enough, and the card goes back. Called once per drag. */
  onRelease(decision: SwipeDecision): void;
  onDragChange?(dragging: boolean): void;
}

/** Controls keep their own presses: a press on one never begins a drag of the deck. */
const CONTROLS = 'button, a, input, select, textarea, [role="button"]';

function swallowNextClick(doc: Document): void {
  const timer = setTimeout(() => doc.removeEventListener('click', swallow, true), 0);
  function swallow(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    clearTimeout(timer);
    doc.removeEventListener('click', swallow, true);
  }
  doc.addEventListener('click', swallow, true);
}

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  samples: Sample[];
  dragging: boolean;
  frame: number;
  shift: number;
}

function attach(
  viewport: HTMLElement,
  track: HTMLElement,
  getOptions: () => DeckGestureOptions,
): () => void {
  const doc = viewport.ownerDocument;
  let gesture: Gesture | null = null;

  const write = () => {
    if (!gesture) return;
    gesture.frame = 0;
    const shift = `${Math.round(gesture.shift * 10) / 10}px`;
    track.style.setProperty('--tp-drag', shift);
    // The window has the same number: the soft edge it fades its cards by grows with the drag.
    viewport.style.setProperty('--tp-drag', shift);
  };

  const end = (released: PointerEvent | null) => {
    const current = gesture;
    if (!current) return;
    gesture = null;
    doc.removeEventListener('pointermove', onMove, true);
    doc.removeEventListener('pointerup', onUp, true);
    doc.removeEventListener('pointercancel', onCancel, true);
    if (current.frame) cancelAnimationFrame(current.frame);
    if (!current.dragging) return;
    if (viewport.hasPointerCapture?.(current.pointerId)) {
      try {
        viewport.releasePointerCapture(current.pointerId);
      } catch {
        // The browser no longer knows this pointer.
      }
    }
    // The decision is made first, so the track's motion is set before the card is let go.
    const options = getOptions();
    if (released) {
      swallowNextClick(doc);
      // The release is the last sample: a drag that stopped before it was let go is not still moving.
      const samples = [...current.samples, { t: released.timeStamp, x: released.clientX }];
      options.onRelease(
        decideSwipe({
          offset: current.startX - released.clientX,
          velocity: velocityOf(samples),
        }),
      );
    } else {
      options.onRelease('none');
    }
    track.style.removeProperty('--tp-drag');
    viewport.style.removeProperty('--tp-drag');
    viewport.removeAttribute('data-dragging');
    options.onDragChange?.(false);
  };

  const onMove = (event: PointerEvent) => {
    const current = gesture;
    if (!current || event.pointerId !== current.pointerId) return;
    current.samples.push({ t: event.timeStamp, x: event.clientX });
    while (
      current.samples.length > 2 &&
      event.timeStamp - (current.samples[0] as Sample).t > VELOCITY_WINDOW_MS
    ) {
      current.samples.shift();
    }
    const dx = event.clientX - current.startX;
    if (!current.dragging) {
      // Sideways only: a mostly vertical gesture is the page scrolling, or text being selected.
      if (
        Math.abs(dx) < DRAG_THRESHOLD_PX ||
        Math.abs(dx) < Math.abs(event.clientY - current.startY)
      ) {
        return;
      }
      current.dragging = true;
      viewport.setAttribute('data-dragging', 'true');
      doc.getSelection()?.removeAllRanges();
      try {
        viewport.setPointerCapture?.(current.pointerId);
      } catch {
        // Capture only keeps the drag following the pointer outside the deck.
      }
      getOptions().onDragChange?.(true);
    }
    const { first, last } = getOptions();
    current.shift = dragShift(dx, { first, last });
    if (!current.frame) current.frame = requestAnimationFrame(write);
  };

  const onUp = (event: PointerEvent) => {
    if (gesture && event.pointerId === gesture.pointerId) end(event);
  };
  const onCancel = (event: PointerEvent) => {
    if (gesture && event.pointerId === gesture.pointerId) end(null);
  };

  const onDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest(CONTROLS)) return;
    end(null);
    gesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      samples: [{ t: event.timeStamp, x: event.clientX }],
      dragging: false,
      frame: 0,
      shift: 0,
    };
    doc.addEventListener('pointermove', onMove, { capture: true, passive: true });
    doc.addEventListener('pointerup', onUp, true);
    doc.addEventListener('pointercancel', onCancel, true);
  };

  viewport.addEventListener('pointerdown', onDown);
  return () => {
    viewport.removeEventListener('pointerdown', onDown);
    end(null);
    track.style.removeProperty('--tp-drag');
    viewport.style.removeProperty('--tp-drag');
    viewport.removeAttribute('data-dragging');
  };
}

/**
 * Lets the tip cards be dragged sideways. The card follows the pointer at about 60 percent and the
 * drag ends in a decision (next, previous or none) from `decideSwipe`; a click that ends a drag is
 * swallowed so a drag never presses a control. It writes `--tp-drag` on the track (which moves by it)
 * and on the viewport (whose edge fade follows it), and `data-dragging` on the viewport, and never
 * changes React state on a pointer move. Attach it while the deck is on screen. The latest options
 * are always used.
 */
export function useDeckGestures(
  viewport: RefObject<HTMLElement | null>,
  track: RefObject<HTMLElement | null>,
  options: DeckGestureOptions,
): void {
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  useEffect(() => {
    const viewportElement = viewport.current;
    const trackElement = track.current;
    if (!viewportElement || !trackElement) return;
    return attach(viewportElement, trackElement, () => latest.current);
  }, [viewport, track]);
}
