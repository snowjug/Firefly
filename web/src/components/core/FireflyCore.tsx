import { useEffect, useRef } from 'react';
import { useTheme } from '../../lib/theme.tsx';
import {
  CoreEngine,
  type CoreMood,
  type CoreQuality,
  type CoreTone,
  type Ctx2D,
} from './engine.ts';
import { readCorePalette } from './palette.ts';

export interface FireflyCoreProps {
  /** The customer's state: sets colour, tempo and how settled the motion is. */
  mood?: CoreMood;
  /** Whether that state is rising, steady or falling (settling). */
  tone?: CoreTone;
  /** Dormant and found signals orbiting the core. Never carries what the signals mean. */
  signals?: { total: number; lit: number } | null;
  /** Change this value to swell the core once, for example when the customer speaks. */
  pulseKey?: number | string | null;
  /** Change this value to flare the most recently found signal. */
  discoveryKey?: number | string | null;
  /** A tighter, faster orbit used while the debrief is being prepared. */
  thinking?: boolean;
  paused?: boolean;
  quality?: CoreQuality;
  /** An accessible description. Leave out when the core is purely decorative. */
  label?: string;
  className?: string;
}

interface Controller {
  engine: CoreEngine;
  sync(): void;
  redraw(): void;
}

/**
 * The Firefly Core. A Canvas 2D visual that pauses when it is off screen, hidden or paused, draws a
 * single still frame under reduced motion, lowers its own quality on slow hardware and falls back
 * to a CSS glow when canvas is unavailable.
 */
export function FireflyCore({
  mood = 'neutral',
  tone = 'steady',
  signals = null,
  pulseKey = null,
  discoveryKey = null,
  thinking = false,
  paused = false,
  quality = 'full',
  label,
  className,
}: FireflyCoreProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controller = useRef<Controller | null>(null);
  const { reducedMotion } = useTheme();
  const flags = useRef({ reduced: reducedMotion, paused, visible: true });

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d') as Ctx2D | null;
    if (!ctx) return; // the CSS glow stays as the fallback

    const readPalette = () => {
      const style = getComputedStyle(wrap);
      return readCorePalette((name) => style.getPropertyValue(name));
    };
    const engine = new CoreEngine(readPalette(), quality);
    let dprCap = quality === 'low' ? 1 : 1.5;
    let raf = 0;
    let running = false;
    let lastDraw = 0;
    let lastFrame = 0;
    let frames = 0;
    let average = 16;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      const width = wrap.clientWidth;
      const height = wrap.clientHeight;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      engine.resize(width, height, dpr);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const tick = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      if (engine.getQuality() === 'low' && now - lastDraw < 30) return;
      lastDraw = now;
      engine.frame(ctx, now);
      if (lastFrame) average = average * 0.94 + (now - lastFrame) * 0.06;
      lastFrame = now;
      frames += 1;
      // Slow hardware: drop to the lighter version once, after a warm-up, and never come back.
      if (frames > 120 && average > 30 && engine.getQuality() === 'full') {
        engine.setQuality('low');
        dprCap = 1;
        resize();
      }
    };

    const redraw = () => {
      if (flags.current.reduced) engine.drawStatic(ctx);
    };

    const sync = () => {
      const f = flags.current;
      const animate = f.visible && !document.hidden && !f.reduced && !f.paused;
      if (animate) {
        if (!running) {
          running = true;
          frames = 0;
          lastFrame = 0;
          average = 16;
          engine.resetClock();
          raf = requestAnimationFrame(tick);
        }
        return;
      }
      stop();
      redraw();
    };

    wrap.dataset.canvas = 'on';
    resize();
    controller.current = { engine, sync, redraw };

    const intersection =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              flags.current.visible = Boolean(entry?.isIntersecting);
              sync();
            },
            { threshold: 0.01 },
          );
    intersection?.observe(wrap);

    const resizing =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            resize();
            if (!running) redraw();
          });
    resizing?.observe(wrap);

    // The palette follows the theme: re-read it when the theme attribute or the system scheme changes.
    const onPalette = () => {
      engine.setPalette(readPalette());
      redraw();
    };
    const mutation = new MutationObserver(onPalette);
    mutation.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    const scheme =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: light)')
        : null;
    scheme?.addEventListener('change', onPalette);
    document.addEventListener('visibilitychange', sync);

    sync();

    return () => {
      stop();
      controller.current = null;
      delete wrap.dataset.canvas;
      intersection?.disconnect();
      resizing?.disconnect();
      mutation.disconnect();
      scheme?.removeEventListener('change', onPalette);
      document.removeEventListener('visibilitychange', sync);
    };
    // The core is created once; later changes arrive through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    flags.current.reduced = reducedMotion;
    flags.current.paused = paused;
    controller.current?.sync();
  }, [reducedMotion, paused]);

  useEffect(() => {
    controller.current?.engine.setMood(mood, tone);
    controller.current?.redraw();
  }, [mood, tone]);

  useEffect(() => {
    controller.current?.engine.setThinking(thinking);
    controller.current?.redraw();
  }, [thinking]);

  const total = signals?.total ?? 0;
  const lit = signals?.lit ?? 0;
  useEffect(() => {
    controller.current?.engine.setSignals(total, lit);
    controller.current?.redraw();
  }, [total, lit]);

  const lastPulse = useRef(pulseKey);
  useEffect(() => {
    if (Object.is(lastPulse.current, pulseKey)) return;
    lastPulse.current = pulseKey;
    controller.current?.engine.pulse();
  }, [pulseKey]);

  const lastDiscovery = useRef(discoveryKey);
  useEffect(() => {
    if (Object.is(lastDiscovery.current, discoveryKey)) return;
    lastDiscovery.current = discoveryKey;
    controller.current?.engine.discover();
  }, [discoveryKey]);

  return (
    <div
      ref={wrapRef}
      className={className ? `core ${className}` : 'core'}
      data-mood={mood}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <canvas ref={canvasRef} className="core-canvas" aria-hidden="true" />
    </div>
  );
}
