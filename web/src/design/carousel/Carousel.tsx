import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cx } from '../cx.ts';
import { decideSwipe, useDragScroll, type DragScrollRelease } from '../interaction/index.ts';
import { IconButton } from '../primitives/Button.tsx';
import {
  atEdges,
  flickTarget,
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
import './carousel.css';

export interface CarouselProps {
  /** Names the gallery for everyone: "Featured scenarios". */
  label: string;
  /** What the items are, for the two buttons' names: "scenarios" gives "Previous scenarios". */
  noun?: string;
  /**
   * What an item holds. `select`: a radio, so the arrow keys move to the next item and choose it;
   * `link`: a link, so they only move focus (Tab still reaches every link). Either way Home and End
   * go to the first and the last item, and the item moved to is brought into view.
   */
  mode?: 'select' | 'link';
  /**
   * Where the chosen item is, for a gallery that has a choice; the count then reads "Selected 3 of 12"
   * (the bar beside it is what follows the scroll). Left out for a gallery of links, whose count is
   * the range in view, "1–4 of 12".
   */
  selectedIndex?: number | null;
  /** The items, in order. Each child becomes one item of a standard list. */
  children: ReactNode;
  className?: string;
}

interface Range {
  first: number;
  last: number;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// A click or a tap should not scroll the item under the finger; a key should. Browsers focus an
// item on a mouse press, so whether the last thing the person did was a press is tracked once for
// the page.
let pressed = false;
let tracking = false;
function trackModality(): void {
  if (tracking || typeof document === 'undefined') return;
  tracking = true;
  document.addEventListener('pointerdown', () => (pressed = true), true);
  document.addEventListener('keydown', () => (pressed = false), true);
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** How long a glide may take before snapping gets its turn back, whether or not it has arrived. */
const SETTLE_MS = 900;

// Everything below works on elements, not on React: the track is the list, and the scroller is the
// element that holds it.

const scrollerOf = (track: HTMLElement): HTMLElement => track.parentElement ?? track;

function readBoxes(track: HTMLElement): ItemBox[] {
  const items = [...track.children] as HTMLElement[];
  const origin = items[0]?.offsetLeft ?? 0;
  return items.map((item) => ({ start: item.offsetLeft - origin, width: item.offsetWidth }));
}

function readView(track: HTMLElement): ScrollView {
  const scroller = scrollerOf(track);
  return {
    scrollLeft: scroller.scrollLeft,
    clientWidth: scroller.clientWidth,
    scrollWidth: scroller.scrollWidth,
    inset: (track.firstElementChild as HTMLElement | null)?.offsetLeft ?? 0,
  };
}

/** Smoothly, unless the person asked for less motion. */
function scrollToLeft(track: HTMLElement, left: number, smooth: boolean): void {
  scrollerOf(track).scrollTo?.({
    left,
    behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto',
  });
}

function revealItem(track: HTMLElement, index: number, smooth: boolean): void {
  const target = revealTarget(index, readBoxes(track), readView(track));
  if (target !== null) scrollToLeft(track, target, smooth);
}

function pageBy(track: HTMLElement, direction: 'previous' | 'next'): void {
  const boxes = readBoxes(track);
  const view = readView(track);
  const box = boxes[pageTarget(direction, boxes, view)];
  if (box) scrollToLeft(track, clamp(box.start, 0, maxScroll(view)), true);
}

/**
 * Where the scroller comes to rest after a mouse drag: one item on from where the drag began if it
 * was a short, fast flick toward it, else the item nearest to where it was let go. It glides there
 * itself. Left alone, the browser would snap at once, with no glide (a jump of up to half an item),
 * and a flick would first snap back the way it came and then reverse. So snapping is held off until
 * the glide has arrived, and then it has nothing left to do.
 */
function settle(track: HTMLElement, release: DragScrollRelease, from: number): void {
  const scroller = scrollerOf(track);
  // First of all, before anything here reads the layout: the drag hook has just given snapping back,
  // and the browser re-snaps the moment it next works out the styles, which a read would make it do.
  scroller.setAttribute('data-settling', 'true');
  let frame = 0;
  let timer = 0;
  const arrive = () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    scroller.removeAttribute('data-settling');
  };
  const boxes = readBoxes(track);
  const here = nearestIndex(boxes, scroller.scrollLeft);
  const box =
    boxes[flickTarget(decideSwipe(release), nearestIndex(boxes, from), here, boxes.length) ?? here];
  if (!box) {
    arrive();
    return;
  }
  const left = clamp(box.start, 0, maxScroll(readView(track)));
  // Watched frame by frame rather than by `scrollend`, which the drag's own scrolling may still be
  // about to send. The timer lets go if the glide is cut short (the wheel, a key, another drag).
  const watch = () => {
    if (Math.abs(scroller.scrollLeft - left) < 1) arrive();
    else frame = requestAnimationFrame(watch);
  };
  scroller.scrollTo?.({ left, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  timer = window.setTimeout(arrive, SETTLE_MS);
  frame = requestAnimationFrame(watch);
}

/** The control that takes focus in each item: its radio, else its link or button. */
function focusTargets(track: HTMLElement): (HTMLElement | null)[] {
  return [...track.children].map((item) =>
    item.querySelector<HTMLElement>(
      'input[type="radio"]:not(:disabled), a[href], button:not(:disabled)',
    ),
  );
}

const KEYS = {
  select: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'],
  link: ['ArrowLeft', 'ArrowRight', 'Home', 'End'],
} as const;

/**
 * A horizontal product gallery: a standard list of items that scrolls sideways, with previous and
 * next buttons, a count, and a thin bar that shows where the visible items are.
 *
 * It never moves by itself: no auto-play, no looping, no copies of its items. Touch uses the
 * browser's own scrolling and snapping; a mouse can drag (a drag never counts as a click on an
 * item, stretches a little at either end, and glides to where it comes to rest); the wheel and
 * trackpad scroll it sideways while a plain vertical wheel passes through to the page. Scrolling is
 * smooth unless the person asks for less motion. The chosen item is kept in view when the choice or
 * the set of items changes.
 */
export function Carousel({
  label,
  noun = 'items',
  mode = 'link',
  selectedIndex = null,
  children,
  className,
}: CarouselProps) {
  const items = Children.toArray(children);
  const total = items.length;
  const signature = items
    .map((child, index) => (isValidElement(child) && child.key !== null ? child.key : index))
    .join('|');
  const trackId = useId();
  const countId = useId();
  const list = useRef<HTMLUListElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const dragFrom = useRef(0);
  const shown = useRef<string | null>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: true });
  const [range, setRange] = useState<Range | null>(null);

  // The mouse drag. The element is the viewport; this component only uses the ref to attach it.
  const viewport = useDragScroll<HTMLDivElement>({
    onDragChange: (dragging) => {
      if (dragging) dragFrom.current = list.current?.parentElement?.scrollLeft ?? 0;
    },
    onRelease: (release) => {
      if (list.current) settle(list.current, release, dragFrom.current);
    },
  });

  const reveal = useCallback((index: number, smooth: boolean) => {
    if (list.current) revealItem(list.current, index, smooth);
  }, []);

  // What is wholly in view and whether either end has been reached change state; where the thumb
  // sits is written straight to the element, so scrolling never renders the component.
  const measure = useCallback(() => {
    const track = list.current;
    if (!track) return;
    const view = readView(track);
    const next = atEdges(view);
    setEdges((current) =>
      current.atStart === next.atStart && current.atEnd === next.atEnd ? current : next,
    );
    const visible = visibleRange(readBoxes(track), view);
    setRange((current) =>
      current?.first === visible?.first && current?.last === visible?.last ? current : visible,
    );
    const fill = thumb.current;
    if (fill && bar.current) {
      const { width, x } = thumbGeometry(view, bar.current.clientWidth);
      fill.style.setProperty('--ff-thumb-w', `${Math.round(width)}px`);
      fill.style.setProperty('--ff-thumb-x', `${Math.round(x * 100) / 100}px`);
    }
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, signature]);

  useEffect(() => {
    const track = list.current;
    if (!track) return;
    const scroller = scrollerOf(track);
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(scroller);
    observer?.observe(track);
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [measure]);

  // The chosen item stays in view: at once on the first render and when the set of items changes
  // (a filter), smoothly when only the choice moves.
  useLayoutEffect(() => {
    if (selectedIndex === null || selectedIndex < 0 || selectedIndex >= total) return;
    reveal(selectedIndex, shown.current === signature);
    shown.current = signature;
  }, [selectedIndex, signature, total, reveal]);

  // Arrow keys, Home and End, and bringing a focused item into view. Native listeners: these are an
  // extra on top of Tab and the radio group's own behaviour, not a replacement for either.
  useEffect(() => {
    trackModality();
    const track = list.current;
    if (!track) return;
    const scroller = scrollerOf(track);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.shiftKey || !(KEYS[mode] as readonly string[]).includes(event.key)) return;
      const targets = focusTargets(track);
      const at = [...track.children].findIndex((item) => item.contains(event.target as Node));
      if (at === -1) return;
      event.preventDefault();
      const last = targets.length - 1;
      const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
      const to = event.key === 'Home' ? 0 : event.key === 'End' ? last : clamp(at + step, 0, last);
      const target = targets[to];
      if (to === at || !target) return;
      target.focus({ preventScroll: true });
      // Moving to a radio chooses it, as in any radio group.
      if (mode === 'select') target.click();
      reveal(to, true);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (pressed) return;
      const at = [...track.children].findIndex((item) => item.contains(event.target as Node));
      if (at !== -1) reveal(at, true);
    };
    scroller.addEventListener('keydown', onKeyDown);
    scroller.addEventListener('focusin', onFocusIn);
    return () => {
      scroller.removeEventListener('keydown', onKeyDown);
      scroller.removeEventListener('focusin', onFocusIn);
    };
  }, [mode, reveal]);

  if (total === 0) return null;
  // With a choice the count says which item is chosen, not which are in view: the bar beside it is
  // what follows the scroll, and a count that looked like it did would seem stale after a drag.
  const chosen = selectedIndex !== null && selectedIndex >= 0;
  const more = [!edges.atStart && 'start', !edges.atEnd && 'end'].filter(Boolean).join(' ');
  return (
    <section
      className={cx('ff-carousel', className)}
      aria-roledescription="carousel"
      aria-label={label}
      aria-describedby={countId}
    >
      <div className="ff-carousel__viewport" ref={viewport} data-more={more || undefined}>
        <ul className="ff-carousel__track" role="list" id={trackId} ref={list}>
          {items.map((child, index) => (
            <li
              className="ff-carousel__item"
              key={isValidElement(child) && child.key !== null ? child.key : index}
              aria-posinset={index + 1}
              aria-setsize={total}
            >
              {child}
            </li>
          ))}
        </ul>
      </div>
      <div className="ff-carousel__controls">
        <p className="ff-carousel__count" id={countId} data-kind={chosen ? 'selected' : 'range'}>
          {chosen ? (
            <>
              <span className="ff-carousel__kind">Selected</span>{' '}
            </>
          ) : null}
          {positionLabel(total, selectedIndex, range)}
        </p>
        <div className="ff-carousel__bar" ref={bar} aria-hidden="true">
          <span className="ff-carousel__thumb" ref={thumb} />
        </div>
        <div className="ff-carousel__nav">
          <IconButton
            className="ff-carousel__arrow"
            data-direction="previous"
            icon="chevron-left"
            label={`Previous ${noun}`}
            appearance="outline"
            aria-controls={trackId}
            disabledFocusable={edges.atStart}
            onClick={() => list.current && pageBy(list.current, 'previous')}
          />
          <IconButton
            className="ff-carousel__arrow"
            data-direction="next"
            icon="chevron-right"
            label={`Next ${noun}`}
            appearance="outline"
            aria-controls={trackId}
            disabledFocusable={edges.atEnd}
            onClick={() => list.current && pageBy(list.current, 'next')}
          />
        </div>
      </div>
    </section>
  );
}
