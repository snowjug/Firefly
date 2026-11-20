// What the field should look like, and the one-off events it should show. A plain module (no React):
// pages write to it, and the draw loop reads it every frame without a single re-render. It is small
// on purpose, because it ships in the first download while the field itself loads later.

export interface WorldPose {
  /** How compressed and sharp the room is, 0 to 1 (same meaning as `atmosphere.ts`). */
  tension: number;
  /** How much space there is, 0 to 1. */
  open: number;
  /** From cool to warm, 0 to 1. */
  warmth: number;
  /** How quick the movement is, 0 to 1. */
  energy: number;
  /** How present the field is overall, 0 to 1. Each route has a default. */
  intensity: number;
  /** A point (0 to 1 across the window) the field leans toward, such as where a discovery was made. */
  focus?: { x: number; y: number } | null;
  /** Easing back: slower, re-aligning, cooler. */
  recovering?: boolean;
}

export type WorldPulseKind = 'discovery' | 'curveball';
export interface WorldPoint {
  x: number;
  y: number;
}

/** The calm room, which is also what the field does before anything has said otherwise. */
export const NEUTRAL_POSE: Readonly<WorldPose> = Object.freeze({
  tension: 0.08,
  open: 1,
  warmth: 0.42,
  energy: 0.22,
  intensity: 0.2,
  focus: null,
  recovering: false,
});

const KEYS = ['tension', 'open', 'warmth', 'energy', 'intensity'] as const;

const unit = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;

/** A complete pose from a partial one: every number finite and inside 0..1, nothing left over. */
export function normalizePose(pose: Partial<WorldPose>, fallback: WorldPose): WorldPose {
  const out: WorldPose = { ...fallback };
  for (const key of KEYS) out[key] = unit(pose[key], fallback[key]);
  if (pose.focus === null) out.focus = null;
  else if (pose.focus && typeof pose.focus === 'object') {
    const x = pose.focus.x;
    const y = pose.focus.y;
    out.focus =
      Number.isFinite(x) && Number.isFinite(y) ? { x: unit(x, 0.5), y: unit(y, 0.5) } : null;
  }
  if (typeof pose.recovering === 'boolean') out.recovering = pose.recovering;
  return out;
}

interface Layer {
  pose: Partial<WorldPose> | null;
}

export interface PoseLayer {
  /** Changes what this layer asks for. `null` asks for nothing (the layer keeps its place). */
  set(pose: Partial<WorldPose> | null): void;
  /** Takes the layer away; whatever was under it shows again. */
  remove(): void;
}

let base: WorldPose = NEUTRAL_POSE;
const layers: Layer[] = [];
const listeners = new Set<() => void>();
let current: WorldPose = base;
let version = 0;

function recompute() {
  let next: Partial<WorldPose> = base;
  // Later layers win, key by key, so a page that only sets the mood keeps the route's intensity.
  for (const layer of layers) if (layer.pose) next = { ...next, ...definedOnly(layer.pose) };
  current = normalizePose(next, NEUTRAL_POSE);
  version += 1;
  for (const listener of [...listeners]) listener();
}

function definedOnly(pose: Partial<WorldPose>): Partial<WorldPose> {
  const out: Partial<WorldPose> = {};
  // Anything that is not a real number (or a boolean, or a point) asks for nothing: the route's own
  // value shows through, rather than some other room.
  for (const key of KEYS) {
    const value = pose[key];
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  }
  if (typeof pose.recovering === 'boolean') out.recovering = pose.recovering;
  if (pose.focus !== undefined) out.focus = pose.focus;
  return out;
}

/** The route's own pose, under every page's request. The shell sets it when the address changes. */
export function setBasePose(pose: WorldPose): void {
  base = normalizePose(pose, NEUTRAL_POSE);
  recompute();
}

/** A new request on top of the stack. The last one added wins; removing it restores the one below. */
export function addPoseLayer(): PoseLayer {
  const layer: Layer = { pose: null };
  layers.push(layer);
  return {
    set(pose) {
      layer.pose = pose;
      recompute();
    },
    remove() {
      const at = layers.indexOf(layer);
      if (at < 0) return;
      layers.splice(at, 1);
      recompute();
    },
  };
}

/** The pose the field should take now. The same object is returned until something changes. */
export const getPose = (): WorldPose => current;
/** A number that goes up whenever the pose changes, so a loop can tell cheaply. */
export const getPoseVersion = (): number => version;

export function subscribePose(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

type PulseSink = (kind: WorldPulseKind, at?: WorldPoint) => void;
let sink: PulseSink | null = null;

/** The field says it is animating and can show a pulse. Returns a function that takes it back. */
export function setPulseSink(next: PulseSink): () => void {
  sink = next;
  return () => {
    if (sink === next) sink = null;
  };
}

/** One short event. A no-op unless a field is animating, so a page can call it without checking. */
export function emitPulse(kind: WorldPulseKind, at?: WorldPoint): void {
  sink?.(kind, at);
}

/** Back to the start. For tests. */
export function resetWorldStore(): void {
  base = NEUTRAL_POSE;
  layers.length = 0;
  listeners.clear();
  sink = null;
  current = base;
  version = 0;
}
