import {
  emptyClassification,
  type EvidenceBehaviour,
  type TurnClassification,
} from '#shared/domain/classification.ts';
import type { EffectiveScenario } from '#shared/domain/config.ts';
import { genericCurveball } from '#shared/domain/curveballs.ts';
import type {
  CoachingReport,
  DiscoveryResult,
  Evidence,
  JourneyPoint,
} from '#shared/domain/report.ts';
import type { HiddenFact } from '#shared/domain/scenario.ts';
import type { StateCategory, StateEvent, CustomerState } from '#shared/domain/state.ts';
import {
  firstSentence,
  fold,
  normalizeWhitespace,
  quoteInText,
  sentences,
  truncate,
} from '#shared/domain/text.ts';
import {
  DIFFICULTIES,
  DIFFICULTY_RANK,
  DIMENSION_IDS,
  FACT_WEIGHT,
  temperatureBand,
  type Difficulty,
  type DimensionId,
} from '#shared/domain/vocab.ts';
import type { EvaluationInput } from '#server/engine/types.ts';
import {
  CURVEBALL_PHRASES,
  hasJargon,
  practiceRecommendation,
  quoted,
  type PhraseContext,
} from './phrasing.ts';

// Deterministic builders shared by the rules evaluator and the model-draft merge: everything in
// the report that is computed from the transcript, the classifications and the recorded state
// events rather than judged. Nothing here guesses; if the data does not say it, the report does not.

export type Sufficiency = 'sufficient' | 'limited' | 'insufficient';
export type Scores = Record<DimensionId, number>;

export interface TraineeTurn {
  index: number; // conversation index; turn 1 is the customer's opening
  number: number; // 1-based position among the trainee's turns
  text: string;
  cls: TurnClassification;
}

export interface CallView {
  input: EvaluationInput;
  scenario: EffectiveScenario;
  name: string; // the customer's first name
  turns: TraineeTurn[];
  byIndex: Map<number, TraineeTurn>;
  events: StateEvent[];
  customerText: string; // folded text of everything the customer said
}

const HONORIFIC = /^(?:dr|mr|mrs|ms|miss|mx|prof)\.?$/i;

export function firstNameOf(fullName: string): string {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  return tokens.find((t) => !HONORIFIC.test(t)) ?? tokens[0] ?? 'the customer';
}

export function buildCallView(input: EvaluationInput): CallView {
  const turns = input.turns
    .filter((t) => t.role === 'trainee')
    .sort((a, b) => a.index - b.index)
    .map((t, i): TraineeTurn => ({
      index: t.index,
      number: i + 1,
      text: t.text,
      cls: { ...emptyClassification(), ...(input.classifications[t.index] ?? {}) },
    }));
  return {
    input,
    scenario: input.scenario,
    name: firstNameOf(input.scenario.persona.name),
    turns,
    byIndex: new Map(turns.map((t) => [t.index, t])),
    events: input.stateEvents,
    customerText: fold(
      input.turns
        .filter((t) => t.role === 'customer')
        .map((t) => t.text)
        .join(' '),
    ),
  };
}

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

const NO_CURVEBALL: CustomerState['curveball'] = {
  status: 'none',
  type: null,
  firedAtTurn: null,
  resolvedAtTurn: null,
  firedCount: 0,
};

export const curveballState = (call: CallView): CustomerState['curveball'] =>
  call.input.finalState.curveball ?? NO_CURVEBALL;

export function joinPhrases(items: string[], conjunction = 'and'): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`;
}

// ---------------------------------------------------------------------------------------
// Evidence: quotes are verified against the trainee turn they cite, always.

export const MAX_QUOTE = 160;

/** A short, verbatim quote of `turnText`, or null when `candidate` is not really in it. */
export function verifiedQuote(
  turnText: string,
  candidate: string | null | undefined,
  max = MAX_QUOTE,
): string | null {
  if (!candidate) return null;
  const quote = normalizeWhitespace(candidate)
    .replace(/^["\u201c\u201d]+|["\u201c\u201d]+$/g, '')
    .trim();
  if (!quoteInText(turnText, quote)) return null;
  return truncate(quote, max);
}

export function sentenceMatching(text: string, pattern: RegExp): string | null {
  return sentences(text).find((s) => pattern.test(s)) ?? null;
}

// Used only when the classification recorded a behaviour without a usable quote.
const FALLBACK: Partial<Record<EvidenceBehaviour, RegExp>> = {
  greeting:
    /\b(?:hello|hi|hey|good (?:morning|afternoon|evening)|thanks? for (?:calling|contacting))\b/i,
  introduction: /\b(?:my name is|this is|i'?m|i am|speaking)\b/i,
  'offers-help': /\b(?:how (?:can|may) i|what can i do|happy to help|here to help|i can help)\b/i,
  'discovery-question': /\?/,
  'empathy-generic': /\b(?:sorry|apolog|understand|appreciate|imagine)\w*/i,
  'empathy-specific': /\b(?:sorry|apolog|understand|appreciate|imagine|frustrat|stress|worr)\w*/i,
  'impact-acknowledged':
    /\b(?:urgent|priority|impact|affect|blocking|holding up|deadline|patients|customers|team)\b/i,
  'ownership-clear':
    /\b(?:i'?ll|i will|i'?m going to|my (?:case|priority)|take (?:this|ownership))\b/i,
  'ownership-vague': /\b(?:someone|we'?ll try|i'?ll try|hopefully|will look)\b/i,
  'next-steps-specific':
    /\b(?:by|before|within|in|at|after|tomorrow|today)\b[^.?!]*\b(?:call|email|update|check|come back|get back|contact)\b|\b(?:call|email|update|check|come back|get back|contact)\b[^.?!]*\b(?:by|before|within|in|at|after|tomorrow|today)\b/i,
  'next-steps-vague': /\b(?:soon|get back to you|follow up|let you know|be in touch|shortly)\b/i,
  'promise-realistic': /\b(?:can'?t|cannot|won'?t|not able to) (?:promise|guarantee)\b/i,
  'promise-unverified':
    /\b(?:promise|guarantee|definitely|certainly|will be (?:fixed|resolved|sorted))\b/i,
  blame:
    /\b(?:you (?:should have|shouldn'?t have|didn'?t|forgot|failed)|your (?:fault|mistake)|not our (?:problem|fault))\b/i,
  dismissive: /\b(?:calm down|not a big deal|no big deal|don'?t worry about it|just a|only a)\b/i,
  summary:
    /\b(?:to (?:recap|summaris|summariz|confirm)|so (?:you|it)|let me (?:recap|confirm)|sounds like|if i(?:'ve| have)? understood)\b/i,
  'wrap-up':
    /\b(?:to (?:recap|wrap up)|in summary|before (?:we|you) (?:go|finish)|we'?ve agreed)\b/i,
  'next-contact':
    /\b(?:call (?:you )?back|next (?:update|contact|call)|speak (?:again )?(?:at|by|tomorrow|today)|touch base|follow ?up)\b/i,
  'anything-else': /\b(?:anything else|any other|is there anything|any questions)\b/i,
  thanks: /\b(?:thank|thanks|goodbye|bye|take care|have a (?:good|great|nice))\b/i,
  troubleshooting:
    /\b(?:try|restart|reboot|reset|clear|click|open|reinstall|go to|sign out|log out)\b/i,
  'corrects-assumption': /\b(?:actually|in fact|just to clarify|let'?s check|could it)\b/i,
  'jargon-explained': /\b(?:which means|meaning|in other words|that is|basically|simply put)\b/i,
};

/** The quote the classifier recorded for a behaviour, if it really is in the turn. */
export function recordedQuote(turn: TraineeTurn, behaviour: EvidenceBehaviour): string | null {
  for (const item of turn.cls.evidence) {
    if (item.behaviour !== behaviour) continue;
    const quote = verifiedQuote(turn.text, item.quote);
    if (quote) return quote;
  }
  return null;
}

export const hasRecorded = (turn: TraineeTurn, ...behaviours: EvidenceBehaviour[]): boolean =>
  turn.cls.evidence.some((e) => (behaviours as string[]).includes(e.behaviour));

/**
 * A verified quote for a behaviour the turn is known to contain: the classifier's own quote if it
 * has one, otherwise the sentence of the turn that best matches, otherwise its first sentence.
 */
export function quoteFor(turn: TraineeTurn, ...behaviours: EvidenceBehaviour[]): string | null {
  for (const behaviour of behaviours) {
    const quote = recordedQuote(turn, behaviour);
    if (quote) return quote;
  }
  for (const behaviour of behaviours) {
    const pattern = FALLBACK[behaviour];
    const found = pattern ? sentenceMatching(turn.text, pattern) : null;
    const quote = verifiedQuote(turn.text, found);
    if (quote) return quote;
  }
  if (behaviours.includes('jargon-unexplained')) {
    const quote = verifiedQuote(turn.text, sentences(turn.text).find(hasJargon));
    if (quote) return quote;
  }
  return verifiedQuote(turn.text, firstSentence(turn.text));
}

export function longestSentence(text: string): string {
  return sentences(text).reduce((a, b) => (b.length > a.length ? b : a), '');
}

export function evidenceOf(turn: TraineeTurn, quote: string | null): Evidence | null {
  return quote ? { turnIndex: turn.index, quote } : null;
}

/** Appends evidence unless the same quote at the same turn is already there. */
export function addEvidence(list: Evidence[], item: Evidence | null): void {
  if (!item) return;
  if (list.some((e) => e.turnIndex === item.turnIndex && e.quote === item.quote)) return;
  list.push(item);
}

/** Keeps the first `max` items by priority, then puts them in transcript order. */
export function topEvidence(list: Evidence[], max = 4): Evidence[] {
  return list.slice(0, max).sort((a, b) => a.turnIndex - b.turnIndex);
}

// ---------------------------------------------------------------------------------------
// State events and the temperature series

export interface TempRow {
  turn: TraineeTurn;
  before: number;
  after: number;
  events: StateEvent[];
}

const clampTemp = (v: number): number => Math.min(100, Math.max(0, Math.round(v)));

/** Temperature around each trainee turn: the last temperature event's `next`, else carried forward. */
export function temperatureSeries(call: CallView): TempRow[] {
  let current = clampTemp(call.input.startState.temperature);
  return call.turns.map((turn) => {
    const events = call.events.filter((e) => e.turnIndex === turn.index);
    const moves = events.filter((e) => e.key === 'temperature');
    const before = current;
    const last = moves[moves.length - 1];
    current = last ? clampTemp(last.next) : before;
    return { turn, before, after: current, events };
  });
}

export const eventsOfCategory = (
  call: CallView,
  categories: StateCategory[],
  turnIndex?: number,
): StateEvent[] =>
  call.events.filter(
    (e) =>
      categories.includes(e.category) && (turnIndex === undefined || e.turnIndex === turnIndex),
  );

type MeasureKey = 'temperature' | 'trust' | 'patience' | 'confidence' | 'ownershipConfidence';
const MEASURE_PHRASE: Record<MeasureKey, (name: string) => string> = {
  temperature: (name) => `${name}'s temperature`,
  trust: (name) => `${name}'s trust`,
  patience: (name) => `${name}'s patience`,
  confidence: (name) => `${name}'s confidence that support can help`,
  ownershipConfidence: (name) => `${name}'s confidence that someone owns the problem`,
};

const isMeasure = (key: string): key is MeasureKey => key in MEASURE_PHRASE;

function moved(name: string, e: StateEvent): string {
  const subject = MEASURE_PHRASE[e.key as MeasureKey](name);
  return `${subject} ${e.delta > 0 ? 'rose' : 'fell'} from ${e.previous} to ${e.next}`;
}

function biggest(events: StateEvent[]): StateEvent | undefined {
  return events.reduce<StateEvent | undefined>(
    (best, e) => (!best || Math.abs(e.delta) > Math.abs(best.delta) ? e : best),
    undefined,
  );
}

/** What went wrong for the customer in these events, in words ("Maya's temperature rose from 52 to 62"). */
export function describeHarm(name: string, events: StateEvent[]): string[] {
  const hotter = biggest(events.filter((e) => e.key === 'temperature' && e.delta > 0));
  const lower = biggest(
    events.filter((e) => e.key !== 'temperature' && isMeasure(e.key) && e.delta < 0),
  );
  return [hotter, lower].filter((e): e is StateEvent => Boolean(e)).map((e) => moved(name, e));
}

/** What went right for the customer in these events. A one-point wobble is not worth mentioning. */
export function describeHelp(name: string, events: StateEvent[], minDrop = 2): string[] {
  const cooler = biggest(events.filter((e) => e.key === 'temperature' && e.delta <= -minDrop));
  const higher = biggest(
    events.filter((e) => e.key !== 'temperature' && isMeasure(e.key) && e.delta > 0),
  );
  return [cooler, higher].filter((e): e is StateEvent => Boolean(e)).map((e) => moved(name, e));
}

/** A rough size for how much harm these events did, used only to rank coaching points. */
export function damageOf(events: StateEvent[]): number {
  let damage = 0;
  for (const e of events) {
    if (e.key === 'temperature' && e.delta > 0) damage += e.delta;
    else if (e.key !== 'temperature' && isMeasure(e.key) && e.delta < 0) damage += -e.delta / 2;
  }
  return damage;
}

// ---------------------------------------------------------------------------------------
// Closing signals (shared by Closing scoring and the sufficiency rules)

const THANKS = /\b(?:thank(?:s| you)|goodbye|bye|take care|have a (?:good|great|nice|lovely))\b/i;
const TIME_REF =
  /\b(?:\d{1,2}(?::\d{2})?\s?(?:am|pm)|\d+\s?(?:minutes?|mins?|hours?|hrs?|days?)|tomorrow|today|tonight|this (?:morning|afternoon|evening)|(?:mon|tues|wednes|thurs|fri|satur|sun)day|end of (?:the )?day|noon|midday)\b/i;

export interface ClosingSignals {
  summary: boolean;
  nextContact: boolean;
  anythingElse: boolean;
  thanks: boolean;
}

export function closingSignals(turn: TraineeTurn): ClosingSignals {
  const c = turn.cls;
  return {
    summary: c.summarises || c.wrapsUp,
    nextContact: c.confirmsNextContact || (c.nextSteps === 'specific' && TIME_REF.test(turn.text)),
    anythingElse: c.asksAnythingElse,
    // The first turn's "thanks for calling" is a greeting, not a goodbye.
    thanks: turn.number > 1 && (hasRecorded(turn, 'thanks') || THANKS.test(turn.text)),
  };
}

/**
 * The trainee turns in which a closing behaviour counts in full. Agreements (a summary, a confirmed
 * next contact) count in the last two turns; a check for anything else counts there too; a
 * goodbye only counts in the final turn, so a mid-call "thanks" is not mistaken for one.
 */
export function closingWindow(call: CallView, key: keyof ClosingSignals): TraineeTurn[] {
  const n = call.turns.length;
  return call.turns.slice(key === 'thanks' ? Math.max(0, n - 1) : Math.max(0, n - 2));
}

/** True when anything in the call worked as a close: an agreement anywhere, or a check or goodbye at the end. */
export function closingSeen(call: CallView): boolean {
  const anywhere: (keyof ClosingSignals)[] = ['summary', 'nextContact'];
  const atTheEnd: (keyof ClosingSignals)[] = ['anythingElse', 'thanks'];
  return (
    anywhere.some((key) => call.turns.some((t) => closingSignals(t)[key])) ||
    atTheEnd.some((key) => closingWindow(call, key).some((t) => closingSignals(t)[key]))
  );
}

// ---------------------------------------------------------------------------------------
// Completion and evidence sufficiency

export function evidenceLevel(traineeTurns: number): Sufficiency {
  return traineeTurns >= 5 ? 'sufficient' : traineeTurns >= 3 ? 'limited' : 'insufficient';
}

const RANK: Record<Sufficiency, number> = { sufficient: 2, limited: 1, insufficient: 0 };
export const worseOf = (a: Sufficiency, b: Sufficiency): Sufficiency =>
  RANK[a] <= RANK[b] ? a : b;

/** How firmly one dimension can be judged from this transcript. */
export function dimensionSufficiency(call: CallView, id: DimensionId): Sufficiency {
  const level = evidenceLevel(call.turns.length);
  // A call that was ended with no closing behaviour at all stopped before the point where
  // closing could be judged: never better than limited, and with three turns or fewer not at all.
  if (id === 'closing' && call.input.endedEarly && !closingSeen(call)) {
    return call.turns.length <= 3 ? 'insufficient' : worseOf(level, 'limited');
  }
  return level;
}

/** Never award a high score without quoted evidence: a 4 needs one piece, a 5 needs two. */
export function capScore(score: number, evidenceCount: number): number {
  if (score >= 5 && evidenceCount < 2) return evidenceCount >= 1 ? 4 : 3;
  if (score >= 4 && evidenceCount < 1) return 3;
  return score;
}

/** Turns where the trainee blamed or dismissed the customer (by classification or recorded event). */
export function harmfulTurns(call: CallView): TraineeTurn[] {
  const flagged = new Set(
    call.events
      .filter((e) => e.category === 'blame' || e.category === 'dismissal')
      .map((e) => e.turnIndex),
  );
  return call.turns.filter((t) => t.cls.blame || t.cls.dismissive || flagged.has(t.index));
}

const HURTFUL_CATEGORIES: StateCategory[] = [
  'blame',
  'dismissal',
  'premature-troubleshooting',
  'jargon',
  'repetition',
  'promise',
];

/**
 * Turns that did the customer recorded harm (heat added or trust lost by blame, dismissal, early
 * fixes, jargon, repetition or an unverifiable promise). A strength is never drawn from one.
 */
export function hurtfulTurns(call: CallView): TraineeTurn[] {
  const hurt = new Set(harmfulTurns(call).map((t) => t.index));
  for (const e of call.events) {
    const worse = (e.key === 'temperature' && e.delta > 0) || (e.key === 'trust' && e.delta < 0);
    if (worse && HURTFUL_CATEGORIES.includes(e.category)) hurt.add(e.turnIndex);
  }
  for (const t of call.turns) if (t.cls.promise === 'unverified') hurt.add(t.index);
  return call.turns.filter((t) => hurt.has(t.index));
}

export function buildCompletion(call: CallView): CoachingReport['completion'] {
  const n = call.turns.length;
  const evidence = evidenceLevel(n);
  const early = call.input.endedEarly;
  const turns = plural(n, 'trainee turn');
  const more = 'More turns would give firmer coaching.';
  let note: string | null = null;
  if (n === 0) {
    note = 'The call ended before any trainee turn was recorded, so there is nothing to evaluate.';
  } else if (early && evidence === 'insufficient') {
    note = `The call ended early, after only ${turns}. This report reflects only what was said, so it is a first look rather than a full evaluation. ${more}`;
  } else if (early && evidence === 'limited') {
    note = `The call ended early, after ${turns}. This report reflects only what was said. ${more}`;
  } else if (early) {
    note = `The call was ended before a natural close. This report reflects only what was said up to that point. ${more}`;
  } else if (evidence === 'insufficient') {
    note = `Only ${turns} were recorded. This report reflects only what was said, so it is a first look rather than a full evaluation. ${more}`;
  } else if (evidence === 'limited') {
    note = `This was a short call (${turns}), so the report rests on limited evidence and reflects only what was said. ${more}`;
  }
  return {
    status: early ? 'ended-early' : 'completed',
    traineeTurns: n,
    evidence,
    note,
  };
}

export function overallScore(scores: Scores, evidence: Sufficiency): number | null {
  if (evidence === 'insufficient') return null;
  const mean = DIMENSION_IDS.reduce((sum, id) => sum + scores[id], 0) / DIMENSION_IDS.length;
  return Math.round(mean * 10) / 10;
}

export function trainingNote(evaluatorName: string): string {
  return `This is practice coaching generated automatically (${evaluatorName}), not an assessment of your performance; a mentor's review of the transcript would add what automatic coaching cannot.`;
}

// ---------------------------------------------------------------------------------------
// Discovery results

const HELPFUL_NOTE: Record<HiddenFact['importance'], string> = {
  critical: 'Finding a critical fact like this keeps the call pointed at the real cause.',
  important: 'This gave the call a clearer picture of what was happening.',
  helpful: 'This added useful context.',
};

/** The sentence of the trainee's turn that most plausibly revealed this fact. */
function revealingQuote(turn: TraineeTurn, fact: HiddenFact): string | null {
  const recorded = turn.cls.evidence
    .filter((e) => e.behaviour === 'discovery-question')
    .map((e) => verifiedQuote(turn.text, e.quote))
    .filter((q): q is string => q !== null)
    .map(fold);
  let best: { sentence: string; score: number } | null = null;
  for (const sentence of sentences(turn.text)) {
    const lower = sentence.toLowerCase();
    const folded = fold(sentence);
    let score = 0;
    if ((fact.cues ?? []).some((cue) => lower.includes(cue.toLowerCase()))) score += 3;
    if (recorded.some((q) => folded.includes(q) || q.includes(folded))) score += 2;
    if (/\?\s*$/.test(sentence)) score += 1;
    if (score > (best?.score ?? 0)) best = { sentence, score };
  }
  const chosen = best?.sentence ?? firstSentence(turn.text);
  return verifiedQuote(turn.text, chosen);
}

function discoveryResult(call: CallView, fact: HiddenFact): DiscoveryResult {
  const record = call.input.discovery[fact.id];
  const status = record ? record.status : 'missed';
  const turn = record
    ? (call.byIndex.get(record.turnIndex) ??
      call.turns.find((t) => quoteInText(t.text, record.question)))
    : undefined;
  const at = record && Number.isInteger(record.turnIndex) && record.turnIndex >= 1;
  const revealedAtTurn = record ? (turn?.index ?? (at ? record.turnIndex : null)) : null;
  const consequence =
    status === 'discovered'
      ? `Found at turn ${revealedAtTurn ?? '?'}. ${HELPFUL_NOTE[fact.importance]}`
      : fact.missedConsequence;
  return {
    factId: fact.id,
    label: fact.label,
    importance: fact.importance,
    status,
    revealedAtTurn,
    revealingQuestion: turn ? revealingQuote(turn, fact) : null,
    whatWasHidden: fact.statement,
    betterQuestion: fact.betterQuestion,
    consequence,
  };
}

export function buildDiscovery(call: CallView): CoachingReport['discovery'] {
  const results = call.scenario.hiddenFacts.map((fact) => discoveryResult(call, fact));
  const count = (status: DiscoveryResult['status']) =>
    results.filter((r) => r.status === status).length;
  return {
    results,
    found: count('discovered'),
    partial: count('partial'),
    missed: count('missed'),
    total: results.length,
  };
}

/** Share of the hidden facts found, weighted by importance (partial counts half). */
export function weightedShare(results: DiscoveryResult[]): number {
  let total = 0;
  let got = 0;
  for (const r of results) {
    const weight = FACT_WEIGHT[r.importance];
    total += weight;
    got += r.status === 'discovered' ? weight : r.status === 'partial' ? weight / 2 : 0;
  }
  return total === 0 ? 0 : got / total;
}

/** "You found 2 of 4 hidden facts and 1 partly; missed: ..." (no closing full stop). */
export function discoverySentence(discovery: CoachingReport['discovery']): string {
  const missed = discovery.results.filter(
    (r) => r.status === 'missed' && r.importance !== 'helpful',
  );
  return `You found ${discovery.found} of ${discovery.total} hidden facts${
    discovery.partial > 0 ? ` and ${discovery.partial} partly` : ''
  }${missed.length > 0 ? `; missed: ${joinPhrases(missed.map((r) => `${r.label} (${r.importance})`))}` : ''}`;
}

// ---------------------------------------------------------------------------------------
// The temperature journey

const CATEGORY_BEHAVIOURS: Partial<Record<StateCategory, EvidenceBehaviour[]>> = {
  rapport: ['greeting', 'introduction', 'offers-help'],
  empathy: ['empathy-specific', 'empathy-generic'],
  impact: ['impact-acknowledged'],
  discovery: ['discovery-question'],
  repetition: ['discovery-question'],
  clarity: ['corrects-assumption'],
  jargon: ['jargon-unexplained', 'jargon-explained'],
  ownership: ['ownership-clear', 'ownership-vague'],
  'next-steps': ['next-steps-specific', 'next-steps-vague'],
  promise: ['promise-unverified', 'promise-realistic'],
  blame: ['blame'],
  dismissal: ['dismissive'],
  'premature-troubleshooting': ['troubleshooting'],
  summary: ['summary'],
  closing: ['wrap-up', 'next-contact', 'anything-else'],
  'low-effort': ['low-effort'],
};

function pointQuote(turn: TraineeTurn, event: StateEvent): string | null {
  const recorded = verifiedQuote(turn.text, event.evidenceQuote);
  if (recorded) return recorded;
  if (event.category === 'curveball') return null; // the customer raised it; nothing to quote
  const behaviours = CATEGORY_BEHAVIOURS[event.category];
  return behaviours
    ? quoteFor(turn, ...behaviours)
    : verifiedQuote(turn.text, firstSentence(turn.text));
}

function pointReason(row: TempRow, curveball: boolean): Pick<JourneyPoint, 'reason' | 'quote'> {
  const pool = curveball ? row.events.filter((e) => e.category === 'curveball') : row.events;
  const temperature = pool.filter((e) => e.key === 'temperature');
  const top = biggest(temperature.length > 0 ? temperature : pool);
  if (!top) return { reason: null, quote: null };
  return { reason: truncate(top.reason, 200), quote: pointQuote(row.turn, top) };
}

export function buildJourney(call: CallView): CoachingReport['journey'] {
  const start = clampTemp(call.input.startState.temperature);
  const points: JourneyPoint[] = [
    {
      turnIndex: 1,
      temperature: start,
      band: temperatureBand(start).label,
      kind: 'start',
      delta: 0,
      reason: null,
      quote: null,
    },
  ];
  const rows = temperatureSeries(call);
  rows.forEach((row, i) => {
    const delta = row.after - row.before;
    const bandChanged = temperatureBand(row.after).id !== temperatureBand(row.before).id;
    const curveball = row.events.some((e) => e.category === 'curveball');
    const kind: JourneyPoint['kind'] =
      i === rows.length - 1
        ? 'end'
        : curveball
          ? 'curveball'
          : Math.abs(delta) >= 6 || bandChanged
            ? 'turning-point'
            : 'turn';
    points.push({
      turnIndex: row.turn.index,
      temperature: row.after,
      band: temperatureBand(row.after).label,
      kind,
      delta,
      ...pointReason(row, curveball),
    });
  });
  const temps = points.map((p) => p.temperature);
  return {
    points,
    start,
    end: temps[temps.length - 1] ?? start,
    peak: Math.max(...temps),
    lowest: Math.min(...temps),
  };
}

// ---------------------------------------------------------------------------------------
// Curveball

function describeResponse(turn: TraineeTurn): { did: string; quote: string | null } {
  const c = turn.cls;
  const did: { text: string; behaviour: EvidenceBehaviour }[] = [];
  if (c.acknowledgesImpact)
    did.push({ text: 'acknowledged the impact', behaviour: 'impact-acknowledged' });
  if (c.empathy !== 'none')
    did.push({
      text: 'showed empathy',
      behaviour: c.empathy === 'specific' ? 'empathy-specific' : 'empathy-generic',
    });
  if (c.ownership === 'clear')
    did.push({ text: 'took clear ownership', behaviour: 'ownership-clear' });
  if (c.nextSteps === 'specific')
    did.push({ text: 'gave a specific next step', behaviour: 'next-steps-specific' });
  if (c.promise === 'realistic')
    did.push({ text: 'was honest about what you could commit to', behaviour: 'promise-realistic' });
  if (did.length === 0 && c.askedQuestion)
    did.push({ text: 'asked a question to re-engage', behaviour: 'discovery-question' });
  const first = did[0];
  return {
    did: did.length > 0 ? joinPhrases(did.slice(0, 2).map((d) => d.text)) : 'responded to it',
    quote: first ? quoteFor(turn, first.behaviour) : null,
  };
}

export function buildCurveball(call: CallView): CoachingReport['curveball'] {
  const state = curveballState(call);
  if (state.status === 'none' || !state.type) return null;
  const type = state.type;
  const firedEvent = call.events.find((e) => e.category === 'curveball');
  const firedAt = state.firedAtTurn ?? firedEvent?.turnIndex ?? null;
  if (firedAt === null || firedAt < 1) return null;

  const { name } = call;
  const definition =
    call.scenario.curveballs.find((d) => d.type === type) ?? genericCurveball(type);
  const expected =
    definition?.expectedResponse ??
    'Acknowledge what was said, say what you will do and give a time for the next update.';
  const what = `${name} ${CURVEBALL_PHRASES[type]}`;
  const responses = call.turns.filter((t) => t.index > firedAt);
  const rowOf = (turn: TraineeTurn) =>
    temperatureSeries(call).find((r) => r.turn.index === turn.index);
  const tail =
    state.firedCount > 1 ? ' A second curveball also came up; this covers the latest one.' : '';

  let assessment: string;
  if (state.status === 'resolved') {
    const turn =
      (state.resolvedAtTurn !== null ? call.byIndex.get(state.resolvedAtTurn) : undefined) ??
      responses[0];
    if (turn) {
      const { did, quote } = describeResponse(turn);
      const row = rowOf(turn);
      const moveText =
        row && row.before !== row.after
          ? `; ${name}'s temperature went from ${row.before} to ${row.after} on that turn`
          : '';
      assessment = `After turn ${firedAt}, ${what}. At turn ${turn.index} you ${did}${quote ? ` (${quoted(quote)})` : ''}, and it was resolved${moveText}.${tail}`;
    } else {
      assessment = `After turn ${firedAt}, ${what}, and it was resolved.${tail}`;
    }
  } else if (state.status === 'unresolved') {
    const failure = call.events.find(
      (e) =>
        e.category === 'curveball' &&
        e.turnIndex > firedAt &&
        e.key === 'temperature' &&
        e.delta > 0,
    );
    const turn = (failure ? call.byIndex.get(failure.turnIndex) : undefined) ?? responses[0];
    const said = turn ? verifiedQuote(turn.text, firstSentence(turn.text)) : null;
    const reply = turn
      ? ` Your reply at turn ${turn.index}${said ? ` (${quoted(said)})` : ''} did not address it.`
      : '';
    const heat = failure
      ? ` ${name}'s temperature rose from ${failure.previous} to ${failure.next}.`
      : '';
    assessment = `After turn ${firedAt}, ${what}, and it was not resolved.${reply}${heat} A stronger response: ${expected}${tail}`;
  } else {
    assessment =
      responses.length === 0
        ? `After turn ${firedAt}, ${what}, and the call ended before you could respond. A strong response: ${expected}${tail}`
        : `After turn ${firedAt}, ${what}, and it was still open when the call ended, so there is not enough to judge your response. A strong response: ${expected}${tail}`;
  }

  return { type, firedAtTurn: firedAt, status: state.status, assessment };
}

// ---------------------------------------------------------------------------------------
// Context for wording

/** The best question the trainee had not yet found an answer to by `turnIndex`. */
export function unfoundQuestion(call: CallView, turnIndex: number): string | null {
  const open = call.scenario.hiddenFacts
    .filter((f) => {
      const record = call.input.discovery[f.id];
      return !(record && record.turnIndex <= turnIndex);
    })
    .sort((a, b) => FACT_WEIGHT[b.importance] - FACT_WEIGHT[a.importance]);
  return open[0]?.betterQuestion ?? null;
}

export function phraseContext(call: CallView, turnIndex = Number.MAX_SAFE_INTEGER): PhraseContext {
  const { scenario } = call;
  const saidByCustomer = (text: string | undefined): string | null =>
    text && call.customerText.includes(fold(text)) ? text : null;
  return {
    name: call.name,
    product: scenario.environment.product,
    stage: scenario.config.callStage,
    proficiency: scenario.config.proficiency,
    impact: scenario.config.impact,
    impactQuote: saidByCustomer(scenario.impactVariant.summary),
    deadlineQuote: saidByCustomer(scenario.impactVariant.deadline),
    nextQuestion: unfoundQuestion(call, turnIndex),
  };
}

// ---------------------------------------------------------------------------------------
// What to practise next

export function lowestDimension(scores: Scores, focus: DimensionId[]): DimensionId {
  const rank = (d: DimensionId) => {
    const i = focus.indexOf(d);
    return i === -1 ? focus.length + DIMENSION_IDS.indexOf(d) : i;
  };
  return [...DIMENSION_IDS].sort(
    (a, b) => scores[a] - scores[b] || rank(a) - rank(b),
  )[0] as DimensionId;
}

export function nextDifficulty(current: Difficulty, overall: number | null): Difficulty {
  if (overall === null) return current;
  const step = overall >= 4 ? 1 : overall <= 2.5 ? -1 : 0;
  const rank = Math.min(DIFFICULTIES.length - 1, Math.max(0, DIFFICULTY_RANK[current] + step));
  return DIFFICULTIES[rank] as Difficulty;
}

export function pickScenario(
  library: EvaluationInput['library'],
  currentId: string,
  dimension: DimensionId,
  difficulty: Difficulty,
): { id: string; title: string } | null {
  const fits = library.filter((s) => s.coachingFocus.includes(dimension));
  const distance = (s: (typeof fits)[number]) =>
    Math.abs(DIFFICULTY_RANK[s.difficulty] - DIFFICULTY_RANK[difficulty]);
  const others = fits
    .filter((s) => s.id !== currentId)
    .sort(
      (a, b) =>
        distance(a) - distance(b) || DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty],
    );
  const pick = others[0] ?? fits.find((s) => s.id === currentId);
  return pick ? { id: pick.id, title: pick.title } : null;
}

export function buildNextPractice(
  call: CallView,
  scores: Scores,
  overall: number | null,
  discovery: CoachingReport['discovery'],
  override?: { dimension: DimensionId; recommendation: string },
): CoachingReport['nextPractice'] {
  const { scenario } = call;
  const dimension = override?.dimension ?? lowestDimension(scores, scenario.coachingFocus);
  const missed = discovery.results
    .filter((r) => r.status !== 'discovered' && r.importance !== 'helpful')
    .sort((a, b) => FACT_WEIGHT[b.importance] - FACT_WEIGHT[a.importance])[0];
  const difficulty = nextDifficulty(scenario.config.difficulty, overall);
  const pick = pickScenario(call.input.library, scenario.scenarioId, dimension, difficulty);
  return {
    dimension,
    recommendation:
      override?.recommendation ??
      practiceRecommendation(
        dimension,
        missed ? { betterQuestion: missed.betterQuestion } : undefined,
        scores[dimension] >= 5,
      ),
    suggestedDifficulty: difficulty,
    suggestedScenarioId: pick?.id ?? null,
    suggestedScenarioTitle: pick?.title ?? null,
  };
}
