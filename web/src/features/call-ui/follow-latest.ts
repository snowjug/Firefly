import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/** How near the end counts as "at the latest turn", in pixels. */
export const FOLLOW_SLACK_PX = 40;
/** How long a scroll that the page asked for may still be under way, in milliseconds. */
export const PIN_WINDOW_MS = 1000;

/**
 * What a scroll event means for following the newest turn.
 *  - Near the end: the log is following again, whoever got it there.
 *  - Anywhere else, while the page's own scroll to the end is under way: nothing changed. A scroll
 *    the page asked for passes through places that are not the end, and must not read as a person
 *    leaving it.
 *  - Anywhere else, otherwise: a person (or something outside the page, such as find-in-page) moved
 *    it away, and the log stops following them.
 */
export function followAfterScroll(input: {
  distanceFromEnd: number;
  /** The page's own scroll to the end is under way. */
  pinning: boolean;
  following: boolean;
  slack?: number;
}): boolean {
  if (input.distanceFromEnd <= (input.slack ?? FOLLOW_SLACK_PX)) return true;
  return input.pinning ? input.following : false;
}

const distanceFromEnd = (element: HTMLElement) =>
  element.scrollHeight - element.scrollTop - element.clientHeight;

/** The ways a hand takes over a scroll: the wheel or trackpad, a touch, the keyboard, a drag of the scrollbar. */
const HAND_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

export interface FollowLatest {
  /** Attach to the element that scrolls. */
  scroller: RefObject<HTMLDivElement | null>;
  /** Whether the log has been scrolled away from the newest turn by hand: this is when "Jump to latest" is offered. */
  away: boolean;
  /** Stay with the newest turn, if the person has not left it. */
  pin(behavior: ScrollBehavior): void;
  /** Take the person back to the newest turn, and follow again. */
  jump(behavior: ScrollBehavior): void;
  /** Wire to the element's `scroll` event. */
  onScroll(): void;
}

/**
 * Follows the newest turn of a log for as long as the person has not left it. Only a scroll that is
 * not the page's own moves the log away from the end, so "Jump to latest" appears after the person
 * has scrolled up and never while the log follows a new turn; and while they read earlier turns,
 * nothing scrolls under them, however many turns arrive.
 */
export function useFollowLatest(): FollowLatest {
  const scroller = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const pinUntil = useRef(0);
  const [away, setAway] = useState(false);

  // A hand on the log ends any scroll the page had begun, so that scrolling away again is never
  // taken for the page's own movement.
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const take = () => {
      pinUntil.current = 0;
    };
    for (const type of HAND_EVENTS) element.addEventListener(type, take, { passive: true });
    return () => {
      for (const type of HAND_EVENTS) element.removeEventListener(type, take);
    };
  }, []);

  const scrollToEnd = useCallback((behavior: ScrollBehavior) => {
    const element = scroller.current;
    if (!element) return;
    const top = element.scrollHeight;
    // Only a scroll that will really move the log is the page's: one that goes nowhere sends no
    // event to end it.
    if (Math.abs(top - element.clientHeight - element.scrollTop) >= 1) {
      pinUntil.current = performance.now() + PIN_WINDOW_MS;
    }
    if (typeof element.scrollTo === 'function') element.scrollTo({ top, behavior });
    else element.scrollTop = top;
  }, []);

  const pin = useCallback(
    (behavior: ScrollBehavior) => {
      if (following.current) scrollToEnd(behavior);
    },
    [scrollToEnd],
  );

  const jump = useCallback(
    (behavior: ScrollBehavior) => {
      following.current = true;
      setAway(false);
      scrollToEnd(behavior);
    },
    [scrollToEnd],
  );

  const onScroll = useCallback(() => {
    const element = scroller.current;
    if (!element) return;
    const next = followAfterScroll({
      distanceFromEnd: distanceFromEnd(element),
      pinning: performance.now() < pinUntil.current,
      following: following.current,
    });
    following.current = next;
    setAway(!next);
  }, []);

  return { scroller, away, pin, jump, onScroll };
}
