// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  atEdges,
  flickTarget,
  isFullyVisible,
  maxScroll,
  nearestIndex,
  pageTarget,
  positionLabel,
  revealTarget,
  thumbGeometry,
  visibleRange,
  type ItemBox,
  type ScrollView,
} from './carousel-math.ts';

// Sixteen items 280 px wide with 16 px between them, in a window that shows four and a bit.
const STEP = 296;
const items: ItemBox[] = Array.from({ length: 16 }, (_, index) => ({
  start: index * STEP,
  width: 280,
}));
const view = (scrollLeft: number, extra: Partial<ScrollView> = {}): ScrollView => ({
  scrollLeft,
  clientWidth: 1216,
  scrollWidth: 15 * STEP + 280 + 16,
  inset: 8,
  ...extra,
});

describe('where the scroller is', () => {
  it('knows the furthest it can go, and the two ends', () => {
    expect(maxScroll(view(0))).toBe(15 * STEP + 296 - 1216);
    expect(atEdges(view(0))).toEqual({ atStart: true, atEnd: false });
    expect(atEdges(view(maxScroll(view(0))))).toEqual({ atStart: false, atEnd: true });
    expect(atEdges(view(500))).toEqual({ atStart: false, atEnd: false });
  });

  it('treats a sub-pixel rounding at an end as being at the end', () => {
    expect(atEdges(view(1.5)).atStart).toBe(true);
    expect(atEdges(view(maxScroll(view(0)) - 1.5)).atEnd).toBe(true);
    expect(atEdges(view(3)).atStart).toBe(false);
  });

  it('is at both ends when everything fits', () => {
    const fits = view(0, { scrollWidth: 800, clientWidth: 1216 });
    expect(maxScroll(fits)).toBe(0);
    expect(atEdges(fits)).toEqual({ atStart: true, atEnd: true });
  });
});

describe('what is wholly in view', () => {
  it('lists the items that fit inside the window, not those cut by an edge', () => {
    // 4 x 296 = 1184, plus the inset 8: the fourth item (start 888, ends 1168) fits, the fifth does not.
    expect(visibleRange(items, view(0))).toEqual({ first: 0, last: 3 });
    // Scrolled half an item: the first is cut on the left, and the fifth is cut on the right.
    expect(visibleRange(items, view(148))).toEqual({ first: 1, last: 3 });
  });

  it('says whether one item is wholly visible', () => {
    expect(isFullyVisible(items[3] as ItemBox, view(0))).toBe(true);
    expect(isFullyVisible(items[4] as ItemBox, view(0))).toBe(false);
    expect(isFullyVisible(items[0] as ItemBox, view(100))).toBe(false);
  });

  it('has no range when no item is wholly visible (a wide item, or mid-scroll on a phone)', () => {
    const phone = view(150, { clientWidth: 359 });
    const wide: ItemBox[] = [
      { start: 0, width: 305 },
      { start: 321, width: 305 },
    ];
    expect(visibleRange(wide, phone)).toBeNull();
  });

  it('finds the item whose start is nearest a scroll position', () => {
    expect(nearestIndex(items, 0)).toBe(0);
    expect(nearestIndex(items, 160)).toBe(1);
    expect(nearestIndex(items, 5 * STEP + 10)).toBe(5);
    expect(nearestIndex([], 100)).toBe(0);
  });
});

describe('the previous and next buttons', () => {
  it('move a page of the items that are wholly visible', () => {
    expect(pageTarget('next', items, view(0))).toBe(4);
    expect(pageTarget('next', items, view(4 * STEP))).toBe(8);
    expect(pageTarget('previous', items, view(8 * STEP))).toBe(4);
  });

  it('never go past either end', () => {
    expect(pageTarget('previous', items, view(0))).toBe(0);
    expect(pageTarget('previous', items, view(2 * STEP))).toBe(0);
    expect(pageTarget('next', items, view(14 * STEP))).toBe(15);
  });

  it('move one item at a time when only one fits, even mid-scroll', () => {
    const phone = view(150, { clientWidth: 359 });
    const narrow: ItemBox[] = Array.from({ length: 6 }, (_, index) => ({
      start: index * 321,
      width: 305,
    }));
    expect(pageTarget('next', narrow, phone)).toBe(1);
    expect(pageTarget('previous', narrow, view(2 * 321, { clientWidth: 359 }))).toBe(1);
  });

  it('stay put with nothing to scroll', () => {
    expect(pageTarget('next', [], view(0))).toBe(0);
  });
});

describe('bringing an item into view', () => {
  it('leaves an item that is already wholly visible where it is', () => {
    expect(revealTarget(2, items, view(0))).toBeNull();
    expect(revealTarget(99, items, view(0))).toBeNull();
  });

  it('brings an item that is cut or out of view to the start edge', () => {
    expect(revealTarget(6, items, view(0))).toBe(6 * STEP);
    expect(revealTarget(0, items, view(2 * STEP))).toBe(0);
    expect(revealTarget(4, items, view(0))).toBe(4 * STEP);
  });

  it('never scrolls past what the scroller can reach', () => {
    const reach = maxScroll(view(0));
    expect(revealTarget(15, items, view(0))).toBe(reach);
  });
});

describe('a short flick with the mouse', () => {
  it('moves exactly one item when the drag ended where it began', () => {
    expect(flickTarget('next', 3, 3, 16)).toBe(4);
    expect(flickTarget('previous', 3, 3, 16)).toBe(2);
  });

  it('leaves a longer drag to the browser, which snaps to the item it landed on', () => {
    expect(flickTarget('next', 3, 5, 16)).toBeNull();
    expect(flickTarget('previous', 3, 1, 16)).toBeNull();
  });

  it('does nothing without a swipe, and nothing past either end', () => {
    expect(flickTarget('none', 3, 3, 16)).toBeNull();
    expect(flickTarget('previous', 0, 0, 16)).toBeNull();
    expect(flickTarget('next', 15, 15, 16)).toBeNull();
  });
});

describe('the position bar', () => {
  it('sizes the thumb by how much is in view, with a floor, and moves it with the scroll', () => {
    const track = 300;
    const none = thumbGeometry(view(0), track);
    expect(none.x).toBe(0);
    expect(none.width).toBeCloseTo((track * 1216) / view(0).scrollWidth, 5);
    const end = thumbGeometry(view(maxScroll(view(0))), track);
    expect(end.x).toBeCloseTo(track - end.width, 5);
    const middle = thumbGeometry(view(maxScroll(view(0)) / 2), track);
    expect(middle.x).toBeCloseTo((track - middle.width) / 2, 5);
    expect(thumbGeometry(view(0, { scrollWidth: 100000 }), track).width).toBe(24);
  });

  it('fills the bar when everything fits, and has no size with no room', () => {
    const fits = view(0, { scrollWidth: 800 });
    expect(thumbGeometry(fits, 300)).toEqual({ width: 300, x: 0 });
    expect(thumbGeometry(view(0), 0)).toEqual({ width: 0, x: 0 });
  });
});

describe('the visible count', () => {
  it('is the chosen item\u2019s place when there is a choice', () => {
    expect(positionLabel(16, 2, { first: 0, last: 3 })).toBe('3 of 16');
    expect(positionLabel(16, 0, null)).toBe('1 of 16');
  });

  it('is the items in view when there is no choice', () => {
    expect(positionLabel(12, null, { first: 0, last: 2 })).toBe('1\u20133 of 12');
    expect(positionLabel(12, undefined, { first: 4, last: 4 })).toBe('5 of 12');
    expect(positionLabel(12, null, null)).toBe('1 of 12');
  });

  it('is empty with nothing to count, and never counts past the end', () => {
    expect(positionLabel(0, null, null)).toBe('');
    expect(positionLabel(5, 9, null)).toBe('5 of 5');
  });
});
