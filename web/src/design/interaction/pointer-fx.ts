import { useSyncExternalStore } from 'react';

// Mouse effects (card tilt, the local highlight, the drag stretch) switch on only when every
// condition below holds.
//
// Browsers have no API for "low-power rendering": nothing in CSS media queries or in JavaScript
// reports Low Power Mode, battery saver or CPU throttling. These proxies stand in for it, and this
// module claims no more than they say:
//   - (hover: hover) and (pointer: fine): the main input is a mouse or a trackpad, so there is a
//     pointer to follow. Touch and pen devices fail this.
//   - (prefers-reduced-motion: reduce): the person asked for less motion.
//   - (prefers-reduced-data: reduce): the person asked the page to use less; it is the nearest signal
//     that the page should do less work. Few browsers implement it yet, and where it is unknown the
//     query never matches, so it never blocks by mistake.
//   - (update: slow): the display refreshes slowly (e-ink, some projectors), so animation would stutter.

const REQUIRED = ['(hover: hover)', '(pointer: fine)'] as const;
const BLOCKING = [
  '(prefers-reduced-motion: reduce)',
  '(prefers-reduced-data: reduce)',
  '(update: slow)',
] as const;

type MediaWindow = Pick<Window, 'matchMedia'>;

function browserWindow(): MediaWindow | undefined {
  return typeof window === 'undefined' ? undefined : window;
}

/** True only when the device has a fine hovering pointer and nobody asked for less motion or data. */
export function pointerFxEnabled(win: MediaWindow | undefined = browserWindow()): boolean {
  if (!win || typeof win.matchMedia !== 'function') return false;
  const matches = (query: string) => win.matchMedia(query)?.matches === true;
  return REQUIRED.every(matches) && !BLOCKING.some(matches);
}

function listen(list: MediaQueryList | undefined, notify: () => void): () => void {
  if (!list) return () => undefined;
  if (typeof list.addEventListener === 'function') {
    list.addEventListener('change', notify);
    return () => list.removeEventListener('change', notify);
  }
  // Safari before 14 only has the older listener methods.
  list.addListener?.(notify);
  return () => list.removeListener?.(notify);
}

function subscribe(notify: () => void): () => void {
  const win = browserWindow();
  if (!win || typeof win.matchMedia !== 'function') return () => undefined;
  const stops = [...REQUIRED, ...BLOCKING].map((query) => listen(win.matchMedia(query), notify));
  return () => stops.forEach((stop) => stop());
}

const current = () => pointerFxEnabled();
const off = () => false;

/** `pointerFxEnabled`, kept up to date: it re-evaluates when any of the queries changes. */
export function usePointerFx(): boolean {
  return useSyncExternalStore(subscribe, current, off);
}
