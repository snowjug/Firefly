import type { ProviderKind } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
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

/** How firmly a skill could be judged, in words (never only a colour). */
export const SUFFICIENCY_WORDS: Record<Sufficiency, string> = {
  sufficient: 'Sufficient',
  limited: 'Limited',
  insufficient: 'Not enough evidence',
};

/** The sentence under a skill's score that says how firm it is. */
export const SUFFICIENCY_SENTENCES: Record<Sufficiency, string> = {
  sufficient: 'There was enough in the call to judge this skill.',
  limited: 'This call gave limited evidence for this skill, so treat the score as a first look.',
  insufficient:
    'There was not enough in the call to judge this skill with confidence, so treat the score as a first look.',
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

export const dimensionLabel = (id: DimensionId): string => DIMENSIONS[id].label;

/** "Opening & Rapport" for the skill, or the id itself if an evaluator ever sends an unknown one. */
export const skillName = (id: string): string => DIMENSIONS[id as DimensionId]?.label ?? id;

export const turnName = (index: number): string => `Turn ${index}`;
export const seeTurnText = (index: number): string => `See turn ${index} in the transcript`;

/** The band a 0 to 100 temperature falls in. The number itself is never shown. */
export function bandOf(temperature: number): { id: TemperatureBandId; label: string } {
  const band = temperatureBand(temperature);
  return { id: band.id, label: band.label };
}

/** The band id for a band label such as "Frustrated" (journey points carry the label). */
export function bandIdFor(label: string): TemperatureBandId | null {
  return TEMPERATURE_BANDS.find((band) => band.label === label)?.id ?? null;
}

/** Who wrote the coaching, for the training-aid sentence. Demo mode is always said so. */
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

export const pluralise = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`;
