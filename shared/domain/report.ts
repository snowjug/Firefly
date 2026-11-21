import { z } from 'zod';
import {
  CARE_BEHAVIOURS,
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

// CARE is read from what happened in the call, behaviour by behaviour. Every quote is a verified
// quote of a real turn, exactly like the evidence for the six skills.
const care = z.enum(CARE_BEHAVIOURS);

export const CARE_LEVELS = ['strong', 'developing', 'not-yet', 'limited-evidence'] as const;
export type CareLevel = (typeof CARE_LEVELS)[number];

export const CareBehaviourResultSchema = z.object({
  id: z.string().regex(/^(communicate|accountable|resourceful|empathetic)\.[a-z0-9-]+$/),
  principle: care,
  label: z.string().min(1).max(80), // the observable behaviour, for example "Introduced themselves"
  status: z.enum(['shown', 'partly', 'not-shown']),
  evidence: z.array(EvidenceSchema).max(2),
  note: z.string().max(200).nullable(),
});

export const CarePrincipleResultSchema = z.object({
  id: care,
  label: z.string().min(1).max(40),
  level: z.enum(CARE_LEVELS),
  summary: z.string().min(1).max(240), // grounded in this call, about 25 words
  behaviours: z.array(CareBehaviourResultSchema).max(10),
});

// CBCF is not mapped until authorised CBCF source material is available. The report records that
// state so nothing here can be read as a CBCF result.
export const CbcfStatusSchema = z.object({
  status: z.literal('awaiting-authoritative-source'),
  mappingVersion: z.string().min(1).max(40),
  note: z.string().min(1).max(300),
});

// The customer journey the report shows, in call order: what a support call is expected to move
// through. `not-applicable` is used for the escalation milestone when no curveball happened.
export const MILESTONE_IDS = [
  'greeting',
  'impact',
  'discovery',
  'escalation',
  'ownership',
  'closure',
] as const;
export type MilestoneId = (typeof MILESTONE_IDS)[number];

export const MilestoneSchema = z.object({
  id: z.enum(MILESTONE_IDS),
  label: z.string().min(1).max(60),
  status: z.enum(['reached', 'not-reached', 'not-applicable']),
  turnIndex: turnIndex.nullable(), // the turn that shows it, linked to the transcript
  quote: z.string().max(300).nullable(),
});

const CoachingReportObject = z.object({
  // Version 1 reports were saved before CARE was read from the call. Version 2 reports always
  // carry `care`, `cbcf` and `journey.milestones`.
  version: z.union([z.literal(1), z.literal(2)]),
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
  care: z.array(CarePrincipleResultSchema).length(4).optional(),
  cbcf: CbcfStatusSchema.optional(),
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
    milestones: z.array(MilestoneSchema).length(6).optional(),
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

export const CoachingReportSchema = CoachingReportObject.superRefine((report, ctx) => {
  const add = (message: string, path: (string | number)[]) =>
    ctx.addIssue({ code: 'custom', message, path });

  if (report.care) {
    const seen = new Set<string>();
    report.care.forEach((principle, i) => {
      if (seen.has(principle.id))
        add(`CARE principle "${principle.id}" appears twice`, ['care', i]);
      seen.add(principle.id);
      principle.behaviours.forEach((behaviour, j) => {
        if (behaviour.principle !== principle.id) {
          add('a behaviour sits under a different principle', ['care', i, 'behaviours', j]);
        }
        // A behaviour is only "shown" or "partly shown" when a real moment in the call shows it.
        if (behaviour.status !== 'not-shown' && behaviour.evidence.length === 0) {
          add('a behaviour that was shown needs a quote from the call', [
            'care',
            i,
            'behaviours',
            j,
            'evidence',
          ]);
        }
      });
    });
  }

  if (report.journey.milestones) {
    const order = report.journey.milestones.map((m) => m.id).join(',');
    if (order !== MILESTONE_IDS.join(',')) {
      add('journey milestones must list each milestone once, in call order', [
        'journey',
        'milestones',
      ]);
    }
  }

  if (report.version === 2) {
    if (!report.care) add('a version 2 report carries `care`', ['care']);
    if (!report.cbcf) add('a version 2 report carries `cbcf`', ['cbcf']);
    if (!report.journey.milestones) {
      add('a version 2 report carries `journey.milestones`', ['journey', 'milestones']);
    }
  }
});

export type DimensionResult = z.infer<typeof DimensionResultSchema>;
export type CareBehaviourResult = z.infer<typeof CareBehaviourResultSchema>;
export type CarePrincipleResult = z.infer<typeof CarePrincipleResultSchema>;
export type CbcfStatus = z.infer<typeof CbcfStatusSchema>;
export type Milestone = z.infer<typeof MilestoneSchema>;
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
