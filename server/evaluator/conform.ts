import type {
  CareBehaviourResult,
  CarePrincipleResult,
  CoachingReport,
  Evidence,
  ImprovementItem,
  Milestone,
  StrengthItem,
} from '#shared/domain/report.ts';
import { quoteInText } from '#shared/domain/text.ts';
import type { TranscriptTurn } from '#server/engine/types.ts';
import { BUDGETS, fitWords, wordCount } from './words.ts';

// The last step before a report is saved, for the rules evaluator and the model evaluator alike. It
// holds the text a trainee reads to its word budgets, and makes sure that every quote the report
// carries really is in the turn it cites. Nothing here adds anything: it only shortens or drops.

export { BUDGETS };

export interface ConformOptions {
  /** The transcript. When given, every quote in the report is checked against the turn it cites. */
  turns?: readonly TranscriptTurn[];
}

type Check = (turnIndex: number | null, quote: string | null) => boolean;

function checkerFor(turns: readonly TranscriptTurn[] | undefined): Check {
  if (!turns) return () => true;
  const byIndex = new Map(turns.map((t) => [t.index, t]));
  return (turnIndex, quote) => {
    if (turnIndex === null || quote === null) return false;
    const turn = byIndex.get(turnIndex);
    return turn?.role === 'trainee' && quoteInText(turn.text, quote);
  };
}

function conformStrength(item: StrengthItem): StrengthItem {
  const title = fitWords(item.title, 15);
  const room = Math.max(8, BUDGETS.strengthWords - wordCount(title));
  return { ...item, title, whyItHelped: fitWords(item.whyItHelped, room) };
}

function conformImprovement(item: ImprovementItem, verified: Check): ImprovementItem {
  // A quote that is not in the turn it cites is dropped, and the gap stays as something that
  // never happened.
  const kept = item.quote === null || verified(item.turnIndex, item.quote);
  return {
    ...item,
    turnIndex: kept ? item.turnIndex : null,
    quote: kept ? item.quote : null,
    risk: fitWords(item.risk, BUDGETS.riskWords),
    betterPhrasing: fitWords(item.betterPhrasing, BUDGETS.betterPhrasingWords),
  };
}

function conformBehaviour(behaviour: CareBehaviourResult, verified: Check): CareBehaviourResult {
  const evidence: Evidence[] = behaviour.evidence.filter((e) => verified(e.turnIndex, e.quote));
  if (behaviour.status !== 'not-shown' && evidence.length === 0) {
    return {
      ...behaviour,
      status: 'not-shown',
      evidence,
      note: 'A quote for this could not be checked against the call.',
    };
  }
  return { ...behaviour, evidence };
}

function conformPrinciple(principle: CarePrincipleResult, verified: Check): CarePrincipleResult {
  return {
    ...principle,
    summary: fitWords(principle.summary, BUDGETS.careSummaryWords),
    behaviours: principle.behaviours.map((b) => conformBehaviour(b, verified)),
  };
}

function conformMilestone(milestone: Milestone, verified: Check): Milestone {
  if (milestone.status !== 'reached' || verified(milestone.turnIndex, milestone.quote)) {
    return milestone;
  }
  return { ...milestone, status: 'not-reached', turnIndex: null, quote: null };
}

export function conformReport(
  report: CoachingReport,
  options: ConformOptions = {},
): CoachingReport {
  const verified = checkerFor(options.turns);
  return {
    ...report,
    summary: { ...report.summary, overall: fitWords(report.summary.overall, BUDGETS.summaryWords) },
    strengths: report.strengths
      .filter((s) => verified(s.turnIndex, s.quote))
      .slice(0, BUDGETS.maxStrengths)
      .map(conformStrength),
    improvements: report.improvements
      .slice(0, BUDGETS.maxImprovements)
      .map((i) => conformImprovement(i, verified)),
    ...(report.care ? { care: report.care.map((p) => conformPrinciple(p, verified)) } : {}),
    journey: report.journey.milestones
      ? {
          ...report.journey,
          milestones: report.journey.milestones.map((m) => conformMilestone(m, verified)),
        }
      : report.journey,
  };
}
