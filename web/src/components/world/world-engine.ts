import { onPointerFrame } from '../../lib/motion/pointer.ts';
import {
  PERF_TIERS,
  createFrameMonitor,
  forcedTierFromSearch,
  tierRank,
  type FrameMonitor,
  type PerfTier,
} from '../../lib/perf-tier.ts';
import { STILL_BELOW } from './route-poses.ts';
import {
  drawWorld,
  readPalette,
  spanFor,
  windowToField,
  type Palette,
  type PointerLight,
  type View,
} from './world-draw.ts';
import {
  carryOver,
  createWorld,
  isSettled,
  settleWorld,
  startPulse,
  stepWorld,
  type World,
} from './world-model.ts';
import { getPose, setPulseSink, subscribePose, type WorldPose } from './world-store.ts';

// Runs the field: owns the canvas, the one animation loop, and everything that can make the loop
// stop. It animates only while the tier allows it, the tab is visible, ambient motion is not paused
// (which includes reduced motion) and the route wants more than a whisper. Otherwise it draws one
// still frame, so the page is never blank, and waits. React only hands it the configuration; no frame
// goes through a re-render.

export interface EngineConfig {
  tier: PerfTier;
  /** Ambient motion is paused (by choice, or because reduced motion is on). */
  paused: boolean;
  /** A precise, hovering pointer: strands near it may brighten. */
  fine: boolean;
}

export interface Engine {
  configure(config: EngineConfig): void;
  destroy(): void;
}

/** What `window.__fireflyWorld` reports when the address has `?worldstats=1`. */
export interface WorldStats {
  frames: number;
  /** The field's own cost per frame (its script and its drawing calls), in milliseconds. */
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  tier: PerfTier;
  strands: number;
  points: number;
  mode: 'running' | 'still' | 'off';
  /** The event being shown (0 none, 1 discovery, 2 curveball), how far into it, strands it found. */
  pulse: { kind: number; age: number; found: number } | null;
  reset(): void;
}

const SEED = 20260;
/** Below this the field is not drawn at all. */
const OFF_BELOW = 0.02;
const MAX_DPR: Record<PerfTier, number> = { high: 1.5, medium: 1.25, low: 1 };
/** Milliseconds between drawn frames: quick states 60 a second, calm ones 30, near-still ones 15. */
const FAST_MS = 15;
const CALM_MS = 31;
const SLOW_MS = 62;
/** The field steps down by itself when its own work averages above this (2.4 times its budget). */
const SELF_BUDGET_MS = 6;
const SELF_WARMUP = 45;
const SELF_WINDOW = 60;
/** Frame times are watched from this long after the loop starts, or the mood changes a lot. */
const GRACE_MS = 2500;
const MOOD_SHIFT = 0.25;

/** The cheapest tier any field on this page has had to fall to. It never climbs back. */
let floor: PerfTier = 'high';
export const resetEngineFloor = () => {
  floor = 'high';
};

export function createEngine(canvas: HTMLCanvasElement): Engine | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // `?perf=` pins the tier for trying each one, and a pinned tier stays put (see PerfTierProvider).
  const pinned = forcedTierFromSearch(window.location.search) !== null;
  let cfg: EngineConfig = { tier: 'low', paused: true, fine: false };
  let tier: PerfTier = 'low';
  let world: World | null = null;
  let palette: Palette = readPalette();
  const view: View = { w: 0, h: 0, dpr: 1, span: 1 };
  let alive = false;
  let running = false;
  let frame = 0;
  let queued = 0;
  let last = 0;
  let owed = 0;
  let cost = 0;
  let samples = 0;
  let watched = 0;
  let grace = 0;
  let monitor: FrameMonitor | null = null;
  let stopPulses: (() => void) | null = null;
  let stopPointer: (() => void) | null = null;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, k: 0, seen: -1e9 };
  let lens = false;
  const forced = window.matchMedia?.('(forced-colors: active)');
  const scratch: WorldPose = { ...getPose() };
  const focusScratch = { x: 0.5, y: 0.5 };

  // ------------------------------------------------------------------ stats, only on request
  const ring = new Float32Array(240);
  let drawn = 0;
  if (/[?&]worldstats=1\b/.test(window.location.search)) {
    const read = (): WorldStats => {
      const list = Array.from(ring.subarray(0, Math.min(drawn, ring.length))).sort((a, b) => a - b);
      const at = (p: number) => list[Math.min(list.length - 1, Math.floor(list.length * p))] ?? 0;
      return {
        frames: drawn,
        avgMs: list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0,
        p50Ms: at(0.5),
        p95Ms: at(0.95),
        maxMs: list.at(-1) ?? 0,
        tier,
        strands: world?.count ?? 0,
        points: world?.size ?? 0,
        mode: !world ? 'off' : running ? 'running' : 'still',
        pulse: world
          ? { kind: world.pulse.kind, age: world.pulse.age, found: world.pulse.found }
          : null,
        reset() {
          drawn = 0;
          ring.fill(0);
        },
      };
    };
    Object.defineProperty(window, '__fireflyWorld', { configurable: true, get: read });
  }

  // ------------------------------------------------------------------ geometry and painting
  function resize() {
    const w = Math.max(1, Math.round(canvas.clientWidth));
    const h = Math.max(1, Math.round(canvas.clientHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR[tier]);
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    view.w = w;
    view.h = h;
    view.dpr = dpr;
    view.span = spanFor(w, h);
  }

  /** The pose in the field's own coordinates: a focus across the window becomes one across the run. */
  function target(): WorldPose {
    const pose = getPose();
    Object.assign(scratch, pose);
    if (pose.focus) {
      focusScratch.x = windowToField(view, pose.focus.x);
      focusScratch.y = pose.focus.y;
      scratch.focus = focusScratch;
    }
    return scratch;
  }

  function paint() {
    if (world && alive) {
      drawWorld(ctx!, world, view, palette, lens ? (pointer as PointerLight) : null);
    } else {
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  /** One still frame at the pose with no easing: while nothing moves, a state change is instant. */
  function still() {
    if (world && alive) settleWorld(world, target());
    paint();
  }

  /** Draws a still frame on the next frame, once, however many things changed meanwhile. */
  function queueStill() {
    if (running || queued) return;
    queued = requestAnimationFrame(() => {
      queued = 0;
      if (!running) still();
    });
  }

  // ------------------------------------------------------------------ keeping an eye on speed
  function unwatch() {
    window.clearTimeout(grace);
    monitor?.stop();
    monitor = null;
  }

  /** Watches frame times, after a pause: the first moments after a change are busy with other things. */
  function watch() {
    unwatch();
    if (pinned) return;
    watched = getPose().tension;
    grace = window.setTimeout(() => {
      monitor = createFrameMonitor({
        now: () => performance.now(),
        requestFrame: (callback) => requestAnimationFrame(callback),
        cancelFrame: (id) => cancelAnimationFrame(id),
        isHidden: () => document.hidden,
        onDegrade: (next, reason) => degrade(next, reason),
        start: tier,
      });
      monitor.start();
    }, GRACE_MS);
  }

  function degrade(next: PerfTier, reason: string) {
    if (import.meta.env.DEV) console.warn(`[world] stepping down to ${next}: ${reason}`);
    if (tierRank(next) > tierRank(floor)) floor = next;
    update();
  }

  // ------------------------------------------------------------------ the loop
  function tick(now: number) {
    frame = 0;
    if (!running || !world) return;
    owed += last ? Math.min(0.25, (now - last) / 1000) : 0.016;
    last = now;
    const { energy, intensity } = world.state;
    const wait =
      energy >= 0.5 || world.pulse.kind !== 0
        ? FAST_MS
        : energy * intensity < 0.07
          ? SLOW_MS
          : CALM_MS;
    if (owed * 1000 >= wait) {
      const began = performance.now();
      if (lens) {
        pointer.x += (pointer.tx - pointer.x) * 0.2;
        pointer.y += (pointer.ty - pointer.y) * 0.2;
        const wanted = began - pointer.seen < 2600 ? 1 : 0;
        pointer.k += (wanted - pointer.k) * (wanted > pointer.k ? 0.14 : 0.04);
      }
      stepWorld(world, owed, target());
      owed = 0;
      paint();
      const spent = performance.now() - began;
      ring[drawn % ring.length] = spent;
      drawn += 1;
      cost += (spent - cost) * 0.12;
      samples += 1;
      if (
        !pinned &&
        samples > SELF_WARMUP &&
        samples % SELF_WINDOW === 0 &&
        cost > SELF_BUDGET_MS
      ) {
        degrade(
          PERF_TIERS[Math.min(2, tierRank(tier) + 1)] ?? 'low',
          'the field spent too long drawing',
        );
      } else if (getPose().intensity <= STILL_BELOW && isSettled(world, target())) {
        // A quiet route needs the loop only until the field has settled into its still frame.
        update();
      }
    }
    if (running && !frame) frame = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    last = 0;
    owed = 0;
    samples = 0;
    cost = 0;
    frame = requestAnimationFrame(tick);
    stopPulses = setPulseSink((kind, at) => {
      if (world)
        startPulse(world, kind, at ? { x: windowToField(view, at.x), y: at.y } : undefined);
    });
    watch();
  }

  function halt() {
    if (!running) return;
    running = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    stopPulses?.();
    stopPulses = null;
    unwatch();
  }

  // ------------------------------------------------------------------ deciding what to do
  function update() {
    const wanted = PERF_TIERS[Math.max(tierRank(cfg.tier), tierRank(floor))] ?? 'low';
    const rebuilt = wanted !== tier || (wanted !== 'low' && !world);
    if (rebuilt) {
      halt();
      const previous = world;
      tier = wanted;
      world = wanted === 'low' ? null : createWorld(SEED, wanted);
      resize();
      // Stepping down changes how many strands there are, not the mood: the new field carries on
      // from where the old one was.
      if (world) {
        if (previous) carryOver(previous, world);
        else settleWorld(world, target());
      }
    }
    const pose = getPose();
    alive = world !== null && pose.intensity > OFF_BELOW && !forced?.matches;
    // Resizing a canvas clears it, so a new field is drawn at once rather than a frame later.
    if (rebuilt) paint();
    const moves = alive && !cfg.paused && !document.hidden;
    const settled = world !== null && isSettled(world, target());
    if (moves && (pose.intensity > STILL_BELOW || !settled)) {
      start();
      if (Math.abs(pose.tension - watched) > MOOD_SHIFT) watch();
    } else halt();

    const wantsLens = moves && cfg.fine && tier === 'high';
    if (wantsLens && !stopPointer) {
      lens = true;
      stopPointer = onPointerFrame(window, (x, y) => {
        pointer.tx = x;
        pointer.ty = y;
        if (pointer.k < 0.02) {
          pointer.x = x;
          pointer.y = y;
        }
        pointer.seen = performance.now();
      });
    } else if (!wantsLens && stopPointer) {
      stopPointer();
      stopPointer = null;
      lens = false;
      pointer.k = 0;
    }

    if (alive) canvas.setAttribute('data-live', '');
    else canvas.removeAttribute('data-live');
    if (!running) queueStill();
  }

  // ------------------------------------------------------------------ what can change it
  const unsubscribe = subscribePose(update);
  const onVisible = () => update();
  document.addEventListener('visibilitychange', onVisible);
  forced?.addEventListener('change', onVisible);

  // Painting inside the observer keeps a resize from showing even one blank frame.
  const onResize = () => {
    resize();
    if (running) paint();
    else still();
  };
  const sizeWatcher = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize);
  if (sizeWatcher) sizeWatcher.observe(canvas);
  else window.addEventListener('resize', onResize);

  const onTheme = () => {
    palette = readPalette();
    if (!running) queueStill();
  };
  const themeWatcher = new MutationObserver(onTheme);
  themeWatcher.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  const scheme = window.matchMedia?.('(prefers-color-scheme: light)');
  scheme?.addEventListener('change', onTheme);

  return {
    configure(next) {
      cfg = next;
      update();
    },
    destroy() {
      halt();
      stopPointer?.();
      if (queued) cancelAnimationFrame(queued);
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      forced?.removeEventListener('change', onVisible);
      sizeWatcher?.disconnect();
      window.removeEventListener('resize', onResize);
      themeWatcher.disconnect();
      scheme?.removeEventListener('change', onTheme);
      canvas.removeAttribute('data-live');
      world = null;
    },
  };
}
