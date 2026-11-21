import type { TurnClassification } from '#shared/domain/classification.ts';
import type { EffectiveScenario } from '#shared/domain/config.ts';
import type { HiddenFact, KnownFact } from '#shared/domain/scenario.ts';
import { difficultyProfile, type CustomerState } from '#shared/domain/state.ts';
import { FACT_WEIGHT, type DiscoveryIntent } from '#shared/domain/vocab.ts';
import { clip } from './lexicon.ts';
import { questionTextOf, type TurnAnalysis, type Wording } from './memory.ts';
import { recordNotes } from './record.ts';
import { chance, type Rng } from './rng.ts';
import {
  asksQuantity,
  cueMatches,
  givesQuantity,
  overlap,
  questionWords,
  saysTheSame,
} from './textutil.ts';
import type { DiscoveryRecord, EngineRuntime } from './types.ts';

// What the customer can say in answer to this turn, by how well they know it:
//
//   hidden facts    only when the question addressed them, and only if the customer is willing
//   known facts     confidently, when the topic comes up
//   vague facts     with a hedge; firmed up when the engineer narrows it down or asks to confirm
//   checkable facts after a "give me a moment" line
//   unknown facts   an honest "I don't have that", naming who would know. Never a guess.
//
// A hidden fact is revealed only when the trainee's question addressed it (the classifier decides
// which facts a question addressed) and the customer is willing to share it right now (enough
// trust, impact acknowledged, not too early). Nothing is ever revealed in the opening or because
// the customer "wants to be helpful".

export type WithholdReason = 'trust' | 'impact-ack' | 'timing';

/**
 * What kind of turn this was, apart from its topic. Asking again about something already answered
 * is a `repeat` only when the question really is the same one. A summary, a request to confirm, a
 * follow-up that narrows an answer down and a correction are not repeats.
 */
export type TurnKind = Wording | 'new' | 'repeat' | 'statement';

/**
 * Whose judgement of the question the cues stand in for. In rules mode a fact with cues is told
 * only when the question contains one of them. A model reads the question itself, so in live mode
 * the cues are left to the model.
 */
export type MatchingMode = 'rules' | 'model';

export interface TellItem {
  id: string; // the fact id; `<id>#confirmed` for a vague fact that has been firmed up
  kind: 'known' | 'impact' | 'deadline' | 'history' | 'vague' | 'checkable' | 'unknown' | 'record';
  text: string;
  elaboration?: string;
  simple?: string;
  checking?: string; // a checkable fact: what they say while they look
  whoKnows?: string; // an unknown fact: who would know
  firm?: boolean; // a vague fact in its firmed-up wording
  repeat: boolean; // the customer already said this
  intents: DiscoveryIntent[];
  specific: boolean; // told because a cue matched, so more specific than a topic match
}

export interface DiscoveryTurnInput {
  scenario: EffectiveScenario;
  runtime: EngineRuntime;
  classification: TurnClassification;
  traineeText: string;
  turnIndex: number;
  traineeTurnNumber: number;
  /** The engineer's turn number, not counting a first exchange that was only a greeting. */
  effectiveTurn: number;
  analysis: TurnAnalysis;
  matching?: MatchingMode;
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
  kind: TurnKind;
  repeated: boolean; // a real repeat of a question the customer had already answered
  /**
   * When the question brings nothing new, what the customer already said about its topic, best
   * answer first: the one to say again. Empty otherwise.
   */
  earlier: TellItem[];
  /** A call back: the engineer asked for what the case already records, and the customer says so. */
  fromRecord: boolean;
  newInfoCount: number;
}

const MAX_REVEALS_PER_TURN = 2;
const MAX_NEW_PER_TURN = 3;

/** What a call back already has on the case: the earlier contact, and what was tried before. */
export const IN_RECORD_IDS: ReadonlySet<string> = new Set(['history', 'prior-attempts']);

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
  effectiveTurn: number,
): WithholdReason | null {
  if (effectiveTurn < fact.availableAfterTurn) return 'timing';
  if (provisional.trust < fact.minTrust) return 'trust';
  if (fact.requiresImpactAck && !provisional.impactAck) return 'impact-ack';
  return null;
}

/**
 * Something the customer said earlier, as an item to say again: for when the engineer asks what
 * they meant, or asks the same thing again.
 */
export function earlierItem(
  scenario: EffectiveScenario,
  runtime: EngineRuntime,
  id: string,
): TellItem | null {
  const firm = id.endsWith('#confirmed');
  const base = firm ? id.slice(0, -'#confirmed'.length) : id;
  const common = { id, repeat: true, specific: false };
  const known = [...scenario.knownFacts, ...unlockedKnownFacts(scenario, runtime)].find(
    (f) => f.id === base,
  );
  if (known) {
    return {
      ...common,
      kind: 'known',
      text: known.text,
      intents: known.intents,
      ...(known.elaboration ? { elaboration: known.elaboration } : {}),
      ...(known.simple ? { simple: known.simple } : {}),
    };
  }
  const vague = scenario.vagueFacts.find((f) => f.id === base);
  if (vague) {
    return {
      ...common,
      kind: 'vague',
      text: firm ? (vague.confirmedText ?? vague.text) : vague.text,
      intents: vague.intents,
      firm,
    };
  }
  const checkable = scenario.checkableFacts.find((f) => f.id === base);
  if (checkable) {
    return { ...common, kind: 'checkable', text: checkable.text, intents: checkable.intents };
  }
  const unknown = scenario.unknownFacts.find((f) => f.id === base);
  if (unknown) {
    return {
      ...common,
      kind: 'unknown',
      text: unknown.text,
      intents: unknown.intents,
      ...(unknown.whoKnows ? { whoKnows: unknown.whoKnows } : {}),
    };
  }
  const hidden = scenario.hiddenFacts.find((f) => f.id === base);
  const record = hidden ? runtime.discovery[hidden.id] : undefined;
  if (hidden && record) {
    const style = scenario.config.style;
    const text =
      record.status === 'discovered'
        ? style === 'non-native'
          ? (hidden.statementSimple ?? hidden.statement)
          : style === 'terse'
            ? (hidden.statementTerse ?? hidden.statement)
            : hidden.statement
        : (hidden.partialStatement ?? '');
    if (text !== '') return { ...common, kind: 'known', text, intents: hidden.intents };
  }
  return null;
}

function nothing(kind: TurnKind): DiscoveryTurnResult {
  return {
    reveal: [],
    withheld: [],
    tell: [],
    hints: [],
    records: [],
    answeredIntents: [],
    unanswered: [],
    kind,
    repeated: false,
    earlier: [],
    fromRecord: false,
    newInfoCount: 0,
  };
}

/**
 * What the customer has already said about the topics of a question, the best answer to it first.
 * When the same thing is asked again the customer says it again, and it has to be the answer they
 * gave: "how many people?" is answered with the number, not with another fact that happens to
 * share the topic. What the engineer earned counts for a little more than what was volunteered.
 */
export function earlierAnswers(args: {
  scenario: EffectiveScenario;
  runtime: EngineRuntime;
  intents: ReadonlySet<DiscoveryIntent>;
  question: string;
  said: readonly TellItem[];
}): TellItem[] {
  const { scenario, runtime, intents, question } = args;
  const items = new Map<string, TellItem>();
  const earned = new Set<string>();
  const add = (item: TellItem | null, fromHidden = false) => {
    if (!item || items.has(item.id) || !item.intents.some((i) => intents.has(i))) return;
    items.set(item.id, item);
    if (fromHidden) earned.add(item.id);
  };
  for (const fact of scenario.hiddenFacts) {
    if (runtime.discovery[fact.id]) add(earlierItem(scenario, runtime, fact.id), true);
  }
  for (const item of args.said) if (item.repeat) add(item);
  for (const [id, times] of Object.entries(runtime.toldKnownFacts)) {
    if (times > 0) add(earlierItem(scenario, runtime, id));
  }
  const wanted = new Set(questionWords(question));
  const quantity = asksQuantity(question);
  const score = (item: TellItem) =>
    questionWords(item.text).filter((word) => wanted.has(word)).length +
    (quantity && givesQuantity(item.text) ? 2 : 0) +
    (earned.has(item.id) ? 0.5 : 0);
  return [...items.values()]
    .map((item, order) => ({ item, order, points: score(item) }))
    .sort((a, b) => b.points - a.points || a.order - b.order)
    .map(({ item }) => item);
}

export function processDiscovery(input: DiscoveryTurnInput): DiscoveryTurnResult {
  const {
    scenario,
    runtime,
    classification: c,
    traineeText,
    turnIndex,
    effectiveTurn,
    analysis,
    rng,
  } = input;
  const matching = input.matching ?? 'rules';
  const profile = difficultyProfile(scenario.config.difficulty);
  const provisional = provisionalState(runtime.customer, c);
  const reveal: DiscoveryTurnResult['reveal'] = [];
  const withheld: DiscoveryTurnResult['withheld'] = [];
  const records: DiscoveryRecord[] = [];

  if (c.injectionAttempt) return nothing('statement');

  const maxReveals = scenario.config.style === 'terse' ? 1 : MAX_REVEALS_PER_TURN;
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
  // Facts the engineer has already earned and now asks about again: the customer repeats them.
  const askedAgain: HiddenFact[] = [];
  for (const { fact, strength } of targets) {
    const existing = runtime.discovery[fact.id];
    if (existing?.status === 'discovered') {
      if (strength === 'full') askedAgain.push(fact);
      continue;
    }
    if (strength === 'full') {
      const gate = gateFor(fact, provisional, effectiveTurn);
      if (gate) {
        withheld.push({ fact, reason: gate });
        continue;
      }
      if (reveal.length >= maxReveals) continue;
      reveal.push({ fact, mode: 'full' });
      records.push({ factId: fact.id, status: 'discovered', turnIndex, question });
    } else if (!existing && fact.partialStatement && reveal.length < maxReveals) {
      reveal.push({ fact, mode: 'partial' });
      records.push({ factId: fact.id, status: 'partial', turnIndex, question });
    }
  }

  // Freely shared information. A fact is skipped when a hidden fact revealed this turn already
  // answers the topic that matched it.
  const asked = new Set(c.discoveryIntents);
  const askedText = questionTextOf(traineeText);
  const cuesAllow = (cues: string[] | undefined) =>
    !cues ||
    cues.length === 0 ||
    matching === 'model' ||
    cues.some((cue) => cueMatches(askedText, cue));
  const matches = (intents: DiscoveryIntent[], cues: string[] | undefined) =>
    intents.some((i) => asked.has(i)) && cuesAllow(cues);
  // A fact is picked out by the question when one of its cues is in it. A model does not apply cues,
  // so a fact it was told by topic alone is not "specific" however many cues the author wrote.
  const cued = (cues: string[] | undefined) =>
    (cues ?? []).some((cue) => cueMatches(askedText, cue));

  const coveredByReveal = new Set<DiscoveryIntent>();
  for (const r of reveal)
    if (r.mode === 'full') for (const i of r.fact.intents) coveredByReveal.add(i);
  const coveredHere = (intents: DiscoveryIntent[]) =>
    intents.filter((i) => asked.has(i)).every((i) => coveredByReveal.has(i));

  const told = (id: string) => (runtime.toldKnownFacts[id] ?? 0) > 0;
  // A question that is not a near copy of an earlier one, on a topic already covered, is a follow-up.
  const nearCopy = runtime.asked.some(
    (q) => q.intents.some((i) => asked.has(i)) && overlap(q.words, analysis.words) >= 0.5,
  );
  const narrowed =
    analysis.wording === 'clarification' ||
    analysis.wording === 'confirmation' ||
    analysis.wording === 'summary' ||
    analysis.asksToCheck ||
    !nearCopy;

  const tell: TellItem[] = [];
  for (const fact of [...scenario.knownFacts, ...unlockedKnownFacts(scenario, runtime)]) {
    if (!matches(fact.intents, fact.cues) || coveredHere(fact.intents)) continue;
    tell.push({
      id: fact.id,
      kind: 'known',
      text: fact.text,
      ...(fact.elaboration ? { elaboration: fact.elaboration } : {}),
      ...(fact.simple ? { simple: fact.simple } : {}),
      repeat: told(fact.id),
      intents: fact.intents,
      specific: cued(fact.cues),
    });
  }

  for (const fact of scenario.vagueFacts) {
    // Asking to confirm something the customer was unsure of names it again, so a cue is enough
    // even when the question carries no topic of its own ("Is it definitely the new Outlook?").
    const askedAgain = told(fact.id) && (fact.cues ?? []).some((cue) => cueMatches(askedText, cue));
    if (!(matches(fact.intents, fact.cues) && !coveredHere(fact.intents)) && !askedAgain) continue;
    const base = {
      kind: 'vague' as const,
      intents: fact.intents,
      specific: cued(fact.cues),
    };
    const firmId = `${fact.id}#confirmed`;
    if (told(firmId)) {
      tell.push({
        ...base,
        id: firmId,
        text: fact.confirmedText ?? fact.text,
        firm: true,
        repeat: true,
      });
    } else if (told(fact.id) && fact.confirmedText && narrowed) {
      tell.push({ ...base, id: firmId, text: fact.confirmedText, firm: true, repeat: false });
    } else {
      tell.push({ ...base, id: fact.id, text: fact.text, repeat: told(fact.id) });
    }
  }

  for (const fact of scenario.checkableFacts) {
    if (!matches(fact.intents, fact.cues) || coveredHere(fact.intents)) continue;
    tell.push({
      id: fact.id,
      kind: 'checkable',
      text: fact.text,
      checking: fact.checking,
      repeat: told(fact.id),
      intents: fact.intents,
      specific: cued(fact.cues),
    });
  }

  // When a hidden fact and an unknown fact share a topic, the hidden fact answers if the question
  // was aimed at it; the customer does know it, so they must not say they do not. Otherwise the
  // unknown fact answers.
  const aimedAtHidden = new Set<DiscoveryIntent>(
    targets.filter((t) => t.strength === 'full').flatMap((t) => t.fact.intents),
  );
  for (const fact of scenario.unknownFacts) {
    if (!matches(fact.intents, fact.cues)) continue;
    if (fact.intents.some((i) => aimedAtHidden.has(i))) continue;
    tell.push({
      id: fact.id,
      kind: 'unknown',
      text: fact.text,
      ...(fact.whoKnows ? { whoKnows: fact.whoKnows } : {}),
      repeat: told(fact.id),
      intents: fact.intents,
      specific: cued(fact.cues),
    });
  }

  // A specific answer (one a cue picked out) takes the topic: the customer does not also recite the
  // general facts for it. A fact the engineer already earned and asked about again is such an
  // answer, said again, and so is a fact the customer is holding back: they do not change the
  // subject to something else about the same topic.
  for (const fact of askedAgain) {
    const item = earlierItem(scenario, runtime, fact.id);
    if (item) tell.push({ ...item, specific: true });
  }
  const specificTopics = new Set([
    ...tell.filter((t) => t.specific).flatMap((t) => t.intents.filter((i) => asked.has(i))),
    ...withheld.flatMap((w) => w.fact.intents.filter((i) => asked.has(i))),
  ]);
  for (let i = tell.length - 1; i >= 0; i--) {
    const item = tell[i] as TellItem;
    if (item.kind !== 'known' || item.specific) continue;
    const topics = item.intents.filter((x) => asked.has(x));
    if (topics.length > 0 && topics.every((x) => specificTopics.has(x))) tell.splice(i, 1);
  }

  // Asked what the customer meant, with no topic of its own: say the last thing again, in other
  // words where the scenario has some.
  if (analysis.wording === 'clarification' && tell.length === 0 && reveal.length === 0) {
    for (const id of runtime.lastToldIds) {
      const item = earlierItem(scenario, runtime, id);
      if (item) tell.push(item);
    }
  }

  // The case notes: what was already tried, and what changed recently. A call back has these on the
  // case already, so a question about them is answered with "as I told you before". Notes that
  // restate a hidden fact the engineer has not earned are left out (see record.ts). A note that
  // only says again what an answer already says is not said twice: on a first contact the answer
  // keeps the topic; on a call back the case does, because that is what the customer points to.
  const inRecord = scenario.config.callStage !== 'first-contact';
  const noteLimit = scenario.config.style === 'terse' ? 1 : 2;
  const freshNotes = (notes: string[]): string[] => {
    const chosen: string[] = [];
    for (const note of notes) {
      if (chosen.length >= noteLimit) break;
      if (tell.some((t) => saysTheSame(note, t.text)) || chosen.some((c) => saysTheSame(note, c)))
        continue;
      chosen.push(note);
    }
    return chosen;
  };
  if (asked.has('already_tried') && !coveredHere(['already_tried'])) {
    const notes = recordNotes('tried', scenario, runtime);
    if (inRecord) {
      for (let i = tell.length - 1; i >= 0; i--) {
        const item = tell[i] as TellItem;
        const general = (item.kind === 'known' || item.kind === 'vague') && !item.specific;
        if (
          general &&
          item.intents.includes('already_tried') &&
          notes.some((note) => saysTheSame(note, item.text))
        )
          tell.splice(i, 1);
      }
    }
    const fresh = freshNotes(notes);
    if (fresh.length > 0) {
      tell.push({
        id: 'prior-attempts',
        kind: 'record',
        text: fresh.join(' '),
        repeat: inRecord || told('prior-attempts'),
        intents: ['already_tried'],
        specific: false,
      });
    }
  }
  if (asked.has('recent_changes') && !coveredHere(['recent_changes'])) {
    const fresh = freshNotes(recordNotes('changes', scenario, runtime));
    if (fresh.length > 0) {
      tell.push({
        id: 'recent-changes',
        kind: 'record',
        text: fresh.join(' '),
        repeat: told('recent-changes'),
        intents: ['recent_changes'],
        specific: false,
      });
    }
  }

  // The scenario's general answers about impact and history, used when nothing more specific
  // answered the same topic. What the engineer has already earned on a topic is more specific
  // than the general answer, and is what the customer says again if it is asked about once more.
  // It answers only the topics it is about: a question about the business impact still gets the
  // general answer after the number of people affected has been earned.
  const scopeAsked = (['business_impact', 'affected_scope'] as const).filter((i) => asked.has(i));
  const earnedScope =
    scopeAsked.length > 0 &&
    scopeAsked.every((i) =>
      scenario.hiddenFacts.some(
        (f) => runtime.discovery[f.id] !== undefined && f.intents.includes(i),
      ),
    );
  const specificScope =
    earnedScope ||
    tell.some(
      (t) =>
        (t.kind === 'vague' || t.kind === 'checkable' || t.kind === 'unknown') &&
        t.intents.some((i) => i === 'business_impact' || i === 'affected_scope'),
    );
  if ((asked.has('business_impact') || asked.has('affected_scope')) && !specificScope) {
    tell.push({
      id: 'impact-detail',
      kind: 'impact',
      text: scenario.impactVariant.detail,
      repeat: told('impact-detail'),
      intents: ['business_impact', 'affected_scope'],
      specific: false,
    });
  }
  if (asked.has('urgency_deadline')) {
    tell.push({
      id: 'impact-deadline',
      kind: 'deadline',
      text: scenario.impactVariant.deadline ?? scenario.impactVariant.detail,
      repeat: told('impact-deadline'),
      intents: ['urgency_deadline'],
      specific: false,
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
      specific: false,
    });
  }

  // Limit how much the customer volunteers in a single answer: specific answers first. A terse
  // customer answers what was asked and adds little.
  const rank = (t: TellItem) =>
    t.kind === 'impact' || t.kind === 'deadline' || t.kind === 'history' ? 2 : t.specific ? 0 : 1;
  const maxNew = scenario.config.style === 'terse' ? MAX_NEW_PER_TURN - 1 : MAX_NEW_PER_TURN;
  const room = Math.max(1, maxNew - reveal.length);
  const tellKept = [
    ...tell
      .filter((t) => !t.repeat)
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, room),
    ...tell.filter((t) => t.repeat),
  ];

  const answered = new Set<DiscoveryIntent>();
  for (const r of reveal) for (const i of r.fact.intents) answered.add(i);
  for (const t of tellKept) for (const i of t.intents) answered.add(i);
  const alreadyAnswered = new Set(runtime.answeredIntents);
  const unanswered = c.discoveryIntents.filter((i) => !answered.has(i) && !alreadyAnswered.has(i));

  const nothingNew =
    c.askedQuestion &&
    c.discoveryIntents.length > 0 &&
    reveal.length === 0 &&
    c.discoveryIntents.every((i) => alreadyAnswered.has(i)) &&
    tellKept.every((t) => t.repeat);
  let kind: TurnKind;
  if (analysis.wording) kind = analysis.wording;
  else if (!c.askedQuestion) kind = 'statement';
  else if (nothingNew) kind = nearCopy ? 'repeat' : 'clarification';
  else kind = 'new';

  const newInfoCount = reveal.length + tellKept.filter((t) => !t.repeat).length;
  const fromRecord =
    inRecord && kind !== 'repeat' && tellKept.some((t) => t.repeat && IN_RECORD_IDS.has(t.id));
  // Asked about something already answered, the customer says what they said about it.
  const earlier = nothingNew
    ? earlierAnswers({ scenario, runtime, intents: asked, question: traineeText, said: tellKept })
    : [];

  // Starter difficulty: a gentle clue about something that has not been asked about yet. The
  // customer's first message after the greeting always carries one, so a trainee at Starter gets a
  // clear starting point.
  const hints: HiddenFact[] = [];
  if (profile.hintsEnabled && c.askedQuestion) {
    const open = c.discoveryIntents.includes('problem_description') || effectiveTurn <= 2;
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
  if (profile.hintsEnabled && runtime.opening === 'awaiting-engineer') {
    const first = scenario.hiddenFacts.find(
      (f) =>
        f.hint && !reveal.some((r) => r.fact.id === f.id) && !runtime.hintsGiven.includes(f.id),
    );
    hints.length = 0;
    if (first) hints.push(first);
  }

  return {
    reveal,
    withheld,
    tell: tellKept,
    hints,
    records,
    answeredIntents: [...answered],
    unanswered,
    kind,
    repeated: kind === 'repeat',
    earlier,
    fromRecord,
    newInfoCount,
  };
}
