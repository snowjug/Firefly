import { z } from 'zod';
import {
  CURVEBALL_TYPES,
  DIFFICULTIES,
  DIMENSION_IDS,
  FACT_IMPORTANCE,
  SCORE_LABELS,
} from './vocab.ts';

// The coaching report is stored as JSON with every completed session and re-validated when it is
// read back. Evidence always points at real transcript turns: every quote is checked against the
// turn it cites before a report is saved.

const dimension = z.enum(DIMENSION_IDS);
const turnIndex = z.number().int().min(1);

export const EvidenceSchema = z.object({
  turnIndex,
  quote: z.string().min(1).max(300),
});

export const DimensionResultSchema = z.object({
  id: dimension,
  score: z.number().int().min(1).max(5),
  label: z.enum(SCORE_LABELS),
  rationale: z.string().min(1).max(600),
  evidence: z.array(EvidenceSchema).max(4),
  sufficiency: z.enum(['sufficient', 'limited', 'insufficient']),
  guidance: z.string().min(1).max(500),
});

export const StrengthSchema = z.object({
  dimension,
  title: z.string().min(1).max(120),
  turnIndex,
  quote: z.string().min(1).max(300),
  whyItHelped: z.string().min(1).max(400),
});

export const ImprovementSchema = z.object({
  dimension,
  title: z.string().min(1).max(120),
  turnIndex: turnIndex.nullable(), // null when the gap is something that never happened
  quote: z.string().max(300).nullable(),
  risk: z.string().min(1).max(400),
  betterPhrasing: z.string().min(1).max(500),
  whyItWorks: z.string().min(1).max(400),
});

export const DiscoveryResultSchema = z.object({
  factId: z.string(),
  label: z.string(),
  importance: z.enum(FACT_IMPORTANCE),
  status: z.enum(['discovered', 'partial', 'missed']),
  revealedAtTurn: turnIndex.nullable(),
  revealingQuestion: z.string().nullable(),
  whatWasHidden: z.string(), // shown only after the call has ended
  betterQuestion: z.string(),
  consequence: z.string(),
});

export const JourneyPointSchema = z.object({
  turnIndex: z.number().int().min(0),
  temperature: z.number().min(0).max(100),
  band: z.string(),
  kind: z.enum(['start', 'turn', 'turning-point', 'curveball', 'end']),
  delta: z.number(),
  reason: z.string().nullable(),
  quote: z.string().nullable(),
});

export const CoachingReportSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  evaluator: z.object({
    kind: z.enum(['rules', 'model']),
    name: z.string(),
    version: z.string(),
    providerLabel: z.string(),
  }),
  completion: z.object({
    status: z.enum(['completed', 'ended-early']),
    traineeTurns: z.number().int().min(0),
    evidence: z.enum(['sufficient', 'limited', 'insufficient']),
    note: z.string().nullable(),
  }),
  summary: z.object({
    overall: z.string().min(1).max(1200),
    overallScore: z.number().min(1).max(5).nullable(),
    coachingFocus: z.array(dimension),
  }),
  dimensions: z.array(DimensionResultSchema).length(6),
  strengths: z.array(StrengthSchema).max(3),
  improvements: z.array(ImprovementSchema).max(3),
  discovery: z.object({
    results: z.array(DiscoveryResultSchema),
    found: z.number().int().min(0),
    partial: z.number().int().min(0),
    missed: z.number().int().min(0),
    total: z.number().int().min(0),
  }),
  journey: z.object({
    points: z.array(JourneyPointSchema),
    start: z.number(),
    end: z.number(),
    peak: z.number(),
    lowest: z.number(),
  }),
  curveball: z
    .object({
      type: z.enum(CURVEBALL_TYPES),
      firedAtTurn: turnIndex,
      status: z.enum(['resolved', 'unresolved', 'active']),
      assessment: z.string(),
    })
    .nullable(),
  nextPractice: z.object({
    dimension,
    recommendation: z.string().min(1).max(500),
    suggestedDifficulty: z.enum(DIFFICULTIES),
    suggestedScenarioId: z.string().nullable(),
    suggestedScenarioTitle: z.string().nullable(),
  }),
  trainingNote: z.string(),
});

export type DimensionResult = z.infer<typeof DimensionResultSchema>;
export type StrengthItem = z.infer<typeof StrengthSchema>;
export type ImprovementItem = z.infer<typeof ImprovementSchema>;
export type DiscoveryResult = z.infer<typeof DiscoveryResultSchema>;
export type JourneyPoint = z.infer<typeof JourneyPointSchema>;
export type CoachingReport = z.infer<typeof CoachingReportSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;

// What a model evaluator must return. The server merges it with facts it computes itself
// (discovery results, the temperature journey) and re-checks every quote before saving.
export const EvaluationDraftSchema = z.object({
  summary: z.string().min(1).max(800),
  dimensions: z
    .array(
      z.object({
        id: dimension,
        score: z.number().int().min(1).max(5),
        rationale: z.string().min(1).max(500),
        evidence: z.array(z.object({ turnIndex, quote: z.string().min(1).max(260) })).max(4),
        sufficiency: z.enum(['sufficient', 'limited', 'insufficient']),
        guidance: z.string().min(1).max(400),
      }),
    )
    .length(6),
  strengths: z
    .array(
      z.object({
        dimension,
        turnIndex,
        quote: z.string().min(1).max(260),
        whyItHelped: z.string().min(1).max(300),
      }),
    )
    .max(3),
  improvements: z
    .array(
      z.object({
        dimension,
        turnIndex: turnIndex.nullable(),
        quote: z.string().max(260).nullable(),
        risk: z.string().min(1).max(300),
        betterPhrasing: z.string().min(1).max(400),
        whyItWorks: z.string().min(1).max(300),
      }),
    )
    .max(3),
  nextPractice: z.object({ dimension, recommendation: z.string().min(1).max(400) }),
});
export type EvaluationDraft = z.infer<typeof EvaluationDraftSchema>;
