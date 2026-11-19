// The Firefly Core: a small, original Canvas 2D visual used as the product's "presence". It has no
// dependencies and no WebGL. The engine below is framework-free so it can be unit tested with a
// recording context; FireflyCore.tsx owns the lifecycle (visibility, reduced motion, resize).

export type CoreMood = 'neutral' | 'calm' | 'concerned' | 'frustrated' | 'angry' | 'escalating';
export type CoreTone = 'rising' | 'steady' | 'falling';
export type CoreQuality = 'full' | 'low';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface CorePalette {
  /** Warm light at the heart of the core (the "firefly"). */
  nucleus: Rgb;
  /** Cool secondary light used by the rim rings. */
  mist: Rgb;
  /** Light used for the halo and filaments for each mood. */
  moods: Record<CoreMood, Rgb>;
  /** Colour of a signal that has not been found yet. */
  dormant: Rgb;
  /** Additive blending suits dark surfaces; light surfaces use ordinary alpha blending. */
  additive: boolean;
}

export interface MoodParams {
  /** Orbit speed multiplier. */
  tempo: number;
  /** How unstable the filaments are (0 calm .. 1 agitated). */
  jitter: number;
  /** Breathing frequency of the halo in hertz. Kept well under 1 Hz: nothing ever flashes. */
  breath: number;
  /** Orbit size factor: calm is open and spacious, escalating is compressed. */
  spread: number;
  /** Halo strength. */
  halo: number;
}

// Calm is open, slow and stable; escalating is tight and tense but never strobes or flashes.
export const MOOD_PARAMS: Readonly<Record<CoreMood, MoodParams>> = {
  neutral: { tempo: 0.8, jitter: 0.1, breath: 0.16, spread: 1, halo: 0.8 },
  calm: { tempo: 0.7, jitter: 0.08, breath: 0.14, spread: 1.05, halo: 0.85 },
  concerned: { tempo: 1, jitter: 0.16, breath: 0.24, spread: 0.96, halo: 0.9 },
  frustrated: { tempo: 1.3, jitter: 0.28, breath: 0.34, spread: 0.9, halo: 0.95 },
  angry: { tempo: 1.55, jitter: 0.4, breath: 0.42, spread: 0.84, halo: 1 },
  escalating: { tempo: 1.8, jitter: 0.52, breath: 0.5, spread: 0.78, halo: 1 },
};

/** The subset of CanvasRenderingContext2D the engine uses, so tests can supply a recording stub. */
export type Ctx2D = Pick<
  CanvasRenderingContext2D,
  | 'setTransform'
  | 'clearRect'
  | 'beginPath'
  | 'arc'
  | 'ellipse'
  | 'moveTo'
  | 'bezierCurveTo'
  | 'fill'
  | 'stroke'
  | 'createRadialGradient'
  | 'createLinearGradient'
> & {
  fillStyle: CanvasRenderingContext2D['fillStyle'];
  strokeStyle: CanvasRenderingContext2D['strokeStyle'];
  lineWidth: number;
  lineCap: CanvasRenderingContext2D['lineCap'];
  globalCompositeOperation: CanvasRenderingContext2D['globalCompositeOperation'];
};

const TAU = Math.PI * 2;
const STATIC_TIME = 2.6;
const MAX_SIGNALS = 24;

export interface Signal {
  orbit: number;
  flat: number;
  tilt: number;
  phase: number;
  speed: number;
  size: number;
  /** 0 = dormant, 1 = found. Animated towards the target. */
  lit: number;
}

interface Burst {
  index: number;
  startedAt: number;
}

interface Live {
  tempo: number;
  jitter: number;
  breath: number;
  spread: number;
  halo: number;
  color: Rgb;
}

interface Placed {
  signal: Signal;
  x: number;
  y: number;
  z: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const mix = (a: Rgb, b: Rgb, t: number): Rgb => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
});
const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const rgba = (c: Rgb, a: number) =>
  `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${clamp01(a).toFixed(3)})`;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic orbits for `total` signals, spread evenly across the available radii. */
export function buildSignals(total: number, seed = 7): Signal[] {
  const rand = mulberry32(seed);
  const count = Math.max(0, Math.min(MAX_SIGNALS, Math.floor(total)));
  const signals: Signal[] = [];
  for (let i = 0; i < count; i += 1) {
    const orbit = 0.42 + 0.44 * ((i * 0.618034) % 1);
    signals.push({
      orbit,
      flat: 0.38 + 0.3 * rand(),
      tilt: rand() * Math.PI,
      phase: rand() * TAU,
      speed: (0.5 + 0.35 * rand()) / Math.pow(orbit, 0.7),
      size: 0.016 + 0.006 * rand(),
      lit: 0,
    });
  }
  return signals;
}

export class CoreEngine {
  private palette: CorePalette;
  private quality: CoreQuality;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private mood: CoreMood = 'neutral';
  private tone: CoreTone = 'steady';
  private thinking = false;
  private live: Live;
  private target: Live;
  private signals: Signal[] = [];
  private litTarget = 0;
  private clock = 0;
  private orbitT = 0;
  private energy = 0;
  private flare = 0;
  private bursts: Burst[] = [];
  private lastNow: number | null = null;

  constructor(palette: CorePalette, quality: CoreQuality = 'full') {
    this.palette = palette;
    this.quality = quality;
    this.target = this.computeTarget();
    this.live = { ...this.target, color: { ...this.target.color } };
  }

  setPalette(palette: CorePalette): void {
    this.palette = palette;
    this.target = this.computeTarget();
  }

  setQuality(quality: CoreQuality): void {
    this.quality = quality;
  }

  getQuality(): CoreQuality {
    return this.quality;
  }

  setMood(mood: CoreMood, tone: CoreTone = 'steady'): void {
    this.mood = mood;
    this.tone = tone;
    this.target = this.computeTarget();
  }

  setThinking(thinking: boolean): void {
    this.thinking = thinking;
    this.target = this.computeTarget();
  }

  setSignals(total: number, lit: number): void {
    const count = Math.max(0, Math.min(MAX_SIGNALS, Math.floor(total)));
    if (this.signals.length !== count) {
      const previous = this.signals;
      this.signals = buildSignals(count).map((signal, i) => ({
        ...signal,
        lit: previous[i]?.lit ?? 0,
      }));
    }
    this.litTarget = Math.max(0, Math.min(count, Math.floor(lit)));
  }

  /** A short swell of energy, for example when the customer speaks. */
  pulse(strength = 0.55): void {
    this.energy = Math.min(1, this.energy + strength);
  }

  /** The most recently lit signal flares: a ring around it and a brief swell of the core. */
  discover(): void {
    if (this.signals.length === 0) return;
    const index = Math.max(0, Math.min(this.signals.length - 1, this.litTarget - 1));
    this.bursts.push({ index, startedAt: this.clock });
    this.flare = 1;
  }

  resize(width: number, height: number, dpr: number): void {
    this.width = Math.max(0, width);
    this.height = Math.max(0, height);
    this.dpr = Math.max(1, dpr);
  }

  /** Advance the simulation and draw one frame. `now` is a high-resolution timestamp in ms. */
  frame(ctx: Ctx2D, now: number): void {
    const elapsed = this.lastNow === null ? 1000 / 60 : now - this.lastNow;
    this.lastNow = now;
    this.step(Math.min(0.064, Math.max(0, elapsed / 1000)));
    this.draw(ctx);
  }

  /** Forget the previous timestamp (call when the loop restarts after a pause). */
  resetClock(): void {
    this.lastNow = null;
  }

  /** One calm, fixed frame with no animation. Used for reduced motion and as a first paint. */
  drawStatic(ctx: Ctx2D): void {
    this.target = this.computeTarget();
    this.live = { ...this.target, color: { ...this.target.color } };
    for (let i = 0; i < this.signals.length; i += 1) {
      const signal = this.signals[i];
      if (signal) signal.lit = i < this.litTarget ? 1 : 0;
    }
    this.bursts = [];
    this.energy = 0;
    this.flare = 0;
    this.clock = STATIC_TIME;
    this.orbitT = STATIC_TIME * this.live.tempo;
    this.draw(ctx);
  }

  /** Test helper: the current smoothed parameters. */
  snapshot(): { tempo: number; jitter: number; spread: number; lit: number[]; bursts: number } {
    return {
      tempo: this.live.tempo,
      jitter: this.live.jitter,
      spread: this.live.spread,
      lit: this.signals.map((signal) => signal.lit),
      bursts: this.bursts.length,
    };
  }

  private computeTarget(): Live {
    const base = MOOD_PARAMS[this.mood];
    let { tempo, jitter, spread } = base;
    if (this.tone === 'falling') {
      jitter *= 0.65;
      tempo *= 0.92;
    } else if (this.tone === 'rising') {
      jitter *= 1.12;
    }
    if (this.thinking) {
      tempo *= 1.7;
      spread *= 0.82;
    }
    return {
      tempo,
      jitter,
      breath: base.breath,
      spread,
      halo: base.halo,
      color: this.palette.moods[this.mood],
    };
  }

  private step(dt: number): void {
    const k = 1 - Math.exp(-dt / 0.55);
    const { live, target } = this;
    live.tempo += (target.tempo - live.tempo) * k;
    live.jitter += (target.jitter - live.jitter) * k;
    live.breath += (target.breath - live.breath) * k;
    live.spread += (target.spread - live.spread) * k;
    live.halo += (target.halo - live.halo) * k;
    live.color = mix(live.color, target.color, k);
    this.clock += dt;
    this.orbitT += dt * live.tempo;
    this.energy *= Math.exp(-dt / 0.8);
    this.flare *= Math.exp(-dt / 0.6);
    const lk = 1 - Math.exp(-dt / 0.25);
    for (let i = 0; i < this.signals.length; i += 1) {
      const signal = this.signals[i];
      if (signal) signal.lit += ((i < this.litTarget ? 1 : 0) - signal.lit) * lk;
    }
    this.bursts = this.bursts.filter((burst) => this.clock - burst.startedAt < 1.1);
  }

  private position(
    signal: Signal,
    R: number,
    phaseOffset = 0,
  ): { x: number; y: number; z: number } {
    const angle = signal.phase + phaseOffset + this.orbitT * signal.speed;
    const a = R * signal.orbit * this.live.spread;
    const ex = Math.cos(angle) * a;
    const ey = Math.sin(angle) * a * signal.flat;
    const cos = Math.cos(signal.tilt);
    const sin = Math.sin(signal.tilt);
    return { x: ex * cos - ey * sin, y: ex * sin + ey * cos, z: Math.sin(angle) };
  }

  private draw(ctx: Ctx2D): void {
    const { width: w, height: h, palette, live } = this;
    if (w <= 0 || h <= 0) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) / 2;
    const add = palette.additive;
    const mood = live.color;
    const breath = Math.sin(this.clock * TAU * live.breath);
    ctx.globalCompositeOperation = add ? 'lighter' : 'source-over';

    // Halo: the colour of the customer's state, breathing slowly.
    const haloR = R * 0.92 * (1 + 0.03 * breath + 0.06 * this.energy);
    const haloA = (add ? 0.3 : 0.2) * live.halo * (1 + 0.15 * breath + 0.5 * this.energy);
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR);
    halo.addColorStop(0, rgba(mix(mood, palette.nucleus, 0.35), haloA));
    halo.addColorStop(0.45, rgba(mood, haloA * 0.45));
    halo.addColorStop(1, rgba(mood, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, haloR, 0, TAU);
    ctx.fill();

    const placed: Placed[] = this.signals.map((signal) => ({
      signal,
      ...this.position(signal, R),
    }));
    for (const item of placed) if (item.z < 0) this.drawSignal(ctx, item, cx, cy, R);

    this.drawFilaments(ctx, cx, cy, R);
    this.drawRings(ctx, cx, cy, R);

    const nr = R * 0.075 * (1 + 0.06 * breath + 0.35 * this.flare + 0.12 * this.energy);
    const nucleus = ctx.createRadialGradient(cx, cy, 0, cx, cy, nr * 3.4);
    nucleus.addColorStop(0, rgba(mix(palette.nucleus, WHITE, add ? 0.75 : 0.3), 1));
    nucleus.addColorStop(0.35, rgba(palette.nucleus, 0.95));
    nucleus.addColorStop(1, rgba(mood, 0));
    ctx.fillStyle = nucleus;
    ctx.beginPath();
    ctx.arc(cx, cy, nr * 3.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba(mix(palette.nucleus, WHITE, add ? 0.9 : 0.55), 0.95);
    ctx.beginPath();
    ctx.arc(cx, cy, nr * 0.55, 0, TAU);
    ctx.fill();

    for (const item of placed) if (item.z >= 0) this.drawSignal(ctx, item, cx, cy, R);

    this.drawBursts(ctx, cx, cy, R, placed);
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawFilaments(ctx: Ctx2D, cx: number, cy: number, R: number): void {
    const { live } = this;
    const count = this.quality === 'full' ? 7 : 4;
    const amp = R * (0.05 + live.jitter * 0.16) * (1 + 0.8 * this.energy);
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.1;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * TAU + this.orbitT * 0.12;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const px = -dy;
      const py = dx;
      const speed = 0.7 + i * 0.13;
      const wob1 = Math.sin(this.clock * speed * (0.6 + live.tempo * 0.5) + i * 1.7);
      const wob2 = Math.cos(this.clock * speed * 0.8 * (0.6 + live.tempo * 0.5) + i * 2.3);
      const curl = R * 0.12 * (i % 2 === 0 ? 1 : -1);
      const len = R * (0.62 + 0.14 * Math.sin(i * 2.1 + this.clock * 0.3));
      const x0 = cx + dx * R * 0.09;
      const y0 = cy + dy * R * 0.09;
      const x3 = x0 + dx * len + px * curl * 1.6 + px * amp * wob1;
      const y3 = y0 + dy * len + py * curl * 1.6 + py * amp * wob1;
      const gradient = ctx.createLinearGradient(x0, y0, x3, y3);
      gradient.addColorStop(0, rgba(live.color, 0.55 * (0.8 + 0.5 * this.energy)));
      gradient.addColorStop(1, rgba(live.color, 0));
      ctx.strokeStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.bezierCurveTo(
        x0 + dx * len * 0.35 + px * amp * wob1 * 1.2,
        y0 + dy * len * 0.35 + py * amp * wob1 * 1.2,
        x0 + dx * len * 0.7 + px * (amp * wob2 * 1.6 + curl),
        y0 + dy * len * 0.7 + py * (amp * wob2 * 1.6 + curl),
        x3,
        y3,
      );
      ctx.stroke();
    }
  }

  private drawRings(ctx: Ctx2D, cx: number, cy: number, R: number): void {
    const { palette } = this;
    const rings = this.quality === 'full' ? 2 : 1;
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    for (let k = 0; k < rings; k += 1) {
      const rx = R * (0.2 + 0.07 * k) * this.live.spread;
      const ry = rx * (0.42 + 0.1 * k);
      const rotation = this.orbitT * (0.25 - 0.4 * k);
      ctx.strokeStyle = rgba(k === 0 ? palette.nucleus : palette.mist, 0.38);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, rotation, k, k + 4.2);
      ctx.stroke();
    }
  }

  private drawSignal(ctx: Ctx2D, item: Placed, cx: number, cy: number, R: number): void {
    const { signal, x, y, z } = item;
    const size = R * signal.size * (0.8 + 0.2 * z);
    const px = cx + x;
    const py = cy + y;
    const lit = clamp01(signal.lit);
    if (lit < 0.98) {
      // Dormant: a faint ring and dot that carries no information beyond "something is here".
      const alpha = (1 - lit) * (0.34 + 0.08 * (z + 1));
      ctx.strokeStyle = rgba(this.palette.dormant, alpha);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, size * 1.5, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = rgba(this.palette.dormant, alpha * 0.8);
      ctx.beginPath();
      ctx.arc(px, py, size * 0.5, 0, TAU);
      ctx.fill();
    }
    if (lit > 0.02) {
      const glow = ctx.createRadialGradient(px, py, 0, px, py, size * 6);
      glow.addColorStop(0, rgba(mix(this.palette.nucleus, WHITE, 0.6), lit));
      glow.addColorStop(0.25, rgba(this.palette.nucleus, lit * 0.6));
      glow.addColorStop(1, rgba(this.palette.nucleus, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, py, size * 6, 0, TAU);
      ctx.fill();
      if (this.quality === 'full') {
        const direction = signal.speed >= 0 ? 1 : -1;
        for (let t = 1; t <= 4; t += 1) {
          const trail = this.position(signal, R, -t * 0.09 * direction);
          ctx.fillStyle = rgba(this.palette.nucleus, lit * (0.4 - t * 0.085));
          ctx.beginPath();
          ctx.arc(cx + trail.x, cy + trail.y, size * (0.8 - t * 0.12), 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  private drawBursts(ctx: Ctx2D, cx: number, cy: number, R: number, placed: Placed[]): void {
    ctx.lineWidth = 1.5;
    for (const burst of this.bursts) {
      const progress = clamp01((this.clock - burst.startedAt) / 1.1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const target = placed[burst.index];
      if (target) {
        ctx.strokeStyle = rgba(this.palette.nucleus, (1 - progress) * 0.8);
        ctx.beginPath();
        ctx.arc(cx + target.x, cy + target.y, R * 0.02 + eased * R * 0.14, 0, TAU);
        ctx.stroke();
      }
      ctx.strokeStyle = rgba(this.palette.nucleus, (1 - progress) * 0.3);
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.1 + eased * R * 0.55, 0, TAU);
      ctx.stroke();
    }
  }
}
