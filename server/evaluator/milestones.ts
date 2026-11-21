import type { EvidenceBehaviour } from '#shared/domain/classification.ts';
import {
  MILESTONE_IDS,
  type CoachingReport,
  type Evidence,
  type Milestone,
  type MilestoneId,
} from '#shared/domain/report.ts';
import { quoteFor } from './parts.ts';
import type { CareAssessment } from './care/index.ts';
import { evidenceFrom, hits, recordedEvidence, type TurnView } from './care/context.ts';
import { OFFERS_HELP } from './care/lexicon.ts';
import { analyses } from './care/moments.ts';
import type { BehaviourId, Finding } from './care/types.ts';

// The customer journey a support call is expected to move through, in call order: greeting, impact
// established, discovery, escalation (when a curveball came), ownership and closure. Each is
// "reached" at the trainee turn that shows it, with a verified quote of that turn, or "not-reached".
// The escalation milestone is "not-applicable" when no curveball happened. All of it is read from
// the same behaviour detection as CARE, the discovery records and the curveball record, never from
// a model.

const LABELS: Record<MilestoneId, string> = {
  greeting: 'Greeting',
  impact: 'Impact established',
  discovery: 'Discovery',
  escalation: 'Escalation or curveball',
  ownership: 'Ownership',
  closure: 'Closure',
};

const reached = (id: MilestoneId, evidence: Evidence): Milestone => ({
  id,
  label: LABELS[id],
  status: 'reached',
  turnIndex: evidence.turnIndex,
  quote: evidence.quote,
});

const missed = (id: MilestoneId, status: Milestone['status'] = 'not-reached'): Milestone => ({
  id,
  label: LABELS[id],
  status,
  turnIndex: null,
  quote: null,
});

const earliest = (items: (Evidence | undefined)[]): Evidence | undefined =>
  items.filter((e): e is Evidence => e !== undefined).sort((a, b) => a.turnIndex - b.turnIndex)[0];

/** The first piece of evidence of a behaviour the call showed, in full or in part. */
function evidenceOfBehaviour(
  findings: ReadonlyMap<BehaviourId, Finding>,
  id: BehaviourId,
  statuses: Finding['status'][] = ['shown', 'partly'],
): Evidence | undefined {
  const finding = findings.get(id);
  return finding && statuses.includes(finding.status) ? finding.evidence[0] : undefined;
}

function greeting(assessment: CareAssessment): Milestone {
  const { findings, context: ctx } = assessment;
  const opening = ctx.turns.slice(0, 2);
  const turnsOfOpening = new Set(opening.map((v) => v.turn.index));
  const said = [
    evidenceOfBehaviour(findings, 'communicate.greeting', ['shown']),
    evidenceOfBehaviour(findings, 'communicate.introduction'),
  ].filter((e): e is Evidence => e !== undefined && turnsOfOpening.has(e.turnIndex));
  const found =
    earliest(said) ??
    evidenceFrom(
      hits(ctx, (s) => OFFERS_HELP.test(s.lower), opening),
      1,
    )[0];
  return found ? reached('greeting', found) : missed('greeting');
}

function impact(assessment: CareAssessment): Milestone {
  const { findings } = assessment;
  const found = earliest([
    evidenceOfBehaviour(findings, 'empathetic.business-impact'),
    evidenceOfBehaviour(findings, 'resourceful.impact', ['shown']),
  ]);
  return found ? reached('impact', found) : missed('impact');
}

function discovery(assessment: CareAssessment, results: CoachingReport['discovery']): Milestone {
  // A hidden fact that the call uncovered is the clearest sign that discovery happened.
  const uncovered = results.results
    .filter((r) => r.status !== 'missed' && r.revealedAtTurn !== null && r.revealingQuestion)
    .sort((a, b) => (a.revealedAtTurn ?? 0) - (b.revealedAtTurn ?? 0))[0];
  if (uncovered && uncovered.revealedAtTurn !== null && uncovered.revealingQuestion) {
    return reached('discovery', {
      turnIndex: uncovered.revealedAtTurn,
      quote: uncovered.revealingQuestion,
    });
  }
  // Otherwise discovery is a spread of questions: two different topics asked about.
  const asked = analyses(assessment.context).intents;
  const topics = new Set(asked.flatMap((h) => h.intents));
  const first = asked[0] ? evidenceFrom([asked[0]], 1)[0] : undefined;
  return topics.size >= 2 && first ? reached('discovery', first) : missed('discovery');
}

/** What the trainee said in reply to the curveball, as a quote of the behaviour that answered it. */
function responseQuote(view: TurnView): Evidence | undefined {
  const c = view.turn.cls;
  const flagged: (EvidenceBehaviour | null)[] = [
    c.ownership === 'clear' ? 'ownership-clear' : null,
    c.acknowledgesImpact ? 'impact-acknowledged' : null,
    c.empathy === 'specific' ? 'empathy-specific' : null,
    c.nextSteps === 'specific' ? 'next-steps-specific' : null,
    c.promise === 'realistic' ? 'promise-realistic' : null,
  ];
  const behaviours = flagged.filter((b): b is EvidenceBehaviour => b !== null);
  const recorded = behaviours.length > 0 ? recordedEvidence(view, ...behaviours) : null;
  if (recorded) return recorded;
  const quote = quoteFor(view.turn);
  return quote ? { turnIndex: view.turn.index, quote } : undefined;
}

function escalation(assessment: CareAssessment): Milestone {
  const state = assessment.context.curveball;
  if (state.status === 'none' || !state.type) return missed('escalation', 'not-applicable');
  if (state.status !== 'resolved') return missed('escalation');
  const turns = assessment.context.turns;
  const fired = state.firedAtTurn ?? 0;
  const view =
    (state.resolvedAtTurn !== null
      ? turns.find((v) => v.turn.index === state.resolvedAtTurn)
      : undefined) ?? turns.find((v) => v.turn.index > fired);
  const evidence = view ? responseQuote(view) : undefined;
  return evidence ? reached('escalation', evidence) : missed('escalation');
}

function ownership(assessment: CareAssessment): Milestone {
  const found = evidenceOfBehaviour(assessment.findings, 'accountable.ownership');
  return found ? reached('ownership', found) : missed('ownership');
}

/** The call closed when at least two of: a recap, a time for the next contact, a check for anything else, a polite goodbye. */
function closure(assessment: CareAssessment): Milestone {
  const { findings, context: ctx } = assessment;
  const lastTwo = new Set(ctx.turns.slice(-2).map((v) => v.turn.index));
  const final = ctx.turns[ctx.turns.length - 1]?.turn.index;
  const inEnd = (e: Evidence | undefined): Evidence | undefined =>
    e && lastTwo.has(e.turnIndex) ? e : undefined;

  const items = [
    inEnd(evidenceOfBehaviour(findings, 'communicate.summary', ['shown'])),
    inEnd(evidenceOfBehaviour(findings, 'accountable.update-time', ['shown'])),
    inEnd(evidenceOfBehaviour(findings, 'empathetic.remaining-concerns', ['shown'])),
    // The polite goodbye has to be in the final turn.
    findings.get('communicate.professional-close')?.evidence.find((e) => e.turnIndex === final),
  ].filter((e): e is Evidence => e !== undefined);
  const first = items[0];
  return items.length >= 2 && first ? reached('closure', first) : missed('closure');
}

export function buildMilestones(
  assessment: CareAssessment,
  results: CoachingReport['discovery'],
): Milestone[] {
  const built: Record<MilestoneId, Milestone> = {
    greeting: greeting(assessment),
    impact: impact(assessment),
    discovery: discovery(assessment, results),
    escalation: escalation(assessment),
    ownership: ownership(assessment),
    closure: closure(assessment),
  };
  return MILESTONE_IDS.map((id) => built[id]);
}
