import type { CareAssessment } from './care/index.ts';
import type { BehaviourId } from './care/types.ts';
import type { StageGapKind } from './phrasing.ts';

// Coaching that follows the call's stage. A follow-up is judged on awareness of the case and a
// progress update, an escalated call on acknowledging the earlier experience, explaining the
// escalation and a regular cadence, a closure call on confirming the fix and agreement to close.
// A stage is never marked down for something it does not call for, so a first contact has no stage
// gaps at all: its own gaps (introduction, scoping, impact, ownership) are found elsewhere.

export function stageGapsOf(assessment: CareAssessment): StageGapKind[] {
  const { findings, context } = assessment;
  const status = (id: BehaviourId) => findings.get(id)?.status;
  const missing = (id: BehaviourId): boolean => status(id) === 'not-shown';
  const incomplete = (id: BehaviourId): boolean =>
    status(id) === 'not-shown' || status(id) === 'partly';
  const gaps: StageGapKind[] = [];

  switch (context.stage) {
    case 'follow-up':
      if (missing('empathetic.concern')) gaps.push('no-history-ack');
      if (missing('accountable.progress-update')) gaps.push('no-progress-update');
      break;
    case 'escalated':
      if (missing('empathetic.concern')) gaps.push('no-history-ack');
      if (incomplete('resourceful.escalation')) gaps.push('no-escalation-explained');
      if (incomplete('accountable.update-time')) gaps.push('no-cadence');
      break;
    case 'closure':
      if (missing('resourceful.logical-investigation')) gaps.push('no-resolution-check');
      if (missing('communicate.confirms-understanding')) gaps.push('no-agreement-check');
      break;
    case 'first-contact':
      break;
  }
  return gaps;
}
