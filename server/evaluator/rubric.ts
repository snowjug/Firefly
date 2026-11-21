import type {
  CarePrincipleResult,
  CbcfStatus,
  CoachingReport,
  Milestone,
} from '#shared/domain/report.ts';
import { assessCare, type CareAssessment } from './care/index.ts';
import { cbcfStatus } from './cbcf-mapping.ts';
import { buildMilestones } from './milestones.ts';
import type { CallView } from './parts.ts';

// The rubric layer: what the evaluator reads from the transcript itself, whichever way the scores
// were written. The rules evaluator and the model evaluator both build their reports on this, so
// a model never decides a CARE behaviour, a CARE level or a milestone, and cannot contradict them.

export interface Rubric {
  care: CarePrincipleResult[];
  cbcf: CbcfStatus;
  milestones: Milestone[];
  /** The full reading behind `care`, for coaching that wants to say what this stage called for. */
  assessment: CareAssessment;
}

export function assessRubric(call: CallView, discovery: CoachingReport['discovery']): Rubric {
  const assessment = assessCare(call);
  return {
    care: assessment.principals,
    cbcf: cbcfStatus(),
    milestones: buildMilestones(assessment, discovery),
    assessment,
  };
}
