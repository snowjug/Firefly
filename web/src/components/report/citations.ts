import type { CoachingReport } from '#shared/domain/report.ts';
import { DIMENSIONS } from '#shared/domain/vocab.ts';

/**
 * Which transcript turns the report points at, with short reasons ("Evidence: Empathy").
 * Used to mark those turns in the transcript. Turn numbers are 1-based, like the transcript.
 */
export function citedTurns(report: CoachingReport | null): Map<number, string[]> {
  const cited = new Map<number, string[]>();
  if (!report) return cited;
  const add = (turn: number | null | undefined, label: string) => {
    if (!turn || turn < 1) return;
    const labels = cited.get(turn) ?? [];
    if (!labels.includes(label)) labels.push(label);
    cited.set(turn, labels);
  };
  for (const dimension of report.dimensions) {
    for (const item of dimension.evidence) {
      add(item.turnIndex, `Evidence: ${DIMENSIONS[dimension.id].short}`);
    }
  }
  for (const item of report.strengths) {
    add(item.turnIndex, `Went well: ${DIMENSIONS[item.dimension].short}`);
  }
  for (const item of report.improvements) {
    add(item.turnIndex, `To improve: ${DIMENSIONS[item.dimension].short}`);
  }
  for (const fact of report.discovery.results) {
    add(fact.revealedAtTurn, `Discovery: ${fact.label}`);
  }
  for (const point of report.journey.points) {
    if (point.kind === 'turning-point') add(point.turnIndex, 'Turning point');
    if (point.kind === 'curveball') add(point.turnIndex, 'Curveball');
  }
  if (report.curveball) add(report.curveball.firedAtTurn, 'Curveball');
  return cited;
}

/** The turn a link points at: `?turn=7` first, then `#turn-7`. */
export function linkedTurn(search: URLSearchParams, hash: string): number | null {
  const raw = search.get('turn');
  if (raw !== null && /^\d+$/.test(raw) && Number(raw) >= 1) return Number(raw);
  const match = /^#turn-(\d+)$/.exec(hash);
  return match && Number(match[1]) >= 1 ? Number(match[1]) : null;
}
