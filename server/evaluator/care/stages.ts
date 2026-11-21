import type { CallStage } from '#shared/domain/vocab.ts';
import type { BehaviourId } from './types.ts';

// What each call stage calls for. A behaviour that is "core" for the stage counts against the call
// when it is missing. Every other behaviour is listed only when it was shown (or when something
// harmful was said), so a stage is never marked down for a behaviour it does not call for: a
// closure call is not faulted for skipping environment questions, a first contact is not faulted
// for lacking a progress update.

export const STAGE_CORE: Record<CallStage, readonly BehaviourId[]> = {
  // Introduction, scoping, impact and ownership.
  'first-contact': [
    'communicate.greeting',
    'communicate.introduction',
    'communicate.clear-questions',
    'communicate.plain-language',
    'communicate.pacing',
    'accountable.ownership',
    'accountable.next-action',
    'accountable.update-time',
    'resourceful.logical-investigation',
    'resourceful.scoping',
    'resourceful.impact',
    'resourceful.environment',
    'resourceful.recent-changes',
    'resourceful.prior-troubleshooting',
    'empathetic.concern',
    'empathetic.business-impact',
  ],
  // Awareness of what is already on the case, and a progress update.
  'follow-up': [
    'communicate.greeting',
    'communicate.introduction',
    'communicate.context-confirmed',
    'communicate.pacing',
    'accountable.ownership',
    'accountable.update-time',
    'accountable.progress-update',
    'resourceful.known-evidence',
    'empathetic.concern',
  ],
  // Acknowledging the earlier experience, ownership, explaining the escalation and a cadence.
  escalated: [
    'communicate.greeting',
    'communicate.introduction',
    'communicate.context-confirmed',
    'communicate.pacing',
    'accountable.ownership',
    'accountable.update-time',
    'resourceful.known-evidence',
    'resourceful.escalation',
    'empathetic.concern',
  ],
  // Confirming the fix, agreement to close, a short summary, a check for what is left, a close.
  closure: [
    'communicate.greeting',
    'communicate.context-confirmed',
    'communicate.summary',
    'communicate.confirms-understanding',
    'communicate.pacing',
    'communicate.professional-close',
    'accountable.tracks-commitments',
    'resourceful.logical-investigation',
    'empathetic.remaining-concerns',
  ],
};

export const isCore = (stage: CallStage, id: BehaviourId): boolean =>
  STAGE_CORE[stage].includes(id);

/** Behaviours whose finding is "not shown" because something harmful happened, not because it was missing. */
export const GUARDS: readonly BehaviourId[] = [
  'accountable.no-blame',
  'accountable.no-unsupported-promise',
  'resourceful.no-repeat-questions',
  'empathetic.respectful-tone',
  'empathetic.no-dismissive',
  'empathetic.no-robotic-apology',
];
