import type { ProviderKind } from '#shared/domain/api.ts';
import type { CareBehaviourResult, CareLevel, CoachingReport } from '#shared/domain/report.ts';
import {
  DIMENSIONS,
  TEMPERATURE_BANDS,
  temperatureBand,
  type DimensionId,
  type FactImportance,
  type TemperatureBandId,
} from '#shared/domain/vocab.ts';

// The words the report page uses for data it is given. Labels that already exist in
// `#shared/domain/vocab.ts` are used from there; what is here is only what the page itself says.

export type Sufficiency = CoachingReport['dimensions'][number]['sufficiency'];
export type MilestoneStatus = NonNullable<
  CoachingReport['journey']['milestones']
>[number]['status'];

/** How firmly a skill could be judged, in words (never only a colour). */
export const SUFFICIENCY_WORDS: Record<Sufficiency, string> = {
  sufficient: 'Enough evidence',
  limited: 'Limited evidence',
  insufficient: 'Not enough evidence',
};

/** The sentence that says how firm a score is, in the details of a skill. */
export const SUFFICIENCY_SENTENCES: Record<Sufficiency, string> = {
  sufficient: 'There was enough in the call to judge this skill.',
  limited: 'Limited evidence in this call, so treat the score as a first look.',
  insufficient: 'Not enough in this call to judge this skill, so treat the score as a first look.',
};

export const IMPORTANCE_WORDS: Record<FactImportance, string> = {
  critical: 'Critical',
  important: 'Important',
  helpful: 'Helpful',
};

export const COMPLETION_WORDS: Record<CoachingReport['completion']['status'], string> = {
  completed: 'Completed',
  'ended-early': 'Ended early',
};

export const CURVEBALL_STATUS_WORDS: Record<
  NonNullable<CoachingReport['curveball']>['status'],
  string
> = {
  resolved: 'Resolved',
  unresolved: 'Not resolved',
  active: 'Still open when the call ended',
};

export const CARE_LEVEL_WORDS: Record<CareLevel, string> = {
  strong: 'Strong',
  developing: 'Developing',
  'not-yet': 'Not yet',
  'limited-evidence': 'Limited evidence',
};

export const BEHAVIOUR_STATUS_WORDS: Record<CareBehaviourResult['status'], string> = {
  shown: 'Shown',
  partly: 'Partly shown',
  'not-shown': 'Not shown',
};

export const MILESTONE_STATUS_WORDS: Record<MilestoneStatus, string> = {
  reached: 'Reached',
  'not-reached': 'Not reached',
  'not-applicable': 'Not applicable',
};

export const dimensionLabel = (id: DimensionId): string => DIMENSIONS[id].label;

/** "Opening & Rapport" for the skill, or the id itself if an evaluator ever sends an unknown one. */
export const skillName = (id: string): string => DIMENSIONS[id as DimensionId]?.label ?? id;

export const turnName = (index: number): string => `Turn ${index}`;
export const seeTurnText = (index: number): string => `See turn ${index} in the transcript`;

export const pluralise = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`;

/** A score for people: "4" for a whole number, "4.2" otherwise. */
export const scoreText = (score: number): string =>
  Number.isInteger(score) ? String(score) : score.toFixed(1);

/** "No quotes", "1 quote", "3 quotes": how much of the call backs a score. */
export const quoteCount = (count: number): string =>
  count === 0 ? 'No quotes' : pluralise(count, 'quote');

// ---- Word budgets ---------------------------------------------------------------------------

/** Words as the product counts them: runs of characters between spaces. */
export const countWords = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

export interface Clamped {
  /** What is shown at first: at most the budget, ending at a sentence where one is near. */
  shown: string;
  /** All of it, for "Show more". */
  full: string;
  clamped: boolean;
}

const SENTENCE_END = /[.!?]["'\u2019\u201d)\]]*$/;

/**
 * Text cut to a word budget for the first view. Nothing is thrown away: `full` is every word, and
 * the page offers it behind "Show more". It stops at the end of a sentence when one falls in the
 * last 60 per cent of the budget, and otherwise after the last word that fits, with an ellipsis.
 */
export function clampWords(text: string, max: number): Clamped {
  const full = text.trim().replace(/\s+/g, ' ');
  const tokens = full.split(' ').filter(Boolean);
  const budget = Math.max(1, Math.floor(max));
  if (tokens.length <= budget) return { shown: full, full, clamped: false };
  const head = tokens.slice(0, budget);
  for (let i = head.length - 1; i >= Math.ceil(budget * 0.4) - 1; i -= 1) {
    if (SENTENCE_END.test(head[i] as string)) {
      return { shown: head.slice(0, i + 1).join(' '), full, clamped: true };
    }
  }
  const last = head.length - 1;
  head[last] = `${(head[last] as string).replace(/[,;:\u2013\u2014-]+$/, '')}\u2026`;
  return { shown: head.join(' '), full, clamped: true };
}

// ---- Customer state -------------------------------------------------------------------------

/** The band a 0 to 100 temperature falls in. The number itself is never shown. */
export function bandOf(temperature: number): { id: TemperatureBandId; label: string } {
  const band = temperatureBand(temperature);
  return { id: band.id, label: band.label };
}

/** The band id for a band label such as "Frustrated" (journey points carry the label). */
export function bandIdFor(label: string): TemperatureBandId | null {
  return TEMPERATURE_BANDS.find((band) => band.label === label)?.id ?? null;
}

// ---- Who wrote what -------------------------------------------------------------------------

/** Who wrote the coaching. Demo mode is always said so. */
export function evaluatorByline(
  evaluator: CoachingReport['evaluator'],
  providerKind: ProviderKind,
): string {
  if (evaluator.kind === 'model') return `the language model ${evaluator.providerLabel}`;
  return providerKind === 'mock'
    ? "Firefly's built-in rules evaluator (demo mode)"
    : "Firefly's built-in rules evaluator";
}

/** Who played the customer, for the About section. */
export function customerPlayedBy(providerKind: ProviderKind, providerLabel: string): string {
  return providerKind === 'mock'
    ? "Firefly's built-in rules engine (demo mode), not a language model"
    : `the language model ${providerLabel}`;
}

const capitalise = (text: string) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

/**
 * The engine's word for the customer's unexpected moment is internal. After the call the report
 * says "unexpected turn", so evaluator-written text and marker labels are shown with that word.
 * Only wording written by the evaluator goes through this: what the trainee said is never changed.
 */
export function plainUnexpectedTurn(text: string): string {
  return text
    .replace(/\bcurveballs\b/gi, (m) =>
      m.startsWith('C') ? 'Unexpected turns' : 'unexpected turns',
    )
    .replace(/\bcurveball\b/gi, (m) => (m.startsWith('C') ? 'Unexpected turn' : 'unexpected turn'));
}

/** `plainUnexpectedTurn`, and a leading "Unexpected turn:" dropped where a tag already says it. */
export function unexpectedTurnDetail(text: string): string {
  return capitalise(plainUnexpectedTurn(text).replace(/^unexpected turn:\s*/i, ''));
}

/** "A, B and C". */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
