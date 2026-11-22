import type { CSSProperties } from 'react';

// How the report's blocks come into view as they are scrolled to. Each block uses `useReveal` from
// the design system (`[data-reveal]` in layout.css hides it only on a screen, only while motion is
// allowed, and rises it into place when it has been seen), and this says how far into a stagger it
// stands. A short group of siblings (the six skills, a list of strengths) is watched as one: its
// container takes the ref, and each child spreads the same props with a step of its own, so the group
// comes in one after another when it is seen.

/** The last step of a stagger. A long list is not made to wait for itself: from here on every row comes in together. */
const LAST_STEP = 7;

/** The `style` that puts a child `index` places into its group's stagger (`--dur-stagger` a step, never more than eight). */
export function stagger(index: number): CSSProperties {
  return { '--reveal-i': Math.min(Math.max(0, index), LAST_STEP) } as CSSProperties;
}
