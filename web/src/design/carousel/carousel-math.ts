import type { SwipeDecision } from '../interaction/index.ts';

// The arithmetic behind the carousel, kept apart from the DOM so it can be tested without a layout
// engine. Positions are in px along the scroll axis, measured from the first item's start edge, so
// "scroll to item i" is `scrollLeft = items[i].start`, which is also where a snap point sits.

/** Where an item is, relative to the first item. */
export interface ItemBox {
  start: number;
  width: number;
}

/** The scroller as it is now. `inset` is the gap between the scroller's edge and the first item. */
export interface ScrollView {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
  inset: number;
}

/** A scroll position is "at the edge" within this many px: browsers round sub-pixel scroll offsets. */
export const EDGE_TOLERANCE_PX = 2;

/** The thumb of the position indicator is never narrower than this, so it stays easy to see. */
export const MIN_THUMB_PX = 24;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** The furthest the scroller can scroll. */
export function maxScroll(view: ScrollView): number {
  return Math.max(0, view.scrollWidth - view.clientWidth);
}

export function atEdges(view: ScrollView): { atStart: boolean; atEnd: boolean } {
  return {
    atStart: view.scrollLeft <= EDGE_TOLERANCE_PX,
    atEnd: view.scrollLeft >= maxScroll(view) - EDGE_TOLERANCE_PX,
  };
}

/** Whether an item is wholly inside the scroller's visible window. */
export function isFullyVisible(item: ItemBox, view: ScrollView): boolean {
  return (
    item.start >= view.scrollLeft - EDGE_TOLERANCE_PX &&
    item.start + item.width + view.inset <= view.scrollLeft + view.clientWidth + EDGE_TOLERANCE_PX
  );
}

/** The first and last items that are wholly visible, or null when none is (a wide item, mid-scroll). */
export function visibleRange(
  items: readonly ItemBox[],
  view: ScrollView,
): { first: number; last: number } | null {
  let first = -1;
  let last = -1;
  items.forEach((item, index) => {
    if (!isFullyVisible(item, view)) return;
    if (first === -1) first = index;
    last = index;
  });
  return first === -1 ? null : { first, last };
}

/** The item whose start edge is closest to a scroll position. */
export function nearestIndex(items: readonly ItemBox[], scrollLeft: number): number {
  let best = 0;
  let distance = Number.POSITIVE_INFINITY;
  items.forEach((item, index) => {
    const away = Math.abs(item.start - scrollLeft);
    if (away < distance) {
      distance = away;
      best = index;
    }
  });
  return best;
}

/**
 * The item a previous or next button scrolls to: a page away, where a page is as many items as are
 * wholly visible now (at least one). Never past either end.
 */
export function pageTarget(
  direction: 'previous' | 'next',
  items: readonly ItemBox[],
  view: ScrollView,
): number {
  if (items.length === 0) return 0;
  const range = visibleRange(items, view);
  const first = range ? range.first : nearestIndex(items, view.scrollLeft);
  const size = range ? range.last - range.first + 1 : 1;
  return direction === 'next'
    ? Math.min(items.length - 1, first + size)
    : Math.max(0, first - size);
}

/**
 * The scroll position that brings an item into view, or null when it is already wholly visible. An
 * item is brought to the start edge (a snap point), never further than the scroller can go.
 */
export function revealTarget(
  index: number,
  items: readonly ItemBox[],
  view: ScrollView,
): number | null {
  const item = items[index];
  if (!item || isFullyVisible(item, view)) return null;
  return clamp(item.start, 0, maxScroll(view));
}

/**
 * Where a short, deliberate mouse flick should land. Dragging far enough carries the scroller to
 * another item by itself (and the browser snaps there), so a flick only matters when the drag ended
 * on the item it began on: then a swipe toward the next or previous item moves exactly one item.
 * Returns the item to scroll to, or null to leave it to the browser's own snapping.
 */
export function flickTarget(
  decision: SwipeDecision,
  startIndex: number,
  endIndex: number,
  count: number,
): number | null {
  if (decision === 'none' || startIndex !== endIndex) return null;
  const target = decision === 'next' ? startIndex + 1 : startIndex - 1;
  return target < 0 || target >= count ? null : target;
}

/** Where the position indicator's thumb sits along its track: both numbers are px. */
export function thumbGeometry(
  view: ScrollView,
  trackWidth: number,
  minWidth: number = MIN_THUMB_PX,
): { width: number; x: number } {
  const reach = maxScroll(view);
  if (trackWidth <= 0 || reach <= 0 || view.scrollWidth <= 0) {
    return { width: Math.max(0, trackWidth), x: 0 };
  }
  const width = clamp((trackWidth * view.clientWidth) / view.scrollWidth, minWidth, trackWidth);
  const progress = clamp(view.scrollLeft / reach, 0, 1);
  return { width, x: progress * (trackWidth - width) };
}

/**
 * The visible count: the chosen item's place ("3 of 16"), or, for a gallery with no choice, the
 * items wholly in view ("1\u20133 of 16", or "1 of 16" when one). Always a plain, short phrase.
 */
export function positionLabel(
  total: number,
  selectedIndex: number | null | undefined,
  range: { first: number; last: number } | null,
): string {
  if (total <= 0) return '';
  if (selectedIndex !== null && selectedIndex !== undefined && selectedIndex >= 0) {
    return `${Math.min(selectedIndex, total - 1) + 1} of ${total}`;
  }
  const first = (range?.first ?? 0) + 1;
  const last = (range?.last ?? range?.first ?? 0) + 1;
  return first === last ? `${first} of ${total}` : `${first}\u2013${last} of ${total}`;
}
