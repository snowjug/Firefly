import { useEffect, useRef, useState } from 'react';
import { useAmbientPaused } from '../../lib/motion/ambient.tsx';
import { useFinePointer } from '../../lib/motion/pointer.ts';
import { usePerfTier } from '../../lib/PerfTierProvider.tsx';
import { createEngine, type Engine } from './world-engine.ts';

/** Whether this browser can draw 2D at all (jsdom and very old browsers cannot). */
const canDraw = () => document.createElement('canvas').getContext('2d') !== null;

/**
 * The canvas of the field. It is loaded after first paint (see `WorldLayer`) and does nothing but
 * hand its configuration to the engine: what this device can afford, whether ambient motion is
 * paused (reduced motion counts), and whether there is a precise pointer. Where 2D drawing is not
 * available it renders nothing, and the still gradient behind it is the whole field.
 */
export default function WorldField() {
  const tier = usePerfTier();
  const paused = useAmbientPaused();
  const fine = useFinePointer();
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Engine | null>(null);
  const [drawable] = useState(canDraw);

  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const made = createEngine(node);
    engine.current = made;
    return () => {
      made?.destroy();
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    engine.current?.configure({ tier, paused, fine });
  }, [tier, paused, fine]);

  return drawable ? <canvas ref={canvas} className="world__canvas" aria-hidden="true" /> : null;
}
