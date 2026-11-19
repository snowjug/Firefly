import type { TemperatureBandId } from '#shared/domain/vocab.ts';

// Guided practice offers a few starter phrases above the message box. They are generic coaching
// habits, picked by looking at the scenario's public "areas worth exploring". Nothing here comes
// from the scenario's hidden facts, so a chip can say what kind of question to ask but never what
// the answer is.

export type HintId =
  'acknowledge' | 'changed' | 'error' | 'when' | 'who' | 'tried' | 'goal' | 'next';

export interface Hint {
  id: HintId;
  /** What the chip says. */
  label: string;
  /** Plain words to start a reply with. They mention nothing about the scenario. */
  starter: string;
}

export const HINTS: Record<HintId, Hint> = {
  acknowledge: {
    id: 'acknowledge',
    label: 'Acknowledge the impact',
    starter: "I understand this is affecting you, and I'm sorry for the disruption.",
  },
  changed: {
    id: 'changed',
    label: 'Ask what changed recently',
    starter: 'Has anything changed recently on your side?',
  },
  error: {
    id: 'error',
    label: 'Clarify the error message',
    starter: 'Could you tell me exactly what you see on screen, including any error message?',
  },
  when: {
    id: 'when',
    label: 'Ask when it started',
    starter: 'When did you first notice this, and was it working before?',
  },
  who: {
    id: 'who',
    label: 'Check who is affected',
    starter: 'Is anyone else affected, or is it only you?',
  },
  tried: {
    id: 'tried',
    label: 'Ask what they have tried',
    starter: 'What have you already tried so far?',
  },
  goal: {
    id: 'goal',
    label: 'Confirm what they need',
    starter: 'What would a good outcome look like for you, and by when?',
  },
  next: {
    id: 'next',
    label: 'Agree the next step',
    starter: 'Here is what I will do next, and when I will update you:',
  },
};

// Which kind of question an area of the conversation calls for.
const AREA_PATTERNS: readonly [HintId, RegExp][] = [
  ['error', /\b(message|error|screen|says|display)\b/],
  ['changed', /\b(chang\w*|updates?|release|configuration|settings)\b/],
  ['when', /\b(when|since|started|how long|how often|time of day|first)\b/],
  ['who', /\b(affected|who can|which (customers|staff|users|phones|regions))\b/],
  ['tried', /\b(tried|checked|helped|evidence|already)\b/],
  ['goal', /\b(needs?|wants?|achieve|deadline|depends?|rely\w*|relying|options)\b/],
];

const FALLBACKS: readonly HintId[] = ['error', 'changed', 'tried'];

/** The kinds of question a scenario's public areas point to, in the order the areas are listed. */
export function hintIdsForAreas(areas: readonly string[]): HintId[] {
  const ids: HintId[] = [];
  for (const area of areas) {
    const text = area.toLowerCase();
    for (const [id, pattern] of AREA_PATTERNS) {
      if (pattern.test(text) && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

export interface HintContext {
  /** The scenario's public "areas worth exploring". */
  areas: readonly string[];
  /** How the customer is right now. */
  band: TemperatureBandId;
  /** How many messages the trainee has sent so far. */
  traineeTurns: number;
  /** Hints already used in this call, which make way for the next ones. */
  used?: readonly HintId[];
  max?: number;
}

/** A few starter phrases that suit this point in the call, never more than `max`. */
export function hintsFor({ areas, band, traineeTurns, used = [], max = 3 }: HintContext): Hint[] {
  const ordered: HintId[] = [];
  const add = (id: HintId) => {
    if (!ordered.includes(id)) ordered.push(id);
  };
  // Acknowledging the impact matters most at the start and whenever the customer is tense.
  if (band !== 'calm' || traineeTurns < 2) add('acknowledge');
  // Late in the call, the useful move is to agree what happens next.
  if (traineeTurns >= 5) add('next');
  for (const id of hintIdsForAreas(areas)) add(id);
  for (const id of FALLBACKS) add(id);
  return ordered
    .filter((id) => !used.includes(id))
    .slice(0, max)
    .map((id) => HINTS[id]);
}

/** Adds a starter phrase after whatever has already been typed, leaving the caret free to carry on. */
export function withStarter(draft: string, starter: string): string {
  if (draft.trim() === '') return `${starter} `;
  return `${draft}${/\s$/.test(draft) ? '' : ' '}${starter} `;
}
