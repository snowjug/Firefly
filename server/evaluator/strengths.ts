import type { EvidenceBehaviour } from '#shared/domain/classification.ts';
import type { CoachingReport, StrengthItem } from '#shared/domain/report.ts';
import type { StateCategory } from '#shared/domain/state.ts';
import { truncate } from '#shared/domain/text.ts';
import type { DimensionId } from '#shared/domain/vocab.ts';
import { wentStraightToFix } from './dimensions.ts';
import { describeHelp } from './mood.ts';
import { BUDGETS, firstFittingWords, wordCount } from './words.ts';
import {
  closingSignals,
  curveballState,
  eventsOfCategory,
  hurtfulTurns,
  properNouns,
  quoteFor,
  type CallView,
  type Scores,
  type TraineeTurn,
} from './parts.ts';
import {
  CURVEBALL_PHRASES,
  STRENGTH_DIMENSION,
  article,
  lowerLabel,
  quoted,
  strengthText,
  type StrengthKind,
} from './phrasing.ts';

// Strengths for the rules evaluator. Every strength is built from a recorded behaviour (a
// classification with a verified quote) and, where the engine recorded one, the change it caused
// in the customer, in words. Nothing is praised without evidence, and no reaction is described
// that the state events do not show.

export interface CoachedStrength {
  item: StrengthItem;
  said: string; // what the trainee did, with the quote, finishing "At turn N, you ..."
  saidPlain: string; // the same without the quote, for a summary that has to be short
  help: string | null; // the customer's reaction in brief, when there was one worth mentioning
}

interface StrengthCandidate {
  kind: StrengthKind;
  turn: TraineeTurn;
  quote: string;
  weight: number;
  help: string | null; // full wording, for the strength card
  helpBrief: string | null; // the temperature alone, for the summary
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
      helpBrief: describeHelp(name, events, true),
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

  const names = properNouns(scenario);
  for (const r of discovery.results) {
    const turn = r.revealedAtTurn === null ? undefined : call.byIndex.get(r.revealedAtTurn);
    if (r.status !== 'discovered' || r.importance === 'helpful') continue;
    if (!turn || !r.revealingQuestion || !praisable(turn)) continue;
    add('discovery', turn, r.revealingQuestion, r.importance === 'critical' ? 2 : 0, {
      label: lowerLabel(r.label, names),
      importance: r.importance,
    });
  }
  return out;
}

const STRENGTH_SAID: Record<
  StrengthKind,
  (
    quote: string,
    name: string,
    fact?: { label: string; importance: string },
  ) => { quoted: string; plain: string }
> = {
  discovery: (q, _n, fact) => {
    const what = `${article(fact?.importance ?? 'important')} ${fact?.importance ?? 'important'} fact (${fact?.label ?? 'a hidden detail'})`;
    return {
      quoted: `asked ${quoted(q)}, which uncovered ${what}`,
      plain: `asked a question that uncovered ${what}`,
    };
  },
  'ownership-clear': (q) => ({
    quoted: `took clear ownership (${quoted(q)})`,
    plain: 'took clear ownership',
  }),
  'impact-acknowledged': (q, n) => ({
    quoted: `acknowledged what this meant for ${n} (${quoted(q)})`,
    plain: `acknowledged what this meant for ${n}`,
  }),
  'empathy-specific': (q, n) => ({
    quoted: `showed empathy that fitted ${n}'s situation (${quoted(q)})`,
    plain: `showed empathy that fitted ${n}'s situation`,
  }),
  summary: (q) => ({
    quoted: `played the situation back to check understanding (${quoted(q)})`,
    plain: 'played the situation back to check understanding',
  }),
  recap: (q) => ({
    quoted: `recapped what was agreed (${quoted(q)})`,
    plain: 'recapped what was agreed',
  }),
  'next-steps-specific': (q) => ({
    quoted: `gave a specific next step (${quoted(q)})`,
    plain: 'gave a specific next step',
  }),
  'corrects-assumption': (q) => ({
    quoted: `tested a belief gently instead of arguing (${quoted(q)})`,
    plain: 'tested a belief gently instead of arguing',
  }),
  'jargon-explained': (q) => ({
    quoted: `explained a technical term in plain words (${quoted(q)})`,
    plain: 'explained a technical term in plain words',
  }),
  introduction: (q) => ({
    quoted: `opened with a greeting and an introduction (${quoted(q)})`,
    plain: 'opened with a greeting and an introduction',
  }),
  'promise-realistic': (q) => ({
    quoted: `stayed honest about what could be promised (${quoted(q)})`,
    plain: 'stayed honest about what could be promised',
  }),
  'next-contact': (q) => ({
    quoted: `confirmed when the next contact would be (${quoted(q)})`,
    plain: 'confirmed when the next contact would be',
  }),
  'anything-else': (q) => ({
    quoted: `checked whether anything else was needed (${quoted(q)})`,
    plain: 'checked whether anything else was needed',
  }),
};

export function buildStrengths(
  call: CallView,
  discovery: CoachingReport['discovery'],
  scores: Scores,
): CoachedStrength[] {
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
  // Two strengths are better than one when the call really did two things well, even in one
  // dimension: anything that cleared the bar can fill the second place.
  for (const c of candidates) {
    if (chosen.length >= 2) break;
    if (!chosen.includes(c) && !duplicate(c)) chosen.push(c);
  }

  const { name } = call;
  const curveball = curveballState(call);
  return chosen.map((c): CoachedStrength => {
    const text = strengthText(c.kind, {
      name,
      factLabel: c.fact?.label,
      importance: c.fact?.importance,
    });
    const title = truncate(text.title, 120);
    const help = c.help ? ` After this, ${c.help}.` : '';
    const helpBrief = c.helpBrief ? ` After this, ${c.helpBrief}.` : '';
    const resolved =
      c.answeredCurveball && curveball.type
        ? ` This reply also resolved the curveball (${name} ${CURVEBALL_PHRASES[curveball.type]}).`
        : '';
    // The title and the explanation share 35 words. What is dropped first is the second measure
    // of the customer's reaction, then the reaction, never the reason it helped and, when the same
    // reply answered a curveball, never that.
    const room = BUDGETS.strengthWords - wordCount(title);
    const whyItHelped = firstFittingWords(Math.max(8, room), [
      `${text.because}${help}${resolved}`,
      `${text.because}${helpBrief}${resolved}`,
      `${text.because}${resolved}`,
      `${text.because}${help}`,
      `${text.because}${helpBrief}`,
      text.because,
    ]);
    const said = STRENGTH_SAID[c.kind](c.quote, name, c.fact);
    return {
      item: {
        dimension: STRENGTH_DIMENSION[c.kind],
        title,
        turnIndex: c.turn.index,
        quote: c.quote,
        whyItHelped: truncate(whyItHelped, 400),
      },
      said: `at turn ${c.turn.index}, you ${said.quoted}`,
      saidPlain: `at turn ${c.turn.index}, you ${said.plain}`,
      help: c.helpBrief,
    };
  });
}
