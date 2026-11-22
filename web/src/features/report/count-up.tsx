import { useLayoutEffect, type RefObject } from 'react';
import { cx, useInViewOnce } from '../../design/index.ts';
import { prefersReducedMotion } from './dom.ts';

// A number that counts up once, from nothing to what it is. The real value is in the page from the
// first render, as the text of the element, and never changes: a screen reader, a printout, a copy
// and a test all read it at once. Only the digits that are drawn move, and they are not text: the
// script writes them into `data-shown` while `data-counting` is on, and the stylesheet draws them
// from the attribute (as generated content with no spoken equivalent) while it hides the real text
// the way a visually hidden element is hidden. No text node changes, so nothing is announced.
//
// It runs once, when the number is first seen, and not at all when motion is reduced.

/** The count takes `--dur-slower`, and a slot in the stagger of a block is `--dur-stagger`. These are the answer when the page has no stylesheet to ask. */
const COUNT_MS = 400;
const STAGGER_MS = 40;

/** A time held in a custom property ("400ms", "0.4s") in milliseconds, or `fallback` when the page has no such property. */
export function tokenMs(name: string, fallback: number): number {
  if (typeof document === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const match = /^(\d*\.?\d+)(ms|s)$/.exec(raw);
  if (!match) return fallback;
  return Number(match[1]) * (match[2] === 's' ? 1000 : 1);
}

/** Fast at first and slowing into the value, and never past it: a score is not made to bounce. */
const easeOut = (progress: number) => 1 - (1 - progress) ** 3;

/**
 * Counts the element this returns the ref of from 0 to `text` (a number as it is written: "4.2",
 * "3"), a moment after it is seen, `step` places into a block's stagger. Nothing happens, and the
 * real value is the only thing there is, for a text that is not a positive number, under reduced
 * motion, and where a browser cannot say when something is seen.
 */
export function useCountUp(text: string, step = 0): RefObject<HTMLSpanElement | null> {
  const [ref, seen] = useInViewOnce<HTMLSpanElement>();
  useLayoutEffect(() => {
    const element = ref.current;
    const target = Number(text);
    if (!element || !(target > 0) || prefersReducedMotion()) return;
    const decimals = text.includes('.') ? text.length - text.indexOf('.') - 1 : 0;
    const show = (value: number) => element.setAttribute('data-shown', value.toFixed(decimals));
    const finish = () => {
      element.removeAttribute('data-counting');
      element.removeAttribute('data-shown');
    };
    // Nothing has been seen yet: stand at the start, so what scrolls into view is already at 0.
    element.setAttribute('data-counting', '');
    show(0);
    if (!seen) return finish;

    const duration = tokenMs('--dur-slower', COUNT_MS);
    const delay = step * tokenMs('--dur-stagger', STAGGER_MS);
    let begun: number | null = null;
    let frame = 0;
    const tick = (now: number) => {
      begun ??= now;
      const progress = Math.min(1, Math.max(0, (now - begun - delay) / duration));
      show(target * easeOut(progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else finish();
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      finish();
    };
  }, [ref, seen, text, step]);
  return ref;
}

/** The number as it is written, counting up once as it is seen. Give it the class that sets its type. */
export function CountUp({
  text,
  step,
  className,
}: {
  text: string;
  /** How many steps into the block's stagger the count begins. */
  step?: number;
  className?: string;
}) {
  const ref = useCountUp(text, step);
  return (
    <span ref={ref} className={cx('rp-count', className)}>
      <span className="rp-count__value">{text}</span>
    </span>
  );
}
