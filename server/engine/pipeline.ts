import type { TurnClassification } from '#shared/domain/classification.ts';
import type { EffectiveScenario } from '#shared/domain/config.ts';
import type { StateEvent } from '#shared/domain/state.ts';
import { DISCOVERY_INTENTS, type DiscoveryIntent } from '#shared/domain/vocab.ts';
import { quoteInText, redactSensitive, sanitizeModelText } from '#shared/domain/text.ts';
import { conformCustomerReply, endListItems } from './conform.ts';
import { processCurveball, type CurveballTurnResult } from './curveballs.ts';
import { processDiscovery, type DiscoveryTurnResult, type MatchingMode } from './discovery.ts';
import { analyseTurn, recordCommitment, type TurnAnalysis } from './memory.ts';
import { planReply, revealText, type Flavour, type PlanPush } from './plan.ts';
import { isAsking } from './pressing.ts';
import { rngFor, type Rng } from './rng.ts';
import { applyTraineeTurn, weightedCoverage } from './state.ts';
import { questionWords } from './textutil.ts';
import type {
  Commitment,
  DiscoveryMap,
  DiscoveryRecord,
  EngineRuntime,
  TranscriptTurn,
} from './types.ts';

// One trainee turn through the simulation:
//   classify -> analyse -> discover -> update state -> curveballs -> customer reply -> conform
// The classifier and the customer generator are injected, so the same pipeline serves demo mode
// (rules) and live mode (model) and can be tested with fakes. Whatever writes the reply, the
// customer's words are conformed (kept short, no praise, no coaching) and only then is anything
// recorded as said: a hidden fact counts as discovered only if its words are in the final reply.

export interface CustomerGenerationContext {
  scenario: EffectiveScenario;
  runtime: EngineRuntime; // already updated for this turn
  classification: TurnClassification;
  analysis: TurnAnalysis; // what the turn meant for the customer's memory
  discovery: DiscoveryTurnResult;
  curveball: CurveballTurnResult;
  traineeTurnNumber: number;
  /** The engineer's turn number, not counting a first exchange that was only a greeting. */
  effectiveTurn: number;
  /** Stage expectations the engineer met for the first time in this turn. */
  stageMetNow: string[];
  rng: Rng;
  history: TranscriptTurn[]; // the conversation so far, including this trainee turn
  traineeText: string;
}

export interface CustomerGeneration {
  text: string;
  source: 'live' | 'demo';
  /**
   * Codes of what was wrong with a model's reply that was cut down to what could be said safely
   * (see providers/guards.ts). Only codes: never any of the reply. For the log.
   */
  repaired?: readonly string[];
  // Demo mode reports exactly what it said; live mode leaves these to the pipeline's defaults,
  // which follow the plan the model was given.
  bookkeeping?: {
    used?: string[];
    toldIds?: string[];
    hintIds?: string[];
    /** Hidden facts whose words are in the reply. Without it the pipeline checks the reply itself. */
    revealedIds?: string[];
    voicedAssumptions?: string[];
    timelineAsked?: boolean;
    followUpGiven?: boolean;
    pushed?: PlanPush | null;
    /** The line of personality the customer said, when one was added to the reply. */
    flavoured?: Flavour | null;
    echoed?: string | null;
    customerChecks?: { id: string; whoKnows: string }[];
    confusedBy?: string | null;
    /** Most sentences the reply was allowed to have. */
    limit?: number;
  };
}

export interface ProcessTurnArgs {
  scenario: EffectiveScenario;
  runtime: EngineRuntime;
  traineeText: string; // already redacted
  turnIndex: number; // conversation index of this trainee turn
  history: TranscriptTurn[]; // prior turns, not including this trainee turn
  classify: (text: string, traineeTurnNumber: number) => Promise<TurnClassification>;
  generate: (ctx: CustomerGenerationContext) => Promise<CustomerGeneration>;
  /** Whether a model or the rules described the turn: cues only gate answers in rules mode. */
  matching?: MatchingMode;
}

export interface ProcessTurnResult {
  runtime: EngineRuntime;
  classification: TurnClassification;
  stateEvents: StateEvent[];
  discoveryRecords: DiscoveryRecord[];
  customerText: string;
  customerSource: 'live' | 'demo';
  /** What was wrong with a model's reply that had to be cut down (codes only; see CustomerGeneration). */
  customerRepaired: readonly string[];
  curveballFired: string | null; // definition id
}

/** Never trust a classifier (especially a model): clamp it to what the scenario can actually use. */
export function validateClassification(
  c: TurnClassification,
  scenario: EffectiveScenario,
  traineeText: string,
): TurnClassification {
  const factIds = new Set(scenario.hiddenFacts.map((f) => f.id));
  const intents = c.discoveryIntents.filter((i): i is DiscoveryIntent =>
    (DISCOVERY_INTENTS as readonly string[]).includes(i),
  );
  const seen = new Set<string>();
  const factTargets = c.askedQuestion
    ? c.factTargets.filter((t) => {
        if (!factIds.has(t.id) || seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      })
    : [];
  return {
    ...c,
    discoveryIntents: [...new Set(intents)],
    factTargets,
    evidence: c.evidence.filter((e) => quoteInText(traineeText, e.quote)),
    confidence: Math.min(1, Math.max(0, c.confidence)),
  };
}

/** What the customer said, as far as it can be told from the plan the reply was written from. */
function defaultBookkeeping(ctx: CustomerGenerationContext) {
  const plan = planReply(ctx);
  const said = plan.say;
  return {
    toldIds: said
      .filter((s) => !['reminder', 'hint', 'full', 'partial'].includes(s.kind))
      .map((s) => s.id),
    hintIds: said.filter((s) => s.kind === 'hint').map((s) => s.id),
    pushed: plan.push,
    flavoured: plan.flavour,
    echoed: plan.echo?.id ?? null,
    customerChecks: said.flatMap((s) =>
      s.kind === 'unknown' && s.whoKnows ? [{ id: s.id, whoKnows: s.whoKnows }] : [],
    ),
    confused: plan.reactions.includes('confused'),
  };
}

// Sentences the conformer can remove. When it did, a fact the reply was meant to reveal may be gone.
const REMOVING = new Set(['too-long', 'praise', 'coaching', 'announces-facts', 'empty']);

/** Which of the facts this turn revealed are still in the reply. */
function revealsSaid(ctx: CustomerGenerationContext, text: string, removed: boolean): Set<string> {
  const said = new Set<string>();
  const words = new Set(questionWords(text));
  const style = ctx.scenario.config.style;
  for (const { fact, mode } of ctx.discovery.reveal) {
    // A reply that was only formatted is trusted to say what it was asked to say. One that had
    // sentences cut away must still hold most of the fact's words.
    if (!removed) {
      said.add(fact.id);
      continue;
    }
    const wanted = questionWords(revealText(fact, mode, style));
    const covered = wanted.filter((w) => words.has(w)).length;
    if (wanted.length === 0 || covered / wanted.length >= 0.5) said.add(fact.id);
  }
  return said;
}

const NEUTRAL_REPLY = 'Okay.';

export async function processTraineeTurn(args: ProcessTurnArgs): Promise<ProcessTurnResult> {
  const { scenario, runtime, traineeText, turnIndex, history } = args;
  const traineeTurnNumber = runtime.traineeTurns + 1;
  const effectiveTurn = Math.max(1, traineeTurnNumber - runtime.greetingTurns);
  const rng = rngFor(scenario.config.seed, traineeTurnNumber);

  let classification = validateClassification(
    await args.classify(traineeText, traineeTurnNumber),
    scenario,
    traineeText,
  );
  const analysis = analyseTurn({ scenario, runtime, classification, traineeText, history });
  // A short yes to "so you'll call me at three?" answers a question; it is not a thin reply.
  if (analysis.confirmsEcho && classification.lowEffort) {
    classification = { ...classification, lowEffort: false };
  }

  const discovery = processDiscovery({
    scenario,
    runtime,
    classification,
    traineeText,
    turnIndex,
    traineeTurnNumber,
    effectiveTurn,
    analysis,
    ...(args.matching ? { matching: args.matching } : {}),
    rng,
  });

  const stateResult = applyTraineeTurn({
    scenario,
    runtime,
    assessment: {
      c: classification,
      repeated: discovery.repeated,
      kind: discovery.kind,
      newInfoCount: discovery.newInfoCount,
      answeredIntents: discovery.answeredIntents,
      fromRecord: discovery.fromRecord,
      analysis,
    },
    turnIndex,
    traineeTurnNumber,
    effectiveTurn,
  });

  const discoveryMap: DiscoveryMap = { ...runtime.discovery };
  for (const record of discovery.records) discoveryMap[record.factId] = record;

  const afterDiscovery: EngineRuntime = { ...runtime, discovery: discoveryMap };
  const curveball = processCurveball({
    scenario,
    runtime: afterDiscovery,
    customer: stateResult.customer,
    classification,
    turnIndex,
    traineeTurnNumber,
    effectiveTurn,
    discovery: discoveryMap,
  });

  const customer = { ...curveball.customer };
  customer.discoveryCoverage = weightedCoverage(scenario, afterDiscovery);

  const stateEvents = [...stateResult.events, ...curveball.events];
  const tempDelta = stateEvents
    .filter((e) => e.key === 'temperature')
    .reduce((sum, e) => sum + e.delta, 0);

  const askedIntents = { ...runtime.askedIntents };
  for (const intent of classification.discoveryIntents) {
    askedIntents[intent] = (askedIntents[intent] ?? 0) + 1;
  }
  const answered = new Set<DiscoveryIntent>([
    ...runtime.answeredIntents,
    ...discovery.answeredIntents,
  ]);

  // What this turn adds to the customer's memory of the call.
  let commitments: Commitment[] = runtime.commitments;
  if (analysis.commitment) {
    commitments = recordCommitment(commitments, analysis.commitment, turnIndex).commitments;
  }
  const misunderstandings = [...runtime.misunderstandings];
  if (analysis.summary.verdict === 'inaccurate') {
    misunderstandings.push({ by: 'engineer', turnIndex, about: 'summary' });
  }
  const assumptionsCorrected = analysis.assumption?.established
    ? [...new Set([...runtime.assumptionsCorrected, analysis.assumption.id])]
    : runtime.assumptionsCorrected;
  const asked =
    classification.askedQuestion && classification.discoveryIntents.length > 0
      ? [
          ...runtime.asked,
          { turnIndex, intents: classification.discoveryIntents, words: analysis.words },
        ].slice(-12)
      : runtime.asked;

  const updated: EngineRuntime = {
    ...runtime,
    customer,
    discovery: discoveryMap,
    traineeTurns: traineeTurnNumber,
    askedIntents,
    answeredIntents: [...answered],
    unlockedKnownFacts: [...runtime.unlockedKnownFacts, ...curveball.unlockedFactIds],
    firedCurveballs: curveball.fired
      ? [...runtime.firedCurveballs, curveball.fired.id]
      : runtime.firedCurveballs,
    lastCurveballTurn: curveball.fired ? traineeTurnNumber : runtime.lastCurveballTurn,
    behaviourStreak: stateResult.streaks,
    turnsWithoutEmpathy: stateResult.turnsWithoutEmpathy,
    lastTemperatureDelta: tempDelta,
    asked,
    commitments,
    misunderstandings,
    assumptionsCorrected,
    stageMet: [...runtime.stageMet, ...stateResult.stageMet],
    awaitingConfirmation: false,
  };

  const ctx: CustomerGenerationContext = {
    scenario,
    runtime: updated,
    classification,
    analysis,
    discovery,
    curveball,
    traineeTurnNumber,
    effectiveTurn,
    stageMetNow: stateResult.stageMet,
    rng,
    history: [...history, { index: turnIndex, role: 'trainee', text: traineeText }],
    traineeText,
  };
  const generated = await args.generate(ctx);
  const bk = generated.bookkeeping ?? {};
  const fallback = defaultBookkeeping(ctx);
  const plan = planReply(ctx);

  // Conform first, then record: nothing counts as said unless it is in the reply the customer gave.
  // The lines of a list become sentences before line breaks are collapsed, or they would run together.
  const cleaned = sanitizeModelText(endListItems(redactSensitive(generated.text).text), 900);
  const conformed = conformCustomerReply(cleaned, { maxSentences: bk.limit ?? plan.maxSentences });
  const customerText = conformed.text || NEUTRAL_REPLY;
  const removed = conformed.problems.some((p) => REMOVING.has(p));
  const revealed = bk.revealedIds
    ? new Set(bk.revealedIds)
    : revealsSaid(ctx, customerText, removed || conformed.text === '');

  const records = discovery.records.filter((r) => revealed.has(r.factId));
  const finalDiscovery: DiscoveryMap = { ...runtime.discovery };
  for (const record of records) finalDiscovery[record.factId] = record;
  const dropped = discovery.records.filter((r) => !revealed.has(r.factId));
  // A topic whose answer never made it into the reply has not been answered.
  const stillAnswered = new Set<DiscoveryIntent>(runtime.answeredIntents);
  for (const intent of discovery.answeredIntents) stillAnswered.add(intent);
  for (const record of dropped) {
    const fact = scenario.hiddenFacts.find((f) => f.id === record.factId);
    for (const intent of fact?.intents ?? []) {
      const covered =
        runtime.answeredIntents.includes(intent) ||
        discovery.tell.some((t) => !t.repeat && t.intents.includes(intent)) ||
        records.some((r) =>
          scenario.hiddenFacts.find((f) => f.id === r.factId)?.intents.includes(intent),
        );
      if (!covered) stillAnswered.delete(intent);
    }
  }

  const toldIds = bk.toldIds ?? fallback.toldIds;
  const toldKnownFacts = { ...updated.toldKnownFacts };
  for (const id of toldIds) toldKnownFacts[id] = (toldKnownFacts[id] ?? 0) + 1;
  for (const id of bk.voicedAssumptions ?? []) toldKnownFacts[`assumption-${id}`] = 1;

  const pushed =
    bk.pushed !== undefined ? bk.pushed : bk.timelineAsked ? 'timeline' : fallback.pushed;
  const flavoured = bk.flavoured !== undefined ? bk.flavoured : fallback.flavoured;
  // Every time the customer asked for something is remembered, so that asks are spaced out whatever
  // they were for (see pressing.ts): a push, a line that asks for a plan or a name, or a concern
  // raised earlier that is raised again.
  const pushes: Record<string, number> = {
    ...updated.pushes,
    ...(pushed ? { [pushed]: traineeTurnNumber } : {}),
    ...(isAsking(flavoured) ? { [flavoured]: traineeTurnNumber } : {}),
    ...(bk.followUpGiven ? { 'follow-up': traineeTurnNumber } : {}),
  };

  // The customer said a commitment back, or offered to check with someone.
  const echoed = bk.echoed !== undefined ? bk.echoed : fallback.echoed;
  const customerChecks = bk.customerChecks ?? fallback.customerChecks;
  let ledger = updated.commitments.map((k) =>
    echoed && k.id === echoed ? { ...k, reflected: true } : k,
  );
  for (const check of customerChecks) {
    const id = `u-${check.id}`;
    if (ledger.some((k) => k.id === id)) continue;
    ledger = [
      ...ledger,
      {
        id,
        by: 'customer' as const,
        turnIndex: turnIndex + 1,
        kind: 'check' as const,
        action: `ask ${check.whoKnows}`,
        due: null,
        clarity: 'vague' as const,
        supported: true,
        reflected: false,
      },
    ].slice(-8);
  }
  const confused = bk.confusedBy !== undefined ? bk.confusedBy !== null : fallback.confused;

  const customerFinal = {
    ...customer,
    discoveryCoverage: weightedCoverage(scenario, { ...updated, discovery: finalDiscovery }),
  };
  const finalRuntime: EngineRuntime = {
    ...updated,
    customer: customerFinal,
    discovery: finalDiscovery,
    answeredIntents: [...stillAnswered],
    toldKnownFacts,
    hintsGiven: [...updated.hintsGiven, ...(bk.hintIds ?? fallback.hintIds)],
    lastToldIds: [
      ...new Set([
        ...toldIds,
        ...revealed,
        ...plan.say.filter((s) => s.kind === 'reminder').map((s) => s.id),
      ]),
    ],
    curveballFollowUpGiven: updated.curveballFollowUpGiven || Boolean(bk.followUpGiven),
    asksForTimelineAtTurn:
      pushed === 'timeline' ? traineeTurnNumber : updated.asksForTimelineAtTurn,
    pushes,
    lastCustomerLines: [...updated.lastCustomerLines, ...(bk.used ?? [])].slice(-10),
    commitments: ledger,
    awaitingConfirmation: Boolean(echoed),
    misunderstandings: confused
      ? [
          ...updated.misunderstandings,
          { by: 'customer' as const, turnIndex, about: 'term' as const },
        ].slice(-8)
      : updated.misunderstandings,
    // The reason for the call is given once it has been said: a reply that did not say it (the
    // engineer's first words were only "Yes.") leaves it still to give. A first exchange that was
    // only a greeting is not counted by the rules about timing.
    opening: toldIds.includes('reason') ? 'reason-given' : runtime.opening,
    greetingTurns:
      runtime.opening === 'awaiting-engineer' && analysis.greetingOnly
        ? runtime.greetingTurns + 1
        : runtime.greetingTurns,
  };

  return {
    runtime: finalRuntime,
    classification,
    stateEvents,
    discoveryRecords: records,
    customerText,
    customerSource: generated.source,
    customerRepaired: generated.repaired ?? [],
    curveballFired: curveball.fired?.id ?? null,
  };
}
