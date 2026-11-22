import type { DimensionId, ProductId } from '#shared/domain/vocab.ts';
import type { IconName } from '../../design/icons.tsx';

// The landing page's words and examples, in one place. Every example is made up: the people and
// their organisations do not exist, and each preview says so. Nothing here is loaded from the
// scenario library. Only the featured scenarios are fetched, and the page works without them.

export const LANDING_TITLE = 'Firefly: practise Microsoft support calls';

export const HERO = {
  title: 'Practise Microsoft support calls safely.',
  lead: 'Speak with a realistic customer. Review evidence-based coaching after the call.',
  primary: 'Start call',
  secondary: 'Explore scenarios',
} as const;

/** The section the hero's second action scrolls to. */
export const FEATURED_ID = 'featured';

export const FEATURED = {
  title: 'Featured scenarios',
  lead: 'Pick a call, then adjust the details before you start.',
  all: 'All scenarios',
  loading: 'Loading scenarios',
  failed: 'Scenarios did not load.',
  offline: 'You are offline.',
  retry: 'Try again',
  browse: 'Browse all scenarios',
} as const;

/** Three connected steps. Each is a short title and at most six words under it. */
export const STEPS = [
  { icon: 'list', title: 'Choose scenario', text: 'Pick a product and issue.' },
  { icon: 'microphone', title: 'Speak naturally', text: 'Talk with a synthetic customer.' },
  { icon: 'document', title: 'Review coaching', text: 'See quotes behind every score.' },
] as const satisfies readonly { icon: IconName; title: string; text: string }[];

/** The products the featured scenarios are drawn from, in the order the cards are shown. */
export const FEATURED_PRODUCTS: readonly ProductId[] = [
  'teams',
  'outlook',
  'exchange-online',
  'sharepoint-online',
  'onedrive-business',
  'm365-apps',
  'entra-id',
  'intune',
  'defender-office-365',
  'windows-11',
  'azure',
  'dynamics-365',
];

export const REPORT_PREVIEW = {
  title: 'Coaching evidence',
  lead: 'Each score rests on words from the call.',
  caption: 'Example report. Synthetic call.',
  evidence: 'Evidence',
  coaching: 'Coaching',
  skills: 'Skills',
} as const;

export interface ReportPreviewRow {
  skill: DimensionId;
  /** The turn the quote is from. */
  turn: number;
  /** What the trainee said, word for word. */
  quote: string;
  /** What the coaching made of it. */
  note: string;
  score: number;
}

/**
 * The six skills of an example report, each with the words it rests on. The customer speaks first,
 * so the trainee's turns are even; the report opens on turn 4.
 */
export const REPORT_ROWS: readonly ReportPreviewRow[] = [
  {
    skill: 'opening-rapport',
    turn: 2,
    quote: "Yes, you've reached support. My name is Alex. How can I help today?",
    note: 'Clear greeting and name, then an open question.',
    score: 4,
  },
  {
    skill: 'scoping-discovery',
    turn: 4,
    quote: 'Which guests are affected, and when did it start?',
    note: 'Asks who and when. Ask what changed next.',
    score: 4,
  },
  {
    skill: 'empathy-deescalation',
    turn: 6,
    quote: 'I understand this is urgent. I will check it now.',
    note: 'Acknowledges urgency. Name the impact on them.',
    score: 3,
  },
  {
    skill: 'clarity',
    turn: 8,
    quote: 'So external guests cannot join since this morning. Is that right?',
    note: 'Summarises in plain words and checks.',
    score: 4,
  },
  {
    skill: 'ownership-next-steps',
    turn: 10,
    quote: "I'll own this and update you by 3 PM, even if it is still being worked.",
    note: 'Names the owner and a specific time.',
    score: 5,
  },
  {
    skill: 'closing',
    turn: 12,
    quote: "To confirm: I'll update you by 3 PM. Is there anything else today?",
    note: 'Confirms the plan and asks about other needs.',
    score: 4,
  },
];

/** The skill the report preview opens on: its quote is from turn 4. */
export const REPORT_FIRST: DimensionId = 'scoping-discovery';

export const RESPONSIBLE_NOTE = 'Synthetic scenarios only. Coaching, not performance assessment.';

export const FINAL_TITLE = 'Start a Microsoft support call';
