import type { ReactNode } from 'react';
import type { AvatarTraits, HairStyle } from './avatar-traits.ts';
import { makeRefs, mirrorPath, type Refs } from './avatar-kit.tsx';

interface Circle {
  x: number;
  y: number;
  r: number;
}

/** A hair outline is either one path or a cluster of curls. */
type Geometry = { path: string } | { circles: readonly Circle[] };

interface Paint {
  fill?: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
}

function draw(geometry: Geometry, paint: Paint): ReactNode {
  if ('path' in geometry) return <path d={geometry.path} {...paint} />;
  return geometry.circles.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r={c.r} {...paint} />);
}

interface HairArt {
  /** Drawn behind the head and shoulders: long hair behind the neck, or a bun. */
  back?: Geometry;
  /** Which gradient fills `back`; the plain hair gradient unless a design needs its own. */
  backFill?: 'hair' | 'bun';
  backAccessory?: (refs: Refs, traits: AvatarTraits) => ReactNode;
  /** The hair over the head. */
  front: Geometry;
  /** Glossy bands, filled with a white fade. */
  shine: readonly string[];
  /** Light flow lines. */
  strands: readonly string[];
  /** Dark flow lines for depth. */
  grooves: readonly string[];
  parting?: string;
  /** Pieces that sit on top of the hair: a bun and its tie. */
  accessory?: (refs: Refs, traits: AvatarTraits) => ReactNode;
  /** Strength of the dark shading around the inside edge of the hair. */
  edge: { width: number; opacity: number };
  /** A cool edge light on the outside of the hair. Curls skip it: every curl would get its own. */
  noRim?: boolean;
  /** Very short hair: a soft, speckled cap rather than a solid one. */
  cropped?: boolean;
}

function ring(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  from: number,
  to: number,
  count: number,
  radius: number,
  jitter = 0.16,
): Circle[] {
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1);
    const angle = ((from + (to - from) * t) * Math.PI) / 180;
    const wobble = 1 + jitter * Math.sin(i * 2.7 + 0.6);
    const push = 1 + 0.05 * Math.cos(i * 1.9);
    return {
      x: cx + Math.cos(angle) * rx * push,
      y: cy + Math.sin(angle) * ry * push,
      r: radius * wobble,
    };
  });
}

/** A short arc along one side of every curl: bright on the lit upper left, dark on the lower right. */
function curlArcs(list: readonly Circle[], from: number, to: number, scale: number): string[] {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  return list.map(({ x, y, r }) => {
    const rr = r * scale;
    const sx = x + Math.cos(rad(from)) * rr;
    const sy = y + Math.sin(rad(from)) * rr;
    const ex = x + Math.cos(rad(to)) * rr;
    const ey = y + Math.sin(rad(to)) * rr;
    return `M ${sx.toFixed(1)} ${sy.toFixed(1)} A ${rr.toFixed(1)} ${rr.toFixed(1)} 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`;
  });
}

const CURLY_FRONT: readonly Circle[] = [
  ...ring(200, 150, 100, 82, 154, 386, 19, 21),
  ...ring(200, 146, 64, 50, 196, 344, 8, 24),
  ...ring(200, 140, 30, 24, 210, 330, 4, 22),
  { x: 126, y: 176, r: 15 },
  { x: 274, y: 176, r: 15 },
  { x: 122, y: 198, r: 12 },
  { x: 278, y: 198, r: 12 },
  { x: 148, y: 142, r: 15 },
  { x: 172, y: 130, r: 16 },
  { x: 200, y: 125, r: 15 },
  { x: 228, y: 129, r: 16 },
  { x: 252, y: 140, r: 15 },
];

const COILY_FRONT: readonly Circle[] = [
  ...ring(200, 146, 102, 90, 148, 392, 34, 11.5, 0.12),
  ...ring(200, 146, 84, 72, 150, 390, 28, 12.5, 0.12),
  ...ring(200, 142, 64, 54, 170, 370, 22, 13, 0.12),
  ...ring(200, 138, 40, 32, 190, 350, 12, 15, 0.1),
  { x: 124, y: 176, r: 11 },
  { x: 276, y: 176, r: 11 },
  { x: 120, y: 194, r: 9.5 },
  { x: 280, y: 194, r: 9.5 },
  { x: 140, y: 150, r: 10.5 },
  { x: 156, y: 138, r: 10.5 },
  { x: 174, y: 130, r: 10.5 },
  { x: 192, y: 126, r: 10.5 },
  { x: 208, y: 126, r: 10.5 },
  { x: 226, y: 130, r: 10.5 },
  { x: 244, y: 138, r: 10.5 },
  { x: 260, y: 150, r: 10.5 },
];

/** The hair designs, drawn facing one way. `flip` mirrors every shape so each has a twin. */
function buildArt(style: HairStyle, flip: boolean): HairArt {
  const p = (d: string): string => (flip ? mirrorPath(d) : d);
  const ps = (list: readonly string[]): string[] => list.map(p);
  const cs = (list: readonly Circle[]): Circle[] =>
    flip ? list.map((c) => ({ ...c, x: 400 - c.x })) : [...list];

  switch (style) {
    case 'crop':
      return {
        front: {
          path: p(
            'M 118 194 C 107 134 140 79 200 77 C 260 79 293 134 282 194 C 280 180 277 168 271 160 C 264 152 254 148 246 147 L 241 154 C 234 148 226 146 219 147 L 213 155 C 206 148 197 146 190 147 L 184 154 C 177 147 168 146 160 150 L 154 157 C 147 152 140 154 134 161 C 129 168 125 178 122 188 L 118 194 Z',
          ),
        },
        shine: ps(['M 146 112 C 162 92 194 84 226 88 C 198 94 172 104 156 124 Z']),
        strands: ps([
          'M 132 132 C 148 106 176 94 206 92',
          'M 150 138 C 164 116 190 104 218 104',
          'M 232 96 C 256 104 272 124 276 152',
        ]),
        grooves: ps(['M 176 140 C 190 116 214 108 244 112', 'M 128 160 C 130 140 138 122 150 110']),
        edge: { width: 12, opacity: 0.3 },
      };
    case 'sidepart':
      return {
        front: {
          path: p(
            'M 116 196 C 103 136 132 78 196 73 C 262 69 297 126 284 196 C 282 182 279 170 273 160 C 262 148 246 146 232 139 C 218 133 206 126 196 118 C 188 111 178 104 170 99 C 158 108 142 122 135 141 C 130 153 128 165 125 176 C 122 184 119 190 116 196 Z',
          ),
        },
        shine: ps(['M 176 86 C 214 70 262 90 278 138 C 256 104 220 92 190 98 Z']),
        strands: ps([
          'M 172 98 C 210 84 254 98 274 150',
          'M 174 108 C 206 100 246 114 268 160',
          'M 150 118 C 138 130 132 150 128 176',
        ]),
        grooves: ps(['M 182 100 C 218 100 252 124 270 156', 'M 160 106 C 148 118 140 132 136 150']),
        parting: p('M 170 99 C 168 92 168 86 170 80'),
        edge: { width: 12, opacity: 0.3 },
      };
    case 'curly': {
      const list = cs(CURLY_FRONT);
      return {
        front: { circles: list },
        shine: [],
        strands: curlArcs(list, 196, 282, 0.76),
        grooves: curlArcs(list, 20, 104, 0.76),
        edge: { width: 4, opacity: 0.3 },
        noRim: true,
      };
    }
    case 'coily': {
      const list = cs(COILY_FRONT);
      return {
        front: { circles: list },
        shine: [],
        strands: curlArcs(list, 196, 282, 0.7),
        grooves: curlArcs(list, 20, 104, 0.7),
        edge: { width: 3, opacity: 0.3 },
        noRim: true,
      };
    }
    case 'straight':
      return {
        back: {
          path: p(
            'M 120 150 C 98 210 92 330 98 440 L 302 440 C 308 330 302 210 280 150 C 270 112 240 90 200 90 C 160 90 130 112 120 150 Z',
          ),
        },
        front: {
          path: p(
            'M 108 410 C 100 340 102 260 108 200 C 112 130 148 82 200 80 C 252 82 288 130 292 200 C 298 260 300 340 292 410 C 278 422 256 420 244 404 C 250 350 262 290 272 230 C 276 200 274 172 262 150 C 248 124 224 108 200 106 C 176 108 152 124 138 150 C 126 172 124 200 128 230 C 138 290 150 350 156 404 C 144 420 122 422 108 410 Z',
          ),
        },
        shine: ps([
          'M 134 140 C 146 104 176 88 204 86 C 176 98 156 120 150 160 C 146 196 146 232 150 270 C 138 236 130 190 134 140 Z',
        ]),
        strands: ps([
          'M 196 96 C 150 108 118 160 114 230 C 110 300 112 360 116 406',
          'M 204 96 C 250 108 282 160 286 230 C 290 300 288 360 284 406',
          'M 196 108 C 160 120 136 164 134 230 C 134 300 140 350 144 398',
          'M 204 108 C 240 120 264 164 266 230 C 266 290 260 350 256 398',
        ]),
        grooves: ps([
          'M 160 118 C 140 150 134 200 138 262',
          'M 242 118 C 262 150 268 200 264 262',
          'M 124 250 C 124 300 126 350 128 396',
          'M 276 250 C 276 300 274 350 272 396',
        ]),
        parting: p('M 200 106 C 200 98 200 92 200 84'),
        edge: { width: 14, opacity: 0.34 },
      };
    case 'wavy':
      return {
        back: {
          path: p(
            'M 112 160 C 90 220 96 320 104 420 L 300 420 C 308 320 306 220 288 160 C 276 116 244 92 200 92 C 156 92 124 116 112 160 Z',
          ),
        },
        front: {
          path: p(
            'M 104 416 C 90 386 112 362 100 330 C 90 300 98 262 106 224 C 108 160 140 84 202 78 C 264 74 296 128 292 204 C 296 250 306 276 298 310 C 290 342 312 366 300 404 C 296 420 274 428 262 414 C 252 396 262 372 262 340 C 262 316 252 296 258 266 C 266 238 274 214 272 190 C 270 172 266 164 258 156 C 244 146 230 142 216 134 C 202 126 190 112 178 100 C 164 110 146 126 138 148 C 130 168 128 196 130 226 C 132 262 146 296 152 332 C 154 362 150 392 136 412 C 128 424 112 426 104 416 Z',
          ),
        },
        shine: ps(['M 182 84 C 226 68 274 92 284 150 C 262 108 226 94 196 100 Z']),
        strands: ps([
          'M 178 100 C 220 92 262 112 282 168 C 292 214 290 250 296 290 C 300 330 290 360 296 396',
          'M 174 110 C 214 106 254 130 272 180 C 280 230 270 260 276 300 C 282 340 270 370 278 404',
          'M 140 150 C 120 190 118 230 126 270 C 134 310 112 340 120 400',
        ]),
        grooves: ps([
          'M 150 130 C 132 170 126 210 134 250 C 142 290 126 330 132 380',
          'M 262 200 C 270 250 252 280 262 330 C 270 360 262 384 266 402',
        ]),
        parting: p('M 178 100 C 176 92 176 86 178 80'),
        edge: { width: 14, opacity: 0.34 },
      };
    case 'bun':
      return {
        back: { path: 'M 164 100 C 153 78 164 46 200 40 C 236 46 247 78 236 100 Z' },
        backFill: 'bun',
        backAccessory: (_refs, traits) => (
          <g>
            <path
              d="M 176 60 C 186 46 214 46 224 60 M 172 76 C 178 88 198 94 216 88 M 190 64 C 198 57 211 59 213 67"
              fill="none"
              stroke={traits.hairColor.light}
              strokeOpacity={0.55}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
            <path
              d="M 206 42 C 230 50 236 74 228 94 M 172 92 C 160 74 170 52 188 44"
              fill="none"
              stroke={traits.hairColor.dark}
              strokeOpacity={0.55}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
            <ellipse
              cx={186}
              cy={56}
              rx={14}
              ry={7}
              fill="#ffffff"
              opacity={0.22}
              transform="rotate(-30 186 56)"
            />
          </g>
        ),
        front: {
          path: p(
            'M 123 182 C 118 132 148 88 200 86 C 252 88 282 132 277 182 C 272 164 262 148 246 138 C 232 130 216 127 200 127 C 184 127 168 130 154 138 C 138 148 128 164 123 182 Z',
          ),
        },
        shine: ps(['M 146 120 C 164 98 196 90 226 92 C 196 100 172 112 158 136 Z']),
        strands: ps([
          'M 136 150 C 146 120 174 100 204 98',
          'M 150 144 C 160 124 184 110 214 108',
          'M 266 150 C 258 120 236 102 208 98',
        ]),
        grooves: ps(['M 170 132 C 188 116 214 112 238 118', 'M 126 168 C 128 148 136 128 150 114']),
        accessory: (_refs, traits) => (
          <g>
            <path
              d="M 166 93 C 182 84 218 84 234 93"
              fill="none"
              stroke={traits.top.base}
              strokeWidth={6}
              strokeLinecap="round"
            />
            <path
              d="M 168 91 C 184 83 216 83 232 91"
              fill="none"
              stroke={traits.top.light}
              strokeOpacity={0.7}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          </g>
        ),
        edge: { width: 12, opacity: 0.3 },
      };
    case 'buzz':
      return {
        front: {
          path: p(
            'M 121 186 C 114 134 144 90 200 88 C 256 90 286 134 279 186 C 277 174 273 164 267 156 C 254 142 232 134 200 134 C 168 134 146 142 133 156 C 127 164 123 174 121 186 Z',
          ),
        },
        shine: ps(['M 152 112 C 168 96 196 90 224 94 C 196 98 174 108 160 126 Z']),
        strands: [],
        grooves: [],
        edge: { width: 8, opacity: 0.2 },
        cropped: true,
      };
    case 'bob':
      return {
        back: {
          path: p(
            'M 110 200 C 96 250 98 290 108 304 L 292 304 C 302 290 304 250 290 200 C 284 120 252 86 200 86 C 148 86 116 120 110 200 Z',
          ),
        },
        front: {
          path: p(
            'M 108 296 C 96 262 100 218 108 186 C 114 128 146 82 200 80 C 254 82 286 128 292 186 C 300 218 304 262 292 296 C 278 304 260 298 250 284 C 262 262 270 236 272 208 C 273 190 270 172 262 160 C 246 150 224 146 200 146 C 176 146 154 150 138 160 C 130 172 127 190 128 208 C 130 236 138 262 150 284 C 140 298 122 304 108 296 Z',
          ),
        },
        shine: ps(['M 140 118 C 156 96 184 86 214 88 C 182 96 160 114 152 142 Z']),
        strands: ps([
          'M 124 150 C 112 190 112 240 122 284',
          'M 276 150 C 288 190 288 240 278 284',
          'M 150 120 C 180 106 224 106 254 122',
        ]),
        grooves: ps(['M 140 160 C 134 200 138 244 150 280', 'M 260 160 C 266 200 262 244 250 280']),
        edge: { width: 14, opacity: 0.34 },
      };
  }
}

const ART_CACHE = new Map<string, HairArt>();

function artFor(traits: AvatarTraits): HairArt {
  const key = `${traits.hairStyle}:${traits.flip}`;
  const cached = ART_CACHE.get(key);
  if (cached) return cached;
  const art = buildArt(traits.hairStyle, traits.flip);
  ART_CACHE.set(key, art);
  return art;
}

interface HairProps {
  uid: string;
  traits: AvatarTraits;
}

/** Long hair: everything that sits behind the head and shoulders. */
export function HairBack({ uid, traits }: HairProps) {
  const art = artFor(traits);
  if (!art.back) return null;
  const refs = makeRefs(uid);
  const { url, id } = refs;
  return (
    <g className="ill-hair-back">
      <clipPath id={id('hairBackClip')}>{draw(art.back, {})}</clipPath>
      {draw(art.back, { fill: url(art.backFill ?? 'hair') })}
      <g clipPath={url('hairBackClip')}>
        {draw(art.back, {
          fill: 'none',
          stroke: traits.hairColor.dark,
          strokeWidth: 16,
          strokeOpacity: 0.4,
        })}
        {draw(art.back, { fill: 'none', stroke: url('rimR'), strokeWidth: 6 })}
        {art.backAccessory ? art.backAccessory(refs, traits) : null}
      </g>
    </g>
  );
}

/** A soft shadow the hair throws on the forehead and cheeks, built from stacked strokes. */
export function HairShadow({ uid, traits }: HairProps) {
  const art = artFor(traits);
  const { url } = makeRefs(uid);
  const deep = traits.skin.deep;
  return (
    <g clipPath={url('face')} className="ill-hair-shadow">
      {draw(art.front, { fill: 'none', stroke: deep, strokeWidth: 22, strokeOpacity: 0.07 })}
      {draw(art.front, { fill: 'none', stroke: deep, strokeWidth: 14, strokeOpacity: 0.1 })}
      {draw(art.front, { fill: 'none', stroke: deep, strokeWidth: 8, strokeOpacity: 0.16 })}
    </g>
  );
}

const STUBBLE = Array.from({ length: 90 }, (_, i) => ({
  x: 132 + ((i * 53) % 136),
  y: 94 + ((i * 29) % 50),
  r: 0.7 + ((i * 7) % 5) * 0.14,
}));

export function HairFront({ uid, traits }: HairProps) {
  const art = artFor(traits);
  const refs = makeRefs(uid);
  const { url, id } = refs;
  const hair = traits.hairColor;
  return (
    <g className="ill-hair-front">
      <clipPath id={id('hairClip')}>{draw(art.front, {})}</clipPath>
      {draw(art.front, { fill: url(art.cropped ? 'hairFade' : 'hair') })}
      <g clipPath={url('hairClip')}>
        {draw(art.front, {
          fill: 'none',
          stroke: hair.dark,
          strokeWidth: art.edge.width,
          strokeOpacity: art.edge.opacity,
        })}
        {art.cropped
          ? STUBBLE.map((dot, i) => (
              <circle
                key={i}
                cx={dot.x}
                cy={dot.y}
                r={dot.r}
                fill={i % 3 === 0 ? hair.light : hair.dark}
                opacity={i % 3 === 0 ? 0.35 : 0.4}
              />
            ))
          : null}
        {art.grooves.map((d, i) => (
          <g key={`g${i}`} fill="none" stroke={hair.dark} strokeLinecap="round">
            <path d={d} strokeOpacity={0.14} strokeWidth={7} />
            <path d={d} strokeOpacity={0.38} strokeWidth={2} />
          </g>
        ))}
        {art.strands.map((d, i) => (
          <g key={`s${i}`} fill="none" stroke={hair.light} strokeLinecap="round">
            <path d={d} strokeOpacity={0.16} strokeWidth={7} />
            <path d={d} strokeOpacity={0.42} strokeWidth={1.8} />
          </g>
        ))}
        {art.shine.map((d, i) => (
          <path key={`h${i}`} d={d} fill={url('hairShine')} />
        ))}
        {art.noRim ? null : (
          <g mask={url('outsideFace')}>
            {draw(art.front, { fill: 'none', stroke: url('rimR'), strokeWidth: 6 })}
          </g>
        )}
      </g>
      {art.parting ? (
        <path
          d={art.parting}
          fill="none"
          stroke={hair.dark}
          strokeOpacity={0.7}
          strokeWidth={2.6}
          strokeLinecap="round"
        />
      ) : null}
      {art.accessory ? art.accessory(refs, traits) : null}
    </g>
  );
}
