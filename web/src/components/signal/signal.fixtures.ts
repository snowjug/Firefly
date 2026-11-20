import type { BusinessImpact, Difficulty } from '#shared/domain/vocab.ts';
import { MOOD_ATMOSPHERE, type Atmosphere } from '../call/atmosphere.ts';
import type { GlyphTraits } from './types.ts';

// Shared by the instrument's tests: a room for each mood and a mission to draw.

export type Mood = keyof typeof MOOD_ATMOSPHERE;

/** The atmosphere the chamber would have for a customer in this band. */
export const room = (mood: Mood, over: Partial<Atmosphere> = {}): Atmosphere => ({
  mood,
  trend: 'steady',
  ...MOOD_ATMOSPHERE[mood],
  recovering: false,
  silent: false,
  label: mood,
  status: `Customer mood: ${mood}.`,
  ...over,
});

export const traits = (over: Partial<GlyphTraits> = {}): GlyphTraits => ({
  difficulty: 'standard' satisfies Difficulty,
  impact: 'medium' satisfies BusinessImpact,
  start: 'frustrated',
  stage: 'first-contact',
  status: 'new',
  minutes: 10,
  ...over,
});
