import { useEffect, useRef } from 'react';
import {
  addPoseLayer,
  emitPulse,
  type PoseLayer,
  type WorldPoint,
  type WorldPose,
  type WorldPulseKind,
} from './world-store.ts';

export type { WorldPose } from './world-store.ts';
export { routePose } from './route-poses.ts';

/**
 * The pose this page wants while it is mounted: the call chamber passes its customer's mood here.
 * Only the keys it sets are taken over (the route keeps the rest), the field smooths the change
 * itself, and leaving the page restores what was there before. If two pages ask at once, the one
 * that mounted last wins. `null` asks for nothing.
 */
export function useWorldPose(pose: Partial<WorldPose> | null): void {
  const layer = useRef<PoseLayer | null>(null);

  useEffect(() => {
    const added = addPoseLayer();
    layer.current = added;
    return () => {
      added.remove();
      layer.current = null;
    };
  }, []);

  // The values, not the object: a new object with the same numbers must not re-send the pose.
  const present = pose !== null;
  const tension = pose?.tension;
  const open = pose?.open;
  const warmth = pose?.warmth;
  const energy = pose?.energy;
  const intensity = pose?.intensity;
  const recovering = pose?.recovering;
  const focus = pose?.focus;
  const focusKind = focus === undefined ? 0 : focus === null ? 1 : 2;
  const focusX = focus?.x;
  const focusY = focus?.y;

  useEffect(() => {
    if (!present) {
      layer.current?.set(null);
      return;
    }
    layer.current?.set({
      tension,
      open,
      warmth,
      energy,
      intensity,
      recovering,
      focus:
        focusKind === 0
          ? undefined
          : focusKind === 1
            ? null
            : { x: focusX ?? 0.5, y: focusY ?? 0.5 },
    });
  }, [present, tension, open, warmth, energy, intensity, recovering, focusKind, focusX, focusY]);
}

/**
 * One short event in the field (under a second): a discovery is a warm bloom travelling along the
 * nearby strands, a curveball kinks them and lets them settle. `at` is where it happened, 0 to 1
 * across the window. It does nothing when the field is not animating (paused, reduced motion, low
 * effects), so a page can call it without checking.
 */
export function pulseWorld(kind: WorldPulseKind, at?: WorldPoint): void {
  emitPulse(kind, at);
}
