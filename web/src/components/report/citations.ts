import type { CoachingReport } from '#shared/domain/report.ts';
import { DIMENSIONS } from '#shared/domain/vocab.ts';

/** One reason the report points at a turn, and the words it quotes from it when it quotes any. */
export interface Citation {
  label: string;
  quote: string | null;
}

/**
 * Which transcript turns the report points at, with the reason and the quoted words for each
 * ("Evidence: Empathy", "I will call you back by 3pm."). Turn numbers are 1-based, like the
 * transcript. The order is the report's own: skills, strengths, opportunities, discovery, turning
 * points, the curveball.
 */
export function citationsByTurn(report: CoachingReport | null): Map<number, Citation[]> {
  const cited = new Map<number, Citation[]>();
  if (!report) return cited;
  const add = (turn: number | null | undefined, label: string, quote?: string | null) => {
    if (!turn || turn < 1) return;
    const words = quote?.trim() ? quote.trim() : null;
    const list = cited.get(turn) ?? [];
    if (!list.some((item) => item.label === label && item.quote === words)) {
      list.push({ label, quote: words });
    }
    cited.set(turn, list);
  };
  for (const dimension of report.dimensions) {
    for (const item of dimension.evidence) {
      add(item.turnIndex, `Evidence: ${DIMENSIONS[dimension.id].short}`, item.quote);
    }
  }
  for (const item of report.strengths) {
    add(item.turnIndex, `Went well: ${DIMENSIONS[item.dimension].short}`, item.quote);
  }
  for (const item of report.improvements) {
    add(item.turnIndex, `To improve: ${DIMENSIONS[item.dimension].short}`, item.quote);
  }
  for (const fact of report.discovery.results) {
    add(fact.revealedAtTurn, `Discovery: ${fact.label}`, fact.revealingQuestion);
  }
  for (const point of report.journey.points) {
    if (point.kind === 'turning-point') add(point.turnIndex, 'Turning point', point.quote);
    if (point.kind === 'curveball') add(point.turnIndex, 'Curveball');
  }
  if (report.curveball) add(report.curveball.firedAtTurn, 'Curveball');
  return cited;
}

/** Just the reasons ("Evidence: Empathy"), once each, for marking the cited turns. */
export function citedTurns(report: CoachingReport | null): Map<number, string[]> {
  const labels = new Map<number, string[]>();
  for (const [turn, citations] of citationsByTurn(report)) {
    const unique: string[] = [];
    for (const { label } of citations) if (!unique.includes(label)) unique.push(label);
    labels.set(turn, unique);
  }
  return labels;
}

/** The turn a link points at: `?turn=7` first, then `#turn-7`. */
export function linkedTurn(search: URLSearchParams, hash: string): number | null {
  const raw = search.get('turn');
  if (raw !== null && /^\d+$/.test(raw) && Number(raw) >= 1) return Number(raw);
  const match = /^#turn-(\d+)$/.exec(hash);
  return match && Number(match[1]) >= 1 ? Number(match[1]) : null;
}

// ---------------------------------------------------------------------------------------
// Finding the quoted words inside a turn

export interface TextPiece {
  text: string;
  /** The report quotes these words. */
  quoted: boolean;
}

const SINGLE_MARKS = /[\u2018\u2019\u02BC\u201A]/g;
const DOUBLE_MARKS = /[\u201C\u201D\u201E]/g;
const DASHES = /[\u2010-\u2015\u2212]/g;

/**
 * The text with whitespace folded to single spaces, case and the shape of quote marks ignored, and
 * for each folded character the place it came from. A report quotes what was said, but a model
 * evaluator may tidy spacing and quote marks, so the match is made on this folded form.
 */
function fold(text: string): { folded: string; from: number[] } {
  let folded = '';
  const from: number[] = [];
  let space = false;
  for (let i = 0; i < text.length; i += 1) {
    const raw = text[i] as string;
    if (/\s/.test(raw)) {
      if (folded !== '' && !space) {
        folded += ' ';
        from.push(i);
      }
      space = true;
      continue;
    }
    space = false;
    folded += raw
      .toLowerCase()
      .replace(SINGLE_MARKS, "'")
      .replace(DOUBLE_MARKS, '"')
      .replace(DASHES, '-');
    from.push(i);
  }
  if (folded.endsWith(' ')) {
    folded = folded.slice(0, -1);
    from.pop();
  }
  return { folded, from };
}

const stripEllipsis = (quote: string) =>
  quote
    .trim()
    .replace(/^(?:\u2026|\.{3})\s*/, '')
    .replace(/\s*(?:\u2026|\.{3})$/, '');

/**
 * Splits a turn's text into the words the report quotes and the words around them. A quote is
 * found at its first place in the text; one that cannot be found (it was shortened, or it belongs
 * to another turn) leaves the text whole. Overlapping quotes become one stretch.
 */
export function markQuotes(text: string, quotes: readonly string[]): TextPiece[] {
  const { folded, from } = fold(text);
  const ranges: [number, number][] = [];
  for (const raw of quotes) {
    const wanted = fold(stripEllipsis(raw)).folded;
    if (wanted.length < 2) continue;
    const at = folded.indexOf(wanted);
    if (at === -1) continue;
    const start = from[at] as number;
    const end = (from[at + wanted.length - 1] as number) + 1;
    ranges.push([start, end]);
  }
  if (ranges.length === 0) return [{ text, quoted: false }];
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }
  // Quoting the whole turn says nothing about which words: the turn's own tag says it is cited.
  const only = merged.length === 1 ? merged[0] : undefined;
  if (only && text.slice(0, only[0]).trim() === '' && text.slice(only[1]).trim() === '') {
    return [{ text, quoted: false }];
  }
  const pieces: TextPiece[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) pieces.push({ text: text.slice(cursor, start), quoted: false });
    pieces.push({ text: text.slice(start, end), quoted: true });
    cursor = end;
  }
  if (cursor < text.length) pieces.push({ text: text.slice(cursor), quoted: false });
  return pieces;
}
