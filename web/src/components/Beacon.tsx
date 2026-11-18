import { useOnScreen } from '../lib/hooks.ts';
import { useTheme } from '../lib/theme.tsx';

/**
 * Decorative 3D motif (CSS transforms only; no WebGL). It pauses when scrolled out of view and is
 * static when reduced motion is requested. Hidden from assistive technology.
 */
export function Beacon() {
  const [ref, visible] = useOnScreen<HTMLDivElement>();
  const { reducedMotion } = useTheme();
  return (
    <div ref={ref} className="beacon" aria-hidden="true" data-paused={!visible || reducedMotion}>
      <div className="beacon-glow" />
      <div className="beacon-gyro">
        <span className="beacon-ring r1">
          <span className="beacon-dot" />
          <span className="beacon-dot second" />
        </span>
        <span className="beacon-ring r2">
          <span className="beacon-dot" />
        </span>
        <span className="beacon-ring r3">
          <span className="beacon-dot" />
        </span>
      </div>
      <div className="beacon-core" />
    </div>
  );
}
