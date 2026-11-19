import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './theme.tsx';

// Small motion helpers. The CSS motion tokens (tokens.css) carry most of the language; this file
// holds the few behaviours CSS cannot do alone. Every helper degrades to "no motion, final state"
// under reduced motion, and none of them delays an action.

/** Cubic ease-out, used for number interpolation. */
export function easeOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - x, 3);
}

/**
 * Animates a number towards `target`. Returns the value to display right now. With reduced motion
 * (or `enabled: false`) it returns the target straight away. Pair it with the real value in text
 * that assistive technology reads, so the animation is only ever decoration.
 */
export function useAnimatedNumber(target: number, duration = 700, enabled = true): number {
  const reducedMotion = useReducedMotion();
  const animate = enabled && !reducedMotion;
  const [shown, setShown] = useState(animate ? 0 : target);
  const from = useRef(animate ? 0 : target);

  useEffect(() => {
    if (!animate) return;
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const progress = easeOutCubic((now - start) / duration);
      const value = origin + (target - origin) * progress;
      from.current = value;
      setShown(value);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, target, duration]);

  return animate ? shown : target;
}

/**
 * Marks an element as revealed the first time it scrolls into view, so CSS can run a short entrance
 * on `[data-revealed='true']`. Without IntersectionObserver, or with reduced motion, it is
 * revealed immediately.
 */
export function useReveal<T extends HTMLElement>(): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion || typeof IntersectionObserver === 'undefined') {
      el.dataset.revealed = 'true';
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.dataset.revealed = 'true';
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion]);
  return ref;
}

/** Runs a same-document view transition when the browser supports it, otherwise just runs `update`. */
export function withViewTransition(update: () => void, reducedMotion: boolean): void {
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => unknown;
  };
  if (reducedMotion || typeof doc.startViewTransition !== 'function') {
    update();
    return;
  }
  doc.startViewTransition(update);
}

/** A small stagger delay, capped so long lists never feel slow. */
export function stagger(index: number, step = 70, max = 420): React.CSSProperties {
  return { animationDelay: `${Math.min(max, index * step)}ms` };
}
