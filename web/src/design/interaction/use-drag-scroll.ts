import { useEffect, useRef, type RefObject } from 'react';
import { pointerFxEnabled } from './pointer-fx.ts';
import { useAttachedRef } from './use-attached-ref.ts';

const DEFAULT_THRESHOLD_PX = 6;
const OVERSCROLL_DIVISOR = 3;
const OVERSCROLL_MAX_PX = 48;
const VELOCITY_WINDOW_MS = 80;

/**
 * How a drag ended. Both numbers share one sign, and it is the direction the content was dragged:
 * positive means toward the start edge of the container (to the left, in a left-to-right layout),
 * which brings later items into view, so a positive release is a swipe to the next item. Negative
 * means toward the end edge, a swipe to the previous item.
 */
export interface DragScrollRelease {
  /** How far the pointer travelled between going down and being released, in px. */
  offset: number;
  /** How fast it was moving at the release, in px per ms, over about the last 80 ms. */
  velocity: number;
}

export interface DragScrollOptions {
  /** Horizontal movement below this is a click, not a drag, in px. Default 6. */
  thresholdPx?: number;
  /** Called with true when a drag begins and with false when it ends for any reason. */
  onDragChange?(dragging: boolean): void;
  /** Called when a drag ends because the mouse button was released (not when it was cancelled). */
  onRelease?(release: DragScrollRelease): void;
}

export type SwipeDecision = 'next' | 'previous' | 'none';

export interface SwipeThresholds {
  /** A drag this far is a swipe on its own, in px. Default 48. */
  offsetPx?: number;
  /** A drag at least this fast, in px per ms, may be shorter. Default 0.35. */
  velocity?: number;
  /** The shortest distance a fast flick may cover, in px. Default a third of `offsetPx`. */
  flickOffsetPx?: number;
}

/**
 * Turns a release into a decision. Distance decides; speed can shorten the distance but never
 * replace it, because velocity alone is a twitch, not an intent. So: a drag of `offsetPx` is a swipe;
 * a shorter drag is a swipe only if it is also fast (`velocity`) and at least `flickOffsetPx`; and a
 * drag that was flung back the other way as it was released decides nothing. The sign of the offset
 * picks the direction, as documented on `DragScrollRelease`: positive is 'next', negative 'previous'.
 */
export function decideSwipe(
  release: DragScrollRelease,
  thresholds: SwipeThresholds = {},
): SwipeDecision {
  const { offset, velocity } = release;
  if (!Number.isFinite(offset) || !Number.isFinite(velocity) || offset === 0) return 'none';
  const offsetPx = thresholds.offsetPx ?? 48;
  const flickPx = thresholds.flickOffsetPx ?? offsetPx / 3;
  const fast = Math.abs(velocity) >= (thresholds.velocity ?? 0.35);
  if (fast && Math.sign(velocity) !== Math.sign(offset)) return 'none';
  const distance = Math.abs(offset);
  if (distance < offsetPx && !(fast && distance >= flickPx)) return 'none';
  return offset > 0 ? 'next' : 'previous';
}

interface Sample {
  t: number;
  x: number;
}

interface Drag {
  stretch: boolean;
  saved: { snap: string; behavior: string; select: string; webkitSelect: string };
}

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  startScroll: number;
  samples: Sample[];
  drag: Drag | null;
}

const round = (value: number) => Math.round(value * 100) / 100;

function record(gesture: Gesture, event: PointerEvent): void {
  const { samples } = gesture;
  samples.push({ t: event.timeStamp, x: event.clientX });
  while (samples.length > 2 && event.timeStamp - (samples[0] as Sample).t > VELOCITY_WINDOW_MS) {
    samples.shift();
  }
}

/** Px per ms over the last 80 ms before the release; positive toward the start edge. */
function velocityOf(samples: readonly Sample[]): number {
  const last = samples[samples.length - 1];
  if (!last) return 0;
  const first = samples.find((sample) => last.t - sample.t <= VELOCITY_WINDOW_MS);
  if (!first || last.t <= first.t) return 0;
  return (first.x - last.x) / (last.t - first.t);
}

/** A press on the element's own scrollbar belongs to the browser, not to the drag. */
function onScrollbar(element: HTMLElement, event: PointerEvent): boolean {
  if (event.target !== element || element.clientWidth === 0) return false;
  const box = element.getBoundingClientRect();
  return (
    event.clientX - box.left >= element.clientLeft + element.clientWidth ||
    event.clientY - box.top >= element.clientTop + element.clientHeight
  );
}

function capture(element: HTMLElement, pointerId: number, on: boolean): void {
  try {
    if (on) element.setPointerCapture?.(pointerId);
    else if (element.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
  } catch {
    // The browser no longer knows this pointer. Capture only keeps the drag following the pointer
    // outside the element; the document listeners carry the drag without it.
  }
}

/** The browser sends a click when a drag is released; swallow it for one tick so a drag never selects. */
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

function dragScroll(element: HTMLElement, getOptions: () => DragScrollOptions): () => void {
  const doc = element.ownerDocument;
  let gesture: Gesture | null = null;

  const startDrag = (current: Gesture): Drag => {
    const { style } = element;
    const drag: Drag = {
      stretch: pointerFxEnabled(doc.defaultView ?? undefined),
      saved: {
        snap: style.scrollSnapType,
        behavior: style.scrollBehavior,
        select: style.userSelect,
        webkitSelect: style.webkitUserSelect,
      },
    };
    style.scrollSnapType = 'none';
    style.scrollBehavior = 'auto';
    style.userSelect = 'none';
    style.webkitUserSelect = 'none';
    element.setAttribute('data-dragging', 'true');
    const selection = doc.getSelection();
    if (selection && selection.rangeCount > 0 && element.contains(selection.anchorNode)) {
      selection.removeAllRanges();
    }
    capture(element, current.pointerId, true);
    return drag;
  };

  const follow = (current: Gesture, drag: Drag, offset: number) => {
    const wanted = current.startScroll + offset;
    const reach = Math.max(0, element.scrollWidth - element.clientWidth);
    const scroll = Math.min(Math.max(wanted, 0), reach);
    element.scrollLeft = scroll;
    if (!drag.stretch) return;
    const past = Math.min(Math.abs(wanted - scroll) / OVERSCROLL_DIVISOR, OVERSCROLL_MAX_PX);
    element.style.setProperty('--drag-overscroll', `${round(Math.sign(wanted - scroll) * past)}px`);
  };

  const restore = (current: Gesture, { saved }: Drag) => {
    const { style } = element;
    style.scrollSnapType = saved.snap;
    style.scrollBehavior = saved.behavior;
    style.userSelect = saved.select;
    style.webkitUserSelect = saved.webkitSelect;
    style.removeProperty('--drag-overscroll');
    element.removeAttribute('data-dragging');
    capture(element, current.pointerId, false);
  };

  // `released` is the pointerup that ended the gesture; null when it was cancelled or torn down.
  const end = (released: PointerEvent | null) => {
    const current = gesture;
    if (!current) return;
    gesture = null;
    doc.removeEventListener('pointermove', onPointerMove, true);
    doc.removeEventListener('pointerup', onPointerUp, true);
    doc.removeEventListener('pointercancel', onPointerCancel, true);
    const { drag } = current;
    if (!drag) return;
    restore(current, drag);
    if (released) swallowNextClick(doc);
    const { onDragChange, onRelease } = getOptions();
    onDragChange?.(false);
    if (released) {
      onRelease?.({
        offset: current.startX - released.clientX,
        velocity: velocityOf(current.samples),
      });
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    const current = gesture;
    if (!current || event.pointerType !== 'mouse') return;
    record(current, event);
    const offset = current.startX - event.clientX;
    if (!current.drag) {
      const across = Math.abs(offset);
      const threshold = Math.max(0, getOptions().thresholdPx ?? DEFAULT_THRESHOLD_PX);
      // A mostly vertical gesture is not a drag: it is more likely a text selection.
      if (across === 0 || across < threshold || across < Math.abs(event.clientY - current.startY)) {
        return;
      }
      current.drag = startDrag(current);
      // Only now, with the drag on record: a callback that throws cannot leave it half started.
      getOptions().onDragChange?.(true);
    }
    follow(current, current.drag, offset);
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    if (gesture) record(gesture, event);
    end(event);
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') end(null);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || onScrollbar(element, event)) return;
    end(null); // a release that never reached the page: start clean
    gesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScroll: element.scrollLeft,
      samples: [{ t: event.timeStamp, x: event.clientX }],
      drag: null,
    };
    doc.addEventListener('pointermove', onPointerMove, { capture: true, passive: true });
    doc.addEventListener('pointerup', onPointerUp, true);
    doc.addEventListener('pointercancel', onPointerCancel, true);
  };

  // Otherwise the browser starts dragging a link, an image or selected text and cancels the pointer.
  const onDragStart = (event: DragEvent) => {
    if (gesture) event.preventDefault();
  };

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('dragstart', onDragStart);
  return () => {
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('dragstart', onDragStart);
    end(null);
  };
}

/**
 * Mouse drag-to-scroll for a horizontally scrollable element: attach the returned ref to it. Only a
 * mouse with its primary button drags; touch and pen keep the browser's own scrolling.
 *
 * A press that moves less than `thresholdPx` horizontally stays a click. Past it the drag begins:
 * the element carries `data-dragging="true"`, scrolls with the pointer, and scroll snapping, smooth
 * scrolling and text selection are switched off until the button is released (the previous inline
 * values come back). The click that ends a drag is swallowed for one tick, so a drag never selects
 * a card. `pointerdown` is never cancelled, so focus and text selection before the threshold work.
 *
 * At either scroll limit the drag stretches instead of stopping: `--drag-overscroll` is the movement
 * past the limit divided by 3, at most 48px, positive past the end and negative past the start.
 * Apply it to an inner track, for example `transform: translateX(calc(var(--drag-overscroll, 0px)
 * * -1))`, with a transition so it settles back on release (when the property is removed) and none
 * under `[data-dragging='true']`, so it follows the pointer. The stretch is the only decorative part,
 * so it follows `pointerFxEnabled`: it is left out for people who ask for less motion or have a
 * coarse main pointer. Dragging itself still works.
 *
 * Left-to-right layouts only. While a drag is on the hook owns `data-dragging` and the inline
 * values above, so do not set them yourself. A press on the element's own scrollbar is left to the
 * browser, and the browser's own drag of a link or an image is cancelled while the mouse is down,
 * because it would otherwise cancel the pointer. The latest options are always used; they need no
 * memoising.
 */
export function useDragScroll<T extends HTMLElement>(
  options: DragScrollOptions = {},
): RefObject<T | null> {
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  return useAttachedRef<T>((element) => dragScroll(element, () => latest.current), []);
}
