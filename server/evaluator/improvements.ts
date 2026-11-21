import type { EvidenceBehaviour } from '#shared/domain/classification.ts';
import type { CoachingReport, DiscoveryResult, ImprovementItem } from '#shared/domain/report.ts';
import type { StateCategory, StateEvent } from '#shared/domain/state.ts';
import { truncate } from '#shared/domain/text.ts';
import { temperatureBand, type DimensionId } from '#shared/domain/vocab.ts';
import type { Outcome } from './dimensions.ts';
import { describeHarm } from './mood.ts';
import {
  closingSeen,
  damageOf,
  eventsOfCategory,
  hasRecorded,
  longestSentence,
  phraseContext,
  properNouns,
  quoteFor,
  temperatureSeries,
  verifiedQuote,
  type CallView,
  type Scores,
  type Sufficiency,
  type TraineeTurn,
} from './parts.ts';
import {
  IMPROVEMENT_DIMENSION,
  improvementText,
  lowerLabel,
  stageLead,
  type ImprovementKind,
  type StageGapKind,
  type StretchKind,
} from './phrasing.ts';
import { BUDGETS, firstFittingWords, fitWords } from './words.ts';

// Improvements for the rules evaluator. Real findings come first: harmful behaviour, then missed
// or partly found facts (each with the scenario's own better question), then the gaps the
// dimension scorers found. Only a call that has fewer than two of those gets a stretch, and a
// stretch is always built on something the trainee really said or on something the scenario
// shows never happened. Nothing is invented.

export interface CoachedImprovement {
  item: ImprovementItem;
  kind: ImprovementKind;
  advice: string; // the opportunity as behaviour, finishing "The biggest opportunity is to ..."
  turn: number | null;
  quote: string | null;
  harm: string | null; // the customer's reaction in brief, when there was one worth mentioning
}

export interface ImprovementCandidate {
  kind: ImprovementKind;
  turn: TraineeTurn | null;
  quote: string | null;
  harm: number;
  events: StateEvent[]; // recorded changes that this gap or behaviour caused
  fact?: DiscoveryResult;
  riskLead?: string; // a fact about this customer that opens the risk sentence
  upset?: boolean; // for no-empathy: the customer was already upset
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
  'no-open-question': 3,
  'few-topics': 3,
  unclear: 4,
  'no-next-contact': 3,
  'no-anything-else': 2,
  'no-history-ack': 6,
  'no-progress-update': 5,
  'no-escalation-explained': 5,
  'no-cadence': 5,
  'no-resolution-check': 5,
  'no-agreement-check': 4,
  'stretch-scoping': 1,
  'stretch-empathy': 1,
  'stretch-clarity': 1,
  'stretch-ownership': 1,
  'stretch-closing': 1,
};

// A second point in a dimension that is already covered is only added when it is this serious.
const SERIOUS = 8;

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
  'no-open-question': [],
  'few-topics': [],
  unclear: ['clarity'],
  'no-next-contact': ['next-steps'],
  'no-anything-else': [],
  'no-history-ack': [],
  'no-progress-update': [],
  'no-escalation-explained': [],
  'no-cadence': [],
  'no-resolution-check': [],
  'no-agreement-check': [],
  'stretch-scoping': [],
  'stretch-empathy': [],
  'stretch-clarity': [],
  'stretch-ownership': [],
  'stretch-closing': [],
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
  outcomes: Outcome[],
  stageGaps: StageGapKind[],
): ImprovementCandidate[] {
  const { name, scenario } = call;
  const { proficiency, impact } = scenario.config;
  const out: ImprovementCandidate[] = [];
  const rows = temperatureSeries(call);
  const gaps = new Set(outcomes.map((o) => `${o.id}:${o.gap}`));

  // Something the trainee said: quoted, with the damage recorded at that turn.
  const presence = (
    kind: ImprovementKind,
    turns: TraineeTurn[],
    behaviour: EvidenceBehaviour,
  ): void => {
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
    });
  };
  const withEvents = (category: StateCategory) =>
    call.turns.filter((t) => eventsOfCategory(call, [category], t.index).length > 0);

  presence(
    'blame',
    call.turns.filter((t) => t.cls.blame || withEvents('blame').includes(t)),
    'blame',
  );
  presence(
    'dismissive',
    call.turns.filter((t) => t.cls.dismissive || withEvents('dismissal').includes(t)),
    'dismissive',
  );

  const jargon = call.turns.filter((t) => t.cls.jargon === 'unexplained');
  if (
    proficiency === 'novice'
      ? jargon.length >= 1
      : proficiency === 'intermediate' && jargon.length >= 2
  ) {
    presence('jargon', jargon, 'jargon-unexplained');
  }
  presence(
    'unverified-promise',
    call.turns.filter((t) => t.cls.promise === 'unverified'),
    'promise-unverified',
  );
  presence('premature-troubleshooting', withEvents('premature-troubleshooting'), 'troubleshooting');
  presence('repeated-question', withEvents('repetition'), 'discovery-question');

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
    });
  }

  const impactEvents = eventsOfCategory(call, ['impact']);
  if (
    !call.turns.some((t) => t.cls.acknowledgesImpact) &&
    (impact === 'high' || damageOf(impactEvents) > 0 || gaps.has('empathy-deescalation:no-impact'))
  ) {
    out.push({
      kind: 'no-impact-ack',
      turn: null,
      quote: null,
      harm: SEVERITY['no-impact-ack'] + (impact === 'high' ? 3 : 0) + damageOf(impactEvents),
      events: impactEvents,
    });
  }

  const hot = rows.filter((r) => r.before >= 50);
  const firstHot = hot[0];
  const upset =
    firstHot !== undefined &&
    !hot.some((r) => r.turn.cls.empathy !== 'none' || r.turn.cls.acknowledgesImpact);
  if (upset || (gaps.has('empathy-deescalation:no-empathy') && !firstHot)) {
    const events = eventsOfCategory(call, ['empathy']);
    out.push({
      kind: 'no-empathy',
      turn: null,
      quote: null,
      harm: SEVERITY['no-empathy'] + (firstHot ? (firstHot.before - 50) / 5 : 0) + damageOf(events),
      events,
      upset,
      ...(upset && firstHot
        ? {
            riskLead: `${name} was ${temperatureBand(firstHot.before).label} when you replied at turn ${firstHot.turn.index}.`,
          }
        : {}),
    });
  }

  if (!closingSeen(call)) {
    out.push({
      kind: 'no-closing',
      turn: null,
      quote: null,
      harm: SEVERITY['no-closing'] + (call.input.endedEarly ? 1 : 0),
      events: eventsOfCategory(call, ['closing']),
    });
  } else if (!call.turns.some((t) => t.cls.summarises || t.cls.wrapsUp)) {
    out.push({
      kind: 'no-summary',
      turn: null,
      quote: null,
      harm: SEVERITY['no-summary'],
      events: [],
    });
  }

  // Gaps the dimension scorers found that have no finding of their own above.
  const gapCandidate = (kind: ImprovementKind, events: StateEvent[] = []) =>
    out.push({ kind, turn: null, quote: null, harm: SEVERITY[kind], events });
  if (gaps.has('opening-rapport:no-open-question')) gapCandidate('no-open-question');
  if (gaps.has('scoping-discovery:few-topics')) gapCandidate('few-topics');
  if (gaps.has('closing:no-anything-else')) gapCandidate('no-anything-else');
  if (gaps.has('ownership-next-steps:no-next-contact') || gaps.has('closing:no-next-contact')) {
    gapCandidate('no-next-contact', eventsOfCategory(call, ['next-steps']));
  }
  if (gaps.has('clarity:unclear')) {
    const muddled = call.turns.find((t) => t.cls.clarity === 'unclear' && !t.cls.lowEffort);
    const quote = muddled ? verifiedQuote(muddled.text, longestSentence(muddled.text)) : null;
    if (muddled && quote) {
      const events = eventsOfCategory(call, ['clarity'], muddled.index);
      out.push({
        kind: 'unclear',
        turn: muddled,
        quote,
        harm: SEVERITY.unclear + damageOf(events),
        events,
      });
    }
  }

  // What this call's stage calls for and never got (a progress update on a follow-up, an
  // explained escalation on an escalated case, a check that the fix worked on a closure call).
  for (const kind of stageGaps) {
    out.push({ kind, turn: null, quote: null, harm: SEVERITY[kind], events: [] });
  }
  // The stage's own wording of the empathy gap says more than the general one, so it replaces it.
  if (stageGaps.includes('no-history-ack')) {
    for (let i = out.length - 1; i >= 0; i -= 1) {
      if (out[i]?.kind === 'no-empathy') out.splice(i, 1);
    }
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
    });
  }
  return out;
}

/**
 * Up to three, one per dimension where possible. A second point in a dimension already used
 * earns its place when it is serious (blame after a dismissal, say) or is another missed or
 * partly found fact, which brings its own better question. Other findings only fill the list up
 * to two. A single finding is returned as one.
 */
function select(ranked: ImprovementCandidate[]): ImprovementCandidate[] {
  const chosen: ImprovementCandidate[] = [];
  const used = new Set<DimensionId>();
  for (const c of ranked) {
    const dimension = IMPROVEMENT_DIMENSION[c.kind];
    if (chosen.length < 3 && !used.has(dimension)) {
      chosen.push(c);
      used.add(dimension);
    }
  }
  const rest = () => ranked.filter((c) => !chosen.includes(c));
  for (const c of rest().filter((r) => r.harm >= SERIOUS)) {
    if (chosen.length < 3) chosen.push(c);
  }
  for (const c of rest().filter((r) => r.kind === 'missed-fact')) {
    if (chosen.length < 3) chosen.push(c);
  }
  for (const c of rest()) {
    if (chosen.length < 2) chosen.push(c);
  }
  return chosen;
}

// ---------------------------------------------------------------------------------------
// Stretches: only for a call that is strong enough to have fewer than two real findings.

export function stretchCandidates(call: CallView, scores: Scores): ImprovementCandidate[] {
  const out: ImprovementCandidate[] = [];
  const add = (kind: StretchKind, turn: TraineeTurn | null, quote: string | null) =>
    out.push({ kind, turn, quote, harm: SEVERITY[kind], events: [] });

  const specific = call.turns.filter((t) => t.cls.empathy === 'specific');
  const only = specific.length === 1 ? specific[0] : undefined;
  if (only) add('stretch-empathy', only, quoteFor(only, 'empathy-specific'));

  const recap = call.turns.find((t) => t.cls.summarises);
  if (recap && scores.clarity <= 4) add('stretch-clarity', recap, quoteFor(recap, 'summary'));

  const owner = call.turns.find((t) => t.cls.ownership === 'clear');
  if (owner && call.turns.some((t) => t.cls.confirmsNextContact)) {
    add('stretch-ownership', owner, quoteFor(owner, 'ownership-clear'));
  }

  const closer = [...call.turns].reverse().find((t) => t.cls.summarises || t.cls.wrapsUp);
  if (closer) add('stretch-closing', closer, quoteFor(closer, 'summary', 'wrap-up'));

  const voiced = phraseContext(call).assumption;
  if (voiced && !call.turns.some((t) => t.cls.correctsAssumption)) {
    add('stretch-scoping', null, null);
  }
  // Weakest area first; a stretch with no quote still never happened, so it is a real gap.
  return out
    .filter((c) => c.turn === null || c.quote !== null)
    .sort((a, b) => scores[IMPROVEMENT_DIMENSION[a.kind]] - scores[IMPROVEMENT_DIMENSION[b.kind]]);
}

// ---------------------------------------------------------------------------------------

export function buildImprovements(
  call: CallView,
  discovery: CoachingReport['discovery'],
  scores: Scores,
  sufficiency: Sufficiency,
  outcomes: Outcome[],
  stageGaps: StageGapKind[] = [],
): CoachedImprovement[] {
  const ranked = improvementCandidates(call, discovery, sufficiency, outcomes, stageGaps)
    .map((c) => ({ c, rank: c.harm + (5 - scores[IMPROVEMENT_DIMENSION[c.kind]]) }))
    .sort((a, b) => b.rank - a.rank || (a.c.turn?.index ?? 0) - (b.c.turn?.index ?? 0))
    .map((r) => r.c);

  const chosen = select(ranked);
  if (chosen.length < 2 && sufficiency === 'sufficient') {
    const taken = new Set(chosen.map((c) => IMPROVEMENT_DIMENSION[c.kind]));
    const stretches = stretchCandidates(call, scores);
    const fresh = stretches.filter((c) => !taken.has(IMPROVEMENT_DIMENSION[c.kind]));
    for (const c of [...fresh, ...stretches.filter((s) => !fresh.includes(s))]) {
      if (chosen.length < 2) chosen.push(c);
    }
  }

  const { name, scenario } = call;
  const names = properNouns(scenario);
  return chosen.map((c): CoachedImprovement => {
    const hidden = c.fact ? scenario.hiddenFacts.find((f) => f.id === c.fact?.factId) : undefined;
    const fact =
      c.fact && hidden
        ? {
            label: lowerLabel(c.fact.label, names),
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
      upset: c.upset,
    });
    const harm = describeHarm(name, c.events);
    const harmBrief = describeHarm(name, c.events, true);
    const phrase = (what: string | null) =>
      what ? ` ${c.turn ? 'After this,' : 'Along the way,'} ${what}.` : '';
    const consequence = phrase(harm);
    const consequenceBrief = phrase(harmBrief);
    const stage = STAGE_LEAD_KINDS.has(c.kind) ? stageLead(scenario.config.callStage, name) : '';
    const standing = `${text.risk}${consequence}`;
    // The risk is held to 45 words. The customer's second reaction goes first, then the stage and
    // the call's own lead-in, before the standing reason or the moment itself is touched.
    const opening = c.riskLead ? `${c.riskLead} ` : '';
    const risk = firstFittingWords(BUDGETS.riskWords, [
      `${opening}${stage ? `${stage} ` : ''}${standing}`,
      `${opening}${stage ? `${stage} ` : ''}${text.risk}${consequenceBrief}`,
      `${opening}${standing}`,
      `${opening}${text.risk}${consequenceBrief}`,
      `${text.risk}${consequenceBrief}`,
      `${opening}${text.risk}`,
      text.risk,
    ]);
    return {
      item: {
        dimension: IMPROVEMENT_DIMENSION[c.kind],
        title: truncate(text.title, 120),
        turnIndex: c.turn?.index ?? null,
        quote: c.quote,
        risk: truncate(risk, 400),
        betterPhrasing: fitWords(text.betterPhrasing, BUDGETS.betterPhrasingWords),
        whyItWorks: truncate(text.whyItWorks, 400),
      },
      kind: c.kind,
      advice: text.advice,
      turn: c.turn?.index ?? null,
      quote: c.quote,
      harm: describeHarm(name, c.events, true),
    };
  });
}
