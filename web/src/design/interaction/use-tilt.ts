import type { RefObject } from 'react';
import { usePointerFx } from './pointer-fx.ts';
import { useAttachedRef } from './use-attached-ref.ts';

// The design system's ceiling for card tilt, in degrees: "1 to 2 degrees, never more".
const MAX_TILT_DEG = 2;
const DEFAULT_TILT_DEG = 1.5;
const PROPERTIES = ['--tilt-x', '--tilt-y', '--glow-x', '--glow-y'] as const;

export interface TiltOptions {
  /** The most the element turns, in degrees. Default 1.5; anything above 2 is held to 2. */
  maxDeg?: number;
}

export interface TiltValues {
  /** Turn about the horizontal axis, in degrees: `rotateX(var(--tilt-x))`. */
  rx: number;
  /** Turn about the vertical axis, in degrees: `rotateY(var(--tilt-y))`. */
  ry: number;
  /** The pointer's position inside the rectangle, 0 to 100 from the left edge. */
  gx: number;
  /** The pointer's position inside the rectangle, 0 to 100 from the top edge. */
  gy: number;
}

/** Keeps a position in the rectangle; a degenerate rectangle (no size yet) counts as the centre. */
function within(position: number, size: number): number {
  const fraction = size > 0 ? position / size : 0.5;
  return Number.isFinite(fraction) ? Math.min(Math.max(fraction, 0), 1) : 0.5;
}

// Math gives -0 for a pointer at the exact centre; callers and tests should see 0.
const plain = (value: number) => (Object.is(value, -0) ? 0 : value);

/**
 * How far to turn an element for a pointer position. The element turns as if the pointer pressed on
 * it: a pointer near the right edge sends the right edge away from the viewer (`ry` > 0) and a
 * pointer near the top sends the top edge away (`rx` > 0). Both are 0 at the centre and never exceed
 * `maxDeg`, which is itself held to 2 degrees. A pointer outside the rectangle counts as on its edge.
 */
export function tiltFor(
  pointer: { x: number; y: number },
  rect: { left: number; top: number; width: number; height: number },
  maxDeg: number,
): TiltValues {
  const limit = Number.isFinite(maxDeg) ? Math.min(Math.max(maxDeg, 0), MAX_TILT_DEG) : 0;
  const gx = within(pointer.x - rect.left, rect.width);
  const gy = within(pointer.y - rect.top, rect.height);
  return {
    rx: plain(-(gy * 2 - 1) * limit),
    ry: plain((gx * 2 - 1) * limit),
    gx: gx * 100,
    gy: gy * 100,
  };
}

const round = (value: number) => Math.round(value * 100) / 100;

function markOff(element: HTMLElement): () => void {
  element.dataset.fx = 'off';
  return () => undefined;
}

function followMouse(element: HTMLElement, maxDeg: number): () => void {
  element.dataset.fx = 'on';
  let frame = 0;
  let pointer: { x: number; y: number } | null = null;

  const write = () => {
    frame = 0;
    if (!pointer) return;
    const { rx, ry, gx, gy } = tiltFor(pointer, element.getBoundingClientRect(), maxDeg);
    pointer = null;
    element.style.setProperty('--tilt-x', `${round(rx)}deg`);
    element.style.setProperty('--tilt-y', `${round(ry)}deg`);
    element.style.setProperty('--glow-x', `${round(gx)}%`);
    element.style.setProperty('--glow-y', `${round(gy)}%`);
  };

  const clear = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    pointer = null;
    for (const name of PROPERTIES) element.style.removeProperty(name);
  };

  const onMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    pointer = { x: event.clientX, y: event.clientY };
    if (!frame) frame = requestAnimationFrame(write);
  };

  const onLeave = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') clear();
  };

  element.addEventListener('pointermove', onMove, { passive: true });
  element.addEventListener('pointerleave', onLeave, { passive: true });
  element.addEventListener('pointercancel', onLeave, { passive: true });
  return () => {
    element.removeEventListener('pointermove', onMove);
    element.removeEventListener('pointerleave', onLeave);
    element.removeEventListener('pointercancel', onLeave);
    clear();
  };
}

/**
 * Turns an element a degree or two toward the mouse and moves a highlight under it. Attach the
 * returned ref; the hook writes `--tilt-x`, `--tilt-y` (degrees) and `--glow-x`, `--glow-y`
 * (percentages) on that element while the mouse is over it, and removes them when it leaves, so the
 * stylesheet's own fallbacks (`var(--tilt-x, 0deg)`, `var(--glow-x, 50%)`) are the resting state.
 * `data-fx` is "on" while the effect is live and "off" where it is not allowed (see
 * `pointerFxEnabled`), so a stylesheet can also tell the two apart. Nothing is listened to when the
 * effect is off. Only mouse pointers count: touch and pen are ignored. No React state changes on a
 * pointer move; the work is one write per animation frame.
 */
export function useTilt<T extends HTMLElement>(options: TiltOptions = {}): RefObject<T | null> {
  const maxDeg = options.maxDeg ?? DEFAULT_TILT_DEG;
  const enabled = usePointerFx();
  return useAttachedRef<T>(
    (element) => (enabled ? followMouse(element, maxDeg) : markOff(element)),
    [enabled, maxDeg],
  );
}
