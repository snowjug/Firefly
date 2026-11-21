// Adaptive effects. Decorative effects (particles, blur, shaders, pointer trails) cost more than a
// weak machine can spare, so each one has a budget by tier: a first guess from what the browser
// reports about the device, then a frame monitor that steps down when the page really struggles.
// The tier only ever goes down while a page is open (it never climbs back, so it cannot flap), and
// it never changes what the app does, only how much decoration is drawn.

export type PerfTier = 'high' | 'medium' | 'low';

/** Best first: the position in this list is the tier's rank. */
export const PERF_TIERS: readonly PerfTier[] = ['high', 'medium', 'low'];

/** 0 for high, 1 for medium and 2 for low: a higher rank is a cheaper tier. */
export const tierRank = (tier: PerfTier): number => PERF_TIERS.indexOf(tier);

export interface PerfEnv {
  hardwareConcurrency?: number;
  /** Gigabytes, as `navigator.deviceMemory` reports them (a rounded figure, at most 8). */
  deviceMemory?: number;
  saveData?: boolean;
  coarsePointer: boolean;
  devicePixelRatio: number;
}

/** A number the browser actually reported: finite and above zero. Anything else is "unknown". */
const known = (value: number | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;

/**
 * The first guess. Data saver is a request to spend less, so it wins; a device with two cores or
 * 2 GB or less is low; four cores or 4 GB or less, or a touch screen as the main pointer, is
 * medium; the rest is high. Anything the browser does not report (Safari has no deviceMemory)
 * counts as no evidence either way rather than as a weak device.
 */
export function initialTier(env: PerfEnv): PerfTier {
  if (env.saveData) return 'low';
  const memory = known(env.deviceMemory);
  const cores = known(env.hardwareConcurrency);
  if ((memory !== undefined && memory <= 2) || (cores !== undefined && cores <= 2)) return 'low';
  if (
    (memory !== undefined && memory <= 4) ||
    (cores !== undefined && cores <= 4) ||
    env.coarsePointer
  ) {
    return 'medium';
  }
  return 'high';
}

export interface EffectBudget {
  /** Floating particles. */
  readonly motes: number;
  /** The most device pixels per CSS pixel a canvas should use. */
  readonly dprCap: number;
  /** Backdrop blur and other blurs that cost a lot to paint. */
  readonly blur: boolean;
  /** The background shader. */
  readonly shader: boolean;
  /** How large the shader renders, as a share of the screen (it is scaled up to fit). */
  readonly shaderScale: number;
  /** Cursor-following effects. */
  readonly pointerEffects: boolean;
  /** Connecting threads and lines. */
  readonly filaments: number;
}

const BUDGETS: Record<PerfTier, EffectBudget> = {
  high: Object.freeze({
    motes: 120,
    dprCap: 2,
    blur: true,
    shader: true,
    shaderScale: 1,
    pointerEffects: true,
    filaments: 14,
  }),
  medium: Object.freeze({
    motes: 70,
    dprCap: 1.5,
    blur: true,
    shader: true,
    shaderScale: 0.6,
    pointerEffects: true,
    filaments: 8,
  }),
  low: Object.freeze({
    motes: 24,
    dprCap: 1,
    blur: false,
    shader: false,
    shaderScale: 0.5,
    pointerEffects: false,
    filaments: 3,
  }),
};

/**
 * What each effect may use at a tier. The objects are shared and frozen, and an unknown tier gets
 * the cheapest budget.
 */
export function tierBudget(tier: PerfTier): EffectBudget {
  return BUDGETS[tier] ?? BUDGETS.low;
}

/** The device pixel ratio a canvas should render at: the screen's own, within the tier's cap. */
export function effectiveDpr(env: Pick<PerfEnv, 'devicePixelRatio'>, tier: PerfTier): number {
  const ratio = known(env.devicePixelRatio) ?? 1;
  return Math.min(Math.max(1, ratio), tierBudget(tier).dprCap);
}

// ------------------------------------------------------------------------------------------
// Reading the environment

/** The parts of `window` that are read, so this can be used (and tested) without a real one. */
export interface PerfSource {
  navigator?: {
    hardwareConcurrency?: number;
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  matchMedia?: (query: string) => { matches: boolean };
  devicePixelRatio?: number;
}

/** Reads what the browser says about the device. Anything it does not report is left out. */
export function readPerfEnv(source?: PerfSource): PerfEnv {
  const navigator = source?.navigator;
  let coarsePointer = false;
  try {
    coarsePointer = source?.matchMedia?.('(pointer: coarse)').matches === true;
  } catch {
    coarsePointer = false;
  }
  return {
    hardwareConcurrency: navigator?.hardwareConcurrency,
    deviceMemory: navigator?.deviceMemory,
    saveData: navigator?.connection?.saveData === true,
    coarsePointer,
    devicePixelRatio: known(source?.devicePixelRatio) ?? 1,
  };
}

/** `?perf=low|medium|high` in the address pins a tier, so each can be tried on any machine. */
export function forcedTierFromSearch(search: string): PerfTier | null {
  const value = new URLSearchParams(search).get('perf')?.toLowerCase();
  return PERF_TIERS.find((tier) => tier === value) ?? null;
}

// ------------------------------------------------------------------------------------------
// The frame monitor

/** A median frame time above this (about 45 fps) costs one tier... */
export const SLOW_FRAME_MS = 22;
/** ...and above this (about 25 fps) goes straight to low. */
export const VERY_SLOW_FRAME_MS = 40;
export const DEFAULT_WINDOW_MS = 1500;
/** The monitor stops, satisfied, after this many windows in a row without a step down. */
export const STEADY_WINDOWS = 5;
/** A window needs this many frames to count, unless it has run three times as long. */
const MIN_FRAMES = 3;
/** A longer gap between frames means the page was suspended, not slow, so it is not a sample. */
const MAX_FRAME_GAP_MS = 2000;

export interface FrameMonitorOptions {
  now(): number;
  requestFrame(callback: () => void): number;
  cancelFrame(id: number): void;
  isHidden(): boolean;
  onDegrade(next: PerfTier, reason: string): void;
  start: PerfTier;
  windowMs?: number;
}

export interface FrameMonitor {
  start(): void;
  stop(): void;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] as number)
    : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

/**
 * Watches the gaps between animation frames in windows (1.5 s by default) and steps the tier down
 * when the median is too long: above 22 ms drops one tier, above 40 ms drops straight to low. The
 * median shrugs off the odd long frame. Windows in which the page was hidden, or paused for longer
 * than two seconds, say nothing about speed and are thrown away. It never steps back up, and it
 * stops itself once the page has stayed steady for five windows in a row or has reached low.
 */
export function createFrameMonitor(options: FrameMonitorOptions): FrameMonitor {
  const windowMs =
    options.windowMs !== undefined && Number.isFinite(options.windowMs) && options.windowMs > 0
      ? options.windowMs
      : DEFAULT_WINDOW_MS;

  let tier = options.start;
  let running = false;
  let pending: number | null = null;
  let windowStart: number | null = null;
  let lastFrame: number | null = null;
  let gaps: number[] = [];
  let steady = 0;

  const startWindow = (at: number | null) => {
    windowStart = at;
    lastFrame = at;
    gaps = [];
  };

  const stop = () => {
    running = false;
    if (pending !== null) options.cancelFrame(pending);
    pending = null;
  };

  const closeWindow = (at: number, elapsed: number) => {
    const frames = gaps;
    startWindow(at);
    if (frames.length === 0) return;
    const typical = median(frames);
    if (typical <= SLOW_FRAME_MS) {
      steady += 1;
      if (steady >= STEADY_WINDOWS) stop();
      return;
    }
    steady = 0;
    const verySlow = typical > VERY_SLOW_FRAME_MS;
    const next: PerfTier = verySlow ? 'low' : (PERF_TIERS[tierRank(tier) + 1] ?? 'low');
    tier = next;
    const limit = verySlow ? VERY_SLOW_FRAME_MS : SLOW_FRAME_MS;
    options.onDegrade(
      next,
      `Median frame time ${typical.toFixed(1)} ms over ${(elapsed / 1000).toFixed(1)} s, ` +
        `above the ${limit} ms limit; moving to ${next} effects`,
    );
    if (next === 'low') stop();
  };

  const onFrame = () => {
    pending = null;
    if (!running) return;
    const at = options.now();
    if (options.isHidden()) {
      startWindow(null);
    } else if (windowStart === null || lastFrame === null) {
      startWindow(at);
    } else {
      const gap = at - lastFrame;
      if (gap > MAX_FRAME_GAP_MS) startWindow(at);
      else {
        if (gap > 0) gaps.push(gap);
        lastFrame = at;
        const elapsed = at - windowStart;
        if (elapsed >= windowMs && (gaps.length >= MIN_FRAMES || elapsed >= windowMs * 3)) {
          closeWindow(at, elapsed);
        }
      }
    }
    if (running) pending = options.requestFrame(onFrame);
  };

  return {
    start() {
      if (running || tier === 'low') return;
      running = true;
      steady = 0;
      startWindow(null);
      pending = options.requestFrame(onFrame);
    },
    stop,
  };
}
