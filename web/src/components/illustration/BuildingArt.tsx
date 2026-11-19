import { useId } from 'react';
import { makeRefs, Stops } from './avatar-kit.tsx';
import './illustration.css';

export interface BuildingArtProps {
  className?: string;
}

// A glass office tower at night, seen from the street. Every vertical edge runs to one point far
// above the picture, so the tower narrows as it rises. The scene is built once, here, from a few
// numbers: it is the same on every render.
const VX = 318;
const VY = -480;
const BASE = 880;
const CORNER = 262;
const FLOORS = 27;

interface Face {
  /** +1 runs right from the corner edge, -1 runs left. */
  dir: 1 | -1;
  cols: number;
  width: number;
  /** How much each column steps down the floor lines, so the floors tilt away from the corner. */
  slope: number;
}

const FACES: Record<'left' | 'right', Face> = {
  left: { dir: -1, cols: 7, width: 48, slope: 0.007 },
  right: { dir: 1, cols: 9, width: 52, slope: 0.005 },
};

function hash(a: number, b: number, c = 0): number {
  let h = Math.imul(a + 374761393, 668265263) ^ Math.imul(b + 1274126177, 2246822519);
  h ^= Math.imul(c + 97, 3266489917);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The point where mullion `col` meets floor line `floor`. */
function point(face: Face, col: number, floor: number): { x: number; y: number } {
  const x0 = CORNER + face.dir * col * face.width;
  const u = 1 - 1 / (1 + 0.07 * floor) - col * face.slope;
  return { x: x0 + (VX - x0) * u, y: BASE + (VY - BASE) * u };
}

const fmt = (n: number) => n.toFixed(1);
const pt = (p: { x: number; y: number }) => `${fmt(p.x)} ${fmt(p.y)}`;

interface Pane {
  d: string;
  fill: string;
  opacity: number;
}

interface FaceArt {
  triangle: string;
  tinted: Pane[];
  lit: Pane[];
  floors: string[];
  mullions: string[];
}

const WARM = ['#ffd27a', '#ffe3a6', '#ffc25c'];
const COOL = ['#a8dcff', '#d2efff', '#8cc9ff'];
const TINTS = ['#17458c', '#1c5fa3', '#10708f', '#123a78', '#2a67b5'];

function buildFace(name: 'left' | 'right'): FaceArt {
  const face = FACES[name];
  const seed = name === 'left' ? 1 : 2;
  const end = CORNER + face.dir * face.cols * face.width;
  const tinted: Pane[] = [];
  const lit: Pane[] = [];
  const floors: string[] = [];
  const mullions: string[] = [];

  for (let col = 0; col <= face.cols; col += 1) {
    const x0 = CORNER + face.dir * col * face.width;
    mullions.push(`M ${fmt(x0)} ${BASE} L ${fmt(VX)} ${VY}`);
  }

  for (let floor = 0; floor <= FLOORS; floor += 1) {
    const points = Array.from({ length: face.cols + 1 }, (_, col) => point(face, col, floor));
    if (points.every((p) => p.y > 840 || p.y < -30)) continue;
    floors.push(`M ${points.map(pt).join(' L ')}`);
  }

  for (let floor = 0; floor < FLOORS; floor += 1) {
    // Some floors are working late, most are dark.
    const roll = hash(floor, seed, 7);
    const floorLit = roll < 0.18 ? 0.9 : roll < 0.45 ? 0.38 : 0.07;
    for (let col = 0; col < face.cols; col += 1) {
      const a = point(face, col, floor);
      const b = point(face, col + 1, floor);
      const c = point(face, col + 1, floor + 1);
      const d = point(face, col, floor + 1);
      const ys = [a.y, b.y, c.y, d.y];
      if (Math.min(...ys) > 840 || Math.max(...ys) < -30) continue;
      const path = `M ${pt(a)} L ${pt(b)} L ${pt(c)} L ${pt(d)} Z`;
      const r = hash(col, floor, seed);
      if (r < floorLit) {
        const palette = hash(col, floor, seed + 10) < 0.7 ? WARM : COOL;
        lit.push({
          d: path,
          fill: palette[Math.floor(hash(col, floor, seed + 20) * palette.length)] as string,
          opacity: 0.55 + hash(col, floor, seed + 30) * 0.4,
        });
      } else if (hash(col, floor, seed + 40) < 0.4) {
        tinted.push({
          d: path,
          fill: TINTS[Math.floor(hash(col, floor, seed + 50) * TINTS.length)] as string,
          opacity: 0.35 + hash(col, floor, seed + 60) * 0.45,
        });
      }
    }
  }

  return {
    triangle: `M ${CORNER} ${BASE} L ${end} ${BASE} L ${VX} ${VY} Z`,
    tinted,
    lit,
    floors,
    mullions,
  };
}

const LEFT = buildFace('left');
const RIGHT = buildFace('right');

const STARS = Array.from({ length: 56 }, (_, i) => ({
  x: Math.round(hash(i, 3, 1) * 600),
  y: Math.round(hash(i, 4, 1) * 360),
  r: 0.5 + hash(i, 5, 1) * 1.1,
  o: 0.25 + hash(i, 6, 1) * 0.6,
}));

// Lower towers behind the main one, with a few lit windows each.
const BACKDROP: readonly { x: number; w: number; top: number; shade: string }[] = [
  { x: -10, w: 70, top: 300, shade: '#0b1c40' },
  { x: 54, w: 56, top: 380, shade: '#0d2248' },
  { x: 112, w: 46, top: 250, shade: '#0a1a3a' },
  { x: 496, w: 52, top: 210, shade: '#0b1d42' },
  { x: 546, w: 64, top: 330, shade: '#0d2349' },
];

const BACKDROP_WINDOWS = BACKDROP.flatMap((tower, t) =>
  Array.from({ length: 34 }, (_, i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    return {
      x: tower.x + 7 + col * ((tower.w - 14) / 5),
      y: tower.top + 14 + row * 22,
      on: hash(t, i, 9) < 0.34,
      warm: hash(t, i, 11) < 0.7,
    };
  }).filter((w) => w.y < 780),
);

/**
 * A night-time glass office tower for the sign-in side panel: deep blues, lit floors and a moonlit
 * sky behind. It is decorative, fills its container (cropping rather than stretching) and has no
 * motion.
 */
export function BuildingArt({ className }: BuildingArtProps) {
  const uid = `ill${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { id, url } = makeRefs(uid);
  const faceArt = (art: FaceArt, glass: string, shade: number) => (
    <g clipPath={url(glass === 'glassL' ? 'faceL' : 'faceR')}>
      <path d={art.triangle} fill={url(glass)} />
      {art.tinted.map((pane, i) => (
        <path key={i} d={pane.d} fill={pane.fill} opacity={pane.opacity} />
      ))}
      <g filter={url('bloom')} opacity={0.75}>
        {art.lit.map((pane, i) => (
          <path key={i} d={pane.d} fill={pane.fill} opacity={pane.opacity} />
        ))}
      </g>
      {art.lit.map((pane, i) => (
        <path key={i} d={pane.d} fill={pane.fill} opacity={pane.opacity} />
      ))}
      <path
        d={art.floors.join(' ')}
        fill="none"
        stroke="#020717"
        strokeOpacity={0.75}
        strokeWidth={1.3}
      />
      <path
        d={art.mullions.join(' ')}
        fill="none"
        stroke="#020717"
        strokeOpacity={0.8}
        strokeWidth={1.6}
      />
      <path
        d={art.mullions.join(' ')}
        fill="none"
        stroke="#7cc2ff"
        strokeOpacity={0.14}
        strokeWidth={0.7}
        transform="translate(1.1 0)"
      />
      <path d={art.triangle} fill="#020717" opacity={shade} />
    </g>
  );

  return (
    <svg
      className={['ill-building', className ?? ''].filter(Boolean).join(' ')}
      viewBox="0 0 600 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
          <Stops
            stops={[
              [0, '#040a20'],
              [0.34, '#0a1d47'],
              [0.7, '#123a74'],
              [1, '#1f6d9e'],
            ]}
          />
        </linearGradient>
        <radialGradient id={id('horizon')} cx="0.5" cy="1" r="0.75">
          <Stops
            stops={[
              [0, '#4ad0e8', 0.5],
              [0.5, '#2a8fc6', 0.18],
              [1, '#2a8fc6', 0],
            ]}
          />
        </radialGradient>
        <radialGradient id={id('moon')}>
          <Stops
            stops={[
              [0, '#dbe8ff', 0.5],
              [0.4, '#9ab8ff', 0.14],
              [1, '#9ab8ff', 0],
            ]}
          />
        </radialGradient>
        <linearGradient id={id('glassL')} x1="0" y1="1" x2="0.2" y2="0">
          <Stops
            stops={[
              [0, '#0a1f4a'],
              [0.55, '#0c2a5c'],
              [1, '#0f3a74'],
            ]}
          />
        </linearGradient>
        <linearGradient id={id('glassR')} x1="0" y1="1" x2="0.3" y2="0">
          <Stops
            stops={[
              [0, '#0b2552'],
              [0.5, '#12417f'],
              [1, '#1c63a8'],
            ]}
          />
        </linearGradient>
        <linearGradient id={id('sheen')} x1="0.1" y1="0.9" x2="0.9" y2="0.1">
          <Stops
            stops={[
              [0, '#bfe6ff', 0],
              [0.5, '#bfe6ff', 0.2],
              [1, '#bfe6ff', 0],
            ]}
          />
        </linearGradient>
        <linearGradient id={id('edge')} x1="0" y1="1" x2="0" y2="0">
          <Stops
            stops={[
              [0, '#cfeaff', 0.1],
              [0.5, '#cfeaff', 0.85],
              [1, '#cfeaff', 0.5],
            ]}
          />
        </linearGradient>
        <radialGradient id={id('vignette')} cx="0.5" cy="0.5" r="0.75">
          <Stops
            stops={[
              [0.55, '#020617', 0],
              [1, '#020617', 0.7],
            ]}
          />
        </radialGradient>
        <radialGradient id={id('beacon')}>
          <Stops
            stops={[
              [0, '#ff5a4a', 0.95],
              [0.4, '#ff5a4a', 0.35],
              [1, '#ff5a4a', 0],
            ]}
          />
        </radialGradient>
        <filter id={id('bloom')} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
        <clipPath id={id('faceL')}>
          <path d={LEFT.triangle} />
        </clipPath>
        <clipPath id={id('faceR')}>
          <path d={RIGHT.triangle} />
        </clipPath>
      </defs>

      <rect width={600} height={800} fill={url('sky')} />
      <rect width={600} height={800} fill={url('horizon')} />
      <g fill="#e6eeff">
        {STARS.map((star, i) => (
          <circle
            key={i}
            cx={star.x}
            cy={star.y}
            r={star.r.toFixed(2)}
            opacity={star.o.toFixed(2)}
          />
        ))}
      </g>
      <circle cx={84} cy={118} r={74} fill={url('moon')} />
      <path d="M 84 102 A 16 16 0 1 0 84 134 A 12.5 12.5 0 1 1 84 102 Z" fill="#eaf1ff" />

      {BACKDROP.map((tower) => (
        <rect
          key={tower.x}
          x={tower.x}
          y={tower.top}
          width={tower.w}
          height={800 - tower.top}
          fill={tower.shade}
        />
      ))}
      <path d="M 522 210 L 522 168" stroke="#2a3f73" strokeWidth={1.6} />
      <circle cx={522} cy={166} r={9} fill={url('beacon')} />
      <circle cx={522} cy={166} r={1.8} fill="#ff8a7a" />
      {BACKDROP_WINDOWS.map((w, i) => (
        <rect
          key={i}
          x={w.x.toFixed(1)}
          y={w.y}
          width={5}
          height={8}
          fill={w.on ? (w.warm ? '#ffcf78' : '#a8dcff') : '#14306a'}
          opacity={w.on ? 0.85 : 0.5}
        />
      ))}

      {faceArt(LEFT, 'glassL', 0.3)}
      {faceArt(RIGHT, 'glassR', 0)}

      <g clipPath={url('faceR')}>
        <path d="M 250 800 L 360 800 L 700 120 L 560 120 Z" fill={url('sheen')} />
      </g>
      <path d={`M ${CORNER} ${BASE} L ${VX} ${VY}`} stroke={url('edge')} strokeWidth={2.4} />
      <path
        d={`M ${CORNER} ${BASE} L ${VX} ${VY}`}
        stroke="#9fd6ff"
        strokeOpacity={0.18}
        strokeWidth={9}
      />
      <rect width={600} height={800} fill={url('vignette')} />
    </svg>
  );
}
