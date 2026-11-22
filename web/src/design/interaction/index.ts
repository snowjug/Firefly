// Firefly's interaction system: the small hooks behind card tilt, mouse drag, in-view activation,
// loops that pause off screen and the landing call preview. Import them from `design/index.ts`.
//
// What the mouse hooks write for a stylesheet to use (no React state changes on a pointer move):
//   useTilt        --tilt-x, --tilt-y (degrees), --glow-x, --glow-y (percentages), data-fx="on" | "off"
//   useDragScroll  data-dragging="true" while dragging; --drag-overscroll (px) at the scroll limits
// Tilt, the highlight and the drag stretch switch themselves off for a coarse pointer, reduced motion
// and slow or data-saving displays (touch and pen are ignored outright); `usePointerFx` is the one
// place that decides. Dragging itself is not decoration, so a mouse can still drag in those cases.

export { pointerFxEnabled, usePointerFx } from './pointer-fx.ts';
export { tiltFor, useTilt, type TiltOptions, type TiltValues } from './use-tilt.ts';
export {
  decideSwipe,
  useDragScroll,
  type DragScrollOptions,
  type DragScrollRelease,
  type SwipeDecision,
  type SwipeThresholds,
} from './use-drag-scroll.ts';
export { useInViewOnce, useOnScreen, type InViewOptions } from './use-in-view.ts';
export { useReveal, type RevealProps } from './use-reveal.ts';
export { useSelectionSlide } from './use-selection-slide.ts';
export { prefersReducedMotion } from './reduced-motion.ts';
export { mergeRefs } from './merge-refs.ts';
export { usePageVisible } from './use-page-visible.ts';
export { useScrolled } from './use-scrolled.ts';
export { useLoopClock, type LoopClock, type LoopClockOptions } from './use-loop-clock.ts';
