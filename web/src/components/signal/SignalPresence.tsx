import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { usePerfTier } from '../../lib/PerfTierProvider.tsx';
import { useReducedMotion } from '../../lib/theme.tsx';
import { num } from './geometry.ts';
import { presencePose } from './poses.ts';
import { PRESENCE_VIEW, PresenceBezel, PresenceDots, PresenceHeart } from './PresenceLayers.tsx';
import { detailFor, presenceShape } from './presence-shape.ts';
import type { PresenceProps } from './types.ts';
import { useTween } from './useTween.ts';
import '../../styles/signal.css';

const MAX_DOTS = 12;

/** How many of the `edges` a value has reached: 0 up to edges.length. */
const reached = (value: number, edges: readonly number[]): number =>
  edges.filter((edge) => value >= edge).length;

/**
 * The conversation changed: the rings jolt off the heart and settle, in under a second. The inner
 * and outer rings move against each other. A web animation on a wrapper, so it never fights the
 * slow drift on the rings themselves.
 */
function kink(group: HTMLElement | null, direction: 1 | -1): void {
  if (!group || typeof group.animate !== 'function') return;
  const at = (x: number, y: number, turn: number) => ({
    translate: `${num(x * direction)}% ${num(y * direction)}%`,
    rotate: `${num(turn * direction)}deg`,
  });
  group.animate(
    [
      { ...at(0, 0, 0), easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)' },
      { ...at(4.6, -2, -7), offset: 0.16, easing: 'ease-in-out' },
      { ...at(-2, 1, 3), offset: 0.5, easing: 'ease-in-out' },
      { ...at(0, 0, 0) },
    ],
    { duration: 820 },
  );
}

function PresenceView({
  atmosphere,
  discovered,
  pool = 7,
  shifts,
  typing = false,
  frozen = false,
  size = 240,
  className,
}: PresenceProps) {
  const reduced = useReducedMotion();
  const tier = usePerfTier();
  // A frozen render never runs a timer, reduced motion has no movement, and the cheapest tier
  // draws a still instrument: all three show each state at once and keep the words and shapes.
  const still = frozen || reduced || tier === 'low';

  const { tension, open, energy, recovering, silent } = atmosphere;
  const target = useMemo(
    () => presencePose({ tension, open, energy, recovering, silent }),
    [tension, open, energy, recovering, silent],
  );
  const pose = useTween(target, { instant: still });
  const shape = useMemo(() => presenceShape(pose, size), [pose, size]);
  const detail = detailFor(size);

  const dots = Math.max(0, Math.min(MAX_DOTS, Math.round(pool)));
  const lit = Math.max(0, Math.min(dots, Math.floor(discovered)));
  // What was already found when the presence appeared does not pulse; only what is found after.
  const [baseline] = useState(lit);
  const pulsing = !still && lit > baseline ? lit - 1 : -1;

  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const lastShifts = useRef(shifts);
  useEffect(() => {
    const before = lastShifts.current;
    lastShifts.current = shifts;
    if (shifts > before && !still) {
      kink(outer.current, 1);
      kink(inner.current, -1);
    }
  }, [shifts, still]);

  // Only the few things drawn in the accent carry its numbers (see `.sig-accent` in signal.css).
  const hue = pose.hue.toFixed(3);
  const cool = pose.cool.toFixed(3);
  const accent = { '--sig-hue': hue, '--sig-cool': cool } as CSSProperties;
  const halo = { ...accent, '--sig-glow': pose.glow.toFixed(3) } as CSSProperties;
  const root = { width: size, height: size, '--sig-dim': pose.dim.toFixed(3) } as CSSProperties;

  return (
    <div
      className={className ? `sig-presence ${className}` : 'sig-presence'}
      style={root}
      aria-hidden="true"
      data-sig="presence"
      data-sig-mood={atmosphere.mood}
      data-sig-trend={atmosphere.trend}
      data-sig-energy={reached(atmosphere.energy, [0.3, 0.55])}
      data-sig-jitter={reached(atmosphere.tension, [0.45, 0.7, 0.88])}
      data-still={still ? '' : undefined}
      data-frozen={frozen ? '' : undefined}
      data-typing={typing ? '' : undefined}
      data-silent={atmosphere.silent ? '' : undefined}
    >
      <div className="sig-presence__halo sig-accent" style={halo} />
      <PresenceBezel detail={detail} bezel={shape.width.bezel} inner={shape.width.inner} />
      <div
        className="sig-group sig-group--outer"
        ref={outer}
        style={{ translate: `${num(pose.cross * 3.5)}% ${num(-pose.cross * 1.1)}%` }}
      >
        <div className="sig-drift sig-drift--outer sig-accent" style={accent} data-ambient="">
          <svg className="sig-layer" viewBox={PRESENCE_VIEW} focusable="false">
            <path
              className="sig-edge-ring"
              d={shape.edge}
              strokeWidth={shape.width.edge}
              strokeDasharray={shape.dasharray}
              strokeLinecap={shape.round ? 'round' : 'butt'}
              strokeLinejoin={pose.zig > 0.4 ? 'miter' : 'round'}
            />
          </svg>
        </div>
      </div>
      <div
        className="sig-group sig-group--inner"
        ref={inner}
        style={{ translate: `${num(pose.cross * 2.1)}% ${num(-pose.cross * 0.65)}%` }}
      >
        <div className="sig-drift sig-drift--inner" data-ambient="">
          <svg className="sig-layer" viewBox={PRESENCE_VIEW} focusable="false">
            <path className="sig-inner-ring" d={shape.ring2} strokeWidth={shape.width.inner} />
            <path className="sig-inner-ring" d={shape.ring3} strokeWidth={shape.width.inner} />
          </svg>
        </div>
      </div>
      <PresenceDots
        count={dots}
        lit={lit}
        pulsing={pulsing}
        radius={shape.dot}
        width={shape.width.inner}
      />
      <PresenceHeart
        halo={shape.heart.halo}
        dot={shape.heart.dot}
        pip={shape.heart.pip}
        width={shape.width.inner}
        hue={hue}
        cool={cool}
      />
    </div>
  );
}

const sameAtmosphere = (a: PresenceProps['atmosphere'], b: PresenceProps['atmosphere']) =>
  a === b ||
  (a.mood === b.mood &&
    a.trend === b.trend &&
    a.tension === b.tension &&
    a.open === b.open &&
    a.energy === b.energy &&
    a.recovering === b.recovering &&
    a.silent === b.silent);

/**
 * The customer in the room, as the signal instrument. It is decorative: the chamber says the same
 * things in words. Mood sets how compressed, uneven and broken the rings are and what texture the
 * edge has; a rise in `shifts` jolts the rings; each found signal lights one of a fixed pool of
 * dormant dots; typing wobbles the heart. Reduced motion, a frozen render and the lowest
 * performance tier show every state at once with no movement.
 */
export const SignalPresence = memo(
  PresenceView,
  (prev, next) =>
    sameAtmosphere(prev.atmosphere, next.atmosphere) &&
    prev.discovered === next.discovered &&
    prev.pool === next.pool &&
    prev.shifts === next.shifts &&
    prev.typing === next.typing &&
    prev.frozen === next.frozen &&
    prev.size === next.size &&
    prev.className === next.className,
);
