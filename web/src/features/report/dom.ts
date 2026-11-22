// Small DOM helpers for moving around the report: scrolling and focus.

/** Anything that can take focus: a control in the page or a point in the chart. */
export type Focusable = HTMLElement | SVGElement;

/** True for an ordinary click, so a link keeps its normal behaviour with a modifier key or middle button. */
export function isPlainClick(event: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

/** True when the person has asked their system for less motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Brings an element into view. A short element is centred, with its neighbours around it; a tall one
 * starts at the top, clear of the sticky header (the page sets the scroll margin). The scroll is
 * gentle unless the person has asked for less motion.
 */
export function scrollToElement(element: Element): void {
  const tall = element.getBoundingClientRect().height > window.innerHeight * 0.6;
  element.scrollIntoView?.({
    block: tall ? 'start' : 'center',
    inline: 'nearest',
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  });
}

/** How often a gentle scroll to a turn is looked at, and how long it is given before it is left alone. */
const LOOK_MS = 100;
const GIVE_UP_MS = 3000;
/** How many times the place of a turn is put right, and how far off it may be (in pixels) before it is. */
const FIXES = 3;
const SLACK_PX = 8;
/** What a person does when they take the scrolling over from the page. */
const TAKES_OVER = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

/** Where a turn too tall to start a third of the way down starts instead, measured from the window's top. */
const TALL_TOP = 'calc(var(--header-h) + 9rem)';

/**
 * The height a turn has once it is drawn. A turn far from the window is laid out from an estimate
 * (it skips its contents), which is a few lines high, so it is measured as if it were drawn.
 */
function drawnHeight(element: HTMLElement): number {
  element.style.contentVisibility = 'visible';
  const { height } = element.getBoundingClientRect();
  element.style.removeProperty('content-visibility');
  return height;
}

/**
 * Brings a turn that a link led to into view about 35 per cent of the way down the window, under
 * the sticky header and the find bar and well above the "Back to" control at the foot, so the turn
 * is never covered. The distance is `--rp-turn-top` (the page's style sheet sets it, less the
 * scroll padding that the browser adds); a turn too tall for that, which would run under the
 * control, starts just under the bar instead. The scroll is gentle unless the person has asked for
 * less motion. Turns far from the window are laid out from an estimate until they are drawn, so the
 * place of the turn moves while the window comes near it: once the scroll has stopped it is checked
 * and, if it is off, put right without motion (a few times at most, as drawing the turns around it
 * can move it again). A person who scrolls for themselves takes over, and the checks stop.
 * Returns what stops them.
 */
export function scrollToTurn(element: HTMLElement): () => void {
  const tall = drawnHeight(element) > window.innerHeight * 0.45;
  if (tall) element.style.setProperty('--rp-turn-top', TALL_TOP);
  else element.style.removeProperty('--rp-turn-top');
  const place = (behavior: ScrollBehavior) =>
    element.scrollIntoView?.({ block: 'start', inline: 'nearest', behavior });
  const gentle: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
  place(gentle);

  const started = Date.now();
  let timer = 0;
  let before = window.scrollY;
  let fixes = 0;
  const stop = () => {
    window.clearTimeout(timer);
    for (const type of TAKES_OVER) window.removeEventListener(type, stop);
  };
  for (const type of TAKES_OVER) window.addEventListener(type, stop, { passive: true });
  const look = () => {
    const now = window.scrollY;
    const moving = now !== before;
    before = now;
    if (moving && Date.now() - started < GIVE_UP_MS) {
      timer = window.setTimeout(look, LOOK_MS);
      return;
    }
    const padding = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
    const wanted = Number.parseFloat(getComputedStyle(element).scrollMarginTop) + (padding || 0);
    const off = Math.abs(element.getBoundingClientRect().top - wanted);
    if (Number.isFinite(off) && off > SLACK_PX && fixes < FIXES) {
      fixes += 1;
      // A long way off is gone over gently, like the first move; a small slip is put right at once.
      place(off > window.innerHeight / 2 ? gentle : 'auto');
      before = window.scrollY;
      timer = window.setTimeout(look, LOOK_MS);
      return;
    }
    stop();
  };
  timer = window.setTimeout(look, LOOK_MS);
  return stop;
}

/**
 * Moves to a section named by its id: opens it if it is a closed disclosure (or holds one marked
 * `data-rp-disclosure`), scrolls to it and puts keyboard and screen-reader focus on its heading (or
 * its summary), so the next thing read is the section itself. A heading is not a control, so it
 * gets no focus ring, as in the rest of the app. The page's own navigation asks for the scroll to be
 * `smooth`, which it is unless the person has asked for less motion; everything else lands at once.
 */
export function jumpToSection(id: string, options: { smooth?: boolean } = {}): void {
  const section = document.getElementById(id);
  if (!section) return;
  const disclosure =
    section instanceof HTMLDetailsElement
      ? section
      : section.querySelector<HTMLDetailsElement>('details[data-rp-disclosure]');
  if (disclosure && !disclosure.open) disclosure.open = true;
  section.scrollIntoView?.({
    block: 'start',
    inline: 'nearest',
    behavior: options.smooth && !prefersReducedMotion() ? 'smooth' : 'auto',
  });
  const target =
    section instanceof HTMLDetailsElement
      ? section.querySelector<HTMLElement>('summary')
      : section.querySelector<HTMLElement>('[data-rp-heading]');
  if (!target) return;
  if (target.matches('[data-rp-heading]')) target.setAttribute('data-route-target', '');
  target.focus({ preventScroll: true });
}

/** The label of the part of the report an element sits in (the nearest `data-rp-origin`). */
export function originOf(element: Element): string | null {
  return element.closest<HTMLElement>('[data-rp-origin]')?.dataset.rpOrigin ?? null;
}
