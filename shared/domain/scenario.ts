import { z } from 'zod';
import {
  CALL_STAGES,
  CURVEBALL_TYPES,
  DIFFICULTIES,
  DIFFICULTY_RANK,
  DIMENSION_IDS,
  DISCOVERY_INTENTS,
  FACT_IMPORTANCE,
  IMPACTS,
  ISSUE_TYPES,
  PROFICIENCIES,
  START_TEMPERATURES,
  STYLES,
} from './vocab.ts';

// Scenario definitions are authored as TypeScript objects (see server/scenarios/library) and
// validated with these schemas at load time. All people, organisations and products in a
// scenario are fictional.

const id = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'use lower-case kebab-case')
  .max(64);
const text = (max: number, min = 1) => z.string().trim().min(min).max(max);

export const PersonaSchema = z.object({
  name: text(60), // fictional full name
  role: text(80),
  organisation: text(80), // fictional organisation
  background: text(400),
  voice: text(300), // how this person talks (used for model prompts and for authors)
});

export const EnvironmentSchema = z.object({
  product: text(80), // fictional product or service name
  details: z.array(text(200)).min(1).max(8),
});

// What the customer says about the business impact at each impact level. Changing the impact
// setting swaps these in, so it changes what the customer says and how urgent they feel.
export const ImpactVariantSchema = z.object({
  summary: text(300, 10), // volunteered in the opening, in the customer's voice
  detail: text(400, 10), // shared when asked about scope or impact, in the customer's voice
  deadline: text(200).optional(), // time pressure the customer may mention
});

// Facts the customer shares freely when asked a relevant question.
export const KnownFactSchema = z.object({
  id,
  text: text(300, 5), // customer voice
  intents: z.array(z.enum(DISCOVERY_INTENTS)).min(1).max(4),
  elaboration: text(300).optional(), // extra colour for talkative customers
  simple: text(300).optional(), // plainer phrasing for non-native speakers and novices
});

// Facts the customer reveals ONLY in response to an appropriate question.
export const HiddenFactSchema = z.object({
  id,
  importance: z.enum(FACT_IMPORTANCE),
  label: text(60),
  statement: text(400, 10), // customer voice, revealed when a matching intent is asked
  partialStatement: text(300).optional(), // revealed for broad questions (partial discovery)
  // Plain-language description of the kind of question that should reveal this fact. A model
  // classifier uses it to decide whether a question addressed the fact; it must not contain the
  // fact itself.
  revealWhen: text(220, 10),
  intents: z.array(z.enum(DISCOVERY_INTENTS)).min(1).max(4), // topics of questions that reveal it
  partialIntents: z.array(z.enum(DISCOVERY_INTENTS)).max(4).optional(), // broad questions
  // Rules mode: when present, the question must also contain one of these phrases (lower-case,
  // matched as substrings) so that a broad topic does not reveal a specific fact too early.
  cues: z.array(text(60)).max(12).optional(),
  hint: text(240).optional(), // a clearer clue shown at Starter difficulty
  minDifficulty: z.enum(DIFFICULTIES).default('starter'), // fact exists at this difficulty and above
  availableAfterTurn: z.number().int().min(1).max(10).default(1), // trainee turn number
  minTrust: z.number().int().min(0).max(90).default(0), // customer withholds while trust is lower
  requiresImpactAck: z.boolean().default(false), // customer waits until impact is acknowledged
  statementTerse: text(200).optional(),
  statementSimple: text(400).optional(),
  missedConsequence: text(300, 10), // coaching consequence if missed
  betterQuestion: text(240, 10), // a good question that would have revealed it
});

export const CurveballTriggerSchema = z.object({
  earliestTurn: z.number().int().min(2).max(30).default(4), // trainee turn number
  latestTurn: z.number().int().min(2).max(40).optional(), // fires by this turn if conditions never hold
  whenTemperatureAtLeast: z.number().int().min(0).max(100).optional(),
  whenImpactUnacknowledged: z.boolean().optional(),
  whenOwnershipUnclear: z.boolean().optional(),
  afterFact: id.optional(), // fires after this hidden fact has been discovered
});

export const CurveballDefinitionSchema = z.object({
  id,
  type: z.enum(CURVEBALL_TYPES),
  trigger: CurveballTriggerSchema,
  statement: text(400, 10), // customer voice
  followUp: text(300).optional(), // said if still unresolved after two more turns
  introducesFacts: z.array(KnownFactSchema).max(2).optional(), // facts available after it fires
  expectedResponse: text(300, 10), // what a strong response looks like (coaching grounding)
  minDifficulty: z.enum(DIFFICULTIES).default('standard'),
  effects: z
    .object({
      temperature: z.number().int().min(-20).max(30).optional(),
      trust: z.number().int().min(-30).max(10).optional(),
      patience: z.number().int().min(-30).max(10).optional(),
    })
    .optional(),
});

const StageFrameSchema = z.object({
  opening: text(300, 10), // prefix the customer says in the opening for this stage
  brief: text(300, 10), // what the trainee is told about the case so far
});

export const ScenarioDefinitionSchema = z
  .object({
    id,
    version: z.number().int().min(1),
    enabled: z.boolean().default(true),
    spotlight: z.boolean().default(false), // designed for the panel demo
    title: text(80),
    summary: text(220, 20), // public, contains no hidden information
    tags: z.array(text(30)).max(8).default([]),
    estimatedMinutes: z.number().int().min(5).max(30),

    // Default settings (every one of these can be changed when the call is configured)
    issueType: z.enum(ISSUE_TYPES),
    impact: z.enum(IMPACTS),
    startingTemperature: z.enum(START_TEMPERATURES),
    proficiency: z.enum(PROFICIENCIES),
    style: z.enum(STYLES),
    callStage: z.enum(CALL_STAGES),
    difficulty: z.enum(DIFFICULTIES),

    persona: PersonaSchema,
    environment: EnvironmentSchema,
    customerObjective: text(300, 10),

    // What the trainee is allowed to know before the call (no hidden facts).
    brief: z.object({
      situation: text(500, 20),
      goal: text(300, 10),
      groundRules: z.array(text(200)).max(5).default([]),
    }),

    // Neutral first-person statement of the problem. The opening line is composed from this plus
    // the starting temperature, communication style, call stage and impact settings.
    openingCore: text(400, 10),
    impactVariants: z.object({
      low: ImpactVariantSchema,
      medium: ImpactVariantSchema,
      high: ImpactVariantSchema,
    }),
    stageFrames: z
      .object({
        'first-contact': StageFrameSchema,
        'follow-up': StageFrameSchema,
        escalated: StageFrameSchema,
        closure: StageFrameSchema,
      })
      .partial()
      .default({}),
    priorHistory: z
      .array(z.object({ when: text(60), summary: text(240) }))
      .max(6)
      .default([]),

    knownFacts: z.array(KnownFactSchema).min(2).max(10),
    hiddenFacts: z.array(HiddenFactSchema).min(3).max(8),
    incorrectAssumptions: z
      .array(z.object({ id, statement: text(300, 10), truth: text(300, 10) }))
      .max(3)
      .default([]),
    curveballs: z.array(CurveballDefinitionSchema).max(6).default([]),

    expectedDiscoveryAreas: z.array(text(60)).min(2).max(8), // public cues (guided mode)
    successCriteria: z.array(text(240)).min(3).max(6),
    coachingFocus: z.array(z.enum(DIMENSION_IDS)).min(1).max(3),
    poorApproaches: z.array(text(240)).min(2).max(6),
    goodBehaviours: z.array(text(240)).min(3).max(6),
    expectedOutcome: text(400, 10),
    evaluatorNotes: text(800, 20), // root cause and what a strong call looks like
  })
  .superRefine((scenario, ctx) => {
    const add = (message: string, path: (string | number)[]) =>
      ctx.addIssue({ code: 'custom', message, path });

    const ids = new Map<string, string>();
    const claim = (value: string, where: string, path: (string | number)[]) => {
      if (ids.has(value)) add(`id "${value}" is used by both ${ids.get(value)} and ${where}`, path);
      else ids.set(value, where);
    };
    scenario.knownFacts.forEach((f, i) => claim(f.id, 'a known fact', ['knownFacts', i, 'id']));
    scenario.hiddenFacts.forEach((f, i) => claim(f.id, 'a hidden fact', ['hiddenFacts', i, 'id']));
    scenario.curveballs.forEach((c, i) => claim(c.id, 'a curveball', ['curveballs', i, 'id']));

    const hiddenIds = new Set(scenario.hiddenFacts.map((f) => f.id));
    scenario.curveballs.forEach((c, i) => {
      if (c.trigger.afterFact && !hiddenIds.has(c.trigger.afterFact)) {
        add(`afterFact "${c.trigger.afterFact}" is not a hidden fact id`, [
          'curveballs',
          i,
          'trigger',
        ]);
      }
    });

    const defaultRank = DIFFICULTY_RANK[scenario.difficulty];
    const atDefault = scenario.hiddenFacts.filter(
      (f) => DIFFICULTY_RANK[f.minDifficulty] <= defaultRank,
    );
    if (!atDefault.some((f) => f.importance === 'critical')) {
      add('at least one critical hidden fact must exist at the default difficulty', [
        'hiddenFacts',
      ]);
    }
    const starterFacts = scenario.hiddenFacts.filter((f) => f.minDifficulty === 'starter');
    if (starterFacts.length < 2) {
      add('at least two hidden facts must be available at Starter difficulty', ['hiddenFacts']);
    }
    const standardFacts = scenario.hiddenFacts.filter((f) => DIFFICULTY_RANK[f.minDifficulty] <= 1);
    if (standardFacts.length < 3) {
      add('at least three hidden facts must be available at Standard difficulty', ['hiddenFacts']);
    }
    if (!starterFacts.some((f) => f.hint)) {
      add('at least one Starter-tier hidden fact needs a hint (clearer clue)', ['hiddenFacts']);
    }
    scenario.hiddenFacts.forEach((f, i) => {
      if (!f.betterQuestion.trim().endsWith('?')) {
        add('betterQuestion must be phrased as a question', ['hiddenFacts', i, 'betterQuestion']);
      }
    });
  });

export type ScenarioInput = z.input<typeof ScenarioDefinitionSchema>;
export type ScenarioDefinition = z.output<typeof ScenarioDefinitionSchema>;
export type HiddenFact = z.output<typeof HiddenFactSchema>;
export type KnownFact = z.output<typeof KnownFactSchema>;
export type CurveballDefinition = z.output<typeof CurveballDefinitionSchema>;
export type ImpactVariant = z.output<typeof ImpactVariantSchema>;
export type ScenarioPersona = z.output<typeof PersonaSchema>;

// ---------------------------------------------------------------------------------------
// Settings a trainer or trainee can change when configuring a call.

export const ScenarioOverridesSchema = z.object({
  impact: z.enum(IMPACTS).optional(),
  startingTemperature: z.enum(START_TEMPERATURES).optional(),
  proficiency: z.enum(PROFICIENCIES).optional(),
  style: z.enum(STYLES).optional(),
  callStage: z.enum(CALL_STAGES).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  // Curveball types to enable. Omit for the difficulty default; [] for none.
  curveballs: z.array(z.enum(CURVEBALL_TYPES)).max(4).optional(),
});
export type ScenarioOverrides = z.infer<typeof ScenarioOverridesSchema>;
