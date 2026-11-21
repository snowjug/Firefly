import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type FocusEvent,
  type PointerEvent,
} from 'react';
import { Link, useLocation } from 'react-router';
import { useFinePointer } from '../../lib/motion/pointer.ts';
import { useReducedMotion } from '../../lib/theme.tsx';
import { activeNavItem, DOCK_ITEMS } from './nav.ts';

const indexOfItem = (target: EventTarget): number => {
  const item = (target as Element).closest?.('li');
  const list = item?.parentElement;
  return item && list ? Array.from(list.children).indexOf(item) : -1;
};

/**
 * The way around Firefly: a ruler-like strip of numbered destinations at the bottom of the screen.
 * An amber pip rides the ruler to the current destination, leans towards the one under a fine
 * pointer, and follows keyboard focus. The pip is moved by writing one custom property, so a pointer
 * crossing the dock never re-renders React.
 */
export function CommandDock() {
  const { pathname } = useLocation();
  const fine = useFinePointer();
  const reduced = useReducedMotion();
  const active = activeNavItem(pathname);
  const activeIndex = active ? DOCK_ITEMS.indexOf(active) : -1;

  const navRef = useRef<HTMLElement>(null);
  const pipRef = useRef<HTMLSpanElement>(null);
  const activeRef = useRef(activeIndex);
  const lean = useRef({ hover: -1, focus: -1 });

  const place = useCallback(() => {
    const nav = navRef.current;
    const pip = pipRef.current;
    if (!nav || !pip) return;
    const { hover, focus } = lean.current;
    const target = hover >= 0 ? hover : focus >= 0 ? focus : activeRef.current;
    const link = target >= 0 ? nav.querySelectorAll<HTMLElement>('.dock__link')[target] : undefined;
    if (!link) {
      pip.dataset.on = 'false';
      return;
    }
    const navBox = nav.getBoundingClientRect();
    const linkBox = link.getBoundingClientRect();
    pip.style.setProperty(
      '--pip-x',
      `${(linkBox.left - navBox.left + linkBox.width / 2).toFixed(1)}px`,
    );
    pip.dataset.on = 'true';
  }, []);

  useLayoutEffect(() => {
    activeRef.current = activeIndex;
    place();
  }, [activeIndex, place]);

  // The pip is placed before it is allowed to move, so it never glides in from the corner. It is
  // placed again when the dock changes size (a window resize, the fonts arriving).
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    observer?.observe(nav);
    void document.fonts?.ready.then(place);
    const frame = requestAnimationFrame(() => {
      if (pipRef.current) pipRef.current.dataset.ready = 'true';
    });
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [place]);

  const onPointerOver = (event: PointerEvent) => {
    if (!fine || event.pointerType === 'touch') return;
    const over = indexOfItem(event.target);
    if (over === lean.current.hover) return;
    lean.current.hover = over;
    place();
  };
  const onPointerLeave = () => {
    lean.current.hover = -1;
    place();
  };
  const onFocus = (event: FocusEvent) => {
    lean.current.focus = indexOfItem(event.target);
    place();
  };
  const onBlur = () => {
    lean.current.focus = -1;
    place();
  };

  return (
    <nav
      ref={navRef}
      aria-label="Main"
      className="dock glass glass--nav"
      data-vt-persist="dock"
      onPointerOver={onPointerOver}
      onPointerLeave={onPointerLeave}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <span className="dock__ticks" aria-hidden="true" />
      <ul className="dock__list" role="list">
        {DOCK_ITEMS.map((item, index) => (
          <li key={item.to}>
            <Link
              to={item.to}
              className="dock__link"
              aria-current={index === activeIndex ? 'page' : undefined}
              viewTransition={!reduced}
            >
              <span className="dock__no" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="dock__label">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <span ref={pipRef} className="dock__pip" aria-hidden="true" data-on="false" />
    </nav>
  );
}
