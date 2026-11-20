import type {
  BusinessImpact,
  CallStage,
  Difficulty,
  StartTemperature,
} from '#shared/domain/vocab.ts';
import type { Atmosphere } from '../call/atmosphere.ts';

// The one grammar of the signal instrument. A mission on the atlas, the scenario core on the
// calibration page and the customer's presence in a call are the same object read at different
// scales, so they all take their marks from the same few public traits. Nothing here can carry a
// hidden fact: these are the settings anybody can see before a call.

/** Where the trainee stands with a mission: not tried, started, or taken to a close. */
export type GlyphStatus = 'new' | 'attempted' | 'completed';

/**
 * Rings = difficulty, overall size = business impact, outer edge = how the customer starts, heart
 * shape = call stage, heart fill = status, one tick per minute, a glint when it is recommended.
 * `AtlasMission` carries all of these, so a mission can be passed in as it is.
 */
export interface GlyphTraits {
  difficulty: Difficulty;
  impact: BusinessImpact;
  start: StartTemperature;
  stage: CallStage;
  status: GlyphStatus;
  /** The scenario's length. One tick per minute, up to fifteen. */
  minutes: number;
  /** Draws the amber glint: this is the suggested next mission. */
  recommended?: boolean;
}

/** The core draws the same traits; the live settings arrive as `CoreParams`. */
export type CoreTraits = GlyphTraits;

export interface PresenceProps {
  /** What the room is like. From `atmosphereFor`, so cues that are off arrive already neutral. */
  atmosphere: Atmosphere;
  /** How many signals have been found. Lights that many of the dormant dots; never a total. */
  discovered: number;
  /** How many dormant dots there are. A fixed pool, not a count of anything real. Default 7. */
  pool?: number;
  /** How many times the conversation has changed. A rise (not the first value) plays a kink. */
  shifts: number;
  /** The customer is typing: a gentle wobble of the heart. */
  typing?: boolean;
  /** A still render of this atmosphere for the report and the history: no timers, no animation. */
  frozen?: boolean;
  /** Width and height in px. Default 240. */
  size?: number;
  className?: string;
}
