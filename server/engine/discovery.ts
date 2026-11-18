import type { TurnClassification } from '#shared/domain/classification.ts';
import type { EffectiveScenario } from '#shared/domain/config.ts';
import type { HiddenFact, KnownFact } from '#shared/domain/scenario.ts';
import { difficultyProfile, type CustomerState } from '#shared/domain/state.ts';
import { clip } from './lexicon.ts';
import { FACT_WEIGHT, type DiscoveryIntent } from '#shared/domain/vocab.ts';
import { chance, type Rng } from './rng.ts';
import type { DiscoveryRecord, EngineRuntime } from './types.ts';

// Hidden-fact discovery. A hidden fact is revealed only when the trainee's question addressed it
// (the classifier decides which facts a question addressed) and the customer is willing to share
// it right now (enough trust, impact acknowledged, not too early). Nothing is ever revealed in the
// opening or because the customer "wants to be helpful".

export type WithholdReason = 'trust' | 'impact-ack' | 'timing';

export interface TellItem {
  id: string;
  kind: 'known' | 'impact' | 'deadline' | 'history';
  text: string;
  elaboration?: string;
  simple?: string;
  repeat: boolean; // the customer already said this
  intents: DiscoveryIntent[];
}

export interface DiscoveryTurnInput {
  scenario: EffectiveScenario;
  runtime: EngineRuntime;
  classification: TurnClassification;
  traineeText: string;
  turnIndex: number;
  traineeTurnNumber: number;
  rng: Rng;
}

export interface DiscoveryTurnResult {
  reveal: { fact: HiddenFact; mode: 'full' | 'partial' }[];
  withheld: { fact: HiddenFact; reason: WithholdReason }[];
  tell: TellItem[];
  hints: HiddenFact[];
  records: DiscoveryRecord[];
  answeredIntents: DiscoveryIntent[];
  unanswered: DiscoveryIntent[];
  repeated: boolean;
  newInfoCount: number;
}

const MAX_REVEALS_PER_TURN = 3;

export function unlockedKnownFacts(
  scenario: EffectiveScenario,
  runtime: EngineRuntime,
): KnownFact[] {
  const ids = new Set(runtime.unlockedKnownFacts);
  return scenario.curveballs.flatMap((cb) => cb.introducesFacts ?? []).filter((f) => ids.has(f.id));
}

/**
 * The state the customer will be in once the trainee's message has landed. A trainee who shows
 * empathy and then asks a question in the same message should be judged on both.
 */
function provisionalState(
  state: CustomerState,
  c: TurnClassification,
): { trust: number; impactAck: boolean } {
  let trust = state.trust;
  if (c.empathy === 'specific') trust += 6;
  else if (c.empathy === 'generic') trust += 3;
  const impactAck = state.impactAcknowledged || c.acknowledgesImpact;
  if (!state.impactAcknowledged && c.acknowledgesImpact) trust += 6;
  return { trust, impactAck };
}

function gateFor(
  fact: HiddenFact,
  provisional: { trust: number; impactAck: boolean },
  traineeTurnNumber: number,
): WithholdReason | null {
  if (traineeTurnNumber < fact.availableAfterTurn) return 'timing';
  if (provisional.trust < fact.minTrust) return 'trust';
  if (fact.requiresImpactAck && !provisional.impactAck) return 'impact-ack';
  return null;
}

export function processDiscovery(input: DiscoveryTurnInput): DiscoveryTurnResult {
  const {
    scenario,
    runtime,
    classification: c,
    traineeText,
    turnIndex,
    traineeTurnNumber,
    rng,
  } = input;
  const profile = difficultyProfile(scenario.config.difficulty);
  const provisional = provisionalState(runtime.customer, c);
  const reveal: DiscoveryTurnResult['reveal'] = [];
  const withheld: DiscoveryTurnResult['withheld'] = [];
  const records: DiscoveryRecord[] = [];

  if (c.injectionAttempt) {
    return {
      reveal,
      withheld,
      tell: [],
      hints: [],
      records,
      answeredIntents: [],
      unanswered: [],
      repeated: false,
      newInfoCount: 0,
    };
  }

  const order = new Map(scenario.hiddenFacts.map((f, i) => [f.id, i] as const));
  const targets = c.factTargets
    .map((t) => ({ fact: scenario.hiddenFacts.find((f) => f.id === t.id), strength: t.strength }))
    .filter((t): t is { fact: HiddenFact; strength: 'full' | 'partial' } => t.fact !== undefined)
    .sort(
      (a, b) =>
        FACT_WEIGHT[b.fact.importance] - FACT_WEIGHT[a.fact.importance] ||
        (order.get(a.fact.id) ?? 0) - (order.get(b.fact.id) ?? 0),
    );

  const question = clip(traineeText.replace(/\s+/g, ' ').trim(), 220);
  for (const { fact, strength } of targets) {
    const existing = runtime.discovery[fact.id];
    if (existing?.status === 'discovered') continue;
    if (strength === 'full') {
      const gate = gateFor(fact, provisional, traineeTurnNumber);
      if (gate) {
        withheld.push({ fact, reason: gate });
        continue;
      }
      if (reveal.length >= MAX_REVEALS_PER_TURN) continue;
      reveal.push({ fact, mode: 'full' });
      records.push({ factId: fact.id, status: 'discovered', turnIndex, question });
    } else if (!existing && fact.partialStatement && reveal.length < MAX_REVEALS_PER_TURN) {
      reveal.push({ fact, mode: 'partial' });
      records.push({ factId: fact.id, status: 'partial', turnIndex, question });
    }
  }

  // Freely shared information: known facts and the scenario's impact answers. A known fact is
  // skipped when a hidden fact revealed this turn already answers the topic that matched it.
  const asked = new Set(c.discoveryIntents);
  const coveredByReveal = new Set<DiscoveryIntent>();
  for (const r of reveal)
    if (r.mode === 'full') for (const i of r.fact.intents) coveredByReveal.add(i);
  const tell: TellItem[] = [];
  const told = (id: string) => (runtime.toldKnownFacts[id] ?? 0) > 0;
  for (const fact of [...scenario.knownFacts, ...unlockedKnownFacts(scenario, runtime)]) {
    const matched = fact.intents.filter((i) => asked.has(i));
    if (matched.length === 0) continue;
    if (matched.every((i) => coveredByReveal.has(i))) continue;
    tell.push({
      id: fact.id,
      kind: 'known',
      text: fact.text,
      ...(fact.elaboration ? { elaboration: fact.elaboration } : {}),
      ...(fact.simple ? { simple: fact.simple } : {}),
      repeat: told(fact.id),
      intents: fact.intents,
    });
  }
  if (asked.has('business_impact') || asked.has('affected_scope')) {
    tell.push({
      id: 'impact-detail',
      kind: 'impact',
      text: scenario.impactVariant.detail,
      repeat: told('impact-detail'),
      intents: ['business_impact', 'affected_scope'],
    });
  }
  if (asked.has('urgency_deadline')) {
    tell.push({
      id: 'impact-deadline',
      kind: 'deadline',
      text: scenario.impactVariant.deadline ?? scenario.impactVariant.detail,
      repeat: told('impact-deadline'),
      intents: ['urgency_deadline'],
    });
  }
  if (asked.has('previous_contact')) {
    tell.push({
      id: 'history',
      kind: 'history',
      text:
        scenario.config.callStage === 'first-contact' || !scenario.stageFrame.opening
          ? "No, this is the first time I'm calling about it."
          : scenario.stageFrame.opening,
      repeat: told('history'),
      intents: ['previous_contact'],
    });
  }
  // Limit how much the customer volunteers in a single answer.
  const room = Math.max(0, MAX_REVEALS_PER_TURN - reveal.length);
  const tellKept = [
    ...tell.filter((t) => !t.repeat).slice(0, room + 1),
    ...tell.filter((t) => t.repeat),
  ];

  const answered = new Set<DiscoveryIntent>();
  for (const r of reveal) for (const i of r.fact.intents) answered.add(i);
  for (const t of tellKept) for (const i of t.intents) answered.add(i);
  const alreadyAnswered = new Set(runtime.answeredIntents);
  const unanswered = c.discoveryIntents.filter((i) => !answered.has(i) && !alreadyAnswered.has(i));

  const repeated =
    c.askedQuestion &&
    c.discoveryIntents.length > 0 &&
    reveal.length === 0 &&
    c.discoveryIntents.every((i) => alreadyAnswered.has(i)) &&
    tellKept.every((t) => t.repeat);

  const newInfoCount = reveal.length + tellKept.filter((t) => !t.repeat).length;

  // Starter difficulty: a gentle clue about something that has not been asked about yet.
  const hints: HiddenFact[] = [];
  if (profile.hintsEnabled && c.askedQuestion) {
    const open = c.discoveryIntents.includes('problem_description') || traineeTurnNumber <= 2;
    const candidates = scenario.hiddenFacts.filter(
      (f) =>
        f.hint &&
        !runtime.discovery[f.id] &&
        !runtime.hintsGiven.includes(f.id) &&
        !reveal.some((r) => r.fact.id === f.id),
    );
    if (open && candidates.length > 0 && chance(rng, profile.cooperation))
      hints.push(candidates[0] as HiddenFact);
  }

  return {
    reveal,
    withheld,
    tell: tellKept,
    hints,
    records,
    answeredIntents: [...answered],
    unanswered,
    repeated,
    newInfoCount,
  };
}
