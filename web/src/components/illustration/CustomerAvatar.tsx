import { useEffect, useId, useMemo, useRef, type CSSProperties } from 'react';
import type { TemperatureBandId } from '#shared/domain/vocab.ts';
import { useReducedMotion } from '../../lib/theme.tsx';
import { Bust, FIGURE_TRANSFORM, type MouthKey, type RimLight } from './avatar-art.tsx';
import { Backdrop } from './avatar-backdrop.tsx';
import { traitsFor } from './avatar-traits.ts';
import './illustration.css';

export interface CustomerAvatarProps {
  /** Any stable string, such as the persona's name: the same seed always gives the same face. */
  seed: string;
  mood: TemperatureBandId;
  speaking?: boolean;
  /** The head and eyes lean a few pixels toward the pointer while it is over the avatar's parent. */
  interactive?: boolean;
  /** Describes the portrait. Without it the avatar is decorative and hidden from assistive technology. */
  label?: string;
  className?: string;
}

const MOUTHS: readonly MouthKey[] = ['calm', 'concerned', 'frustrated', 'angry', 'escalating'];

// Window light from behind on the right, a warmer fill on the left.
const RIM: RimLight = { left: '#ffd2a6', leftOpacity: 0.32, right: '#c4e4ff', rightOpacity: 0.78 };

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

/**
 * Writes the pointer position (-1 to 1 around the avatar's centre) into two custom properties on the
 * svg, at most once per frame, so CSS moves the head and eyes without React re-rendering.
 */
function usePointerLook(svgRef: React.RefObject<SVGSVGElement | null>, enabled: boolean) {
  useEffect(() => {
    const svg = svgRef.current;
    const host = svg?.parentElement;
    if (!enabled || !svg || !host) return;
    let frame = 0;
    let pending: { x: number; y: number } | null = null;

    const flush = () => {
      frame = 0;
      if (!pending) return;
      svg.style.setProperty('--ill-px', pending.x.toFixed(3));
      svg.style.setProperty('--ill-py', pending.y.toFixed(3));
      pending = null;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const onMove = (event: PointerEvent) => {
      const box = svg.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      pending = {
        x: clamp(((event.clientX - box.left) / box.width - 0.5) * 2),
        // The eyes sit a little above the middle of the portrait.
        y: clamp(((event.clientY - box.top) / box.height - 0.42) * 2),
      };
      schedule();
    };
    const onLeave = () => {
      pending = { x: 0, y: 0 };
      schedule();
    };

    host.addEventListener('pointermove', onMove, { passive: true });
    host.addEventListener('pointerleave', onLeave);
    return () => {
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(frame);
      svg.style.removeProperty('--ill-px');
      svg.style.removeProperty('--ill-py');
    };
  }, [svgRef, enabled]);
}

/**
 * A soft-3D style portrait of the customer on the call: layered gradients, window light and a
 * blurred office. The expression follows `mood`; breathing, blinking and talking are CSS only and
 * stop completely under reduced motion.
 */
export function CustomerAvatar({
  seed,
  mood,
  speaking = false,
  interactive = false,
  label,
  className,
}: CustomerAvatarProps) {
  const uid = `ill${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const traits = useMemo(() => traitsFor(seed), [seed]);
  const reducedMotion = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  usePointerLook(svgRef, interactive && !reducedMotion);

  const { rhythm } = traits;
  const style = {
    '--ill-blink': `${rhythm.blink}s`,
    '--ill-blink-delay': `-${rhythm.blinkOffset}s`,
    '--ill-breathe': `${rhythm.breathe}s`,
    '--ill-breathe-delay': `-${rhythm.breatheOffset}s`,
  } as CSSProperties;

  return (
    <svg
      ref={svgRef}
      className={['ill-customer', reducedMotion ? '' : 'ill-live', className ?? '']
        .filter(Boolean)
        .join(' ')}
      style={style}
      viewBox="0 0 400 480"
      preserveAspectRatio="xMidYMin slice"
      data-mood={mood}
      data-speaking={speaking ? 'true' : 'false'}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <Backdrop uid={uid} backdrop={traits.backdrop} />
      <g transform={FIGURE_TRANSFORM}>
        <Bust uid={uid} traits={traits} mouths={MOUTHS} rim={RIM} />
      </g>
    </svg>
  );
}
