import { useEffect, useRef, useState } from 'react';
import {
  POSE_KEYS,
  omegaFor,
  posesEqual,
  restingState,
  settleSeconds,
  stepPose,
  type Pose,
  type PoseState,
} from './poses.ts';

export interface TweenOptions {
  /** Go straight to the target and run no loop: reduced motion, a frozen render, the lowest tier. */
  instant: boolean;
  /** Seconds a move should take. Default: quick when tension rises, slow when it eases. */
  seconds?: (from: Pose, to: Pose) => number;
  /** Called once when a move has come to rest. */
  onSettled?: () => void;
}

/** A gap longer than this between two frames means the tab was hidden: do not replay the move. */
const RESUME_GAP_SECONDS = 0.25;

/**
 * The pose to draw now, gliding towards `target`. There is exactly one animation-frame loop and it
 * only runs while the pose is still moving: once everything has come to rest it stops, and an
 * unchanged pose costs nothing. Retargeting mid-move keeps the speed, so a change of mood is never
 * a jump. `target` must keep its identity while its numbers do not change.
 */
export function useTween(target: Pose, options: TweenOptions): Pose {
  const { instant, seconds = settleSeconds, onSettled } = options;
  const [shown, setShown] = useState<Pose>(target);
  const [wasInstant, setWasInstant] = useState(instant);
  const motion = useRef<PoseState | null>(null);
  const settled = useRef(onSettled);

  // Coming back from an instant stretch, carry on from the pose that was being shown.
  if (wasInstant !== instant) {
    setWasInstant(instant);
    if (!instant) setShown(target);
  }

  useEffect(() => {
    settled.current = onSettled;
  }, [onSettled]);

  useEffect(() => {
    if (instant) {
      motion.current = restingState(target);
      return;
    }
    const from = (motion.current ??= restingState(target));
    const resting = POSE_KEYS.every((key) => Math.abs(from.velocity[key]) < 1e-6);
    if (resting && posesEqual(from.pose, target)) return;
    const omega = omegaFor(seconds(from.pose, target));
    let last = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const resumed = dt > RESUME_GAP_SECONDS;
      const next = resumed
        ? { ...restingState(target), settled: true }
        : stepPose(motion.current ?? from, target, dt, omega);
      motion.current = { pose: next.pose, velocity: next.velocity };
      setShown(next.pose);
      if (next.settled) {
        settled.current?.();
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, instant, seconds]);

  return instant ? target : shown;
}
