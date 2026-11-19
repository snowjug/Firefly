/**
 * Deterministic avatar traits. Everything is chosen from the seed alone (a small string hash feeds a
 * seeded generator), so the same name always gives the same face, and nothing here uses Math.random.
 */

export type SkinToneId =
  'porcelain' | 'fair' | 'sand' | 'honey' | 'olive' | 'caramel' | 'umber' | 'deep';

export interface SkinTone {
  id: SkinToneId;
  /** Mid tone, the colour most of the face reads as. */
  base: string;
  /** Lit side (forehead, cheekbones). */
  light: string;
  /** Turned-away side and under the chin. */
  shade: string;
  /** Creases, nostrils and eye sockets. */
  deep: string;
  /** Warm cheeks; also the flush when a customer is worked up. */
  blush: string;
  lip: string;
}

export const SKIN_TONES: readonly SkinTone[] = [
  {
    id: 'porcelain',
    base: '#f1cdb8',
    light: '#fbe5d6',
    shade: '#d9a78f',
    deep: '#b97f68',
    blush: '#f09a92',
    lip: '#d98a86',
  },
  {
    id: 'fair',
    base: '#e8bb9d',
    light: '#f6d6bf',
    shade: '#cf9a7a',
    deep: '#ad765a',
    blush: '#ec917f',
    lip: '#cf7c76',
  },
  {
    id: 'sand',
    base: '#dfa982',
    light: '#efc5a2',
    shade: '#c1865f',
    deep: '#9c6648',
    blush: '#e58a74',
    lip: '#c4736c',
  },
  {
    id: 'honey',
    base: '#d19a6a',
    light: '#e4b788',
    shade: '#b07a50',
    deep: '#8a5c3c',
    blush: '#da7c62',
    lip: '#b9665d',
  },
  {
    id: 'olive',
    base: '#bb8a5d',
    light: '#d3a578',
    shade: '#9a6f45',
    deep: '#76512f',
    blush: '#cb775a',
    lip: '#a66258',
  },
  {
    id: 'caramel',
    base: '#a2693f',
    light: '#bd865a',
    shade: '#824f2d',
    deep: '#613a20',
    blush: '#b8644a',
    lip: '#8f4f48',
  },
  {
    id: 'umber',
    base: '#7e4f33',
    light: '#9a6a48',
    shade: '#613a24',
    deep: '#462717',
    blush: '#a24f3f',
    lip: '#783c39',
  },
  {
    id: 'deep',
    base: '#5b3726',
    light: '#774d37',
    shade: '#432618',
    deep: '#2e170d',
    blush: '#8a3d33',
    lip: '#5a2c2b',
  },
];

export type HairStyle =
  'crop' | 'sidepart' | 'curly' | 'coily' | 'straight' | 'wavy' | 'bun' | 'buzz' | 'bob';

export const HAIR_STYLES: readonly HairStyle[] = [
  'crop',
  'sidepart',
  'curly',
  'coily',
  'straight',
  'wavy',
  'bun',
  'buzz',
  'bob',
];

export type HairColorId =
  | 'black'
  | 'espresso'
  | 'brown'
  | 'chestnut'
  | 'auburn'
  | 'ginger'
  | 'blonde'
  | 'dark-blonde'
  | 'grey'
  | 'silver';

export interface HairColor {
  id: HairColorId;
  base: string;
  light: string;
  dark: string;
}

export const HAIR_COLORS: Record<HairColorId, HairColor> = {
  black: { id: 'black', base: '#1f1c26', light: '#58526a', dark: '#0b0a10' },
  espresso: { id: 'espresso', base: '#35261f', light: '#76523f', dark: '#190f0b' },
  brown: { id: 'brown', base: '#5b3c2a', light: '#a1704d', dark: '#31200f' },
  chestnut: { id: 'chestnut', base: '#7d4b2e', light: '#c68454', dark: '#47281a' },
  auburn: { id: 'auburn', base: '#8e402b', light: '#d4714c', dark: '#4f2119' },
  ginger: { id: 'ginger', base: '#b8592d', light: '#ee9358', dark: '#703519' },
  blonde: { id: 'blonde', base: '#d1a95e', light: '#f7e0a2', dark: '#9a7835' },
  'dark-blonde': { id: 'dark-blonde', base: '#a68345', light: '#dabb7e', dark: '#6c5228' },
  grey: { id: 'grey', base: '#8f939e', light: '#cdd0d8', dark: '#585c68' },
  silver: { id: 'silver', base: '#c8cad2', light: '#f4f5f9', dark: '#8a8d98' },
};

export type EyeColorId = 'dark-brown' | 'brown' | 'hazel' | 'green' | 'blue' | 'grey';

export interface EyeColor {
  id: EyeColorId;
  /** Outer iris ring. */
  rim: string;
  base: string;
  /** Inner glow near the pupil. */
  light: string;
}

export const EYE_COLORS: Record<EyeColorId, EyeColor> = {
  'dark-brown': { id: 'dark-brown', rim: '#1f120b', base: '#4a2c1a', light: '#7b5033' },
  brown: { id: 'brown', rim: '#2e1a0f', base: '#6b4126', light: '#a2703f' },
  hazel: { id: 'hazel', rim: '#3a2a12', base: '#7d6a2c', light: '#b79b4a' },
  green: { id: 'green', rim: '#1d3a27', base: '#4a8a58', light: '#8cc58f' },
  blue: { id: 'blue', rim: '#1d3354', base: '#4b84c4', light: '#93c0ee' },
  grey: { id: 'grey', rim: '#2b3640', base: '#76899a', light: '#b7c6d2' },
};

export type CollarType = 'crew' | 'vneck' | 'polo' | 'blazer' | 'turtleneck';

export type TopColorId =
  | 'navy'
  | 'teal'
  | 'plum'
  | 'terracotta'
  | 'forest'
  | 'charcoal'
  | 'oat'
  | 'mustard'
  | 'rose'
  | 'cobalt'
  | 'sage'
  | 'slate'
  | 'sun'
  | 'cloud'
  | 'mint'
  | 'coral'
  | 'sky'
  | 'lilac';

export interface TopColor {
  id: TopColorId;
  base: string;
  light: string;
  shade: string;
}

/** A colour pushed part of the way toward another one: the light and shade of the soft shading. */
export function mixColor(a: string, b: string, t: number): string {
  const parse = (hex: string): [number, number, number] => {
    const value = hex.replace('#', '');
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16),
    ];
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const channel = (from: number, to: number) =>
    Math.round(from + (to - from) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(ar, br)}${channel(ag, bg)}${channel(ab, bb)}`;
}

/** Lighter and darker neighbours of a fabric colour, so one hex per colour is enough. */
export function makeTopColor(id: TopColorId, base: string): TopColor {
  return {
    id,
    base,
    light: mixColor(base, '#ffffff', 0.26),
    shade: mixColor(base, '#0a0d1c', 0.36),
  };
}

export const TOP_COLORS: readonly TopColor[] = [
  makeTopColor('navy', '#2f4478'),
  makeTopColor('teal', '#1f8189'),
  makeTopColor('plum', '#734479'),
  makeTopColor('terracotta', '#c4623f'),
  makeTopColor('forest', '#33704f'),
  makeTopColor('charcoal', '#434a58'),
  makeTopColor('oat', '#d9ccb2'),
  makeTopColor('mustard', '#d4a52f'),
  makeTopColor('rose', '#c98a97'),
  makeTopColor('cobalt', '#3d69cf'),
  makeTopColor('sage', '#8fab8d'),
  makeTopColor('slate', '#5f7899'),
];

/** Bright tops for the support engineer, who has to read well on a dark blue-violet banner. */
export const AGENT_TOPS: readonly TopColor[] = [
  { id: 'sun', base: '#ffd04d', light: '#ffeaa6', shade: '#d89a1c' },
  { id: 'cloud', base: '#f4f7ff', light: '#ffffff', shade: '#b9c4e4' },
  { id: 'mint', base: '#7fe0c0', light: '#c2f4e2', shade: '#3fae8e' },
  { id: 'coral', base: '#ff8f7a', light: '#ffc3b5', shade: '#d4584a' },
  { id: 'sky', base: '#8ccfff', light: '#c6e8ff', shade: '#4a90d4' },
  { id: 'lilac', base: '#cdb7ff', light: '#e8dcff', shade: '#8b6fd0' },
];

export type GlassesShape = 'round' | 'rect' | 'soft-square';

export type FrameColorId = 'black' | 'tortoise' | 'navy' | 'gold' | 'burgundy';

export interface FrameColor {
  id: FrameColorId;
  base: string;
  light: string;
}

export const FRAME_COLORS: Record<FrameColorId, FrameColor> = {
  black: { id: 'black', base: '#1c1e27', light: '#5b6073' },
  tortoise: { id: 'tortoise', base: '#7b4a28', light: '#c98f56' },
  navy: { id: 'navy', base: '#253a64', light: '#6f8fd0' },
  gold: { id: 'gold', base: '#b9964a', light: '#f1da95' },
  burgundy: { id: 'burgundy', base: '#6c2338', light: '#c0607b' },
};

export type BackdropId = 'window' | 'warm' | 'teal' | 'dusk';
export const BACKDROPS: readonly BackdropId[] = ['window', 'warm', 'teal', 'dusk'];

export type BrowWeight = 'fine' | 'regular' | 'full';

export interface AvatarTraits {
  skin: SkinTone;
  hairStyle: HairStyle;
  hairColor: HairColor;
  /** Mirrors lopsided hairstyles (parts, waves) so the same style comes in two directions. */
  flip: boolean;
  glasses: { shape: GlassesShape; frame: FrameColor } | null;
  eyes: EyeColor;
  top: TopColor;
  collar: CollarType;
  /** The shirt under a blazer, polo or V-neck. */
  shirt: string;
  brows: BrowWeight;
  freckles: boolean;
  backdrop: BackdropId;
  /** Idle timings, so a row of avatars never blinks or breathes in step. All in seconds. */
  rhythm: { blink: number; blinkOffset: number; breathe: number; breatheOffset: number };
}

/** A 32-bit FNV-1a hash with a final avalanche, so near-identical seeds ("ana1", "ana2") scatter. */
function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 3266489909);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/** mulberry32: a tiny seeded generator returning numbers in [0, 1). */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)] as T;
}

/** A stable choice from a list, for the few places that need one pick rather than a whole set of traits. */
export function pickBySeed<T>(seed: string, items: readonly T[]): T {
  return pick(createRandom(hashSeed(seed)), items);
}

function pickWeighted<T extends string>(
  random: () => number,
  weights: Readonly<Record<T, number>>,
): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll < 0) return key;
  }
  return (entries[entries.length - 1] as [T, number])[0];
}

// Natural hair colour follows the skin tone loosely, so the faces look like real people.
const HAIR_WEIGHTS_BY_DEPTH: readonly Readonly<Record<HairColorId, number>>[] = [
  // Lighter tones
  {
    black: 10,
    espresso: 12,
    brown: 20,
    chestnut: 14,
    auburn: 8,
    ginger: 7,
    blonde: 12,
    'dark-blonde': 10,
    grey: 5,
    silver: 2,
  },
  // Medium tones
  {
    black: 22,
    espresso: 22,
    brown: 22,
    chestnut: 12,
    auburn: 5,
    ginger: 1,
    blonde: 2,
    'dark-blonde': 6,
    grey: 6,
    silver: 2,
  },
  // Deeper tones
  {
    black: 40,
    espresso: 28,
    brown: 12,
    chestnut: 4,
    auburn: 2,
    ginger: 0,
    blonde: 0,
    'dark-blonde': 0,
    grey: 9,
    silver: 5,
  },
];

const COLLAR_WEIGHTS: Readonly<Record<CollarType, number>> = {
  crew: 28,
  vneck: 22,
  polo: 18,
  blazer: 17,
  turtleneck: 15,
};

const SHIRTS = ['#f3f5f9', '#cfe0f2', '#f4e4d4', '#e5d8ef'] as const;
const GLASSES_SHAPES: readonly GlassesShape[] = ['round', 'rect', 'soft-square'];
const FRAME_IDS = Object.keys(FRAME_COLORS) as FrameColorId[];
const EYE_WEIGHTS: Readonly<Record<EyeColorId, number>> = {
  'dark-brown': 30,
  brown: 28,
  hazel: 14,
  green: 9,
  blue: 12,
  grey: 7,
};
const BROW_WEIGHTS: readonly BrowWeight[] = ['fine', 'regular', 'regular', 'full'];

export function traitsFor(seed: string): AvatarTraits {
  const random = createRandom(hashSeed(seed));

  // The order of these draws is part of the contract: adding a trait must append, never reorder.
  const skin = pick(random, SKIN_TONES);
  const depth = SKIN_TONES.indexOf(skin);
  const group = depth <= 2 ? 0 : depth <= 4 ? 1 : 2;
  const hairColor = HAIR_COLORS[pickWeighted(random, HAIR_WEIGHTS_BY_DEPTH[group])];
  const hairStyle = pick(random, HAIR_STYLES);
  const flip = random() < 0.5;
  const wearsGlasses = random() < 0.34;
  const glassesShape = pick(random, GLASSES_SHAPES);
  const frame = FRAME_COLORS[pick(random, FRAME_IDS)];
  const eyes = EYE_COLORS[pickWeighted(random, EYE_WEIGHTS)];
  const top = pick(random, TOP_COLORS);
  const collar = pickWeighted(random, COLLAR_WEIGHTS);
  const shirt = pick(random, SHIRTS);
  const brows = pick(random, BROW_WEIGHTS);
  const freckles = depth <= 3 && random() < 0.2;
  const backdrop = pick(random, BACKDROPS);
  const blink = 4.4 + random() * 1.8;
  const breathe = 4.6 + random() * 1.2;

  return {
    skin,
    hairStyle,
    hairColor,
    flip,
    glasses: wearsGlasses ? { shape: glassesShape, frame } : null,
    eyes,
    top,
    collar,
    shirt,
    brows,
    freckles,
    backdrop,
    rhythm: {
      blink: Number(blink.toFixed(2)),
      blinkOffset: Number((random() * blink).toFixed(2)),
      breathe: Number(breathe.toFixed(2)),
      breatheOffset: Number((random() * breathe).toFixed(2)),
    },
  };
}
