import {
  CoachingReportSchema,
  type CoachingReport,
  type DimensionResult,
} from '#shared/domain/report.ts';
import { truncate } from '#shared/domain/text.ts';
import { DIMENSION_IDS, DIMENSIONS, scoreLabel } from '#shared/domain/vocab.ts';
import type { EvaluationInput } from '#server/engine/types.ts';
import { buildImprovements } from './improvements.ts';
import { scoreDimensions, type Outcome } from './dimensions.ts';
import { buildStrengths } from './strengths.ts';
import { buildSummary } from './summary.ts';
import {
  buildCallView,
  buildCompletion,
  buildCurveball,
  buildDiscovery,
  buildJourney,
  buildNextPractice,
  capScore,
  dimensionSufficiency,
  overallScore,
  phraseContext,
  trainingNote,
  type CallView,
  type Scores,
} from './parts.ts';
import { dimensionGuidance } from './phrasing.ts';

// The rules evaluator: scores the six dimensions from the turn classifications and the recorded
// state events by the explicit rules in docs/evaluation-rubric.md. It is deterministic: the same
// input always produces the same report (apart from `generatedAt`).

export const EVALUATOR_NAME = 'Firefly rules evaluator';
export const EVALUATOR_VERSION = 'rules-1.0.0';

function judge(call: CallView, outcomes: Outcome[]): DimensionResult[] {
  const context = phraseContext(call);
  return outcomes.map((outcome): DimensionResult => {
    const score = capScore(outcome.score, outcome.support);
    const note =
      score < outcome.score
        ? ` Capped at ${score}: a higher score needs more quoted evidence.`
        : '';
    return {
      id: outcome.id,
      score,
      label: scoreLabel(score),
      rationale: truncate(`${outcome.rationale}${note}`, 600),
      evidence: outcome.evidence,
      sufficiency: dimensionSufficiency(call, outcome.id),
      guidance: truncate(
        dimensionGuidance(outcome.id, outcome.gap, { ...context, fact: outcome.fact }),
        500,
      ),
    };
  });
}

function emptyCall(): DimensionResult[] {
  return DIMENSION_IDS.map((id) => ({
    id,
    score: 1,
    label: scoreLabel(1),
    rationale: 'The call ended before you said anything, so there is nothing to score.',
    evidence: [],
    sufficiency: 'insufficient',
    guidance: `Once a call is under way, this looks at: ${DIMENSIONS[id].description}`,
  }));
}

export function evaluateWithRules(
  input: EvaluationInput,
  options: { now?: Date } = {},
): CoachingReport {
  const call = buildCallView(input);
  const completion = buildCompletion(call);
  const discovery = buildDiscovery(call);

  const nothingSaid = call.turns.length === 0;
  const outcomes = nothingSaid ? [] : scoreDimensions(call, discovery);
  const dimensions = nothingSaid ? emptyCall() : judge(call, outcomes);
  const scores = Object.fromEntries(dimensions.map((d) => [d.id, d.score])) as Scores;
  const overall = overallScore(scores, completion.evidence);

  const strengths = nothingSaid ? [] : buildStrengths(call, discovery, scores);
  const improvements = nothingSaid
    ? []
    : buildImprovements(call, discovery, scores, completion.evidence, outcomes);

  return CoachingReportSchema.parse({
    version: 1,
    generatedAt: (options.now ?? new Date()).toISOString(),
    evaluator: {
      kind: 'rules',
      name: EVALUATOR_NAME,
      version: EVALUATOR_VERSION,
      providerLabel: input.provider.label,
    },
    completion,
    summary: {
      overall: buildSummary({ call, completion, discovery, strengths, improvements }),
      overallScore: overall,
      coachingFocus: [...new Set(input.scenario.coachingFocus)],
    },
    dimensions,
    strengths: strengths.map((s) => s.item),
    improvements: improvements.map((i) => i.item),
    discovery,
    journey: buildJourney(call),
    curveball: buildCurveball(call),
    nextPractice: buildNextPractice(call, scores, overall, discovery),
    trainingNote: trainingNote(EVALUATOR_NAME),
  });
}
