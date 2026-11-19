import type { TurnClassification } from '#shared/domain/classification.ts';
import type { EffectiveScenario } from '#shared/domain/config.ts';
import type { StateEvent } from '#shared/domain/state.ts';
import { DISCOVERY_INTENTS, type DiscoveryIntent } from '#shared/domain/vocab.ts';
import { quoteInText, redactSensitive, sanitizeModelText } from '#shared/domain/text.ts';
import { processCurveball, type CurveballTurnResult } from './curveballs.ts';
import { processDiscovery, type DiscoveryTurnResult } from './discovery.ts';
import { rngFor, type Rng } from './rng.ts';
import { applyTraineeTurn, weightedCoverage } from './state.ts';
import type { DiscoveryMap, DiscoveryRecord, EngineRuntime, TranscriptTurn } from './types.ts';

// One trainee turn through the simulation:
//   classify -> discover -> update state -> curveballs -> customer reply
// The classifier and the customer generator are injected, so the same pipeline serves demo mode
// (rules) and live mode (model) and can be tested with fakes.

export interface CustomerGenerationContext {
  scenario: EffectiveScenario;
  runtime: EngineRuntime; // already updated for this turn
  classification: TurnClassification;
  discovery: DiscoveryTurnResult;
  curveball: CurveballTurnResult;
  traineeTurnNumber: number;
  rng: Rng;
  history: TranscriptTurn[]; // the conversation so far, including this trainee turn
  traineeText: string;
}

export interface CustomerGeneration {
  text: string;
  source: 'live' | 'demo';
  // Demo mode reports exactly what it said; live mode leaves these to the pipeline's defaults.
  bookkeeping?: {
    used?: string[];
    toldIds?: string[];
    hintIds?: string[];
    voicedAssumptions?: string[];
    timelineAsked?: boolean;
    followUpGiven?: boolean;
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
}

export interface ProcessTurnResult {
  runtime: EngineRuntime;
  classification: TurnClassification;
  stateEvents: StateEvent[];
  discoveryRecords: DiscoveryRecord[];
  customerText: string;
  customerSource: 'live' | 'demo';
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

export async function processTraineeTurn(args: ProcessTurnArgs): Promise<ProcessTurnResult> {
  const { scenario, runtime, traineeText, turnIndex, history } = args;
  const traineeTurnNumber = runtime.traineeTurns + 1;
  const rng = rngFor(scenario.config.seed, traineeTurnNumber);

  const classification = validateClassification(
    await args.classify(traineeText, traineeTurnNumber),
    scenario,
    traineeText,
  );

  const discovery = processDiscovery({
    scenario,
    runtime,
    classification,
    traineeText,
    turnIndex,
    traineeTurnNumber,
    rng,
  });

  const stateResult = applyTraineeTurn({
    scenario,
    runtime,
    assessment: {
      c: classification,
      repeated: discovery.repeated,
      newInfoCount: discovery.newInfoCount,
      answeredIntents: discovery.answeredIntents,
    },
    turnIndex,
    traineeTurnNumber,
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
  };

  const generated = await args.generate({
    scenario,
    runtime: updated,
    classification,
    discovery,
    curveball,
    traineeTurnNumber,
    rng,
    history: [...history, { index: turnIndex, role: 'trainee', text: traineeText }],
    traineeText,
  });

  const customerText = sanitizeModelText(redactSensitive(generated.text).text, 900);
  const bk = generated.bookkeeping ?? {};
  const toldIds = bk.toldIds ?? discovery.tell.filter((t) => !t.repeat).map((t) => t.id);
  const hintIds = bk.hintIds ?? discovery.hints.map((h) => h.id);

  const toldKnownFacts = { ...updated.toldKnownFacts };
  for (const id of toldIds) toldKnownFacts[id] = (toldKnownFacts[id] ?? 0) + 1;
  for (const id of bk.voicedAssumptions ?? []) toldKnownFacts[`assumption-${id}`] = 1;

  const finalRuntime: EngineRuntime = {
    ...updated,
    toldKnownFacts,
    hintsGiven: [...updated.hintsGiven, ...hintIds],
    curveballFollowUpGiven: updated.curveballFollowUpGiven || Boolean(bk.followUpGiven),
    asksForTimelineAtTurn: bk.timelineAsked ? traineeTurnNumber : updated.asksForTimelineAtTurn,
    lastCustomerLines: [...updated.lastCustomerLines, ...(bk.used ?? [])].slice(-10),
  };

  return {
    runtime: finalRuntime,
    classification,
    stateEvents,
    discoveryRecords: discovery.records,
    customerText,
    customerSource: generated.source,
    curveballFired: curveball.fired?.id ?? null,
  };
}
