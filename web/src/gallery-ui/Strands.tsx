import { useEffect, useRef } from 'react';

// Gallery only: a stand-in for the animated world behind the app, so every primitive can be judged
// over light strands and not only over the plain field. Deliberately stronger than the real field.

function draw(canvas: HTMLCanvasElement, time: number) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (canvas.width !== Math.round(width * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  const root = getComputedStyle(document.documentElement);
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  const amber = root.getPropertyValue('--amber').trim() || '#f2c463';
  const aqua = root.getPropertyValue('--aqua').trim() || '#8ed8e6';
  context.globalCompositeOperation = light ? 'source-over' : 'lighter';
  context.lineWidth = 1.2;
  const strands = 34;
  for (let i = 0; i < strands; i += 1) {
    const base = (i / strands) * height * 1.3 - height * 0.15;
    const amplitude = 36 + ((i * 37) % 90);
    const frequency = 0.0034 + ((i * 13) % 7) * 0.0006;
    const phase = i * 1.7 + time * 0.0002;
    context.beginPath();
    for (let x = -20; x <= width + 20; x += 20) {
      const y =
        base +
        Math.sin(x * frequency + phase) * amplitude +
        Math.sin(x * frequency * 2.3 + phase * 1.4) * amplitude * 0.35;
      if (x === -20) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.strokeStyle = i % 3 === 0 ? aqua : amber;
    context.globalAlpha = light ? 0.16 + (i % 4) * 0.05 : 0.14 + (i % 5) * 0.06;
    context.stroke();
  }
  context.globalAlpha = 1;
}

export function Strands({ live }: { live: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let frame = 0;
    const paint = (time: number) => {
      draw(canvas, time);
      if (live) frame = requestAnimationFrame(paint);
    };
    paint(0);
    const observer = new MutationObserver(() => draw(canvas, 0));
    observer.observe(document.documentElement, { attributes: true });
    const onResize = () => draw(canvas, 0);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [live]);
  return <canvas ref={ref} className="gallery-strands" aria-hidden="true" />;
}
