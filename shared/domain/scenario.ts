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
  PRODUCT_IDS,
  PROFICIENCIES,
  START_TEMPERATURES,
  STYLES,
} from './vocab.ts';

// Scenario definitions are authored as TypeScript objects (see server/scenarios/library) and
// validated with these schemas at load time. All people, organisations and case references in a
// scenario are fictional. The products are real Microsoft products, so a scenario describes what a
// customer reports in everyday words and never states product behaviour as fact.

const id = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'use lower-case kebab-case')
  .max(64);
const text = (max: number, min = 1) => z.string().trim().min(min).max(max);

export const wordCount = (value: string): number =>
  value.trim().split(/\s+/).filter(Boolean).length;

// Text the trainee reads on screen has a word budget. The character limit is only a generous
// safety net (about twelve characters a word), so a budget never fails on long words.
const short = (maxWords: number, min = 1) =>
  z
    .string()
    .trim()
    .min(min)
    .max(maxWords * 12)
    .refine((value) => wordCount(value) <= maxWords, `use at most ${maxWords} words`);

const intentList = (max: number) => z.array(z.enum(DISCOVERY_INTENTS)).min(1).max(max);
// Rules mode: when present, the question must also contain one of these phrases (lower-case,
// matched as substrings), so that a broad topic does not trigger a specific answer too early.
const cueList = z.array(text(60)).max(12).optional();
// The call stages in which something exists. Left out, every stage. Something that only makes
// sense in a call-back (for example "I was promised a call yesterday") is limited to those stages.
const stageList = z.array(z.enum(CALL_STAGES)).min(1).optional();

export const PersonaSchema = z.object({
  name: text(60), // fictional full name
  role: text(80),
  organisation: text(80), // fictional organisation
  background: text(400),
  voice: text(300), // how this person talks (used for model prompts and for authors)
  // Optional pairing hint for the synthetic voice. The trainee chooses among neutral voices and
  // nothing about a person's behaviour or the support they deserve depends on it.
  speaker: z.enum(['female', 'male']).optional(),
});

// Details of the customer's setup. The product itself comes from `product`, so the two can never
// disagree.
export const EnvironmentSchema = z.object({
  details: z.array(text(200)).min(1).max(8),
});

export const ProductRefSchema = z.object({
  id: z.enum(PRODUCT_IDS),
  area: text(60), // what part of the product, for example "Meetings" or "Virtual machines"
});

// How many people are affected at each impact level, so changing the impact setting changes the
// number as well as the story. Internal: it is usually a hidden fact.
export const AffectedUsersSchema = z.object({
  count: z.number().int().min(1).max(100000).nullable(),
  summary: text(120),
});

// What the trainee may read before the call. It never contains a hidden fact.
export const PublicBriefSchema = z.object({
  issue: short(18), // what the case says is wrong
  impact: z.object({ low: short(16), medium: short(16), high: short(16) }),
  objective: short(18), // what the trainee should aim for on this call
  knownContext: short(30).optional(),
  previousContact: short(30).optional(),
  environment: short(30).optional(),
});

// What the customer says about the business impact at each impact level. Changing the impact
// setting swaps these in, so it changes what the customer says and how urgent they feel.
export const ImpactVariantSchema = z.object({
  summary: text(300, 10), // volunteered in the opening, in the customer's voice
  detail: text(400, 10), // shared when asked about scope or impact, in the customer's voice
  deadline: text(200).optional(), // time pressure the customer may mention
});

// Facts the customer knows and shares confidently when asked a relevant question.
export const KnownFactSchema = z.object({
  id,
  text: text(300, 5), // customer voice
  intents: z.array(z.enum(DISCOVERY_INTENTS)).min(1).max(4),
  cues: cueList,
  stages: stageList,
  elaboration: text(300).optional(), // extra colour for talkative customers
  simple: text(300).optional(), // plainer phrasing for non-native speakers and novices
});

// Facts the customer half remembers. They answer with a hedge, and only firm it up when the
// engineer asks a narrower question or suggests how to confirm.
export const VagueFactSchema = z.object({
  id,
  intents: intentList(3),
  cues: cueList,
  stages: stageList,
  text: text(260, 5), // hedged answer in the customer's voice
  confirmedText: text(260, 5).optional(), // what they say once the engineer narrows it down
});

// Facts the customer can only give after looking something up.
export const CheckableFactSchema = z.object({
  id,
  intents: intentList(3),
  cues: cueList,
  stages: stageList,
  checking: text(120, 3), // what they say while they look, for example "Give me a moment."
  text: text(260, 5), // what they report once they have looked
});

// Things the customer does not know. They say so and never guess. Another person may know.
export const UnknownFactSchema = z.object({
  id,
  intents: intentList(3),
  cues: cueList,
  stages: stageList,
  text: text(240, 5), // for example "I don't have that to hand."
  whoKnows: text(80).optional(), // for example "our administrator"
});

// Background the customer may mention that does not help solve the case (talkative customers).
export const IrrelevantFactSchema = z.object({ id, stages: stageList, text: text(240, 5) });

// What a good call looks like for this scenario, as observable behaviour, by CARE principle.
export const CareExpectationsSchema = z.object({
  communicate: z.array(text(200, 10)).min(1).max(4),
  accountable: z.array(text(200, 10)).min(1).max(4),
  resourceful: z.array(text(200, 10)).min(1).max(4),
  empathetic: z.array(text(200, 10)).min(1).max(4),
});

// What a hidden fact says at one impact level, when it differs from the default `statement`.
export const ImpactStatementSchema = z.object({
  statement: text(400, 10),
  partialStatement: text(300).optional(),
  statementTerse: text(200).optional(),
  statementSimple: text(400).optional(),
});

// Facts the customer reveals ONLY in response to an appropriate question.
export const HiddenFactSchema = z.object({
  id,
  importance: z.enum(FACT_IMPORTANCE),
  label: text(60),
  statement: text(400, 10), // customer voice, revealed when a matching intent is asked
  partialStatement: text(300).optional(), // revealed for broad questions (partial discovery)
  // `statement` is written for the scenario's default impact level. When a call is configured with
  // another level and a fact is about how many people or how bad, give the version for that level
  // here; it replaces `statement` and its variants for that call. Without one the default is used.
  byImpact: z
    .object({
      low: ImpactStatementSchema,
      medium: ImpactStatementSchema,
      high: ImpactStatementSchema,
    })
    .partial()
    .optional(),
  // The call stages in which this fact exists. A fact that only makes sense in a call-back (for
  // example "I was promised a call yesterday") is limited to those stages. Left out, every stage.
  stages: stageList,
  // Plain-language description of the kind of question that should reveal this fact. A model
  // classifier uses it to decide whether a question addressed the fact; it must not contain the
  // fact itself.
  revealWhen: text(220, 10),
  intents: z.array(z.enum(DISCOVERY_INTENTS)).min(1).max(4), // topics of questions that reveal it
  partialIntents: z.array(z.enum(DISCOVERY_INTENTS)).max(4).optional(), // broad questions
  // Rules mode: when present, the question must also contain one of these phrases (lower-case,
  // matched as substrings) so that a broad topic does not reveal a specific fact too early.
  cues: cueList,
  // A fact can be both hidden and something the customer has to look up. Then they say `checking`
  // first and give `statement` in the same reply.
  knowledge: z.enum(['confident', 'after-checking']).default('confident'),
  checking: text(120, 3).optional(),
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
    listSummary: short(18, 10), // one line for the scenario list; no hidden information
    summary: short(60, 20), // public detail view; contains no hidden information
    tags: z.array(text(30)).max(8).default([]),
    estimatedMinutes: z.number().int().min(5).max(30),

    // The Microsoft product. The case number is made up (SIM-000000 form) so that it cannot be
    // mistaken for a real service request; follow-up, escalated and closure calls should have one.
    product: ProductRefSchema,
    caseReference: z
      .string()
      .regex(/^SIM-\d{6}$/, 'use the form SIM-000000')
      .optional(),

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
    // Internal: how many people are affected at each impact level. Usually a hidden fact, so it is
    // never in the brief.
    affectedUsers: z.object({
      low: AffectedUsersSchema,
      medium: AffectedUsersSchema,
      high: AffectedUsersSchema,
    }),
    customerObjective: text(300, 10),
    customerExpectation: text(300, 10), // what the customer expects from this call
    desiredOutcome: text(300, 10), // the support outcome a good call reaches
    previousTroubleshooting: z.array(text(200)).max(6).default([]),
    recentChanges: z.array(text(200)).max(5).default([]),

    publicBrief: PublicBriefSchema,

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
    // Every stage a call can be configured for has its own opening and brief, so a follow-up,
    // an escalation and a closure call each sound different. A first contact may rely on
    // `openingCore` alone.
    stageFrames: z.object({
      'first-contact': StageFrameSchema.optional(),
      'follow-up': StageFrameSchema,
      escalated: StageFrameSchema,
      closure: StageFrameSchema,
    }),
    priorHistory: z
      .array(z.object({ when: text(60), summary: text(240) }))
      .max(6)
      .default([]),

    // What the customer knows, and how well. Together these decide what they can say when asked.
    knownFacts: z.array(KnownFactSchema).min(2).max(10), // known and confidently answerable
    vagueFacts: z.array(VagueFactSchema).max(4).default([]), // vaguely remembered
    checkableFacts: z.array(CheckableFactSchema).max(4).default([]), // available after checking
    unknownFacts: z.array(UnknownFactSchema).min(1).max(5), // not known to the customer
    irrelevantFacts: z.array(IrrelevantFactSchema).max(4).default([]), // not relevant
    hiddenFacts: z.array(HiddenFactSchema).min(3).max(8), // hidden but discoverable
    incorrectAssumptions: z // misunderstood or wrongly assumed by the customer
      .array(z.object({ id, stages: stageList, statement: text(300, 10), truth: text(300, 10) }))
      .max(3)
      .default([]),
    curveballs: z.array(CurveballDefinitionSchema).max(6).default([]),
    // The curveball types this scenario can be configured with. Every authored curveball must be
    // listed; a listed type without an authored definition uses a generic one.
    allowedCurveballs: z.array(z.enum(CURVEBALL_TYPES)).min(1).max(8),

    expectedDiscoveryAreas: z.array(text(60)).min(2).max(8), // public cues (guided mode)
    successCriteria: z.array(text(240)).min(3).max(6),
    coachingFocus: z.array(z.enum(DIMENSION_IDS)).min(1).max(3),
    careExpectations: CareExpectationsSchema,
    // Behaviours from the CBCF material. This stays empty until authorised CBCF source material
    // is available (see docs/care-cbcf-rubric.md); nothing is guessed.
    cbcfBehaviours: z.array(text(200)).max(0).default([]),
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
    scenario.vagueFacts.forEach((f, i) => claim(f.id, 'a vague fact', ['vagueFacts', i, 'id']));
    scenario.checkableFacts.forEach((f, i) =>
      claim(f.id, 'a checkable fact', ['checkableFacts', i, 'id']),
    );
    scenario.unknownFacts.forEach((f, i) =>
      claim(f.id, 'an unknown fact', ['unknownFacts', i, 'id']),
    );
    scenario.irrelevantFacts.forEach((f, i) =>
      claim(f.id, 'an irrelevant fact', ['irrelevantFacts', i, 'id']),
    );
    scenario.hiddenFacts.forEach((f, i) => claim(f.id, 'a hidden fact', ['hiddenFacts', i, 'id']));
    scenario.curveballs.forEach((c, i) => claim(c.id, 'a curveball', ['curveballs', i, 'id']));

    if (scenario.vagueFacts.length + scenario.checkableFacts.length < 1) {
      add('at least one fact must be vaguely remembered or available only after checking', [
        'vagueFacts',
      ]);
    }

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

    // Counted at the scenario's own call stage: a fact limited to other stages does not help here.
    const here = scenario.hiddenFacts.filter(
      (f) => !f.stages || f.stages.includes(scenario.callStage),
    );
    const defaultRank = DIFFICULTY_RANK[scenario.difficulty];
    const atDefault = here.filter((f) => DIFFICULTY_RANK[f.minDifficulty] <= defaultRank);
    if (!atDefault.some((f) => f.importance === 'critical')) {
      add('at least one critical hidden fact must exist at the default difficulty', [
        'hiddenFacts',
      ]);
    }
    const starterFacts = here.filter((f) => f.minDifficulty === 'starter');
    if (starterFacts.length < 2) {
      add('at least two hidden facts must be available at Starter difficulty', ['hiddenFacts']);
    }
    const standardFacts = here.filter((f) => DIFFICULTY_RANK[f.minDifficulty] <= 1);
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
      if (f.knowledge === 'after-checking' && !f.checking) {
        add('a fact the customer has to look up needs a `checking` line', [
          'hiddenFacts',
          i,
          'checking',
        ]);
      }
    });

    const allowed = new Set(scenario.allowedCurveballs);
    if (allowed.size !== scenario.allowedCurveballs.length) {
      add('allowedCurveballs lists a type twice', ['allowedCurveballs']);
    }
    scenario.curveballs.forEach((c, i) => {
      if (!allowed.has(c.type)) {
        add(`curveball type "${c.type}" is not in allowedCurveballs`, ['curveballs', i, 'type']);
      }
    });
  });

export type ScenarioInput = z.input<typeof ScenarioDefinitionSchema>;
export type ScenarioDefinition = z.output<typeof ScenarioDefinitionSchema>;
export type HiddenFact = z.output<typeof HiddenFactSchema>;
export type ImpactStatement = z.output<typeof ImpactStatementSchema>;
export type KnownFact = z.output<typeof KnownFactSchema>;
export type VagueFact = z.output<typeof VagueFactSchema>;
export type CheckableFact = z.output<typeof CheckableFactSchema>;
export type UnknownFact = z.output<typeof UnknownFactSchema>;
export type IrrelevantFact = z.output<typeof IrrelevantFactSchema>;
export type CareExpectations = z.output<typeof CareExpectationsSchema>;
export type PublicBrief = z.output<typeof PublicBriefSchema>;
export type ProductRef = z.output<typeof ProductRefSchema>;
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
