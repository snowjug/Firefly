import type { Evidence } from '#shared/domain/report.ts';
import type { CareBehaviour } from '#shared/domain/vocab.ts';
import type { CareContext } from './context.ts';

// The CARE behaviour catalogue: each observable behaviour has a stable id under its own principle.
// A principal never lists more than ten behaviours (the report schema's limit).

export const BEHAVIOUR_IDS = [
  'communicate.greeting',
  'communicate.introduction',
  'communicate.context-confirmed',
  'communicate.clear-questions',
  'communicate.active-listening',
  'communicate.summary',
  'communicate.plain-language',
  'communicate.pacing',
  'communicate.confirms-understanding',
  'communicate.professional-close',
  'accountable.ownership',
  'accountable.expectations',
  'accountable.no-blame',
  'accountable.no-unsupported-promise',
  'accountable.next-action',
  'accountable.named-owner',
  'accountable.update-time',
  'accountable.tracks-commitments',
  'accountable.progress-update',
  'resourceful.logical-investigation',
  'resourceful.scoping',
  'resourceful.impact',
  'resourceful.environment',
  'resourceful.recent-changes',
  'resourceful.prior-troubleshooting',
  'resourceful.known-evidence',
  'resourceful.escalation',
  'resourceful.no-repeat-questions',
  'empathetic.concern',
  'empathetic.business-impact',
  'empathetic.respectful-tone',
  'empathetic.de-escalation',
  'empathetic.no-dismissive',
  'empathetic.no-robotic-apology',
  'empathetic.adapts',
  'empathetic.remaining-concerns',
] as const;
export type BehaviourId = (typeof BEHAVIOUR_IDS)[number];

export type BehaviourStatus = 'shown' | 'partly' | 'not-shown';

/** What one detector concluded about one behaviour in this call. */
export interface Finding {
  status: BehaviourStatus;
  /** Verified quotes: at most two. A `shown` or `partly` finding always has at least one. */
  evidence: Evidence[];
  /** One plain sentence: what was missing, or what held the credit back. */
  note?: string;
  /** Something harmful was said. The principal can then be no better than "developing". */
  harm?: boolean;
  /** How the principal's summary should put the gap, when the behaviour's usual wording would mislead. */
  clause?: string;
  /** This call needed the behaviour whatever its stage (a customer who asked for a manager). */
  core?: boolean;
}

export interface BehaviourSpec {
  id: BehaviourId;
  principle: CareBehaviour;
  /** The observable behaviour, for example "Introduced themselves by name and team". */
  label: (ctx: CareContext) => string;
  /** A clause for the principal's summary when it was shown, without a subject ("kept it plain"). */
  done: (ctx: CareContext) => string;
  /** A clause for the summary when it was not, without a subject ("never gave a time"). */
  missing: (ctx: CareContext) => string;
  /** A finding, or null when the call gave nothing to judge it on. */
  judge: (ctx: CareContext) => Finding | null;
}
