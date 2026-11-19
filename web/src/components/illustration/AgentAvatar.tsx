import { useId, useMemo, type CSSProperties } from 'react';
import { useReducedMotion } from '../../lib/theme.tsx';
import { Bust, type MouthKey, type RimLight } from './avatar-art.tsx';
import { makeRefs, Stops } from './avatar-kit.tsx';
import {
  AGENT_TOPS,
  EYE_COLORS,
  HAIR_COLORS,
  SKIN_TONES,
  pickBySeed,
  traitsFor,
  type AvatarTraits,
  type HairStyle,
} from './avatar-traits.ts';
import './illustration.css';

export interface AgentAvatarProps {
  className?: string;
  /** Describes the figure. Without it the avatar is decorative and hidden from assistive technology. */
  label?: string;
  /** Varies the skin, hair, glasses and top. Without a seed the same friendly engineer always appears. */
  seed?: string;
}

const MOUTHS: readonly MouthKey[] = ['happy'];

// Strong edge lights so the figure separates from a dark blue or violet banner.
const RIM: RimLight = { left: '#9fe4ff', leftOpacity: 0.95, right: '#ffd6f4', rightOpacity: 0.85 };

// A little smaller than the customer so the shoulders stay inside the box.
const FIGURE = 'translate(200 372) scale(1.08) translate(-200 -352)';

const DEFAULT_AGENT: AvatarTraits = {
  skin: SKIN_TONES.find((tone) => tone.id === 'honey') ?? SKIN_TONES[0],
  hairStyle: 'sidepart',
  hairColor: HAIR_COLORS.espresso,
  flip: false,
  glasses: null,
  eyes: EYE_COLORS.brown,
  top: AGENT_TOPS[0],
  collar: 'crew',
  shirt: '#f3f5f9',
  brows: 'regular',
  freckles: false,
  backdrop: 'window',
  rhythm: { blink: 5.2, blinkOffset: 1.4, breathe: 5.4, breatheOffset: 0.8 },
};

function agentTraits(seed: string | undefined): AvatarTraits {
  if (seed === undefined) return DEFAULT_AGENT;
  const base = traitsFor(seed);
  return {
    ...base,
    top: pickBySeed(`${seed}:top`, AGENT_TOPS),
    // A blazer or turtleneck in a bright fabric reads as a costume, so keep to relaxed necklines.
    collar: base.collar === 'blazer' ? 'polo' : base.collar === 'turtleneck' ? 'crew' : base.collar,
  };
}

/** Where the headband crosses the top of each hairstyle (just above its outline). */
const BAND_TOP: Record<HairStyle, number> = {
  crop: 78,
  sidepart: 74,
  curly: 58,
  coily: 51,
  straight: 81,
  wavy: 79,
  bun: 87,
  buzz: 89,
  bob: 81,
};

/** Headband, ear cups and a boom microphone, drawn in the head's own coordinates so they move with it. */
function Headset({ uid, style }: { uid: string; style: HairStyle }) {
  const { id, url } = makeRefs(uid);
  const t = BAND_TOP[style];
  const band = `M 112 200 C 104 ${t + 48} 146 ${t} 200 ${t} C 254 ${t} 296 ${t + 48} 288 200`;
  const arm = 'M 104 240 C 96 280 128 302 152 292 C 160 288 163 283 164 278';
  return (
    <g className="ill-headset">
      <defs>
        <linearGradient
          id={id('hsBand')}
          gradientUnits="userSpaceOnUse"
          x1="104"
          y1="0"
          x2="296"
          y2="0"
        >
          <Stops
            stops={[
              [0, '#56609f'],
              [0.5, '#2e3566'],
              [1, '#1a1f48'],
            ]}
          />
        </linearGradient>
        <linearGradient id={id('hsCup')} x1="0" y1="0" x2="1" y2="1">
          <Stops
            stops={[
              [0, '#5b66a8'],
              [0.45, '#2c3366'],
              [1, '#161a3d'],
            ]}
          />
        </linearGradient>
        <radialGradient id={id('hsAccent')} cx="0.35" cy="0.3" r="0.8">
          <Stops
            stops={[
              [0, '#a6f2ff'],
              [0.5, '#3fb7ff'],
              [1, '#2a5be0'],
            ]}
          />
        </radialGradient>
        <linearGradient id={id('hsMic')} x1="0" y1="0" x2="0" y2="1">
          <Stops
            stops={[
              [0, '#6872b4'],
              [1, '#1d2250'],
            ]}
          />
        </linearGradient>
      </defs>

      <path
        d={band}
        fill="none"
        stroke="#05060f"
        strokeOpacity={0.24}
        strokeWidth={16}
        strokeLinecap="round"
      />
      <path d={band} fill="none" stroke={url('hsBand')} strokeWidth={9} strokeLinecap="round" />
      <path
        d={band}
        fill="none"
        stroke="#b7c3ff"
        strokeOpacity={0.5}
        strokeWidth={1.8}
        strokeLinecap="round"
        transform="translate(-1.2 -2)"
      />

      <path
        d={arm}
        fill="none"
        stroke="#05060f"
        strokeOpacity={0.2}
        strokeWidth={5}
        strokeLinecap="round"
        transform="translate(2 3)"
      />
      <path d={arm} fill="none" stroke="#262c5c" strokeWidth={4.6} strokeLinecap="round" />
      <path
        d={arm}
        fill="none"
        stroke="#8c99e6"
        strokeOpacity={0.6}
        strokeWidth={1.2}
        strokeLinecap="round"
        transform="translate(-1 -1)"
      />
      <g transform="translate(164 277) rotate(-38)">
        <rect x={-9.5} y={-5.2} width={19} height={10.4} rx={5.2} fill={url('hsMic')} />
        <rect x={-6.5} y={-3.8} width={10} height={2.4} rx={1.2} fill="#ffffff" opacity={0.42} />
      </g>

      {[106, 294].map((x, i) => (
        <g key={x} transform={`translate(${x} 214)`}>
          <ellipse cx={i === 0 ? 4 : -4} cy={3} rx={17} ry={28} fill="#05060f" opacity={0.22} />
          <ellipse rx={17} ry={28} fill={url('hsCup')} />
          <ellipse
            rx={17}
            ry={28}
            fill="none"
            stroke="#b4c0ff"
            strokeOpacity={0.35}
            strokeWidth={1.4}
          />
          <path
            d={i === 0 ? 'M 11 -22 C 19 -10 19 10 11 22' : 'M -11 -22 C -19 -10 -19 10 -11 22'}
            fill="none"
            stroke="#0b0e2c"
            strokeOpacity={0.55}
            strokeWidth={4.5}
            strokeLinecap="round"
          />
          <ellipse cx={i === 0 ? -1 : 1} rx={10.5} ry={19} fill={url('hsAccent')} />
          <ellipse
            cx={-3.4}
            cy={-9}
            rx={3.2}
            ry={7.5}
            fill="#ffffff"
            opacity={0.55}
            transform="rotate(14 -3.4 -9)"
          />
          {i === 1 ? (
            <>
              <circle cx={-1} cy={13} r={5} fill="#8dffbf" opacity={0.28} />
              <circle cx={-1} cy={13} r={2} fill="#9dffc8" />
            </>
          ) : null}
        </g>
      ))}
    </g>
  );
}

/** A lanyard and ID badge, on the chest. */
function Lanyard() {
  return (
    <g>
      <path
        d="M 154 350 L 192 414"
        fill="none"
        stroke="#2b66ff"
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path
        d="M 246 350 L 208 414"
        fill="none"
        stroke="#2557e8"
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path
        d="M 152 351 L 190 413"
        fill="none"
        stroke="#8fb3ff"
        strokeOpacity={0.6}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <path
        d="M 248 351 L 210 413"
        fill="none"
        stroke="#8fb3ff"
        strokeOpacity={0.45}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <rect x={196} y={408} width={8} height={7} rx={2} fill="#6b7aa8" />
      <rect
        x={180}
        y={414}
        width={40}
        height={52}
        rx={6}
        fill="#05060f"
        opacity={0.18}
        transform="translate(2 3)"
      />
      <rect x={180} y={414} width={40} height={52} rx={6} fill="#f7f9ff" />
      <path
        d="M 180 420 A 6 6 0 0 1 186 414 L 214 414 A 6 6 0 0 1 220 420 L 220 426 L 180 426 Z"
        fill="#2b66ff"
      />
      <path
        d="M 200 430 L 202 436 L 208 438 L 202 440 L 200 446 L 198 440 L 192 438 L 198 436 Z"
        fill="#ffb92e"
      />
      <rect x={188} y={451} width={24} height={3} rx={1.5} fill="#b9c2dc" />
      <rect x={192} y={457} width={16} height={3} rx={1.5} fill="#d3d9ea" />
    </g>
  );
}

/**
 * The support engineer for banners: a friendly bust in a bright top, wearing a headset with a boom
 * microphone. The background is transparent, and strong edge lights keep it readable on dark blue
 * or violet. It breathes and blinks (CSS only), and is still under reduced motion.
 */
export function AgentAvatar({ className, label, seed }: AgentAvatarProps) {
  const uid = `ill${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const traits = useMemo(() => agentTraits(seed), [seed]);
  const reducedMotion = useReducedMotion();
  const { id, url } = makeRefs(uid);
  const { rhythm } = traits;
  const style = {
    '--ill-blink': `${rhythm.blink}s`,
    '--ill-blink-delay': `-${rhythm.blinkOffset}s`,
    '--ill-breathe': `${rhythm.breathe}s`,
    '--ill-breathe-delay': `-${rhythm.breatheOffset}s`,
  } as CSSProperties;

  return (
    <svg
      className={['ill-agent', reducedMotion ? '' : 'ill-live', className ?? '']
        .filter(Boolean)
        .join(' ')}
      style={style}
      viewBox="0 30 400 440"
      preserveAspectRatio="xMidYMax meet"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <defs>
        <radialGradient id={id('halo')}>
          <Stops
            stops={[
              [0, '#ffffff', 0.2],
              [0.6, '#b9c8ff', 0.08],
              [1, '#b9c8ff', 0],
            ]}
          />
        </radialGradient>
      </defs>
      <ellipse cx={200} cy={270} rx={210} ry={230} fill={url('halo')} />
      <g transform={FIGURE}>
        <Bust
          uid={uid}
          traits={traits}
          mouths={MOUTHS}
          rim={RIM}
          compact
          headOverlay={<Headset uid={uid} style={traits.hairStyle} />}
          bodyOverlay={<Lanyard />}
        />
      </g>
    </svg>
  );
}
