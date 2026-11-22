import type { IconName } from '../../design/index.ts';

// The tips of the "During the call" strip, shown in Guided practice only.
//
// A tip teaches general behaviour on a support call: how to open, scope, show empathy, be clear, take
// ownership and close. It never says anything about THIS call. It must not reveal a hidden fact, a
// customer's secret, a scoring trigger, the complication to expect, an answer or a fix, the evaluator
// or a customer-state threshold; it names no product and holds no number. Nothing in this folder
// imports a scenario or the state of a call (a test reads the imports to hold it to that), and the
// words of every tip are checked against the whole scenario library (tips.test.ts).
//
// Limits (also tested): at most 10 words in a tip, at most 30 in its "Learn why" line, and one simple
// icon from the design system's set. British English, plain, no emoji.

export const TIP_PHASES = [
  'opening',
  'scoping',
  'empathy',
  'clarity',
  'ownership',
  'closing',
] as const;
export type TipPhase = (typeof TIP_PHASES)[number];

/** The four CARE behaviours, in the words a tip card shows. */
export const CARE_LABELS = [
  'Communicate effectively',
  'Be accountable',
  'Be resourceful',
  'Be empathetic',
] as const;
export type CareLabel = (typeof CARE_LABELS)[number];

export interface Tip {
  /** Stable, for tests and keys. Never shown. */
  id: string;
  phase: TipPhase;
  /** One short tip: at most 10 words. */
  text: string;
  /** One simple icon from the design system. */
  icon: IconName;
  care?: CareLabel;
  /** A line of at most 30 words, behind "Learn why". */
  why?: string;
}

export const MAX_TIP_WORDS = 10;
export const MAX_WHY_WORDS = 30;

/** In the order a call tends to go: the deck reads from the first tip to the last. */
export const TIPS: readonly Tip[] = [
  {
    id: 'welcome',
    phase: 'opening',
    text: 'Greet, then confirm who you are speaking with.',
    icon: 'headset',
    care: 'Communicate effectively',
    why: "A warm, clear welcome and the customer's name start the call well, and make the rest easier to follow.",
  },
  {
    id: 'listen-first',
    phase: 'opening',
    text: 'Let the customer describe the problem first.',
    icon: 'chat',
    care: 'Be empathetic',
    why: 'Customers settle when they feel heard. Listening first also shows you what matters most to them before you start asking questions.',
  },
  {
    id: 'impact',
    phase: 'opening',
    text: 'Establish impact before troubleshooting.',
    icon: 'flag',
    why: 'Knowing who and what is affected tells you how urgent the case is, and what the customer wants from this call.',
  },
  {
    id: 'what-changed',
    phase: 'scoping',
    text: 'Ask what changed before the issue began.',
    icon: 'search',
    care: 'Be resourceful',
    why: 'Many problems follow a change somewhere. Asking when it worked, and what happened since, narrows the search without guessing.',
  },
  {
    id: 'how-many',
    phase: 'scoping',
    text: 'Clarify how many users are affected.',
    icon: 'list',
    care: 'Be resourceful',
    why: 'Whether few or many are affected changes the urgency and where you look next.',
  },
  {
    id: 'tried-so-far',
    phase: 'scoping',
    text: 'Find out what has been tried so far.',
    icon: 'refresh',
    care: 'Be resourceful',
    why: 'It saves repeating steps and shows how far the customer has got. Ask what happened each time.',
  },
  {
    id: 'example',
    phase: 'scoping',
    text: 'Ask for an example of what is happening.',
    icon: 'eye',
    care: 'Communicate effectively',
    why: "A description in the customer's own terms is more reliable than an assumption about the cause.",
  },
  {
    id: 'acknowledge',
    phase: 'empathy',
    text: 'Acknowledge concern, then explain the plan.',
    icon: 'shield',
    care: 'Be empathetic',
    why: 'Recognising how the customer feels first makes them more ready to hear what happens next.',
  },
  {
    id: 'pace',
    phase: 'empathy',
    text: 'Slow down when the customer is worried.',
    icon: 'clock',
    care: 'Be empathetic',
  },
  {
    id: 'possible',
    phase: 'empathy',
    text: 'Say what is possible, not only what is not.',
    icon: 'check',
    care: 'Communicate effectively',
    why: 'A limit is easier to accept when it comes with a next step the customer can rely on.',
  },
  {
    id: 'plain-language',
    phase: 'clarity',
    text: 'Use plain language with a novice customer.',
    icon: 'caption',
    care: 'Communicate effectively',
    why: 'Skip jargon unless the customer uses it first. If they do not follow, say it again more simply.',
  },
  {
    id: 'summarise',
    phase: 'clarity',
    text: 'Summarise before proposing next steps.',
    icon: 'document',
    care: 'Communicate effectively',
    why: 'Repeating what you heard lets the customer correct you early, and shows you understood the situation.',
  },
  {
    id: 'check-followed',
    phase: 'clarity',
    text: 'Check the customer has followed you.',
    icon: 'help',
    why: 'A short check, such as asking whether that makes sense, catches confusion before it grows.',
  },
  {
    id: 'owner',
    phase: 'ownership',
    text: 'Name the owner of the next action.',
    icon: 'person',
    care: 'Be accountable',
    why: 'The customer needs to know who does what next. If it is you, say so plainly.',
  },
  {
    id: 'update-time',
    phase: 'ownership',
    text: 'Give a specific next-update time.',
    icon: 'calendar',
    care: 'Be accountable',
    why: 'A clear time lets the customer plan, and gives you something you can keep. Phrases like soon or shortly do not.',
  },
  {
    id: 'honest',
    phase: 'ownership',
    text: 'Be honest about what you do not yet know.',
    icon: 'info',
    care: 'Be accountable',
    why: 'Admitting a gap, and saying how you will find out, builds more trust than a guess.',
  },
  {
    id: 'agreement',
    phase: 'closing',
    text: 'Confirm agreement before closing.',
    icon: 'check-circle',
    care: 'Be accountable',
    why: 'Ask whether the plan suits the customer. Their agreement, in their own terms, is what lets you finish with confidence.',
  },
  {
    id: 'anything-else',
    phase: 'closing',
    text: 'Ask if there is anything else to cover.',
    icon: 'chat',
    care: 'Be empathetic',
  },
  {
    id: 'thank',
    phase: 'closing',
    text: 'Thank them and restate the plan.',
    icon: 'phone',
    care: 'Communicate effectively',
    why: 'A short, warm ending leaves the customer clear on what happens next and who they will hear from.',
  },
];
