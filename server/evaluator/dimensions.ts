import type { EvidenceBehaviour } from '#shared/domain/classification.ts';
import type { CoachingReport, Evidence } from '#shared/domain/report.ts';
import { firstSentence } from '#shared/domain/text.ts';
import {
  DISCOVERY_INTENT_LABELS,
  FACT_WEIGHT,
  type CallStage,
  type DimensionId,
  type DiscoveryIntent,
} from '#shared/domain/vocab.ts';
import {
  addEvidence,
  evidenceOf,
  closingSignals,
  closingWindow,
  curveballState,
  discoverySentence,
  harmfulTurns,
  hasRecorded,
  joinPhrases,
  keyFactsClause,
  longestSentence,
  plural,
  quoteFor,
  recordedQuote,
  sentenceMatching,
  topEvidence,
  verifiedQuote,
  weightedShare,
  type CallView,
  type ClosingSignals,
  type TraineeTurn,
} from './parts.ts';
import { describeCall } from './mood.ts';

// The six dimension scorers of the rules evaluator. Each returns a score computed from the
// classifications and recorded state events by explicit, documented rules (docs/care-cbcf-rubric.md),
// the quotes that support it, and the gap that should drive the guidance. Scores never depend on how
// long, short, formal or fluent the trainee's messages were: only on what they did.

export interface Outcome {
  id: DimensionId;
  score: number; // before the evidence cap is applied
  rationale: string;
  evidence: Evidence[];
  support: number; // distinct pieces of supporting evidence found
  gap: string; // what drives the guidance ("none" when nothing was missing)
  fact?: { betterQuestion: string };
}

const clamp = (n: number): number => Math.min(5, Math.max(1, n));
const turnList = (turns: TraineeTurn[]): string => joinPhrases(turns.map((t) => `turn ${t.index}`));

// ---------------------------------------------------------------------------------------
// 1. Opening & Rapport

const SELF_OR_HELP =
  /\b(?:my name is|this is [a-z]+|i['\u2019]?m (?!sorry|afraid|not|going|just|here|happy|glad|sure|so|really|very|trying|looking|able|unable|aware|worried)[a-z]+|i am (?!sorry|afraid|not|going)[a-z]+|how (?:can|may|could) i (?:help|assist)|what can i do|happy to help|here to help|i can help)/i;
const OPEN_INVITE =
  /\b(?:what(?:['\u2019]s| is)? (?:been )?(?:happening|going on|the (?:issue|problem|trouble)|wrong)|tell me (?:what|more|about)|walk me through|talk me through|how (?:can|may|could) i (?:help|assist)|what can i do|can you (?:describe|explain|tell me)|could you (?:describe|explain|tell me)|what (?:seems|appears) to be|what brings you|what are you (?:seeing|experiencing))\b/i;
const CONFIRMS_REASON =
  /\b(?:you(?:['\u2019]re| are) (?:calling|ringing|getting in touch)|calling (?:about|because|regarding|to)|(?:reason|purpose) (?:for|of) (?:your|the) call|you (?:wanted|want|would like) to (?:check|confirm|close|talk|ask|know)|so we can close)\b/i;
const HISTORY_ACK =
  /\b(?:(?:earlier|previous|last|yesterday(?:['\u2019]s)?) (?:call|contact|case|ticket|conversation)|you (?:called|contacted|rang|reached out|raised|logged)|(?:the|your) (?:wait|delay)|waiting|(?:no|any) update|chase|second (?:call|time)|already (?:called|raised|logged|spoken|contacted)|case notes)\b/i;

const WH_QUESTION = /\b(?:what|how|why|when|where|which|who)\b/i;

// An open question is one that cannot be answered with yes or no: the customer has to explain.
const opensConversation = (t: TraineeTurn): boolean =>
  t.cls.discoveryIntents.includes('problem_description') ||
  t.cls.discoveryIntents.includes('error_message') ||
  (t.cls.askedQuestion && WH_QUESTION.test(t.text)) ||
  OPEN_INVITE.test(t.text) ||
  CONFIRMS_REASON.test(t.text);

/** The first turn gave instructions without inviting the customer to explain the problem. */
export const wentStraightToFix = (first: TraineeTurn): boolean =>
  first.cls.troubleshooting && !opensConversation(first);

const acknowledgesHistory = (t: TraineeTurn): boolean =>
  t.cls.discoveryIntents.includes('previous_contact') || HISTORY_ACK.test(t.text);

/** The turn that shows empathy or, depending on the call stage, history or purpose acknowledgement. */
function feelingTurn(early: TraineeTurn[], stage: CallStage): TraineeTurn | null {
  const feels = early.find((t) => t.cls.empathy !== 'none' || t.cls.acknowledgesImpact);
  if (feels) return feels;
  if (stage === 'follow-up' || stage === 'escalated')
    return early.find(acknowledgesHistory) ?? null;
  if (stage === 'closure') return early.find((t) => CONFIRMS_REASON.test(t.text)) ?? null;
  return null;
}

function feelingQuote(turn: TraineeTurn): string | null {
  if (turn.cls.empathy !== 'none' || turn.cls.acknowledgesImpact) {
    return quoteFor(turn, 'empathy-specific', 'empathy-generic', 'impact-acknowledged');
  }
  const sentence =
    sentenceMatching(turn.text, HISTORY_ACK) ??
    sentenceMatching(turn.text, CONFIRMS_REASON) ??
    firstSentence(turn.text);
  return verifiedQuote(turn.text, sentence);
}

function openingQuote(turn: TraineeTurn): string | null {
  const sentence =
    sentenceMatching(turn.text, OPEN_INVITE) ??
    sentenceMatching(turn.text, CONFIRMS_REASON) ??
    sentenceMatching(turn.text, /\b(?:what|how|why|when|where|which|who)\b[^?]*\?/i);
  return (
    verifiedQuote(turn.text, sentence) ??
    recordedQuote(turn, 'discovery-question') ??
    verifiedQuote(turn.text, sentenceMatching(turn.text, /\?/))
  );
}

const FEELING_DONE: Record<CallStage, string> = {
  'first-contact': 'acknowledged how the problem affected them',
  'follow-up': 'acknowledged the history or the wait',
  escalated: 'acknowledged the history or the wait',
  closure: 'confirmed the purpose of the call',
};
const FEELING_MISSING: Record<CallStage, string> = {
  'first-contact': 'any acknowledgement of how the problem affected them',
  'follow-up': 'any acknowledgement of the history, the wait or the impact',
  escalated: 'any acknowledgement of the history, the wait or the impact',
  closure: 'a confirmation of why they were calling',
};

function scoreOpening(call: CallView): Outcome {
  const { name } = call;
  const stage = call.scenario.config.callStage;
  const early = call.turns.slice(0, 2);
  const first = early[0] as TraineeTurn;

  const greetTurn =
    first.cls.introduces || hasRecorded(first, 'greeting', 'introduction', 'offers-help')
      ? first
      : null;
  const idTurn =
    early.find(
      (t) =>
        hasRecorded(t, 'introduction', 'offers-help') ||
        (t.cls.introduces && SELF_OR_HELP.test(t.text)),
    ) ?? null;
  const openTurn = early.find(opensConversation) ?? null;
  const feelTurn = feelingTurn(early, stage);

  const fixFirst = wentStraightToFix(first);
  const harmFirst = first.cls.blame || first.cls.dismissive;
  const penalty = fixFirst || harmFirst ? 1 : 0;
  const found = [greetTurn, idTurn, openTurn, feelTurn];
  const score = clamp(1 + found.filter(Boolean).length - penalty);

  const support: Evidence[] = [];
  if (greetTurn)
    addEvidence(
      support,
      evidenceOf(greetTurn, quoteFor(greetTurn, 'greeting', 'introduction', 'offers-help')),
    );
  if (idTurn)
    addEvidence(support, evidenceOf(idTurn, quoteFor(idTurn, 'introduction', 'offers-help')));
  if (openTurn) addEvidence(support, evidenceOf(openTurn, openingQuote(openTurn)));
  if (feelTurn) addEvidence(support, evidenceOf(feelTurn, feelingQuote(feelTurn)));
  const against: Evidence[] = [];
  if (penalty) {
    const behaviours: EvidenceBehaviour[] = fixFirst
      ? ['troubleshooting']
      : first.cls.blame
        ? ['blame']
        : ['dismissive'];
    addEvidence(against, evidenceOf(first, quoteFor(first, ...behaviours)));
  }

  const did: string[] = [];
  const missing: string[] = [];
  if (greetTurn) did.push(`greeted ${name}`);
  else missing.push('a greeting');
  if (idTurn) did.push('introduced yourself or offered help');
  else missing.push('an introduction');
  if (openTurn) did.push('asked an open question');
  else missing.push('an open question');
  if (feelTurn) did.push(FEELING_DONE[stage]);
  else missing.push(FEELING_MISSING[stage]);

  const parts: string[] = [];
  if (did.length > 0) {
    parts.push(`In your first two turns you ${joinPhrases(did)}.`);
    if (missing.length > 0) parts.push(`Missing: ${joinPhrases(missing)}.`);
  } else {
    parts.push(`Your first two turns did not include ${joinPhrases(missing, 'or')}.`);
  }
  if (penalty)
    parts.push(
      `Your first turn also ${fixFirst ? 'went straight into troubleshooting instructions' : 'contained blame or dismissive language'}, which costs a point.`,
    );

  const gap = fixFirst
    ? 'straight-to-fix'
    : harmFirst
      ? 'blame'
      : !greetTurn
        ? 'no-greeting'
        : !idTurn
          ? 'no-introduction'
          : !openTurn
            ? 'no-open-question'
            : !feelTurn
              ? 'no-empathy'
              : 'none';

  return {
    id: 'opening-rapport',
    score,
    rationale: parts.join(' '),
    evidence: topEvidence([...against, ...support]),
    support: support.length,
    gap,
  };
}

// ---------------------------------------------------------------------------------------
// 2. Scoping & Discovery

const CORE_TOPICS: DiscoveryIntent[] = [
  'problem_description',
  'timing_onset',
  'recent_changes',
  'affected_scope',
  'business_impact',
  'error_message',
  'already_tried',
  'environment',
];
const EPS = 1e-9;

function scoreScoping(call: CallView, discovery: CoachingReport['discovery']): Outcome {
  const share = weightedShare(discovery.results);
  const base =
    share + EPS >= 0.85
      ? 5
      : share + EPS >= 0.65
        ? 4
        : share + EPS >= 0.4
          ? 3
          : share + EPS >= 0.2
            ? 2
            : 1;

  const topics = CORE_TOPICS.filter((topic) =>
    call.turns.some((t) => t.cls.discoveryIntents.includes(topic)),
  );
  const repeats = new Set(
    call.events.filter((e) => e.category === 'repetition').map((e) => e.turnIndex),
  );
  const premature = call.events.some((e) => e.category === 'premature-troubleshooting');
  const fewTopics = topics.length < 3;
  const manyRepeats = repeats.size >= 2;
  const score = clamp(base - (fewTopics ? 1 : 0) - (manyRepeats ? 1 : 0) - (premature ? 1 : 0));

  const support: Evidence[] = [];
  const revealed = discovery.results
    .filter((r) => r.status !== 'missed' && r.revealedAtTurn !== null && r.revealingQuestion)
    .sort(
      (a, b) =>
        FACT_WEIGHT[b.importance] - FACT_WEIGHT[a.importance] ||
        Number(b.status === 'discovered') - Number(a.status === 'discovered') ||
        (a.revealedAtTurn ?? 0) - (b.revealedAtTurn ?? 0),
    );
  for (const r of revealed) {
    addEvidence(support, {
      turnIndex: r.revealedAtTurn as number,
      quote: r.revealingQuestion as string,
    });
  }

  const deductions: string[] = [];
  if (fewTopics) {
    deductions.push(
      topics.length === 0
        ? 'no core topic asked about (three are expected)'
        : `only ${plural(topics.length, 'core topic')} asked about (three are expected)`,
    );
  }
  if (manyRepeats) deductions.push(`${repeats.size} repeated questions`);
  if (premature) deductions.push('fixes offered before the problem was scoped');
  const topicNames = topics.map((t) => DISCOVERY_INTENT_LABELS[t].toLowerCase());
  const matter = keyFactsClause(discovery.results);
  const rationale = [
    `${discoverySentence(discovery, undefined, { gap: false })}${matter ? `, and ${matter}` : ''}.`,
    topics.length > 0 ? `Core topics you asked about: ${joinPhrases(topicNames)}.` : '',
    deductions.length === 1
      ? `One point off: ${deductions[0]}.`
      : deductions.length > 1
        ? `One point off for each of: ${joinPhrases(deductions)}.`
        : '',
  ]
    .filter(Boolean)
    .join(' ');

  const open = discovery.results.find((r) => r.status === 'missed' && r.importance !== 'helpful');
  const gap = open
    ? 'missed-fact'
    : premature
      ? 'premature'
      : manyRepeats
        ? 'repeats'
        : fewTopics
          ? 'few-topics'
          : discovery.partial > 0
            ? 'partial'
            : 'none';

  return {
    id: 'scoping-discovery',
    score,
    rationale,
    evidence: topEvidence(support),
    support: support.length,
    gap,
    ...(open ? { fact: { betterQuestion: open.betterQuestion } } : {}),
  };
}

// ---------------------------------------------------------------------------------------
// 3. Empathy & De-escalation

function specificGeneric(specific: TraineeTurn[], generic: TraineeTurn[]): string {
  const shown = [
    specific.length > 0 ? `specific empathy at ${turnList(specific)}` : '',
    generic.length > 0 ? `general empathy at ${turnList(generic)}` : '',
  ].filter(Boolean);
  return shown.length > 0
    ? `You showed ${joinPhrases(shown)}.`
    : 'None of your turns showed empathy.';
}

function scoreEmpathy(call: CallView): Outcome {
  const { name } = call;
  const start = call.input.startState.temperature;
  const end = call.input.finalState.temperature;
  const specific = call.turns.filter((t) => t.cls.empathy === 'specific');
  const generic = call.turns.filter((t) => t.cls.empathy === 'generic');
  const impact = call.turns.filter((t) => t.cls.acknowledgesImpact);
  const harmful = harmfulTurns(call);
  const curveball = curveballState(call).status;

  const calmed = end <= start - 8 || (end <= 30 && harmful.length === 0);
  let score = 2;
  if (specific.length >= 1 || generic.length >= 2) score += 1;
  if (impact.length >= 1) score += 1;
  if (calmed) score += 1;
  score -= Math.min(2, harmful.length);
  if (curveball === 'resolved') score += 1;
  else if (curveball === 'unresolved') score -= 1;
  score = clamp(score);
  // Excellent needs consistency: repeated specific empathy, nothing harmful, and no net rise.
  if (score >= 5 && !(specific.length >= 2 && harmful.length === 0 && end <= start)) score = 4;

  const support: Evidence[] = [];
  for (const t of specific.slice(0, 2))
    addEvidence(support, evidenceOf(t, quoteFor(t, 'empathy-specific')));
  const ack = impact[0];
  if (ack) addEvidence(support, evidenceOf(ack, quoteFor(ack, 'impact-acknowledged')));
  const general = generic[0];
  if (general) addEvidence(support, evidenceOf(general, quoteFor(general, 'empathy-generic')));
  const against: Evidence[] = [];
  for (const t of harmful) {
    if (t.cls.blame) addEvidence(against, evidenceOf(t, quoteFor(t, 'blame')));
    if (t.cls.dismissive) addEvidence(against, evidenceOf(t, quoteFor(t, 'dismissive')));
    if (!t.cls.blame && !t.cls.dismissive) {
      // Harm recorded by the engine without a classification flag (for example from a model).
      const recorded = call.events.find(
        (e) => e.turnIndex === t.index && (e.category === 'blame' || e.category === 'dismissal'),
      );
      addEvidence(
        against,
        evidenceOf(t, quoteFor(t, recorded?.category === 'blame' ? 'blame' : 'dismissive')),
      );
    }
  }

  const rationale = [
    specificGeneric(specific, generic),
    impact.length > 0
      ? `You acknowledged the impact at ${turnList(impact)}.`
      : 'You did not acknowledge the impact.',
    harmful.length > 0 ? `Blame or dismissive language at ${turnList(harmful)}.` : '',
    `${describeCall(name, start, end)}.${
      end <= start - 8
        ? ' That counts as calming the customer.'
        : calmed
          ? ' The call ended calm with nothing harmful said, which also counts.'
          : ''
    }`,
    curveball === 'resolved'
      ? 'A curveball was handled well.'
      : curveball === 'unresolved'
        ? 'A curveball went unresolved.'
        : '',
  ]
    .filter(Boolean)
    .join(' ');

  const gap =
    harmful.length > 0
      ? harmful.some((t) => t.cls.blame)
        ? 'blame'
        : 'dismissive'
      : specific.length === 0 && generic.length < 2
        ? 'no-empathy'
        : impact.length === 0
          ? 'no-impact'
          : curveball === 'unresolved'
            ? 'curveball'
            : end > start
              ? 'temperature'
              : 'none';

  return {
    id: 'empathy-deescalation',
    score,
    rationale,
    evidence: topEvidence([...against.slice(0, 2), ...support]),
    support: support.length,
    gap,
  };
}

// ---------------------------------------------------------------------------------------
// 4. Clarity

function scoreClarity(call: CallView): Outcome {
  const { proficiency } = call.scenario.config;
  const clear = call.turns.filter((t) => t.cls.clarity === 'clear');
  const summaries = call.turns.filter((t) => t.cls.summarises);
  const jargon = call.turns.filter((t) => t.cls.jargon === 'unexplained');
  const explained = call.turns.filter((t) => t.cls.jargon === 'explained');
  // Low-effort replies ("ok") are not unclear writing, and brevity is never penalised.
  const unclear = call.turns.filter((t) => t.cls.clarity === 'unclear' && !t.cls.lowEffort);

  // Jargon only matters for customers who would not know the terms.
  const jargonCounts =
    proficiency === 'novice'
      ? jargon
      : proficiency === 'intermediate' && jargon.length >= 2
        ? jargon
        : [];
  let score = 3;
  if (clear.length >= 2 || summaries.length >= 1) score += 1;
  if (
    (proficiency === 'expert' || jargon.length === 0) &&
    summaries.length >= 1 &&
    unclear.length === 0
  )
    score += 1;
  if (proficiency === 'novice') score -= Math.min(2, jargonCounts.length);
  else score -= jargonCounts.length > 0 ? 1 : 0;
  if (unclear.length >= 2) score -= 1;
  score = clamp(score);

  const support: Evidence[] = [];
  for (const t of summaries.slice(0, 2))
    addEvidence(support, evidenceOf(t, quoteFor(t, 'summary')));
  const plain = explained[0];
  if (plain) addEvidence(support, evidenceOf(plain, quoteFor(plain, 'jargon-explained')));
  // A clear turn has no sentence-level pointer, so it is only cited when nothing sharper exists.
  const clearTurn = clear.find((t) => !t.cls.summarises);
  if (support.length === 0 && clearTurn) {
    addEvidence(
      support,
      evidenceOf(clearTurn, verifiedQuote(clearTurn.text, longestSentence(clearTurn.text))),
    );
  }
  const against: Evidence[] = [];
  for (const t of jargonCounts.slice(0, 2))
    addEvidence(against, evidenceOf(t, quoteFor(t, 'jargon-unexplained')));
  const muddled = unclear[0];
  if (unclear.length >= 2 && muddled) {
    addEvidence(
      against,
      evidenceOf(muddled, verifiedQuote(muddled.text, longestSentence(muddled.text))),
    );
  }

  // Only observed behaviour is described. A count such as "1 of 5 turns was clear" would wrongly
  // imply that the other turns were unclear, which the classification cannot say.
  const rationale = [
    summaries.length > 0
      ? `You played the situation back to check understanding at ${turnList(summaries)}.`
      : 'There was no recap of what you had understood before the call ended.',
    explained.length > 0
      ? `You put a technical term into plain words at ${turnList(explained)}.`
      : '',
    summaries.length === 0 && clear.length >= 2
      ? `Your replies at ${turnList(clear)} were easy to follow.`
      : '',
    jargonCounts.length > 0
      ? `Unexplained technical terms came up at ${turnList(jargonCounts)}${proficiency === 'novice' ? `, which a novice customer cannot follow` : ''}.`
      : jargon.length > 0
        ? `Technical terms went unexplained at ${turnList(jargon)}; for this ${proficiency} customer that is not penalised.`
        : 'No unexplained technical terms came up.',
    unclear.length >= 2 ? `Your replies at ${turnList(unclear)} were hard to follow.` : '',
    score <= 3 ? 'Length, grammar and phrasing are not part of this score.' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const gap =
    jargonCounts.length > 0
      ? 'jargon'
      : unclear.length >= 2
        ? 'unclear'
        : summaries.length === 0
          ? 'no-summary'
          : 'none';

  return {
    id: 'clarity',
    score,
    rationale,
    evidence: topEvidence([...against, ...support]),
    support: support.length,
    gap,
  };
}

// ---------------------------------------------------------------------------------------
// 5. Ownership & Next Steps

function scoreOwnership(call: CallView): Outcome {
  const owns = call.turns.filter((t) => t.cls.ownership === 'clear');
  const vagueOwn = call.turns.filter((t) => t.cls.ownership === 'vague');
  const steps = call.turns.filter((t) => t.cls.nextSteps === 'specific');
  const vagueSteps = call.turns.filter((t) => t.cls.nextSteps === 'vague');
  const contact = call.turns.filter((t) => t.cls.confirmsNextContact);
  const promises = call.turns.filter((t) => t.cls.promise === 'unverified');

  let points = 0;
  points += owns.length > 0 ? 2 : vagueOwn.length > 0 ? 1 : 0;
  points += steps.length > 0 ? 2 : vagueSteps.length > 0 ? 1 : 0;
  points += contact.length > 0 ? 1 : 0;
  points -= Math.min(2, promises.length);
  const score = clamp(points <= 0 ? 1 : points === 1 ? 2 : points <= 3 ? 3 : points === 4 ? 4 : 5);

  const support: Evidence[] = [];
  const own = owns[0] ?? vagueOwn[0];
  if (own)
    addEvidence(
      support,
      evidenceOf(own, quoteFor(own, owns.length > 0 ? 'ownership-clear' : 'ownership-vague')),
    );
  const step = steps[0] ?? vagueSteps[0];
  if (step)
    addEvidence(
      support,
      evidenceOf(
        step,
        quoteFor(step, steps.length > 0 ? 'next-steps-specific' : 'next-steps-vague'),
      ),
    );
  const next = contact[0];
  if (next)
    addEvidence(support, evidenceOf(next, quoteFor(next, 'next-contact', 'next-steps-specific')));
  const against: Evidence[] = [];
  const broken = promises[0];
  if (broken) addEvidence(against, evidenceOf(broken, quoteFor(broken, 'promise-unverified')));

  const rationale = [
    owns.length > 0
      ? `You took clear ownership at ${turnList(owns)}.`
      : vagueOwn.length > 0
        ? `Ownership stayed vague (${turnList(vagueOwn)}).`
        : 'Ownership was not stated.',
    steps.length > 0
      ? `You gave specific next steps at ${turnList(steps)}.`
      : vagueSteps.length > 0
        ? `Next steps stayed vague (${turnList(vagueSteps)}).`
        : 'No next steps were given.',
    contact.length > 0 ? `You confirmed the next contact at ${turnList(contact)}.` : '',
    promises.length > 0
      ? `${promises.length === 1 ? 'A promise' : `${promises.length} promises`} could not be verified (${turnList(promises)}).`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const gap =
    promises.length > 0
      ? 'unverified-promise'
      : owns.length === 0
        ? vagueOwn.length > 0
          ? 'vague-ownership'
          : 'no-ownership'
        : steps.length === 0
          ? vagueSteps.length > 0
            ? 'vague-next-steps'
            : 'no-next-steps'
          : contact.length === 0
            ? 'no-next-contact'
            : 'none';

  return {
    id: 'ownership-next-steps',
    score,
    rationale,
    evidence: topEvidence([...against, ...support]),
    support: support.length,
    gap,
  };
}

// ---------------------------------------------------------------------------------------
// 6. Closing

const CLOSING_ITEMS: {
  key: keyof ClosingSignals;
  done: string;
  behaviours: EvidenceBehaviour[];
  earlierCounts: boolean;
}[] = [
  {
    key: 'summary',
    done: 'summarised or wrapped up what was agreed',
    behaviours: ['summary', 'wrap-up'],
    earlierCounts: true,
  },
  {
    key: 'nextContact',
    done: 'confirmed the next contact',
    behaviours: ['next-contact', 'next-steps-specific'],
    earlierCounts: true,
  },
  {
    key: 'anythingElse',
    done: 'checked for anything else',
    behaviours: ['anything-else'],
    earlierCounts: false,
  },
  { key: 'thanks', done: 'closed politely', behaviours: ['thanks'], earlierCounts: false },
];

function scoreClosing(call: CallView): Outcome {
  const earlier = call.turns.slice(0, -2);
  let points = 0;
  const done: string[] = [];
  const doneEarlier: string[] = [];
  const missing: string[] = [];
  const support: Evidence[] = [];
  const gaps: string[] = [];

  for (const item of CLOSING_ITEMS) {
    const at = closingWindow(call, item.key).find((t) => closingSignals(t)[item.key]);
    // Agreements made earlier count half: they still need confirming at the end.
    const before = item.earlierCounts
      ? earlier.find((t) => closingSignals(t)[item.key])
      : undefined;
    const turn = at ?? before;
    if (turn) addEvidence(support, evidenceOf(turn, quoteFor(turn, ...item.behaviours)));
    if (at) {
      points += 1;
      done.push(`${item.done} (turn ${at.index})`);
    } else {
      if (before) {
        points += 0.5;
        doneEarlier.push(`${item.done} (turn ${before.index})`);
      } else {
        missing.push(item.done);
      }
      gaps.push(item.key);
    }
  }
  const score = clamp(1 + Math.floor(points + EPS));

  const parts: string[] = [];
  if (done.length > 0) parts.push(`At the end of the call you ${joinPhrases(done)}.`);
  else parts.push('The call ended without a summary or confirmation of next steps.');
  if (doneEarlier.length > 0)
    parts.push(
      `Earlier you ${joinPhrases(doneEarlier)}; that counts half, because agreements still need confirming at the end.`,
    );
  if (done.length > 0 && missing.length > 0) parts.push(`Not found: ${joinPhrases(missing)}.`);

  const gapNames: Record<string, string> = {
    summary: 'no-summary',
    nextContact: 'no-next-contact',
    anythingElse: 'no-anything-else',
    thanks: 'no-thanks',
  };
  const first = gaps[0];
  return {
    id: 'closing',
    score,
    rationale: parts.join(' '),
    evidence: topEvidence(support),
    support: support.length,
    gap: first ? (gapNames[first] as string) : 'none',
  };
}

// ---------------------------------------------------------------------------------------

export function scoreDimensions(call: CallView, discovery: CoachingReport['discovery']): Outcome[] {
  return [
    scoreOpening(call),
    scoreScoping(call, discovery),
    scoreEmpathy(call),
    scoreClarity(call),
    scoreOwnership(call),
    scoreClosing(call),
  ];
}
