import type { EvidenceBehaviour } from '#shared/domain/classification.ts';
import type {
  CoachingReport,
  DiscoveryResult,
  ImprovementItem,
  StrengthItem,
} from '#shared/domain/report.ts';
import type { StateCategory, StateEvent } from '#shared/domain/state.ts';
import { truncate } from '#shared/domain/text.ts';
import { temperatureBand, type DimensionId } from '#shared/domain/vocab.ts';
import { wentStraightToFix } from './dimensions.ts';
import {
  closingSeen,
  closingSignals,
  curveballState,
  damageOf,
  describeHarm,
  describeHelp,
  discoverySentence,
  eventsOfCategory,
  hurtfulTurns,
  hasRecorded,
  joinPhrases,
  phraseContext,
  plural,
  quoteFor,
  temperatureSeries,
  verifiedQuote,
  type CallView,
  type Scores,
  type Sufficiency,
  type TraineeTurn,
} from './parts.ts';
import {
  CURVEBALL_PHRASES,
  IMPROVEMENT_DIMENSION,
  STRENGTH_DIMENSION,
  firstFitting,
  improvementText,
  quoted,
  stageLead,
  strengthText,
  type ImprovementKind,
  type StrengthKind,
} from './phrasing.ts';

// Strengths, improvements and the overall summary for the rules evaluator. Every item is built
// from a recorded behaviour (a classification with a verified quote) and, where the engine
// recorded one, the change it caused in the customer. Nothing is praised or criticised without
// evidence, and no reaction is described that the state events do not show.

export interface Coached<T> {
  item: T;
  clause: string; // how the summary refers to it
}

// ---------------------------------------------------------------------------------------
// Strengths

interface StrengthCandidate {
  kind: StrengthKind;
  turn: TraineeTurn;
  quote: string;
  weight: number;
  help: string[]; // recorded changes in the customer after this turn
  answeredCurveball: boolean;
  fact?: { label: string; importance: string };
}

const MIN_STRENGTH_WEIGHT = 3;

// Behaviours that count as answering a curveball well on the turn that resolved it.
const ANSWERS_CURVEBALL = new Set<StrengthKind>([
  'impact-acknowledged',
  'empathy-specific',
  'ownership-clear',
  'next-steps-specific',
  'promise-realistic',
]);

const STRENGTH_CATEGORIES: Record<StrengthKind, StateCategory[]> = {
  discovery: ['discovery'],
  'ownership-clear': ['ownership'],
  'impact-acknowledged': ['impact'],
  'empathy-specific': ['empathy'],
  summary: ['summary'],
  recap: ['summary', 'closing'],
  'next-steps-specific': ['next-steps'],
  'corrects-assumption': ['clarity'],
  'jargon-explained': ['jargon'],
  introduction: ['rapport'],
  'promise-realistic': ['promise'],
  'next-contact': ['closing'],
  'anything-else': ['closing'],
};

const STRENGTH_WEIGHT: Record<StrengthKind, number> = {
  discovery: 7,
  'ownership-clear': 7,
  'impact-acknowledged': 7,
  'empathy-specific': 7,
  summary: 6,
  recap: 6,
  'next-steps-specific': 6,
  'corrects-assumption': 5,
  'jargon-explained': 4,
  'promise-realistic': 4,
  'next-contact': 4,
  introduction: 3,
  'anything-else': 2,
};

function strengthCandidates(
  call: CallView,
  discovery: CoachingReport['discovery'],
  scores: Scores,
): StrengthCandidate[] {
  const { name, scenario } = call;
  const hurtful = new Set(hurtfulTurns(call).map((t) => t.index));
  // Never praise a turn that also hurt the call, tried to break the customer's role, or (as the
  // opening is already scored down for it) went straight into fixes without a word of welcome.
  const praisable = (turn: TraineeTurn): boolean =>
    !hurtful.has(turn.index) &&
    !turn.cls.injectionAttempt &&
    !(turn.number === 1 && wentStraightToFix(turn));
  const lastTwo = new Set(call.turns.slice(-2).map((t) => t.index));
  const curveball = curveballState(call);
  const resolvedAt = curveball.status === 'resolved' ? curveball.resolvedAtTurn : null;
  const out: StrengthCandidate[] = [];

  const add = (
    kind: StrengthKind,
    turn: TraineeTurn,
    quote: string | null,
    extra = 0,
    fact?: StrengthCandidate['fact'],
  ) => {
    if (!quote) return;
    const answeredCurveball = resolvedAt === turn.index && ANSWERS_CURVEBALL.has(kind);
    const categories: StateCategory[] = answeredCurveball
      ? [...STRENGTH_CATEGORIES[kind], 'curveball']
      : STRENGTH_CATEGORIES[kind];
    const events = eventsOfCategory(call, categories, turn.index);
    const cooled = -events
      .filter((e) => e.key === 'temperature' && e.delta < 0)
      .reduce((sum, e) => sum + e.delta, 0);
    out.push({
      kind,
      turn,
      quote,
      weight:
        STRENGTH_WEIGHT[kind] +
        extra +
        Math.min(4, Math.round(cooled / 3)) +
        (answeredCurveball ? 3 : 0),
      help: describeHelp(name, events),
      answeredCurveball,
      fact,
    });
  };

  for (const turn of call.turns) {
    if (!praisable(turn)) continue;
    const c = turn.cls;
    const q = (...behaviours: EvidenceBehaviour[]) => quoteFor(turn, ...behaviours);
    const high = scenario.config.impact === 'high' ? 2 : 0;
    const novice = scenario.config.proficiency === 'novice' ? 2 : 0;
    if (turn.number === 1 && c.introduces && scores['opening-rapport'] >= 3) {
      add('introduction', turn, q('introduction', 'greeting', 'offers-help'));
    }
    if (c.ownership === 'clear') add('ownership-clear', turn, q('ownership-clear'));
    if (c.acknowledgesImpact) add('impact-acknowledged', turn, q('impact-acknowledged'), high);
    if (c.empathy === 'specific') add('empathy-specific', turn, q('empathy-specific'));
    if (c.summarises || c.wrapsUp) {
      add(lastTwo.has(turn.index) ? 'recap' : 'summary', turn, q('summary', 'wrap-up'));
    }
    if (c.nextSteps === 'specific') add('next-steps-specific', turn, q('next-steps-specific'));
    if (c.correctsAssumption && scenario.incorrectAssumptions.length > 0) {
      add('corrects-assumption', turn, q('corrects-assumption'));
    }
    if (c.jargon === 'explained') add('jargon-explained', turn, q('jargon-explained'), novice);
    if (c.promise === 'realistic') add('promise-realistic', turn, q('promise-realistic'));
    if (lastTwo.has(turn.index) && closingSignals(turn).nextContact) {
      add('next-contact', turn, q('next-contact', 'next-steps-specific'));
    }
    if (lastTwo.has(turn.index) && c.asksAnythingElse) {
      add('anything-else', turn, q('anything-else'));
    }
  }

  for (const r of discovery.results) {
    const turn = r.revealedAtTurn === null ? undefined : call.byIndex.get(r.revealedAtTurn);
    if (r.status !== 'discovered' || r.importance === 'helpful') continue;
    if (!turn || !r.revealingQuestion || !praisable(turn)) continue;
    add('discovery', turn, r.revealingQuestion, r.importance === 'critical' ? 2 : 0, {
      label: r.label,
      importance: r.importance,
    });
  }
  return out;
}

const STRENGTH_CLAUSE: Record<
  StrengthKind,
  (quote: string, name: string, label: string) => string
> = {
  discovery: (q, _n, label) => `you asked ${quoted(q)}, which uncovered ${quoted(label)}`,
  'ownership-clear': (q) => `you took clear ownership (${quoted(q)})`,
  'impact-acknowledged': (q, n) => `you acknowledged what this meant for ${n} (${quoted(q)})`,
  'empathy-specific': (q, n) => `your empathy fitted ${n}'s situation (${quoted(q)})`,
  summary: (q) => `you played the situation back (${quoted(q)})`,
  recap: (q) => `you recapped what was agreed (${quoted(q)})`,
  'next-steps-specific': (q) => `you gave a specific next step (${quoted(q)})`,
  'corrects-assumption': (q) => `you tested a belief gently (${quoted(q)})`,
  'jargon-explained': (q) => `you explained a technical term in plain words (${quoted(q)})`,
  introduction: (q) => `you opened with a greeting and an introduction (${quoted(q)})`,
  'promise-realistic': (q) => `you stayed honest about what could be promised (${quoted(q)})`,
  'next-contact': (q) => `you confirmed the next contact (${quoted(q)})`,
  'anything-else': (q) => `you checked whether anything else was needed (${quoted(q)})`,
};

export function buildStrengths(
  call: CallView,
  discovery: CoachingReport['discovery'],
  scores: Scores,
): Coached<StrengthItem>[] {
  // A routine courtesy on its own (a bare "anything else?") is not a clear strength.
  const candidates = strengthCandidates(call, discovery, scores)
    .filter((c) => c.weight >= MIN_STRENGTH_WEIGHT)
    .sort((a, b) => b.weight - a.weight || a.turn.index - b.turn.index);
  const chosen: StrengthCandidate[] = [];
  const duplicate = (c: StrengthCandidate) =>
    chosen.some((x) => x.turn.index === c.turn.index && x.quote === c.quote);
  const used = new Set<DimensionId>();
  for (const c of candidates) {
    if (chosen.length >= 3) break;
    const dimension = STRENGTH_DIMENSION[c.kind];
    if (!used.has(dimension) && !duplicate(c)) {
      chosen.push(c);
      used.add(dimension);
    }
  }
  // A second point in the same dimension is only worth adding when it is a substantial one.
  for (const c of candidates) {
    if (chosen.length >= 3) break;
    if (!chosen.includes(c) && c.weight >= 6 && !duplicate(c)) chosen.push(c);
  }

  const { name } = call;
  const curveball = curveballState(call);
  return chosen.map((c): Coached<StrengthItem> => {
    const text = strengthText(c.kind, {
      name,
      factLabel: c.fact?.label,
      importance: c.fact?.importance,
    });
    const help = c.help.length > 0 ? ` After this, ${joinPhrases(c.help)}.` : '';
    const resolved =
      c.answeredCurveball && curveball.type
        ? ` This reply also resolved the curveball (${name} ${CURVEBALL_PHRASES[curveball.type]}).`
        : '';
    return {
      item: {
        dimension: STRENGTH_DIMENSION[c.kind],
        title: truncate(text.title, 120),
        turnIndex: c.turn.index,
        quote: c.quote,
        whyItHelped: truncate(`${text.because}${help}${resolved}`, 400),
      },
      clause: `at turn ${c.turn.index}, ${STRENGTH_CLAUSE[c.kind](c.quote, name, c.fact?.label ?? '')}${
        c.help[0] ? `, and ${c.help[0]}` : ''
      }`,
    };
  });
}

// ---------------------------------------------------------------------------------------
// Improvements

interface ImprovementCandidate {
  kind: ImprovementKind;
  turn: TraineeTurn | null;
  quote: string | null;
  harm: number;
  events: StateEvent[]; // recorded changes that this gap or behaviour caused
  fact?: DiscoveryResult;
  riskLead?: string; // a fact about this customer that opens the risk sentence
  clause: string;
}

const SEVERITY: Record<ImprovementKind, number> = {
  blame: 9,
  dismissive: 9,
  'unverified-promise': 8,
  'premature-troubleshooting': 7,
  'no-impact-ack': 4,
  'no-empathy': 6,
  jargon: 6,
  'repeated-question': 5,
  'no-ownership': 6,
  'vague-ownership': 4,
  'no-next-steps': 6,
  'vague-next-steps': 4,
  'missed-fact': 5,
  'no-closing': 4,
  'no-summary': 3,
  'no-introduction': 3,
};

// Mistakes that land harder on a case that is already open or escalated.
const STAGE_LEAD_KINDS = new Set<ImprovementKind>([
  'blame',
  'dismissive',
  'unverified-promise',
  'premature-troubleshooting',
  'repeated-question',
  'no-next-steps',
  'vague-next-steps',
]);

const IMPROVEMENT_CATEGORIES: Record<ImprovementKind, StateCategory[]> = {
  'no-introduction': ['rapport'],
  blame: ['blame'],
  dismissive: ['dismissal'],
  jargon: ['jargon'],
  'unverified-promise': ['promise'],
  'premature-troubleshooting': ['premature-troubleshooting', 'rapport'],
  'repeated-question': ['repetition'],
  'no-ownership': ['ownership'],
  'vague-ownership': ['ownership'],
  'no-next-steps': ['next-steps'],
  'vague-next-steps': ['next-steps'],
  'no-impact-ack': ['impact'],
  'no-empathy': ['empathy'],
  'missed-fact': [],
  'no-summary': ['summary', 'closing'],
  'no-closing': ['closing', 'next-steps'],
};

/** The turn where a behaviour did the most recorded damage (the earliest on a tie). */
function worstTurn(
  call: CallView,
  turns: TraineeTurn[],
  categories: StateCategory[],
): TraineeTurn | null {
  let worst: TraineeTurn | null = null;
  let most = -1;
  for (const t of turns) {
    const damage = damageOf(eventsOfCategory(call, categories, t.index));
    if (damage > most) {
      worst = t;
      most = damage;
    }
  }
  return worst;
}

function improvementCandidates(
  call: CallView,
  discovery: CoachingReport['discovery'],
  sufficiency: Sufficiency,
): ImprovementCandidate[] {
  const { name, scenario } = call;
  const { proficiency, impact } = scenario.config;
  const out: ImprovementCandidate[] = [];
  const rows = temperatureSeries(call);

  // Something the trainee said: quoted, with the damage recorded at that turn.
  const presence = (
    kind: ImprovementKind,
    turns: TraineeTurn[],
    behaviour: EvidenceBehaviour,
    clause: (quote: string, turn: TraineeTurn) => string,
  ) => {
    const turn = worstTurn(call, turns, IMPROVEMENT_CATEGORIES[kind]);
    if (!turn) return;
    const events = eventsOfCategory(call, IMPROVEMENT_CATEGORIES[kind], turn.index);
    const recorded = events
      .map((e) => verifiedQuote(turn.text, e.evidenceQuote))
      .find((q): q is string => q !== null);
    const quote = recorded ?? quoteFor(turn, behaviour);
    if (!quote) return;
    out.push({
      kind,
      turn,
      quote,
      harm: SEVERITY[kind] + damageOf(events) + 2 * Math.max(0, turns.length - 1),
      events,
      clause: clause(quote, turn),
    });
  };
  const withEvents = (category: StateCategory) =>
    call.turns.filter((t) => eventsOfCategory(call, [category], t.index).length > 0);

  const blamed = call.turns.filter((t) => t.cls.blame || withEvents('blame').includes(t));
  presence('blame', blamed, 'blame', (q, t) => `the blame at turn ${t.index} (${quoted(q)})`);
  const dismissed = call.turns.filter(
    (t) => t.cls.dismissive || withEvents('dismissal').includes(t),
  );
  presence(
    'dismissive',
    dismissed,
    'dismissive',
    (q, t) => `the dismissive reply at turn ${t.index} (${quoted(q)})`,
  );

  const jargon = call.turns.filter((t) => t.cls.jargon === 'unexplained');
  if (
    proficiency === 'novice'
      ? jargon.length >= 1
      : proficiency === 'intermediate' && jargon.length >= 2
  ) {
    presence(
      'jargon',
      jargon,
      'jargon-unexplained',
      (q, t) => `the unexplained term at turn ${t.index} (${quoted(q)})`,
    );
  }
  presence(
    'unverified-promise',
    call.turns.filter((t) => t.cls.promise === 'unverified'),
    'promise-unverified',
    (q, t) => `the promise at turn ${t.index} (${quoted(q)}) that could not be verified`,
  );
  presence(
    'premature-troubleshooting',
    withEvents('premature-troubleshooting'),
    'troubleshooting',
    (q, t) => `giving fixes at turn ${t.index} (${quoted(q)}) before the problem was understood`,
  );
  presence(
    'repeated-question',
    withEvents('repetition'),
    'discovery-question',
    (_q, t) => `repeating a question ${name} had already answered (turn ${t.index})`,
  );

  // Gaps: things that never happened. They are only called out when the call was long enough
  // for them to have shown up.
  if (sufficiency === 'insufficient') return out;

  const first = call.turns[0];
  if (
    first &&
    !first.cls.introduces &&
    !hasRecorded(first, 'greeting', 'introduction', 'offers-help')
  ) {
    const events = eventsOfCategory(call, ['rapport'], first.index);
    out.push({
      kind: 'no-introduction',
      turn: null,
      quote: null,
      harm: SEVERITY['no-introduction'] + damageOf(events),
      events,
      clause: 'the opening, which had no greeting or introduction',
    });
  }

  if (!call.turns.some((t) => t.cls.ownership === 'clear')) {
    const vague = call.turns.find((t) => t.cls.ownership === 'vague');
    const quote = vague ? quoteFor(vague, 'ownership-vague') : null;
    const events = eventsOfCategory(call, ['ownership']);
    const kind: ImprovementKind = quote ? 'vague-ownership' : 'no-ownership';
    out.push({
      kind,
      turn: quote ? (vague as TraineeTurn) : null,
      quote,
      harm: SEVERITY[kind] + damageOf(events),
      events,
      clause: quote
        ? `ownership that stayed vague (${quoted(quote)})`
        : 'not naming who owns the problem',
    });
  }

  if (!call.turns.some((t) => t.cls.nextSteps === 'specific')) {
    const vague = call.turns.find((t) => t.cls.nextSteps === 'vague');
    const quote = vague ? quoteFor(vague, 'next-steps-vague') : null;
    const events = eventsOfCategory(call, ['next-steps']);
    const kind: ImprovementKind = quote ? 'vague-next-steps' : 'no-next-steps';
    out.push({
      kind,
      turn: quote ? (vague as TraineeTurn) : null,
      quote,
      harm: SEVERITY[kind] + damageOf(events),
      events,
      clause: quote
        ? `next steps that stayed vague (${quoted(quote)})`
        : 'not agreeing a specific next step with a time',
    });
  }

  const impactEvents = eventsOfCategory(call, ['impact']);
  if (
    !call.turns.some((t) => t.cls.acknowledgesImpact) &&
    (impact === 'high' || damageOf(impactEvents) > 0)
  ) {
    out.push({
      kind: 'no-impact-ack',
      turn: null,
      quote: null,
      harm: SEVERITY['no-impact-ack'] + (impact === 'high' ? 3 : 0) + damageOf(impactEvents),
      events: impactEvents,
      clause: `never acknowledging the impact (it was ${impact} in this call)`,
    });
  }

  const hot = rows.filter((r) => r.before >= 50);
  const firstHot = hot[0];
  if (
    firstHot &&
    !hot.some((r) => r.turn.cls.empathy !== 'none' || r.turn.cls.acknowledgesImpact)
  ) {
    const events = eventsOfCategory(call, ['empathy']);
    const band = temperatureBand(firstHot.before).label.toLowerCase();
    out.push({
      kind: 'no-empathy',
      turn: null,
      quote: null,
      harm: SEVERITY['no-empathy'] + (firstHot.before - 50) / 5 + damageOf(events),
      events,
      riskLead: `${name}'s temperature was ${firstHot.before} (${band}) when you replied at turn ${firstHot.turn.index}.`,
      clause: `showing no empathy while ${name} was upset (temperature ${firstHot.before} at turn ${firstHot.turn.index})`,
    });
  }

  if (!closingSeen(call)) {
    out.push({
      kind: 'no-closing',
      turn: null,
      quote: null,
      harm: SEVERITY['no-closing'] + (call.input.endedEarly ? 1 : 0),
      events: eventsOfCategory(call, ['closing']),
      clause: 'the call ending without a summary or confirmation of next steps',
    });
  } else if (!call.turns.some((t) => t.cls.summarises || t.cls.wrapsUp)) {
    out.push({
      kind: 'no-summary',
      turn: null,
      quote: null,
      harm: SEVERITY['no-summary'],
      events: [],
      clause: 'not recapping what was agreed',
    });
  }

  for (const r of discovery.results) {
    if (r.status === 'discovered' || r.importance === 'helpful') continue;
    out.push({
      kind: 'missed-fact',
      turn: null,
      quote: null,
      harm:
        SEVERITY['missed-fact'] +
        (r.importance === 'critical' ? 3 : 0) -
        (r.status === 'partial' ? 2 : 0),
      events: [],
      fact: r,
      clause: `${r.status === 'partial' ? 'finding only part of' : 'not finding'} a ${r.importance} fact: ${r.label}`,
    });
  }
  return out;
}

export function buildImprovements(
  call: CallView,
  discovery: CoachingReport['discovery'],
  scores: Scores,
  sufficiency: Sufficiency,
): Coached<ImprovementItem>[] {
  const ranked = improvementCandidates(call, discovery, sufficiency)
    .map((c) => ({ c, rank: c.harm + (5 - scores[IMPROVEMENT_DIMENSION[c.kind]]) }))
    .sort((a, b) => b.rank - a.rank || (a.c.turn?.index ?? 0) - (b.c.turn?.index ?? 0))
    .map((r) => r.c);

  // One point per dimension where possible; a second in the same dimension only if it is serious.
  const chosen: ImprovementCandidate[] = [];
  const used = new Set<DimensionId>();
  for (const c of ranked) {
    const dimension = IMPROVEMENT_DIMENSION[c.kind];
    if (chosen.length < 3 && !used.has(dimension)) {
      chosen.push(c);
      used.add(dimension);
    }
  }
  for (const c of ranked) {
    if (chosen.length < 3 && !chosen.includes(c) && c.harm >= 8) chosen.push(c);
  }

  const { name } = call;
  return chosen.map((c): Coached<ImprovementItem> => {
    const hidden = c.fact
      ? call.scenario.hiddenFacts.find((f) => f.id === c.fact?.factId)
      : undefined;
    const fact =
      c.fact && hidden
        ? {
            label: c.fact.label,
            importance: c.fact.importance,
            betterQuestion: c.fact.betterQuestion,
            revealWhen: hidden.revealWhen,
            missedConsequence: hidden.missedConsequence,
            partial: c.fact.status === 'partial',
          }
        : undefined;
    const text = improvementText(c.kind, phraseContext(call, c.turn?.index), {
      quote: c.quote,
      fact,
    });
    const harm = describeHarm(name, c.events);
    const lead = c.turn ? 'After this,' : 'Along the way,';
    const consequence = harm.length > 0 ? ` ${lead} ${joinPhrases(harm)}.` : '';
    const stage = STAGE_LEAD_KINDS.has(c.kind)
      ? stageLead(call.scenario.config.callStage, name)
      : '';
    const standing = `${text.risk}${consequence}`;
    const risk = firstFitting(400, [
      `${c.riskLead ? `${c.riskLead} ` : ''}${stage ? `${stage} ` : ''}${standing}`,
      `${c.riskLead ? `${c.riskLead} ` : ''}${standing}`,
      standing,
    ]);
    return {
      item: {
        dimension: IMPROVEMENT_DIMENSION[c.kind],
        title: truncate(text.title, 120),
        turnIndex: c.turn?.index ?? null,
        quote: c.quote,
        risk,
        betterPhrasing: truncate(text.betterPhrasing, 500),
        whyItWorks: truncate(text.whyItWorks, 400),
      },
      clause: harm[0]
        ? `${c.clause}${c.turn ? ', after which' : '; meanwhile,'} ${harm[0]}`
        : c.clause,
    };
  });
}

// ---------------------------------------------------------------------------------------
// Overall summary: at most three sentences, no generic praise.

export function buildSummary(args: {
  completion: CoachingReport['completion'];
  discovery: CoachingReport['discovery'];
  strengths: Coached<StrengthItem>[];
  improvements: Coached<ImprovementItem>[];
}): string {
  const { completion, discovery, strengths, improvements } = args;
  const n = completion.traineeTurns;
  if (n === 0) return 'No trainee turns were recorded, so there is nothing to evaluate.';

  const strength = strengths[0];
  const gap = improvements[0];
  const standout = strength
    ? `What stood out: ${strength.clause}.`
    : 'There was no clear strength to point to in this call.';
  const opportunity = gap
    ? `The biggest opportunity is ${gap.clause}.`
    : 'No single gap stood out.';
  const found = discoverySentence(discovery);

  if (completion.evidence === 'insufficient') {
    const intro = `The call ended after ${plural(n, 'trainee turn')}, which is too few to score with confidence, so there is no overall score.`;
    const middle = strength ? standout : gap ? opportunity : '';
    return truncate([intro, middle, `${found}.`].filter(Boolean).join(' '), 1200);
  }
  const limit =
    completion.evidence === 'limited'
      ? `; with only ${plural(n, 'trainee turn')}, this rests on limited evidence`
      : '';
  return truncate([standout, opportunity, `${found}${limit}.`].join(' '), 1200);
}
