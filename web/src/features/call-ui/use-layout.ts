import { useEffect, type RefObject } from 'react';
import { useMediaQuery } from '../../lib/hooks.ts';

/**
 * Which arrangement of the call screen is showing: three columns (80em and up), two (64em up, the
 * context moves into a sheet) or one. The page picks what to render from this, because the voice
 * controls live in the stage panel on wide screens and in a dock at the bottom on narrow ones, and
 * only one of the two may exist at a time.
 */
export type LayoutMode = 'wide' | 'medium' | 'narrow';

export function useLayoutMode(): LayoutMode {
  const wide = useMediaQuery('(min-width: 80em)');
  const medium = useMediaQuery('(min-width: 64em)');
  return wide ? 'wide' : medium ? 'medium' : 'narrow';
}

/**
 * True when the window is short: a phone held on its side, a small phone, or a very short browser
 * window. A narrow window this short has no room for the tips strip beside the transcript and the
 * dock (the strip would take most of what the transcript has), so it leaves the strip out.
 */
export function useShortScreen(): boolean {
  return useMediaQuery('(max-height: 44em)');
}

/** True when the person asked for less motion: the waveform becomes a still level meter. */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/** The keyboard is taken to be open when it hides at least this many pixels of the page. */
const KEYBOARD_MIN_PX = 120;

/**
 * Keeps the custom property `--cw-vh` equal to the height of what is really visible while the
 * on-screen keyboard is open, so the dock and the composer stay above it, and marks the root with
 * `data-keyboard="open"` for the stylesheet (the tips strip is put out of the way then). Without a
 * keyboard (and while the person pinch-zooms) both are removed and the stylesheet's `100dvh` applies.
 * Only a script can know the keyboard's size in browsers that do not resize the layout for it.
 */
export function useVisualViewportHeight(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
): void {
  useEffect(() => {
    const element = ref.current;
    const viewport = typeof window === 'undefined' ? null : window.visualViewport;
    if (!enabled || !element || !viewport) return;
    const update = () => {
      const hidden = window.innerHeight - viewport.height - viewport.offsetTop;
      if (viewport.scale <= 1.01 && hidden >= KEYBOARD_MIN_PX) {
        element.style.setProperty('--cw-vh', `${Math.round(viewport.height)}px`);
        element.dataset.keyboard = 'open';
      } else {
        element.style.removeProperty('--cw-vh');
        delete element.dataset.keyboard;
      }
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      element.style.removeProperty('--cw-vh');
      delete element.dataset.keyboard;
    };
  }, [ref, enabled]);
}
