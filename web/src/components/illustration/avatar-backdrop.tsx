import { makeRefs, Stops } from './avatar-kit.tsx';
import type { BackdropId } from './avatar-traits.ts';

interface Palette {
  wallTop: string;
  wallBottom: string;
  /** The window light. */
  window: string;
  glow: string;
  bokeh: readonly [string, string, string];
  furnish: string;
  plant: string;
}

const PALETTES: Record<BackdropId, Palette> = {
  window: {
    wallTop: '#566b92',
    wallBottom: '#222d4a',
    window: '#d6e9ff',
    glow: '#8fb8ff',
    bokeh: ['#ffffff', '#b9d4ff', '#ffe0b3'],
    furnish: '#18213c',
    plant: '#2f6b6a',
  },
  warm: {
    wallTop: '#7d6459',
    wallBottom: '#33283a',
    window: '#ffeccf',
    glow: '#ffb56b',
    bokeh: ['#ffd9a0', '#fff1d6', '#ff9f6b'],
    furnish: '#2b1d24',
    plant: '#5a7048',
  },
  teal: {
    wallTop: '#3f7c80',
    wallBottom: '#17323c',
    window: '#dcfff6',
    glow: '#6fe0c8',
    bokeh: ['#c6fff0', '#ffffff', '#9ae8ff'],
    furnish: '#10272e',
    plant: '#2f7a52',
  },
  dusk: {
    wallTop: '#62529a',
    wallBottom: '#201c42',
    window: '#ffdcf2',
    glow: '#c08bff',
    bokeh: ['#ffd1ec', '#d6c2ff', '#ffffff'],
    furnish: '#17142f',
    plant: '#3f6a7a',
  },
};

const BOKEH: readonly (readonly [number, number, number, number])[] = [
  // x, y, radius, colour index
  [58, 78, 30, 0],
  [112, 40, 17, 1],
  [34, 156, 21, 2],
  [150, 96, 12, 1],
  [352, 214, 24, 2],
  [372, 118, 15, 0],
  [318, 292, 19, 1],
  [70, 262, 26, 1],
  [24, 318, 15, 0],
  [388, 348, 20, 2],
];

/** A soft office behind the figure: window light, bokeh and a few out-of-focus shapes, for depth. */
export function Backdrop({ uid, backdrop }: { uid: string; backdrop: BackdropId }) {
  const { id, url } = makeRefs(uid);
  const p = PALETTES[backdrop];
  return (
    <>
      <defs>
        <linearGradient id={id('wall')} x1="0" y1="0" x2="0.35" y2="1">
          <Stops
            stops={[
              [0, p.wallTop],
              [1, p.wallBottom],
            ]}
          />
        </linearGradient>
        <radialGradient id={id('glow')}>
          <Stops
            stops={[
              [0, p.glow, 0.55],
              [0.5, p.glow, 0.2],
              [1, p.glow, 0],
            ]}
          />
        </radialGradient>
        {p.bokeh.map((color, i) => (
          <radialGradient key={color + i} id={id(`bokeh${i}`)}>
            <Stops
              stops={[
                [0, color, 0.2],
                [0.72, color, 0.3],
                [0.9, color, 0.5],
                [1, color, 0],
              ]}
            />
          </radialGradient>
        ))}
        <radialGradient id={id('ambient')}>
          <Stops
            stops={[
              [0, '#05060f', 0.5],
              [0.6, '#05060f', 0.22],
              [1, '#05060f', 0],
            ]}
          />
        </radialGradient>
        <radialGradient id={id('vignette')} cx="0.5" cy="0.46" r="0.72">
          <Stops
            stops={[
              [0.5, '#04050c', 0],
              [1, '#04050c', 0.62],
            ]}
          />
        </radialGradient>
        <linearGradient id={id('wash')} x1="1" y1="0" x2="0.2" y2="0.8">
          <Stops
            stops={[
              [0, '#ffffff', 0.18],
              [1, '#ffffff', 0],
            ]}
          />
        </linearGradient>
        <radialGradient id={id('tintCool')} cx="0.5" cy="0.3" r="0.8">
          <Stops
            stops={[
              [0, '#7aa8ff', 0.3],
              [1, '#7aa8ff', 0],
            ]}
          />
        </radialGradient>
        <radialGradient id={id('tintWarm')} cx="0.5" cy="0.34" r="0.8">
          <Stops
            stops={[
              [0, '#ffb066', 0.34],
              [1, '#ffb066', 0],
            ]}
          />
        </radialGradient>
        <radialGradient id={id('tintHot')} cx="0.5" cy="0.38" r="0.85">
          <Stops
            stops={[
              [0, '#ff3b26', 0.52],
              [0.6, '#d81f16', 0.26],
              [1, '#d81f16', 0],
            ]}
          />
        </radialGradient>
        <filter id={id('blurL')} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id={id('blurS')} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <g className="ill-backdrop">
        <rect width={400} height={480} fill={url('wall')} />
        <circle cx={318} cy={60} r={250} fill={url('glow')} />
        <g filter={url('blurL')}>
          {[0, 1, 2].flatMap((row) =>
            [0, 1].map((col) => (
              <rect
                key={`${row}-${col}`}
                x={228 + col * 92}
                y={-24 + row * 104}
                width={86}
                height={98}
                rx={3}
                fill={p.window}
                opacity={0.78 - row * 0.16 - col * 0.06}
              />
            )),
          )}
          <rect x={-30} y={214} width={150} height={118} rx={10} fill={p.furnish} opacity={0.6} />
          <rect x={-16} y={226} width={104} height={58} rx={5} fill={p.window} opacity={0.3} />
          <ellipse cx={362} cy={356} rx={46} ry={40} fill={p.plant} opacity={0.5} />
          <ellipse cx={330} cy={380} rx={30} ry={30} fill={p.plant} opacity={0.4} />
        </g>
        <g filter={url('blurS')}>
          {BOKEH.map(([x, y, r, c]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={url(`bokeh${c}`)} />
          ))}
        </g>
        <rect width={400} height={480} fill={url('wash')} />
        <ellipse cx={200} cy={340} rx={230} ry={190} fill={url('ambient')} />
        <rect className="ill-tint ill-tint-cool" width={400} height={480} fill={url('tintCool')} />
        <rect className="ill-tint ill-tint-warm" width={400} height={480} fill={url('tintWarm')} />
        <rect className="ill-tint ill-tint-hot" width={400} height={480} fill={url('tintHot')} />
        <rect width={400} height={480} fill={url('vignette')} />
      </g>
    </>
  );
}
