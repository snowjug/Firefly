import type { PublicStateDTO } from '#shared/domain/api.ts';
import type { PracticeMode, TemperatureBandId } from '#shared/domain/vocab.ts';
import type { ChatShift } from './useCall.ts';

// How the customer's public state becomes the atmosphere of the call room. Guided practice shows
// it; immersive practice shows no mood, no count and no change, so reading the customer from what
// they say stays the whole point. Nothing here can reveal a hidden fact or the kind of curveball:
// the inputs are the public state and the shifts already derived from it.

/** `full` shows every cue; `none` shows none, and nothing can be read into the gap. */
export type CueLevel = 'full' | 'none';

/** Anything other than guided practice fails closed: no cues. */
export function cueLevelFor(mode: PracticeMode): CueLevel {
  return mode === 'guided' ? 'full' : 'none';
}

export interface Atmosphere {
  /** What the room is tinted by: the customer's band, or `neutral` when cues are off. */
  mood: TemperatureBandId | 'neutral';
  trend: 'rising' | 'steady' | 'falling';
  /** How compressed and sharp the room is, 0 to 1. */
  tension: number;
  /** How much space there is, 0 to 1. */
  open: number;
  /** From cool to warm, 0 to 1. */
  warmth: number;
  /** How quick the movement is, 0 to 1. */
  energy: number;
  /** The customer is easing back from a tense state. */
  recovering: boolean;
  /** The customer has stopped giving anything to work with. */
  silent: boolean;
  /** The mood in a word ("Frustrated"), for a visible label. Empty when cues are off. */
  label: string;
  /** Always present: the room's state as plain text, for assistive technology. */
  status: string;
}

type Numbers = Pick<Atmosphere, 'tension' | 'open' | 'warmth' | 'energy'>;

/** The numbers for each band. They mirror the `[data-mood]` blocks in styles/tokens.css exactly. */
export const MOOD_ATMOSPHERE: Readonly<Record<TemperatureBandId, Readonly<Numbers>>> = {
  calm: { tension: 0.08, open: 1, warmth: 0.42, energy: 0.22 },
  concerned: { tension: 0.3, open: 0.8, warmth: 0.55, energy: 0.36 },
  frustrated: { tension: 0.56, open: 0.58, warmth: 0.74, energy: 0.52 },
  angry: { tension: 0.8, open: 0.36, warmth: 0.86, energy: 0.66 },
  escalating: { tension: 0.94, open: 0.24, warmth: 0.92, energy: 0.74 },
};

/** Easing back slows the room down. Mirrors `[data-mood][data-trend='falling']` in tokens.css. */
export const EASING_ENERGY_CAP = 0.2;

export const DISCOVERY_COPY = {
  label: 'Signal found',
  announcement: 'A signal was found.',
} as const;

/** Said when the conversation changed. It never says how: only that it did. */
export const SHIFT_COPY = {
  curveball: 'The conversation changed.',
  silent: 'The customer has gone quiet.',
} as const;

export const CUES_OFF_STATUS = 'Customer mood cues are off in immersive practice.';

const TREND_WORDS: Record<Atmosphere['trend'], string> = {
  rising: ', rising',
  steady: '',
  falling: ', easing',
};

/** What cues being off looks like: the calm room, and no word of anything that is going on. */
const NEUTRAL: Atmosphere = {
  mood: 'neutral',
  trend: 'steady',
  ...MOOD_ATMOSPHERE.calm,
  recovering: false,
  silent: false,
  label: '',
  status: CUES_OFF_STATUS,
};

/**
 * The room's atmosphere for the customer's public state. With `none` the result is the same
 * whatever the state is, so it can never leak the band, the trend or silence.
 */
export function atmosphereFor(state: PublicStateDTO, cue: CueLevel): Atmosphere {
  if (cue === 'none') return { ...NEUTRAL };

  const { band, trend, silent } = state;
  // The band comes off the network: an unknown one must not break the screen.
  const known = Object.hasOwn(MOOD_ATMOSPHERE, band.id);
  const numbers = known ? MOOD_ATMOSPHERE[band.id] : MOOD_ATMOSPHERE.calm;
  const easing = trend === 'falling';
  const silence = silent ? ` ${SHIFT_COPY.silent}` : '';
  return {
    mood: known ? band.id : 'neutral',
    trend,
    tension: numbers.tension,
    open: numbers.open,
    warmth: numbers.warmth,
    energy: easing ? Math.min(numbers.energy, EASING_ENERGY_CAP) : numbers.energy,
    recovering: easing && band.id !== 'calm',
    silent,
    label: band.label,
    status: `Customer mood: ${band.label}${TREND_WORDS[trend]}.${silence}`,
  };
}

/**
 * What a screen reader is told when the customer's state shifts after a reply. It names the
 * customer (as the caller wants them spoken of) for a change of mood, and never says what kind of
 * curveball it was. Empty when cues are off.
 */
export function shiftAnnouncement(shift: ChatShift, customerName: string, cue: CueLevel): string {
  if (cue === 'none') return '';
  const name = customerName.trim() || 'The customer';
  switch (shift.kind) {
    case 'curveball':
      return SHIFT_COPY.curveball;
    case 'silent':
      return SHIFT_COPY.silent;
    case 'band':
      if (shift.direction === 'tenser') return `${name} is more tense.`;
      if (shift.direction === 'calmer') return `${name} is calmer.`;
      return `${name}'s mood changed.`;
    default: {
      const _unknown: never = shift.kind;
      return '';
    }
  }
}
