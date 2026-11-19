import { useOnDemand } from '../../lib/onDemand.ts';
import type { FireflyCoreProps } from './CoreCanvas.tsx';

export type { FireflyCoreProps } from './CoreCanvas.tsx';

const loadCanvas = () => import('./CoreCanvas.tsx');

/**
 * The Firefly Core. Its drawing code is loaded after the page around it has painted, so it never
 * holds up the first screen. While that code arrives (and for good if it cannot be loaded) the same
 * box is shown with the same CSS glow, which is also what stays if a canvas cannot be created, so
 * nothing moves when the canvas takes over.
 */
export function FireflyCore(props: FireflyCoreProps) {
  const { module } = useOnDemand(loadCanvas);
  const Canvas = module?.CoreCanvas;
  if (Canvas) return <Canvas {...props} />;

  const { className, label, mood = 'neutral' } = props;
  return (
    <div
      className={className ? `core ${className}` : 'core'}
      data-mood={mood}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <canvas className="core-canvas" aria-hidden="true" />
    </div>
  );
}
