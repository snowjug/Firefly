import { useEffect, useRef } from 'react';

/**
 * Keeps the keyboard from being dropped. When `trigger` changes, a control may have been removed from
 * under it: a button replaced by the notice about it, or a notice that was dismissed. If nothing
 * holds focus any more, it goes to the element `find` returns, so the next Tab or the screen reader
 * starts from the call and not from the top of the page. Focus that is somewhere real is never
 * moved, and neither is anything on the first render. `find` should be the same function each time.
 */
export function useRescueFocus(trigger: unknown, find: () => HTMLElement | null): void {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const active = document.activeElement;
    if (!active || active === document.body) find()?.focus();
  }, [trigger, find]);
}

/** The call controls, which can take focus when nothing else can (a control that held it is gone). */
export const findControlsZone = (): HTMLElement | null => document.getElementById('cw-controls');

/** The microphone control, where focus goes when the trainee goes back to voice. */
export const findTalkControl = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-cw-talk]');
