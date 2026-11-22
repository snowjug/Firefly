import type { DimensionId, ProductId } from '#shared/domain/vocab.ts';
import type { CustomerState } from '../../design/primitives/Badge.tsx';

// The landing page's call preview is a short call that plays by itself: the customer speaks, the
// trainee answers, the customer explains the problem, the call ends and the card turns into a small
// report. Everything about it is decided here, as pure functions of the time into the loop, so the
// same time always gives the same picture and a test can step through it. Every person, organisation
// and sentence is made up, and the preview says so.

export type Speaker = 'customer' | 'trainee';

export interface ScriptLine {
  speaker: Speaker;
  text: string;
}

/** One skill in the report that follows the call: the words it rests on, then the score. */
export interface PreviewReportRow {
  skill: DimensionId;
  /** The turn the quote is from. The customer speaks first, so the trainee's turns are even. */
  turn: number;
  quote: string;
  score: number;
}

export interface PreviewExample {
  /** The tab's value and the key of its panel. */
  id: string;
  product: ProductId;
  /** The short name on the tab. */
  tab: string;
  /** The product's full name, as the call shows it. */
  productName: string;
  customer: { name: string; role: string };
  /** The customer's first line, the trainee's answer and the customer's explanation of the problem. */
  lines: readonly [ScriptLine, ScriptLine, ScriptLine];
  /** How the customer feels at the start, and once they have explained the problem. */
  states: readonly [CustomerState, CustomerState];
  report: readonly [PreviewReportRow, PreviewReportRow, PreviewReportRow];
}

// The Teams call is the default and is the one the page's brief spells out; the other two are of the
// same shape, so the three tabs differ only in their words and in how the customer feels.
export const PREVIEW_EXAMPLES: readonly PreviewExample[] = [
  {
    id: 'teams',
    product: 'teams',
    tab: 'Teams',
    productName: 'Microsoft Teams',
    customer: { name: 'Maya Okafor', role: 'Operations coordinator' },
    lines: [
      { speaker: 'customer', text: 'Good morning. Is this Microsoft support?' },
      {
        speaker: 'trainee',
        text: "Yes, you've reached support. My name is Alex. How can I help today?",
      },
      {
        speaker: 'customer',
        text: 'Our Teams meetings stopped working for external guests this morning.',
      },
    ],
    states: ['calm', 'concerned'],
    report: [
      {
        skill: 'opening-rapport',
        turn: 2,
        quote: 'My name is Alex. How can I help today?',
        score: 4,
      },
      {
        skill: 'scoping-discovery',
        turn: 4,
        quote: 'Which guests are affected, and since when?',
        score: 4,
      },
      {
        skill: 'empathy-deescalation',
        turn: 6,
        quote: 'I understand this is urgent. I will check it now.',
        score: 3,
      },
    ],
  },
  {
    id: 'outlook',
    product: 'outlook',
    tab: 'Outlook',
    productName: 'Outlook',
    customer: { name: 'Daniel Reyes', role: 'Practice manager' },
    lines: [
      { speaker: 'customer', text: "Hello. I'm calling about an Outlook problem." },
      {
        speaker: 'trainee',
        text: 'Thanks for calling. My name is Alex. What is happening in Outlook?',
      },
      {
        speaker: 'customer',
        text: 'We cannot open Outlook this morning, and the whole team is waiting.',
      },
    ],
    states: ['concerned', 'frustrated'],
    report: [
      {
        skill: 'opening-rapport',
        turn: 2,
        quote: 'Thanks for calling. My name is Alex.',
        score: 4,
      },
      {
        skill: 'scoping-discovery',
        turn: 4,
        quote: 'When did it stop, and who is affected?',
        score: 5,
      },
      {
        skill: 'empathy-deescalation',
        turn: 6,
        quote: 'That must be stressful with the team waiting.',
        score: 4,
      },
    ],
  },
  {
    id: 'entra-id',
    product: 'entra-id',
    tab: 'Entra ID',
    productName: 'Microsoft Entra ID',
    customer: { name: 'Priya Nair', role: 'IT administrator' },
    lines: [
      { speaker: 'customer', text: 'Hi, is this Microsoft support?' },
      { speaker: 'trainee', text: "Yes, it is. I'm Alex. How can I help?" },
      {
        speaker: 'customer',
        text: 'Nobody on my team can sign in. It began around nine.',
      },
    ],
    states: ['calm', 'concerned'],
    report: [
      {
        skill: 'opening-rapport',
        turn: 2,
        quote: "Yes, it is. I'm Alex. How can I help?",
        score: 3,
      },
      {
        skill: 'scoping-discovery',
        turn: 4,
        quote: 'Is it every user, or only some of them?',
        score: 4,
      },
      {
        skill: 'empathy-deescalation',
        turn: 6,
        quote: 'Thanks for your patience while I look.',
        score: 4,
      },
    ],
  },
];

// ---- The timeline -------------------------------------------------------------------------------

/** One loop, in ms: about thirteen seconds of call and report, then a short rest. */
export const LOOP_MS = 15_000;
/** The preview plays this many times and then rests on the report. */
export const MAX_LOOPS = 3;

/**
 * When each beat of a loop happens, in ms from its start. A line appears a moment before it is
 * spoken; the customer's state changes while they explain the problem; the call ends; the card turns
 * into the report; the three quotes come one after another and, once all three are there, the three
 * scores in the same order. Evidence first, then the numbers.
 */
export const BEATS = {
  lines: [
    { appear: 500, speak: [700, 2900] },
    { appear: 3300, speak: [3500, 6600] },
    { appear: 7000, speak: [7200, 10000] },
  ],
  stateChange: 8200,
  end: 10600,
  report: 11000,
  quotes: [11400, 11700, 12000],
  scores: [12800, 13100, 13400],
} as const;

export interface PreviewFrame {
  /** How many lines of the transcript have appeared, 0 to 3. */
  shown: number;
  /** Who is speaking now. Nobody is, before the first line and after the call has ended. */
  speaking: Speaker | null;
  /** How the customer feels now. */
  state: CustomerState;
  /** How loud the customer is, 0 to 1, for the waveform. It rises and falls with their lines. */
  level: number;
  /** The call has ended. */
  ended: boolean;
  /** The card shows the report instead of the call. */
  report: boolean;
  /** How many of the report's quotes have appeared, and how many of its scores, 0 to 3 each. */
  quotes: number;
  scores: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (value: number) => {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
};
const countReached = (times: readonly number[], t: number) =>
  times.filter((time) => t >= time).length;

const RAMP_UP_MS = 120;
const RAMP_DOWN_MS = 240;

/** The customer's loudness at time `t`: a quick rise at the start of each of their lines, a slower fall after it. */
function customerLevel(example: PreviewExample, t: number): number {
  let level = 0;
  example.lines.forEach((line, index) => {
    if (line.speaker !== 'customer') return;
    const [from, to] = BEATS.lines[index]?.speak ?? [0, 0];
    const rise = smooth((t - from) / RAMP_UP_MS);
    const fall = 1 - smooth((t - to) / RAMP_DOWN_MS);
    level = Math.max(level, rise * fall);
  });
  return Math.round(level * 1000) / 1000;
}

/** What the preview shows at `t` ms into a loop. Times outside the loop count as its start or its end. */
export function frameAt(example: PreviewExample, time: number): PreviewFrame {
  const t = Math.min(Math.max(Number.isFinite(time) ? time : 0, 0), LOOP_MS);
  const ended = t >= BEATS.end;
  const speakingIndex = BEATS.lines.findIndex(({ speak: [from, to] }) => t >= from && t < to);
  const spoken = speakingIndex >= 0 ? example.lines[speakingIndex] : undefined;
  return {
    shown: countReached(
      BEATS.lines.map((beat) => beat.appear),
      t,
    ),
    speaking: ended ? null : (spoken?.speaker ?? null),
    state: example.states[t >= BEATS.stateChange ? 1 : 0],
    level: customerLevel(example, t),
    ended,
    report: t >= BEATS.report,
    quotes: countReached(BEATS.quotes, t),
    scores: countReached(BEATS.scores, t),
  };
}

/** The frame the preview rests on after its last loop, and the one shown when motion is reduced. */
export function finalFrame(example: PreviewExample): PreviewFrame {
  return frameAt(example, LOOP_MS);
}

/** The words for what the call is doing: one to three words, as the call screen's own status line. */
export function callStatus(frame: PreviewFrame): 'Speaking' | 'Listening' | 'Call ended' {
  if (frame.ended) return 'Call ended';
  return frame.speaking === 'customer' ? 'Speaking' : 'Listening';
}

// ---- The waveform -------------------------------------------------------------------------------

export const WAVE_BARS = 28;
/** The height of a bar when nobody is speaking, as a fraction of its full height. */
export const WAVE_IDLE = 0.14;

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/**
 * How tall each bar of the customer's waveform is, as a fraction of its full height, for a loudness
 * and a time. The bars are tallest in the middle, and each one swings at its own pace, so the
 * wave looks like a voice and not like a pulse. It is a function of `level` and `t` only: the same
 * numbers always draw the same wave, and a level of 0 is a still, low line.
 */
export function waveScales(t: number, level: number, bars = WAVE_BARS): number[] {
  return Array.from({ length: bars }, (_, index) => {
    const bell = 0.4 + 0.6 * Math.sin((Math.PI * (index + 0.5)) / bars);
    const pace = 0.011 + 0.0006 * ((index * 7) % 11);
    const swing = 0.55 + 0.45 * Math.sin(t * pace + index * 1.7);
    return round3(WAVE_IDLE + (1 - WAVE_IDLE) * clamp01(level) * bell * swing);
  });
}
