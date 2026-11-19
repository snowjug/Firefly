import type { ReactNode } from 'react';
import { HairBack, HairFront, HairShadow } from './avatar-hair.tsx';
import { makeRefs, mirrorPath, Stops, type Refs } from './avatar-kit.tsx';
import { mixColor, type AvatarTraits, type GlassesShape } from './avatar-traits.ts';

export type MouthKey = 'calm' | 'concerned' | 'frustrated' | 'angry' | 'escalating' | 'happy';

/** The two edge lights of the portrait, one on each side of the figure. */
export interface RimLight {
  left: string;
  leftOpacity: number;
  right: string;
  rightOpacity: number;
}

/** The figure is drawn on a 400 × 480 canvas, then enlarged so the head fills more of a small frame. */
export const FIGURE_TRANSFORM = 'translate(200 370) scale(1.16) translate(-200 -352)';

const FACE_D =
  'M 200 102 C 149 102 118 140 118 194 C 118 254 152 308 200 308 C 248 308 282 254 282 194 C 282 140 251 102 200 102 Z';
const NECK_D = 'M 160 272 C 162 314 156 338 144 354 L 256 354 C 244 338 238 314 240 272 Z';
const TORSO_D =
  'M 8 500 C 8 436 24 398 76 378 C 112 364 138 356 160 346 L 240 346 C 262 356 288 364 324 378 C 376 398 392 436 392 500 Z';
/** Narrower shoulders, for figures that sit inside a box instead of bleeding off its sides. */
const TORSO_COMPACT_D =
  'M 44 500 C 44 440 56 406 96 386 C 124 372 144 358 160 346 L 240 346 C 256 358 276 372 304 386 C 344 406 356 440 356 500 Z';

const EYE_X = [159, 241] as const;
const EYE_Y = 205;
const EYE_D = 'M -22 -1 C -14 -16 12 -17 22 2 C 14 14 -14 14 -22 -1 Z';
const LID_COVER_D = 'M -38 -1 L -22 -1 C -14 -16 12 -17 22 2 L 38 2 L 38 -48 L -38 -48 Z';
const LASH_D = 'M -22 -1 C -14 -16 12 -17 22 2';
const LOWER_COVER_D = 'M -38 -1 L -22 -1 C -14 14 14 14 22 2 L 38 2 L 38 48 L -38 48 Z';
const BLINK_COVER_D = 'M -38 -18 L 38 -18 L 38 2 C 26 16 -26 16 -38 -1 Z';
const BLINK_LINE_D = 'M -22 -1 C -14 14 14 14 22 2';
const CREASE_D = 'M -20 -7 C -12 -21 12 -22 20 -6';
const BROW_D =
  'M -25 3.2 C -17 -3.2 -4 -7.2 7 -6.8 C 15 -6.4 21 -4.2 25 -1.2 C 25 0.6 24 2 22 2.2 C 15 -0.6 5 -2 -4 -1.6 C -13 -1 -19 2.6 -25 3.2 Z';

const CAVITY = '#3a0e17';
const TEETH = '#fbf6ee';
const TEETH_SHADE = '#e2d6ca';
const TONGUE = '#d5626e';

interface BustDefsProps {
  uid: string;
  traits: AvatarTraits;
  rim: RimLight;
  compact: boolean;
}

/** Every gradient, pattern and clip path the bust needs, under this instance's id prefix. */
export function BustDefs({ uid, traits, rim, compact }: BustDefsProps) {
  const { id } = makeRefs(uid);
  const { skin, hairColor: hair, top, eyes } = traits;
  const hairLit = mixColor(hair.light, hair.base, 0.3);
  return (
    <defs>
      <radialGradient id={id('skin')} gradientUnits="userSpaceOnUse" cx="166" cy="146" r="198">
        <Stops
          stops={[
            [0, skin.light],
            [0.44, skin.base],
            [1, skin.shade],
          ]}
        />
      </radialGradient>
      <linearGradient
        id={id('skinSide')}
        gradientUnits="userSpaceOnUse"
        x1="176"
        y1="0"
        x2="288"
        y2="0"
      >
        <Stops
          stops={[
            [0, skin.deep, 0],
            [0.55, skin.deep, 0.15],
            [1, skin.deep, 0.4],
          ]}
        />
      </linearGradient>
      <linearGradient id={id('jaw')} gradientUnits="userSpaceOnUse" x1="0" y1="234" x2="0" y2="310">
        <Stops
          stops={[
            [0, skin.deep, 0],
            [1, skin.deep, 0.38],
          ]}
        />
      </linearGradient>
      <linearGradient
        id={id('neck')}
        gradientUnits="userSpaceOnUse"
        x1="0"
        y1="272"
        x2="0"
        y2="354"
      >
        <Stops
          stops={[
            [0, skin.deep, 0.6],
            [0.45, skin.deep, 0.22],
            [1, skin.deep, 0.05],
          ]}
        />
      </linearGradient>
      <radialGradient id={id('chinShadow')}>
        <Stops
          stops={[
            [0, skin.deep, 0.7],
            [0.6, skin.deep, 0.28],
            [1, skin.deep, 0],
          ]}
        />
      </radialGradient>
      <radialGradient id={id('blush')}>
        <Stops
          stops={[
            [0, skin.blush, 0.85],
            [0.6, skin.blush, 0.32],
            [1, skin.blush, 0],
          ]}
        />
      </radialGradient>
      <radialGradient id={id('rage')}>
        <Stops
          stops={[
            [0, skin.blush, 0.9],
            [0.7, skin.blush, 0.6],
            [1, skin.blush, 0],
          ]}
        />
      </radialGradient>
      <radialGradient id={id('sheen')}>
        <Stops
          stops={[
            [0, '#ffffff', 0.6],
            [1, '#ffffff', 0],
          ]}
        />
      </radialGradient>
      <radialGradient id={id('socket')}>
        <Stops
          stops={[
            [0, skin.deep, 0.34],
            [1, skin.deep, 0],
          ]}
        />
      </radialGradient>
      <linearGradient id={id('nose')} x1="0" y1="0" x2="1" y2="0">
        <Stops
          stops={[
            [0, skin.deep, 0],
            [0.5, skin.deep, 0.2],
            [1, skin.deep, 0],
          ]}
        />
      </linearGradient>
      <linearGradient id={id('lipLower')} x1="0" y1="0" x2="0" y2="1">
        <Stops
          stops={[
            [0, mixColor(skin.lip, skin.deep, 0.3)],
            [0.45, skin.lip],
            [1, mixColor(skin.lip, '#ffffff', 0.28)],
          ]}
        />
      </linearGradient>

      <linearGradient
        id={id('hair')}
        gradientUnits="userSpaceOnUse"
        x1="120"
        y1="70"
        x2="292"
        y2="330"
      >
        <Stops
          stops={[
            [0, hairLit],
            [0.38, hair.base],
            [1, hair.dark],
          ]}
        />
      </linearGradient>
      <radialGradient id={id('bun')} gradientUnits="userSpaceOnUse" cx="186" cy="50" r="48">
        <Stops
          stops={[
            [0, hairLit],
            [0.5, hair.base],
            [1, hair.dark],
          ]}
        />
      </radialGradient>
      <linearGradient
        id={id('hairFade')}
        gradientUnits="userSpaceOnUse"
        x1="0"
        y1="86"
        x2="0"
        y2="150"
      >
        <Stops
          stops={[
            [0, hair.base, 0.96],
            [0.7, hair.base, 0.7],
            [1, hair.base, 0.28],
          ]}
        />
      </linearGradient>
      <linearGradient id={id('hairShine')} x1="0" y1="0" x2="1" y2="1">
        <Stops
          stops={[
            [0, '#ffffff', 0.55],
            [0.6, '#ffffff', 0.12],
            [1, '#ffffff', 0],
          ]}
        />
      </linearGradient>

      <linearGradient
        id={id('top')}
        gradientUnits="userSpaceOnUse"
        x1="70"
        y1="360"
        x2="330"
        y2="500"
      >
        <Stops
          stops={[
            [0, top.light],
            [0.42, top.base],
            [1, top.shade],
          ]}
        />
      </linearGradient>
      <linearGradient
        id={id('topSide')}
        gradientUnits="userSpaceOnUse"
        x1="8"
        y1="0"
        x2="392"
        y2="0"
      >
        <Stops
          stops={[
            [0, top.shade, 0.5],
            [0.2, top.shade, 0],
            [0.62, top.shade, 0],
            [1, top.shade, 0.55],
          ]}
        />
      </linearGradient>
      <radialGradient id={id('clothShadow')}>
        <Stops
          stops={[
            [0, top.shade, 0.75],
            [1, top.shade, 0],
          ]}
        />
      </radialGradient>
      <pattern
        id={id('knit')}
        width="7"
        height="7"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(6)"
      >
        <rect width="3.4" height="7" fill={top.shade} opacity="0.17" />
      </pattern>
      <pattern id={id('ribs')} width="5" height="5" patternUnits="userSpaceOnUse">
        <rect width="2.4" height="5" fill={top.shade} opacity="0.3" />
      </pattern>

      <linearGradient
        id={id('rimR')}
        gradientUnits="userSpaceOnUse"
        x1="206"
        y1="0"
        x2="290"
        y2="0"
      >
        <Stops
          stops={[
            [0, rim.right, 0],
            [0.3, rim.right, 0],
            [1, rim.right, rim.rightOpacity],
          ]}
        />
      </linearGradient>
      <linearGradient
        id={id('rimL')}
        gradientUnits="userSpaceOnUse"
        x1="196"
        y1="0"
        x2="112"
        y2="0"
      >
        <Stops
          stops={[
            [0, rim.left, 0],
            [0.4, rim.left, 0],
            [1, rim.left, rim.leftOpacity],
          ]}
        />
      </linearGradient>
      <linearGradient
        id={id('rimBodyR')}
        gradientUnits="userSpaceOnUse"
        x1="240"
        y1="430"
        x2="360"
        y2="372"
      >
        <Stops
          stops={[
            [0, rim.right, 0],
            [1, rim.right, rim.rightOpacity],
          ]}
        />
      </linearGradient>
      <linearGradient
        id={id('rimBodyL')}
        gradientUnits="userSpaceOnUse"
        x1="160"
        y1="430"
        x2="40"
        y2="388"
      >
        <Stops
          stops={[
            [0, rim.left, 0],
            [1, rim.left, rim.leftOpacity],
          ]}
        />
      </linearGradient>

      <radialGradient id={id('sclera')}>
        <Stops
          stops={[
            [0, '#fcfaf7'],
            [0.65, '#f1ece8'],
            [1, '#cfc4c0'],
          ]}
        />
      </radialGradient>
      <radialGradient id={id('iris')}>
        <Stops
          stops={[
            [0, eyes.light],
            [0.5, eyes.base],
            [0.9, eyes.rim],
            [1, eyes.rim],
          ]}
        />
      </radialGradient>
      <linearGradient id={id('lidShade')} x1="0" y1="0" x2="0" y2="1">
        <Stops
          stops={[
            [0, '#1a0c0a', 0.34],
            [1, '#1a0c0a', 0],
          ]}
        />
      </linearGradient>

      <linearGradient id={id('lens')} x1="0" y1="0" x2="1" y2="1">
        <Stops
          stops={[
            [0, '#ffffff', 0.2],
            [0.55, '#cfe4ff', 0.06],
            [1, '#ffffff', 0.1],
          ]}
        />
      </linearGradient>

      <clipPath id={id('face')}>
        <path d={FACE_D} />
      </clipPath>
      <mask
        id={id('outsideFace')}
        maskUnits="userSpaceOnUse"
        x="-60"
        y="-60"
        width="520"
        height="620"
      >
        <rect x="-60" y="-60" width="520" height="620" fill="#ffffff" />
        <path d={FACE_D} fill="#000000" />
      </mask>
      <clipPath id={id('torso')}>
        <path d={compact ? TORSO_COMPACT_D : TORSO_D} />
      </clipPath>
      <clipPath id={id('neckClip')}>
        <path d={NECK_D} />
      </clipPath>
      <clipPath id={id('eye-l')}>
        <path d={EYE_D} />
      </clipPath>
      <clipPath id={id('eye-r')}>
        <path d={mirrorPath(EYE_D, 0)} />
      </clipPath>
    </defs>
  );
}

/** The three nested groups that carry the head's pose, the pointer look and the idle or talking bob. */
export function HeadMotion({ children }: { children: ReactNode }) {
  return (
    <g className="ill-pose">
      <g className="ill-look">
        <g className="ill-bob">{children}</g>
      </g>
    </g>
  );
}

interface PartProps {
  uid: string;
  traits: AvatarTraits;
}

// ---------------------------------------------------------------------------------------------
// Clothing

function Collar({ uid, traits }: PartProps) {
  const { url } = makeRefs(uid);
  const { top, shirt } = traits;
  const trim = top.light;
  switch (traits.collar) {
    case 'crew':
      return (
        <g>
          <path d="M 159 350 C 169 372 231 372 241 350 Z" fill={url('skin')} />
          <path d="M 159 350 C 169 372 231 372 241 350 Z" fill={url('neck')} opacity={0.7} />
          <path
            d="M 144 352 C 154 392 246 392 256 352 L 241 350 C 231 372 169 372 159 350 Z"
            fill={trim}
          />
          <path
            d="M 144 352 C 154 392 246 392 256 352 L 241 350 C 231 372 169 372 159 350 Z"
            fill={url('ribs')}
          />
          <path
            d="M 159 350 C 169 372 231 372 241 350"
            fill="none"
            stroke={top.shade}
            strokeOpacity={0.45}
            strokeWidth={1.6}
          />
          <path
            d="M 150 358 C 160 384 240 384 250 358"
            fill="none"
            stroke="#ffffff"
            strokeOpacity={0.22}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </g>
      );
    case 'vneck':
      return (
        <g>
          <path d="M 154 350 L 200 414 L 246 350 Z" fill={url('skin')} />
          <path d="M 154 350 L 200 414 L 246 350 Z" fill={url('neck')} opacity={0.8} />
          <path
            d="M 148 352 L 200 422 L 252 352"
            fill="none"
            stroke={trim}
            strokeWidth={12}
            strokeLinejoin="round"
          />
          <path
            d="M 148 352 L 200 422 L 252 352"
            fill="none"
            stroke={url('ribs')}
            strokeWidth={12}
            strokeLinejoin="round"
          />
          <path
            d="M 154 352 L 200 414 L 246 352"
            fill="none"
            stroke={top.shade}
            strokeOpacity={0.5}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        </g>
      );
    case 'polo':
      return (
        <g>
          <path d="M 166 348 L 200 398 L 234 348 Z" fill={url('skin')} />
          <path d="M 166 348 L 200 398 L 234 348 Z" fill={url('neck')} opacity={0.8} />
          <rect x={194} y={394} width={12} height={110} fill={top.shade} opacity={0.22} />
          <path d="M 200 396 L 200 500" stroke={top.shade} strokeOpacity={0.5} strokeWidth={1.4} />
          {[414, 442, 470].map((y) => (
            <g key={y}>
              <circle cx={200} cy={y} r={3.6} fill={mixColor(top.light, '#ffffff', 0.4)} />
              <circle
                cx={200}
                cy={y}
                r={3.6}
                fill="none"
                stroke={top.shade}
                strokeOpacity={0.5}
                strokeWidth={1}
              />
            </g>
          ))}
          <path
            d="M 142 346 C 154 340 168 342 174 348 L 200 398 C 174 392 152 374 140 354 Z"
            fill={trim}
          />
          <path
            d="M 258 346 C 246 340 232 342 226 348 L 200 398 C 226 392 248 374 260 354 Z"
            fill={mixColor(trim, top.base, 0.35)}
          />
          <path
            d="M 174 348 L 200 398 L 226 348"
            fill="none"
            stroke={top.shade}
            strokeOpacity={0.45}
            strokeWidth={1.4}
          />
        </g>
      );
    case 'blazer':
      return (
        <g>
          <path d="M 162 350 L 200 452 L 238 350 Z" fill={shirt} />
          <path d="M 162 350 L 200 452 L 238 350 Z" fill={url('neck')} opacity={0.45} />
          <path
            d="M 148 342 C 158 338 170 342 178 350 L 198 388 C 174 384 156 368 144 350 Z"
            fill={mixColor(shirt, '#ffffff', 0.4)}
          />
          <path
            d="M 252 342 C 242 338 230 342 222 350 L 202 388 C 226 384 244 368 256 350 Z"
            fill={shirt}
          />
          <path
            d="M 138 364 C 142 354 154 350 162 350 L 200 452 L 190 476 L 130 392 C 128 382 132 372 138 364 Z"
            fill={top.light}
          />
          <path
            d="M 262 364 C 258 354 246 350 238 350 L 200 452 L 210 476 L 270 392 C 272 382 268 372 262 364 Z"
            fill={mixColor(top.base, top.shade, 0.3)}
          />
          <path
            d="M 162 350 L 200 452 L 190 476"
            fill="none"
            stroke={top.shade}
            strokeOpacity={0.55}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          <path
            d="M 238 350 L 200 452 L 210 476"
            fill="none"
            stroke={top.shade}
            strokeOpacity={0.55}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          <circle cx={200} cy={486} r={4.2} fill={top.shade} opacity={0.7} />
        </g>
      );
    case 'turtleneck':
      return (
        <g>
          <path
            d="M 156 298 C 180 309 220 309 244 298 L 254 360 C 228 374 172 374 146 360 Z"
            fill={trim}
          />
          <path
            d="M 156 298 C 180 309 220 309 244 298 L 254 360 C 228 374 172 374 146 360 Z"
            fill={url('ribs')}
          />
          <path
            d="M 152 332 C 180 344 220 344 248 332"
            fill="none"
            stroke={top.shade}
            strokeOpacity={0.4}
            strokeWidth={2}
          />
          <path
            d="M 148 360 C 176 374 224 374 252 360"
            fill="none"
            stroke={top.shade}
            strokeOpacity={0.45}
            strokeWidth={1.6}
          />
          <path
            d="M 160 304 C 182 314 218 314 240 304"
            fill="none"
            stroke="#ffffff"
            strokeOpacity={0.3}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </g>
      );
  }
}

function Body({
  uid,
  traits,
  compact,
  overlay,
}: PartProps & { compact: boolean; overlay?: ReactNode }) {
  const { url } = makeRefs(uid);
  const { top, collar } = traits;
  const torso = compact ? TORSO_COMPACT_D : TORSO_D;
  const knit = collar === 'crew' || collar === 'vneck' || collar === 'turtleneck';
  return (
    <g transform="translate(0 -10)">
      <g className="ill-breath">
        <path d={torso} fill={url('top')} />
        <g clipPath={url('torso')}>
          {knit ? <rect x={0} y={330} width={400} height={180} fill={url('knit')} /> : null}
          <rect x={0} y={330} width={400} height={180} fill={url('topSide')} />
          <path
            d="M 62 402 C 78 440 76 472 58 506 L 100 506 C 104 470 100 438 86 408 Z"
            fill={top.shade}
            opacity={0.26}
          />
          <path
            d="M 338 402 C 322 440 324 472 342 506 L 300 506 C 296 470 300 438 314 408 Z"
            fill={top.shade}
            opacity={0.34}
          />
          <ellipse cx={166} cy={430} rx={76} ry={44} fill={url('sheen')} opacity={0.2} />
          <ellipse cx={200} cy={364} rx={76} ry={26} fill={url('clothShadow')} opacity={0.8} />
        </g>
        <path
          d={torso}
          fill="none"
          stroke={url('rimBodyR')}
          strokeWidth={5}
          clipPath={url('torso')}
        />
        <path
          d={torso}
          fill="none"
          stroke={url('rimBodyL')}
          strokeWidth={5}
          clipPath={url('torso')}
        />
        <path
          d="M 96 386 C 124 372 138 358 150 350"
          fill="none"
          stroke={top.light}
          strokeOpacity={0.5}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <path d={NECK_D} fill={url('skin')} />
        <path d={NECK_D} fill={url('neck')} />
        <g clipPath={url('neckClip')}>
          <rect x={150} y={262} width={110} height={100} fill={url('skinSide')} />
          <ellipse cx={200} cy={316} rx={70} ry={32} fill={url('chinShadow')} />
        </g>
        <Collar uid={uid} traits={traits} />
        {overlay}
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------------------------
// The face

function Ears({ uid, traits }: PartProps) {
  const { url } = makeRefs(uid);
  const { skin } = traits;
  return (
    <g>
      {[116, 284].map((x, i) => (
        <g key={x}>
          <ellipse cx={x} cy={212} rx={11} ry={20} fill={url('skin')} />
          <ellipse
            cx={x}
            cy={212}
            rx={11}
            ry={20}
            fill={skin.deep}
            opacity={i === 0 ? 0.1 : 0.22}
          />
          <path
            d={
              i === 0
                ? 'M 114 200 C 109 206 109 218 115 224'
                : 'M 286 200 C 291 206 291 218 285 224'
            }
            fill="none"
            stroke={skin.deep}
            strokeOpacity={0.55}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </g>
      ))}
    </g>
  );
}

function Nose({ uid, traits }: PartProps) {
  const { url } = makeRefs(uid);
  const deep = traits.skin.deep;
  return (
    <g>
      <path
        d="M 204 192 C 210 206 212 224 208 236 L 200 236 C 203 220 202 204 200 192 Z"
        fill={url('nose')}
      />
      <ellipse cx={200} cy={249} rx={14} ry={4} fill={url('socket')} opacity={0.55} />
      <path
        d="M 187 234 C 191 243 209 243 213 234"
        fill="none"
        stroke={deep}
        strokeOpacity={0.42}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <ellipse cx={191.5} cy={239.4} rx={3} ry={1.8} fill={deep} opacity={0.5} />
      <ellipse cx={208.5} cy={239.4} rx={3} ry={1.8} fill={deep} opacity={0.5} />
      <path
        d="M 184 227 C 180 233 182 239 187 241"
        fill="none"
        stroke={deep}
        strokeOpacity={0.26}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <path
        d="M 216 227 C 220 233 218 239 213 241"
        fill="none"
        stroke={deep}
        strokeOpacity={0.26}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <ellipse cx={199} cy={230} rx={8} ry={5} fill={url('sheen')} opacity={0.8} />
    </g>
  );
}

const FRECKLES: readonly (readonly [number, number, number])[] = [
  [168, 230, 1.4],
  [176, 235, 1.1],
  [158, 236, 1.2],
  [184, 228, 1.0],
  [148, 228, 1.3],
  [165, 242, 1.0],
  [232, 230, 1.4],
  [224, 235, 1.1],
  [242, 236, 1.2],
  [216, 228, 1.0],
  [252, 228, 1.3],
  [235, 242, 1.0],
  [190, 222, 1.0],
  [210, 222, 1.0],
  [178, 244, 0.9],
  [222, 244, 0.9],
];

function Freckles({ color }: { color: string }) {
  return (
    <g opacity={0.45}>
      {FRECKLES.map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={color} />
      ))}
    </g>
  );
}

function FaceBase({ uid, traits }: PartProps) {
  const { url } = makeRefs(uid);
  const { skin } = traits;
  return (
    <g>
      <path d={FACE_D} fill={url('skin')} />
      <g clipPath={url('face')}>
        <rect x={0} y={0} width={400} height={330} fill={url('skinSide')} />
        <rect x={0} y={234} width={400} height={90} fill={url('jaw')} />
        <ellipse cx={182} cy={128} rx={44} ry={19} fill={url('sheen')} opacity={0.7} />
        <ellipse cx={140} cy={230} rx={22} ry={13} fill={url('sheen')} opacity={0.38} />
        <ellipse cx={260} cy={230} rx={18} ry={10} fill={url('sheen')} opacity={0.2} />
        <ellipse cx={198} cy={296} rx={18} ry={7} fill={url('sheen')} opacity={0.26} />
        <g className="ill-cheeks">
          <ellipse cx={142} cy={244} rx={30} ry={19} fill={url('blush')} />
          <ellipse cx={258} cy={244} rx={30} ry={19} fill={url('blush')} />
        </g>
        <ellipse className="ill-rage" cx={200} cy={218} rx={100} ry={112} fill={url('rage')} />
        <ellipse cx={159} cy={192} rx={31} ry={13} fill={url('socket')} />
        <ellipse cx={241} cy={192} rx={31} ry={13} fill={url('socket')} />
        <Nose uid={uid} traits={traits} />
        {traits.freckles ? <Freckles color={skin.deep} /> : null}
        <HairShadow uid={uid} traits={traits} />
      </g>
      <path d={FACE_D} fill="none" stroke={url('rimR')} strokeWidth={3} clipPath={url('face')} />
      <path d={FACE_D} fill="none" stroke={url('rimL')} strokeWidth={3} clipPath={url('face')} />
    </g>
  );
}

function Eye({ uid, traits, side }: PartProps & { side: 'l' | 'r' }) {
  const { url } = makeRefs(uid);
  const left = side === 'l';
  const flip = (d: string) => (left ? d : mirrorPath(d, 0));
  const lid = mixColor(traits.skin.light, traits.skin.base, left ? 0.58 : 0.9);
  const lash = mixColor(traits.skin.deep, '#0b0504', 0.72);
  return (
    <g
      transform={`translate(${EYE_X[left ? 0 : 1]} ${EYE_Y})`}
      className={`ill-eye ill-eye-${side}`}
    >
      <ellipse cx={0} cy={-14} rx={32} ry={12} fill={url('socket')} />
      <ellipse cx={0} cy={16} rx={23} ry={6} fill={url('socket')} opacity={0.45} />
      <path d={flip(EYE_D)} fill={url('sclera')} />
      <g clipPath={url(`eye-${side}`)}>
        <g className="ill-gaze">
          <g className="ill-iris">
            <circle cx={0} cy={-0.3} r={11.2} fill={url('iris')} />
            <circle
              cx={0}
              cy={-0.3}
              r={10.4}
              fill="none"
              stroke={traits.eyes.light}
              strokeOpacity={0.3}
              strokeWidth={1.3}
            />
            <circle cx={0} cy={-0.3} r={5.3} fill="#0d0809" />
            <circle cx={-3.8} cy={-4} r={3.6} fill="#ffffff" opacity={0.96} />
            <circle cx={4} cy={3.5} r={1.7} fill="#ffffff" opacity={0.6} />
          </g>
        </g>
        <rect x={-26} y={-16} width={52} height={11} fill={url('lidShade')} />
        <g className="ill-lid">
          <path d={flip(LID_COVER_D)} fill={lid} />
          <path
            d={flip(LASH_D)}
            fill="none"
            stroke={lash}
            strokeWidth={2.6}
            strokeLinecap="round"
          />
        </g>
        <g className="ill-lid-low">
          <path d={flip(LOWER_COVER_D)} fill={lid} />
        </g>
        <g className="ill-blink">
          <path d={flip(BLINK_COVER_D)} fill={lid} />
          <path
            d={flip(BLINK_LINE_D)}
            fill="none"
            stroke={lash}
            strokeWidth={2.6}
            strokeLinecap="round"
          />
        </g>
      </g>
      <g className="ill-lid">
        <path
          d={flip(CREASE_D)}
          fill="none"
          stroke={traits.skin.deep}
          strokeOpacity={0.45}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </g>
      <path
        d={flip(BLINK_LINE_D)}
        fill="none"
        stroke={traits.skin.deep}
        strokeOpacity={0.32}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </g>
  );
}

function Brow({ traits, side }: { traits: AvatarTraits; side: 'l' | 'r' }) {
  const left = side === 'l';
  const weight = { fine: 0.74, regular: 0.92, full: 1.2 }[traits.brows];
  const hair = traits.hairColor;
  return (
    <g transform={`translate(${left ? 158 : 242} 176)`}>
      <g className={`ill-brow ill-brow-${side}`}>
        <path
          d={left ? BROW_D : mirrorPath(BROW_D, 0)}
          transform={`scale(1 ${weight})`}
          fill={mixColor(hair.base, hair.dark, 0.5)}
          opacity={0.94}
        />
      </g>
    </g>
  );
}

/** Frown, forehead and cheek lines that come and go with the mood. */
function Lines({ traits }: { traits: AvatarTraits }) {
  const deep = traits.skin.deep;
  return (
    <g fill="none" stroke={deep} strokeLinecap="round">
      <g className="ill-furrow" strokeOpacity={0.55} strokeWidth={1.8}>
        <path d="M 194 165 C 192.5 171 192.5 177 194 183" />
        <path d="M 206 165 C 207.5 171 207.5 177 206 183" />
      </g>
      <g className="ill-worry" strokeOpacity={0.4} strokeWidth={1.6}>
        <path d="M 170 150 C 186 146 214 146 230 150" />
        <path d="M 175 158 C 188 155 212 155 225 158" />
      </g>
      <g className="ill-tension" strokeOpacity={0.4} strokeWidth={1.8}>
        <path d="M 176 238 C 166 248 166 260 172 268" />
        <path d="M 224 238 C 234 248 234 260 228 268" />
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------------------------
// Mouths: every mood has its own, and they cross-fade. Lips that can part get a `cavity` and a
// `lip-low` so speech can open them.

function mouthArt(key: MouthKey, traits: AvatarTraits, url: Refs['url']): ReactNode {
  const { skin } = traits;
  const lipDark = mixColor(skin.lip, '#2b0c12', 0.32);
  const line = mixColor(skin.lip, '#1c060a', 0.62);
  const crease = skin.deep;
  const shadowUnder = (cy: number, rx: number) => (
    <ellipse cx={0} cy={cy} rx={rx} ry={2.6} fill={crease} opacity={0.18} />
  );
  switch (key) {
    case 'calm':
      return (
        <>
          {shadowUnder(16, 12)}
          <g className="ill-cavity">
            <path
              d="M -24 -5 C -12 -6 12 -6 24 -5 C 21 9 12 13 0 13 C -12 13 -21 9 -24 -5 Z"
              fill={CAVITY}
            />
            <path d="M -16 -3 C -8 -4 8 -4 16 -3 L 15 1.4 C 8 0.4 -8 0.4 -15 1.4 Z" fill={TEETH} />
            <ellipse cx={0} cy={8} rx={9} ry={3.2} fill={TONGUE} />
          </g>
          <g className="ill-lip-low">
            <path
              d="M -24 -3.4 C -14 3.4 14 3.4 24 -3.4 C 19 9.6 10 12.4 0 12.4 C -10 12.4 -19 9.6 -24 -3.4 Z"
              fill={url('lipLower')}
            />
            <ellipse cx={0} cy={6.6} rx={7} ry={1.8} fill="#ffffff" opacity={0.36} />
          </g>
          <path
            d="M -24 -3.4 C -18 -6.6 -10 -8.2 -4.6 -8.4 C -2.4 -8.6 -1.2 -7.4 0 -7.2 C 1.2 -7.4 2.4 -8.6 4.6 -8.4 C 10 -8.2 18 -6.6 24 -3.4 C 14 3.4 -14 3.4 -24 -3.4 Z"
            fill={lipDark}
          />
          <path
            d="M -24 -3.4 C -14 3.4 14 3.4 24 -3.4"
            fill="none"
            stroke={line}
            strokeWidth={1.3}
            strokeLinecap="round"
          />
          <g
            fill="none"
            stroke={crease}
            strokeOpacity={0.4}
            strokeLinecap="round"
            strokeWidth={1.5}
          >
            <path d="M -26.4 -4 C -28.4 -4.6 -29 -6 -28.4 -7" />
            <path d="M 26.4 -4 C 28.4 -4.6 29 -6 28.4 -7" />
          </g>
          <g
            fill="none"
            stroke={crease}
            strokeOpacity={0.16}
            strokeLinecap="round"
            strokeWidth={1.4}
          >
            <path d="M -34 -5 C -38 -1 -37 7 -32 11" />
            <path d="M 34 -5 C 38 -1 37 7 32 11" />
          </g>
        </>
      );
    case 'concerned':
      return (
        <>
          {shadowUnder(16, 9)}
          <g className="ill-cavity">
            <path
              d="M -17 -3 C -8 -4 8 -4 17 -3 C 15 6 8 9 0 9 C -8 9 -15 6 -17 -3 Z"
              fill={CAVITY}
            />
            <path
              d="M -12 -1.6 C -6 -2.6 6 -2.6 12 -1.6 L 11 1.6 C 6 0.8 -6 0.8 -11 1.6 Z"
              fill={TEETH}
            />
          </g>
          <g className="ill-lip-low">
            <path
              d="M -18 2 C -9 -1.2 9 -1.2 18 2 C 14 9 7 11.4 0 11.4 C -7 11.4 -14 9 -18 2 Z"
              fill={url('lipLower')}
            />
            <ellipse cx={0} cy={6} rx={5.2} ry={1.5} fill="#ffffff" opacity={0.3} />
          </g>
          <path
            d="M -18 2 C -12 -3 -6 -4.4 -2.4 -4.4 C -1.2 -4.4 -0.6 -3.8 0 -3.6 C 0.6 -3.8 1.2 -4.4 2.4 -4.4 C 6 -4.4 12 -3 18 2 C 9 -1.2 -9 -1.2 -18 2 Z"
            fill={lipDark}
          />
          <path
            d="M -18 2 C -9 -1.2 9 -1.2 18 2"
            fill="none"
            stroke={line}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
          <path
            d="M -7 17 C -3 15.2 3 15.2 7 17"
            fill="none"
            stroke={crease}
            strokeOpacity={0.35}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </>
      );
    case 'frustrated':
      return (
        <>
          {shadowUnder(15, 10)}
          <g className="ill-cavity">
            <path
              d="M -20 -2 C -9 -3 9 -3 20 -2 C 18 7 9 10 0 10 C -9 10 -18 7 -20 -2 Z"
              fill={CAVITY}
            />
            <path d="M -14 -1 C -7 -2 7 -2 14 -1 L 13 2 C 7 1.2 -7 1.2 -13 2 Z" fill={TEETH} />
          </g>
          <g className="ill-lip-low">
            <path
              d="M -21 3 C -10 -0.6 10 -0.6 21 3 C 16 9.6 8 11 0 11 C -8 11 -16 9.6 -21 3 Z"
              fill={url('lipLower')}
            />
          </g>
          <path
            d="M -21 3 C -14 -2 -7 -3.8 -2.6 -3.8 C -1.2 -3.8 -0.6 -3.2 0 -3 C 0.6 -3.2 1.2 -3.8 2.6 -3.8 C 7 -3.8 14 -2 21 3 C 10 -0.6 -10 -0.6 -21 3 Z"
            fill={lipDark}
          />
          <path
            d="M -21 3 C -10 -0.6 10 -0.6 21 3"
            fill="none"
            stroke={line}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          <g
            fill="none"
            stroke={crease}
            strokeOpacity={0.45}
            strokeLinecap="round"
            strokeWidth={1.5}
          >
            <path d="M -22 3.8 C -24.4 5.2 -25.4 7.2 -25 9" />
            <path d="M 22 3.8 C 24.4 5.2 25.4 7.2 25 9" />
            <path d="M -9 15 C -4 12.8 4 12.8 9 15" />
          </g>
        </>
      );
    case 'angry':
      return (
        <g className="ill-tense">
          {shadowUnder(14, 14)}
          <path
            d="M -26 8 C -19 -2 -10 -4.6 0 -4.6 C 10 -4.6 19 -2 26 8 C 19 8 10 6.8 0 6.8 C -10 6.8 -19 8 -26 8 Z"
            fill={TEETH}
          />
          <path
            d="M -22 3.6 C -11 1.2 11 1.2 22 3.6"
            fill="none"
            stroke={TEETH_SHADE}
            strokeWidth={1.4}
          />
          <g stroke={TEETH_SHADE} strokeWidth={1} strokeOpacity={0.9}>
            <path d="M -15 -1.6 L -15 5.6" />
            <path d="M -7.5 -3 L -7.5 5.8" />
            <path d="M 0 -3.4 L 0 5.8" />
            <path d="M 7.5 -3 L 7.5 5.8" />
            <path d="M 15 -1.6 L 15 5.6" />
          </g>
          <path
            d="M -26 8 C -19 -2 -10 -4.6 0 -4.6 C 10 -4.6 19 -2 26 8 C 19 8 10 6.8 0 6.8 C -10 6.8 -19 8 -26 8 Z"
            fill="none"
            stroke={lipDark}
            strokeWidth={4.2}
            strokeLinejoin="round"
          />
          <path
            d="M -26.5 9 C -29 10.6 -29.4 13 -28 15"
            fill="none"
            stroke={crease}
            strokeOpacity={0.5}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
          <path
            d="M 26.5 9 C 29 10.6 29.4 13 28 15"
            fill="none"
            stroke={crease}
            strokeOpacity={0.5}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
          <path
            d="M -10 16.4 C -4 14.4 4 14.4 10 16.4"
            fill="none"
            stroke={crease}
            strokeOpacity={0.45}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </g>
      );
    case 'escalating':
      return (
        <g className="ill-tense">
          {shadowUnder(30, 16)}
          <path
            d="M -29 6 C -22 -6 -11 -9 0 -9 C 11 -9 22 -6 29 6 C 25 20 13 27 0 27 C -13 27 -25 20 -29 6 Z"
            fill={CAVITY}
          />
          <path
            d="M -24.5 -1.6 C -16 -6 -8 -7.4 0 -7.4 C 8 -7.4 16 -6 24.5 -1.6 C 16 0.4 8 1.2 0 1.2 C -8 1.2 -16 0.4 -24.5 -1.6 Z"
            fill={TEETH}
          />
          <path
            d="M -22 -0.6 C -12 1.4 12 1.4 22 -0.6"
            fill="none"
            stroke={TEETH_SHADE}
            strokeWidth={1.2}
          />
          <g stroke={TEETH_SHADE} strokeWidth={1}>
            <path d="M -16 -3.6 L -16 0.2" />
            <path d="M -8 -6 L -8 1" />
            <path d="M 0 -7 L 0 1.2" />
            <path d="M 8 -6 L 8 1" />
            <path d="M 16 -3.6 L 16 0.2" />
          </g>
          <path d="M -15 23.2 C -13 13 13 13 15 23.2 C 9 27.4 -9 27.4 -15 23.2 Z" fill={TONGUE} />
          <path d="M 0 15 L 0 24" stroke="#b84a58" strokeWidth={1.2} strokeLinecap="round" />
          <path
            d="M -29 6 C -22 -6 -11 -9 0 -9 C 11 -9 22 -6 29 6 C 25 20 13 27 0 27 C -13 27 -25 20 -29 6 Z"
            fill="none"
            stroke={lipDark}
            strokeWidth={4.6}
            strokeLinejoin="round"
          />
          <path
            d="M -26 -3.5 C -16 -9 -6 -10.6 0 -10.6 C 6 -10.6 16 -9 26 -3.5"
            fill="none"
            stroke="#ffffff"
            strokeOpacity={0.22}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </g>
      );
    case 'happy':
      return (
        <>
          <path
            d="M -28 -3 C -14 9 14 9 28 -3 C 24 15 12 23 0 23 C -12 23 -24 15 -28 -3 Z"
            fill={CAVITY}
          />
          <path
            d="M -24 -0.6 C -12 8.6 12 8.6 24 -0.6 C 22 2.6 12 5 0 5 C -12 5 -22 2.6 -24 -0.6 Z"
            fill={TEETH}
          />
          <path d="M -12 19 C -10 11 10 11 12 19 C 8 22.6 -8 22.6 -12 19 Z" fill={TONGUE} />
          <path
            d="M -28 -3 C -14 9 14 9 28 -3 C 24 15 12 23 0 23 C -12 23 -24 15 -28 -3 Z"
            fill="none"
            stroke={lipDark}
            strokeWidth={3.6}
            strokeLinejoin="round"
          />
          <path
            d="M -30 -4.6 C -33 -6 -33.4 -9 -31.6 -11"
            fill="none"
            stroke={crease}
            strokeOpacity={0.5}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
          <path
            d="M 30 -4.6 C 33 -6 33.4 -9 31.6 -11"
            fill="none"
            stroke={crease}
            strokeOpacity={0.5}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </>
      );
  }
}

function Mouths({ uid, traits, keys }: PartProps & { keys: readonly MouthKey[] }) {
  const { url } = makeRefs(uid);
  return (
    <g transform="translate(200 268) scale(1.12)">
      {keys.map((key) => (
        <g key={key} className={`ill-m ill-m-${key}`}>
          {mouthArt(key, traits, url)}
        </g>
      ))}
    </g>
  );
}

// ---------------------------------------------------------------------------------------------
// Glasses

const LENSES: Record<GlassesShape, { w: number; h: number; r: number }> = {
  round: { w: 58, h: 58, r: 29 },
  rect: { w: 62, h: 44, r: 12 },
  'soft-square': { w: 60, h: 50, r: 21 },
};

function Glasses({ uid, traits }: PartProps) {
  const { url } = makeRefs(uid);
  const glasses = traits.glasses;
  if (!glasses) return null;
  const { frame, shape } = glasses;
  const lens = LENSES[shape];
  const top = EYE_Y - lens.h / 2;
  return (
    <g className="ill-glasses">
      {EYE_X.map((cx) => {
        const x = cx - lens.w / 2;
        const gx = x + lens.w * 0.2;
        const gy = top + lens.h * 0.2;
        return (
          <g key={cx}>
            <rect
              x={x + 2.5}
              y={top + 4}
              width={lens.w}
              height={lens.h}
              rx={lens.r}
              fill="none"
              stroke={traits.skin.deep}
              strokeOpacity={0.2}
              strokeWidth={5}
            />
            <rect x={x} y={top} width={lens.w} height={lens.h} rx={lens.r} fill={url('lens')} />
            <rect
              x={gx}
              y={gy}
              width={4.5}
              height={lens.h * 0.34}
              rx={2.2}
              fill="#ffffff"
              opacity={0.4}
              transform={`rotate(24 ${gx + 2} ${gy + lens.h * 0.17})`}
            />
            <rect
              x={gx + 8}
              y={gy + 2}
              width={2.6}
              height={lens.h * 0.2}
              rx={1.3}
              fill="#ffffff"
              opacity={0.3}
              transform={`rotate(24 ${gx + 9} ${gy + lens.h * 0.1})`}
            />
            <rect
              x={x}
              y={top}
              width={lens.w}
              height={lens.h}
              rx={lens.r}
              fill="none"
              stroke={frame.base}
              strokeWidth={4}
            />
            <path
              d={`M ${x + 5} ${top + lens.h * 0.34} C ${x + 6} ${top + 7}, ${x + lens.w * 0.3} ${top + 2}, ${x + lens.w * 0.52} ${top + 2}`}
              fill="none"
              stroke={frame.light}
              strokeOpacity={0.7}
              strokeWidth={1.4}
              strokeLinecap="round"
            />
          </g>
        );
      })}
      <path
        d={`M ${159 + lens.w / 2} ${EYE_Y - 3} C 194 ${EYE_Y - 9} 206 ${EYE_Y - 9} ${241 - lens.w / 2} ${EYE_Y - 3}`}
        fill="none"
        stroke={frame.base}
        strokeWidth={3.4}
        strokeLinecap="round"
      />
      <path
        d={`M ${159 - lens.w / 2} ${EYE_Y - 4} L 120 ${EYE_Y - 8}`}
        fill="none"
        stroke={frame.base}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <path
        d={`M ${241 + lens.w / 2} ${EYE_Y - 4} L 280 ${EYE_Y - 8}`}
        fill="none"
        stroke={frame.base}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </g>
  );
}

// ---------------------------------------------------------------------------------------------

interface HeadProps extends PartProps {
  mouths: readonly MouthKey[];
  /** Drawn on top of the whole head: a headset, for example. */
  overlay?: ReactNode;
}

function Head({ uid, traits, mouths, overlay }: HeadProps) {
  return (
    <g>
      <Ears uid={uid} traits={traits} />
      <FaceBase uid={uid} traits={traits} />
      <Lines traits={traits} />
      <Brow traits={traits} side="l" />
      <Brow traits={traits} side="r" />
      <g className="ill-eyes">
        <Eye uid={uid} traits={traits} side="l" />
        <Eye uid={uid} traits={traits} side="r" />
      </g>
      <Mouths uid={uid} traits={traits} keys={mouths} />
      <HairFront uid={uid} traits={traits} />
      <Glasses uid={uid} traits={traits} />
      {overlay}
    </g>
  );
}

interface BustProps extends PartProps {
  mouths: readonly MouthKey[];
  rim: RimLight;
  /** Narrower shoulders, so the figure fits inside its box. */
  compact?: boolean;
  /** Drawn on top of the head (inside its motion). */
  headOverlay?: ReactNode;
  /** Drawn on top of the clothes (inside the breathing motion), such as a lanyard. */
  bodyOverlay?: ReactNode;
}

/** The figure: hair behind, shoulders and neck, then the head. The caller supplies the svg and any backdrop. */
export function Bust({
  uid,
  traits,
  mouths,
  rim,
  compact = false,
  headOverlay,
  bodyOverlay,
}: BustProps) {
  return (
    <>
      <BustDefs uid={uid} traits={traits} rim={rim} compact={compact} />
      <HeadMotion>
        <HairBack uid={uid} traits={traits} />
      </HeadMotion>
      <Body uid={uid} traits={traits} compact={compact} overlay={bodyOverlay} />
      <HeadMotion>
        <Head uid={uid} traits={traits} mouths={mouths} overlay={headOverlay} />
      </HeadMotion>
    </>
  );
}
