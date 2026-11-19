import { describe, expect, it } from 'vitest';
import {
  CoreEngine,
  MOOD_PARAMS,
  buildSignals,
  type CoreMood,
  type CorePalette,
  type Ctx2D,
} from './engine.ts';
import { luminance, parseColor, readCorePalette } from './palette.ts';

const rgb = (r: number, g: number, b: number) => ({ r, g, b });
const palette = (additive = true): CorePalette => ({
  nucleus: rgb(246, 189, 94),
  mist: rgb(139, 220, 200),
  moods: {
    neutral: rgb(246, 189, 94),
    calm: rgb(127, 220, 198),
    concerned: rgb(241, 214, 107),
    frustrated: rgb(245, 159, 74),
    angry: rgb(244, 105, 76),
    escalating: rgb(232, 74, 116),
  },
  dormant: rgb(154, 167, 160),
  additive,
});

/** A context that records what was drawn and never touches a real canvas. */
function recorder() {
  const calls: string[] = [];
  const gradient = { addColorStop: () => undefined };
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    globalCompositeOperation: 'source-over',
    setTransform: () => calls.push('setTransform'),
    clearRect: () => calls.push('clearRect'),
    beginPath: () => undefined,
    arc: () => calls.push('arc'),
    ellipse: () => calls.push('ellipse'),
    moveTo: () => undefined,
    bezierCurveTo: () => calls.push('bezier'),
    fill: () => calls.push('fill'),
    stroke: () => calls.push('stroke'),
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
  } as unknown as Ctx2D;
  return { ctx, calls };
}

describe('mood parameters', () => {
  it('get steadily tenser from calm to escalating, without ever strobing', () => {
    const order: CoreMood[] = ['calm', 'concerned', 'frustrated', 'angry', 'escalating'];
    for (let i = 1; i < order.length; i += 1) {
      const before = MOOD_PARAMS[order[i - 1] as CoreMood];
      const after = MOOD_PARAMS[order[i] as CoreMood];
      expect(after.tempo).toBeGreaterThan(before.tempo);
      expect(after.jitter).toBeGreaterThan(before.jitter);
      expect(after.spread).toBeLessThan(before.spread);
    }
    for (const params of Object.values(MOOD_PARAMS)) {
      expect(params.breath).toBeLessThanOrEqual(0.5); // at most one slow swell every two seconds
    }
  });
});

describe('buildSignals', () => {
  it('is deterministic and stays within the orbit bounds', () => {
    const a = buildSignals(6);
    expect(buildSignals(6)).toEqual(a);
    expect(a).toHaveLength(6);
    for (const signal of a) {
      expect(signal.orbit).toBeGreaterThanOrEqual(0.42);
      expect(signal.orbit).toBeLessThanOrEqual(0.86);
      expect(signal.lit).toBe(0);
    }
  });

  it('limits the count', () => {
    expect(buildSignals(-3)).toHaveLength(0);
    expect(buildSignals(500)).toHaveLength(24);
  });
});

describe('CoreEngine', () => {
  it('draws a frame and a static frame without throwing', () => {
    const engine = new CoreEngine(palette());
    engine.resize(300, 300, 1.5);
    engine.setSignals(4, 1);
    const { ctx, calls } = recorder();
    engine.frame(ctx, 0);
    engine.frame(ctx, 16);
    expect(calls).toContain('clearRect');
    expect(calls).toContain('bezier');
    const before = calls.length;
    engine.drawStatic(ctx);
    expect(calls.length).toBeGreaterThan(before);
  });

  it('draws nothing while it has no size', () => {
    const engine = new CoreEngine(palette());
    const { ctx, calls } = recorder();
    engine.frame(ctx, 0);
    expect(calls).toHaveLength(0);
  });

  it('draws the same still frame every time, so reduced motion is stable', () => {
    const engine = new CoreEngine(palette());
    engine.resize(240, 240, 1);
    engine.setMood('frustrated', 'rising');
    engine.setSignals(3, 2);
    const first = recorder();
    const second = recorder();
    engine.drawStatic(first.ctx);
    engine.drawStatic(second.ctx);
    expect(second.calls).toEqual(first.calls);
  });

  it('morphs towards a new mood instead of jumping', () => {
    const engine = new CoreEngine(palette());
    engine.resize(300, 300, 1);
    const { ctx } = recorder();
    engine.frame(ctx, 0);
    const calm = engine.snapshot().tempo;
    engine.setMood('escalating');
    engine.frame(ctx, 16);
    const early = engine.snapshot().tempo;
    expect(early).toBeGreaterThan(calm);
    expect(early).toBeLessThan(MOOD_PARAMS.escalating.tempo);
    for (let t = 32; t < 6000; t += 16) engine.frame(ctx, t);
    expect(engine.snapshot().tempo).toBeCloseTo(MOOD_PARAMS.escalating.tempo, 1);
  });

  it('settles more gently when the customer is calming down', () => {
    const rising = new CoreEngine(palette());
    const falling = new CoreEngine(palette());
    rising.setMood('frustrated', 'rising');
    falling.setMood('frustrated', 'falling');
    rising.resize(200, 200, 1);
    falling.resize(200, 200, 1);
    const { ctx } = recorder();
    for (let t = 0; t < 6000; t += 16) {
      rising.frame(ctx, t);
      falling.frame(ctx, t);
    }
    expect(falling.snapshot().jitter).toBeLessThan(rising.snapshot().jitter);
  });

  it('lights signals as they are found, and flares once for a discovery', () => {
    const engine = new CoreEngine(palette());
    engine.resize(300, 300, 1);
    engine.setSignals(3, 0);
    const { ctx } = recorder();
    for (let t = 0; t < 400; t += 16) engine.frame(ctx, t);
    expect(engine.snapshot().lit.every((lit) => lit < 0.01)).toBe(true);

    engine.setSignals(3, 1);
    engine.discover();
    expect(engine.snapshot().bursts).toBe(1);
    for (let t = 400; t < 1000; t += 16) engine.frame(ctx, t);
    const lit = engine.snapshot().lit;
    expect(lit[0]).toBeGreaterThan(0.9);
    expect(lit[1]).toBeLessThan(0.01);

    for (let t = 1000; t < 2600; t += 16) engine.frame(ctx, t);
    expect(engine.snapshot().bursts).toBe(0); // the ring has finished
  });

  it('ignores discovery when there are no signals', () => {
    const engine = new CoreEngine(palette());
    engine.discover();
    expect(engine.snapshot().bursts).toBe(0);
  });

  it('keeps a bounded drawing budget in low quality', () => {
    const full = new CoreEngine(palette(), 'full');
    const low = new CoreEngine(palette(), 'low');
    for (const engine of [full, low]) {
      engine.resize(300, 300, 1);
      engine.setSignals(8, 8);
    }
    const a = recorder();
    const b = recorder();
    full.frame(a.ctx, 0);
    low.frame(b.ctx, 0);
    expect(b.calls.length).toBeLessThan(a.calls.length);
  });
});

describe('palette', () => {
  it('parses hex and rgb colours and falls back otherwise', () => {
    expect(parseColor('#fff', rgb(0, 0, 0))).toEqual(rgb(255, 255, 255));
    expect(parseColor(' #8bdcc8 ', rgb(0, 0, 0))).toEqual(rgb(139, 220, 200));
    expect(parseColor('rgba(10, 20, 30, 0.5)', rgb(0, 0, 0))).toEqual(rgb(10, 20, 30));
    expect(parseColor('not-a-colour', rgb(1, 2, 3))).toEqual(rgb(1, 2, 3));
    expect(parseColor('', rgb(4, 5, 6))).toEqual(rgb(4, 5, 6));
  });

  it('uses additive light on dark themes and ordinary blending on light ones', () => {
    const dark = readCorePalette((name) => (name === '--bg' ? '#061110' : ''));
    const light = readCorePalette((name) => (name === '--bg' ? '#f3ede0' : ''));
    expect(dark.additive).toBe(true);
    expect(light.additive).toBe(false);
    expect(luminance(rgb(255, 255, 255))).toBeCloseTo(1, 2);
  });

  it('reads the temperature ramp from the tokens', () => {
    const tokens: Record<string, string> = { '--temp-angry': '#f4694c', '--glow': '#f6bd5e' };
    const read = readCorePalette((name) => tokens[name] ?? '');
    expect(read.moods.angry).toEqual(rgb(244, 105, 76));
    expect(read.moods.neutral).toEqual(rgb(246, 189, 94));
  });
});
