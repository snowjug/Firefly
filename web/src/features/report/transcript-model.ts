import type { SessionDTO, TurnMarker } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { fold } from '#shared/domain/text.ts';
import { DIMENSION_IDS, type DimensionId } from '#shared/domain/vocab.ts';
import { formatClock } from '../../lib/format.ts';
import { plainUnexpectedTurn, unexpectedTurnDetail } from './copy.ts';

// The transcript as the review sees it: every turn exactly as it was said, with what the report
// says about it. Pure functions, so the rules for filters, search and evidence are easy to test.

export const TRANSCRIPT_FILTERS = ['all', 'evidence', 'discovery', 'mood', 'unexpected'] as const;
export type TranscriptFilter = (typeof TRANSCRIPT_FILTERS)[number];

export const FILTER_LABELS: Record<TranscriptFilter, string> = {
  all: 'All turns',
  evidence: 'Evidence',
  discovery: 'Discovered facts',
  mood: 'Mood changes',
  unexpected: 'Unexpected turn',
};

/** What a filter found, finishing "Showing 4 turns ...". */
export const FILTER_FOUND: Record<Exclude<TranscriptFilter, 'all'>, string> = {
  evidence: 'cited as evidence',
  discovery: 'where a hidden fact was uncovered',
  mood: 'that changed the customer\u2019s mood',
  unexpected: 'around an unexpected turn',
};

export type MarkerKind = 'mood-rose' | 'mood-eased' | 'mood-changed' | 'discovery' | 'unexpected';

export interface MarkerView {
  kind: MarkerKind;
  /** The short label on the tag: "Mood: rose", "Fact uncovered". */
  tag: string;
  /** What the engine recorded, in words. */
  text: string;
}

export interface TurnView {
  index: number;
  role: 'customer' | 'trainee';
  speaker: string;
  /** Time since the call started, as m:ss. */
  clock: string;
  text: string;
  spoken: boolean;
  markers: MarkerView[];
  /** The skills whose evidence, strengths or opportunities quote this turn. */
  citedFor: DimensionId[];
}

export const turnId = (index: number): string => `turn-${index}`;

function markerView(marker: TurnMarker): MarkerView {
  if (marker.kind === 'discovery') {
    const partly = /^partly uncovered:/i.test(marker.label);
    return {
      kind: 'discovery',
      tag: partly ? 'Fact partly uncovered' : 'Fact uncovered',
      text: marker.label.replace(/^(?:partly uncovered|uncovered):\s*/i, ''),
    };
  }
  if (marker.kind === 'curveball') {
    return { kind: 'unexpected', tag: 'Unexpected turn', text: unexpectedTurnDetail(marker.label) };
  }
  const delta = marker.delta ?? 0;
  const kind: MarkerKind = delta > 0 ? 'mood-rose' : delta < 0 ? 'mood-eased' : 'mood-changed';
  const tag =
    kind === 'mood-rose' ? 'Mood: rose' : kind === 'mood-eased' ? 'Mood: eased' : 'Mood: changed';
  return { kind, tag, text: plainUnexpectedTurn(marker.label) };
}

/** Says whether the trainee really said `quote` in turn `turnIndex`: the only quote that counts as evidence. */
export type QuoteCheck = (turnIndex: number, quote: string) => boolean;

/**
 * Which skills cite which turns: the evidence quotes, the strengths and the opportunities. A
 * quote the turn does not say does not make the turn cited, the same rule as on the report itself.
 * An opportunity that points at a turn without quoting it still cites the turn.
 */
export function citedTurns(
  report: CoachingReport | null,
  verify: QuoteCheck,
): Map<number, DimensionId[]> {
  const found = new Map<number, Set<DimensionId>>();
  const add = (turnIndex: number | null, dimension: DimensionId) => {
    if (turnIndex === null) return;
    const set = found.get(turnIndex) ?? new Set<DimensionId>();
    set.add(dimension);
    found.set(turnIndex, set);
  };
  if (report) {
    for (const d of report.dimensions) {
      for (const e of d.evidence) if (verify(e.turnIndex, e.quote)) add(e.turnIndex, d.id);
    }
    for (const s of report.strengths)
      if (verify(s.turnIndex, s.quote)) add(s.turnIndex, s.dimension);
    for (const i of report.improvements) {
      if (i.turnIndex !== null && (!i.quote || verify(i.turnIndex, i.quote))) {
        add(i.turnIndex, i.dimension);
      }
    }
  }
  return new Map(
    [...found].map(([turnIndex, set]) => [turnIndex, DIMENSION_IDS.filter((id) => set.has(id))]),
  );
}

export function clockFor(startedAt: string, createdAt: string): string {
  const seconds = (Date.parse(createdAt) - Date.parse(startedAt)) / 1000;
  return formatClock(Number.isFinite(seconds) ? seconds : 0);
}

/** One entry per turn, in order, nothing added to or removed from what was said. */
export function buildTranscript(
  session: SessionDTO,
  report: CoachingReport | null,
  verify: QuoteCheck,
): TurnView[] {
  const cited = citedTurns(report, verify);
  return session.turns.map((turn) => ({
    index: turn.index,
    role: turn.role,
    speaker: turn.role === 'trainee' ? 'You' : session.scenario.persona.name,
    clock: clockFor(session.startedAt, turn.createdAt),
    text: turn.text,
    spoken: turn.role === 'trainee' && turn.inputMode === 'voice',
    markers: (turn.markers ?? []).map(markerView),
    citedFor: cited.get(turn.index) ?? [],
  }));
}

/** True when any of the trainee's turns arrived through speech recognition. */
export const hasSpokenTurns = (session: SessionDTO): boolean =>
  session.turns.some((turn) => turn.role === 'trainee' && turn.inputMode === 'voice');

// ---- Filters --------------------------------------------------------------------------------

const matchers: Record<Exclude<TranscriptFilter, 'all'>, (turn: TurnView) => boolean> = {
  evidence: (turn) => turn.citedFor.length > 0,
  discovery: (turn) => turn.markers.some((m) => m.kind === 'discovery'),
  mood: (turn) =>
    turn.markers.some(
      (m) => m.kind === 'mood-rose' || m.kind === 'mood-eased' || m.kind === 'mood-changed',
    ),
  unexpected: (turn) => turn.markers.some((m) => m.kind === 'unexpected'),
};

export function matchesFilter(turn: TurnView, filter: TranscriptFilter): boolean {
  return filter === 'all' ? true : matchers[filter](turn);
}

/** How many turns each filter finds. */
export function filterCounts(turns: readonly TurnView[]): Record<TranscriptFilter, number> {
  return {
    all: turns.length,
    evidence: turns.filter(matchers.evidence).length,
    discovery: turns.filter(matchers.discovery).length,
    mood: turns.filter(matchers.mood).length,
    unexpected: turns.filter(matchers.unexpected).length,
  };
}

export interface ShownTurn {
  turn: TurnView;
  /** Shown only because it answers a turn the filter found (the customer's reply). */
  context: boolean;
}

// The markers sit on the trainee's turn, and what they describe shows in the customer's reply, so
// those filters keep that reply beside the turn they found.
const KEEPS_REPLY: readonly TranscriptFilter[] = ['discovery', 'mood', 'unexpected'];

/** The turns a filter shows, in transcript order. */
export function shownTurns(turns: readonly TurnView[], filter: TranscriptFilter): ShownTurn[] {
  if (filter === 'all') return turns.map((turn) => ({ turn, context: false }));
  const found = new Set(turns.filter((turn) => matchesFilter(turn, filter)).map((t) => t.index));
  const replies = new Set<number>();
  if (KEEPS_REPLY.includes(filter)) {
    for (const turn of turns) {
      if (!found.has(turn.index)) continue;
      const next = turns.find((t) => t.index === turn.index + 1);
      if (next && next.role === 'customer' && !found.has(next.index)) replies.add(next.index);
    }
  }
  return turns
    .filter((turn) => found.has(turn.index) || replies.has(turn.index))
    .map((turn) => ({ turn, context: !found.has(turn.index) }));
}

// ---- Search ---------------------------------------------------------------------------------

export interface TextRange {
  start: number;
  end: number;
}

export interface TextMatch extends TextRange {
  turnIndex: number;
}

const escapePattern = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every occurrence of `query` (ignoring case) in the turns given, in reading order. */
export function findMatches(turns: readonly TurnView[], query: string): TextMatch[] {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const pattern = new RegExp(words.map(escapePattern).join('\\s+'), 'gi');
  const matches: TextMatch[] = [];
  for (const turn of turns) {
    pattern.lastIndex = 0;
    for (let found = pattern.exec(turn.text); found; found = pattern.exec(turn.text)) {
      matches.push({
        turnIndex: turn.index,
        start: found.index,
        end: found.index + found[0].length,
      });
    }
  }
  return matches;
}

// ---- Quotes ---------------------------------------------------------------------------------

/** `fold` from the shared text helpers, one character at a time (it never returns an empty string). */
function foldCharacter(character: string): string {
  return character
    .toLowerCase()
    .replace(/[\u2018\u2019\u201a\u201b]/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/\s/g, ' ');
}

/**
 * Where a quote from the report sits in a turn, or null. A quote is checked against its turn when
 * the report is made, ignoring case, punctuation and spacing, so it is found here the same way:
 * a quote that was shortened, or that spans a line break, still lands on the right words.
 */
export function locateQuote(text: string, quote: string): TextRange | null {
  const wanted = fold(quote);
  if (wanted.length < 3) return null;
  // The turn folded the same way, remembering where each folded character came from.
  let folded = '';
  const starts: number[] = [];
  const ends: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    for (const character of foldCharacter(text.charAt(i))) {
      if (character === ' ') {
        if (folded === '') continue;
        if (folded.endsWith(' ')) {
          ends[ends.length - 1] = i + 1;
          continue;
        }
      }
      folded += character;
      starts.push(i);
      ends.push(i + 1);
    }
  }
  const at = folded.indexOf(wanted);
  if (at === -1) return null;
  const start = starts[at];
  const end = ends[at + wanted.length - 1];
  return start === undefined || end === undefined
    ? null
    : { start, end: withTrailingPunctuation(text, end, quote) };
}

const TRAILING_MARKS = /[.?!\u2026"'\u2018\u2019\u201c\u201d)\]]+$/;

/** A quote ends with the punctuation it was said with; keep it in the highlight when the turn has it too. */
function withTrailingPunctuation(text: string, end: number, quote: string): number {
  const marks = quote.trim().match(TRAILING_MARKS)?.[0] ?? '';
  let at = end;
  for (const mark of marks) {
    if (text.charAt(at) !== mark) break;
    at += 1;
  }
  return at;
}

// ---- Drawing the text -----------------------------------------------------------------------

export type RangeKind = 'quote' | 'match' | 'current';

export interface Segment {
  text: string;
  /** Inside the quoted phrase the report cites. */
  quote: boolean;
  /** Inside a match for the search. */
  match: boolean;
  /** Inside the match the search is currently on. */
  current: boolean;
}

/** The turn's text cut at every edge of every highlight, so each piece has one look. */
export function segmentText(
  text: string,
  ranges: readonly (TextRange & { kind: RangeKind })[],
): Segment[] {
  const usable = ranges.filter((r) => r.start < r.end && r.start >= 0 && r.end <= text.length);
  const edges = [...new Set([0, text.length, ...usable.flatMap((r) => [r.start, r.end])])].sort(
    (a, b) => a - b,
  );
  const segments: Segment[] = [];
  for (let i = 0; i < edges.length - 1; i += 1) {
    const start = edges[i] as number;
    const end = edges[i + 1] as number;
    const covering = usable.filter((r) => r.start <= start && r.end >= end);
    segments.push({
      text: text.slice(start, end),
      quote: covering.some((r) => r.kind === 'quote'),
      match: covering.some((r) => r.kind === 'match' || r.kind === 'current'),
      current: covering.some((r) => r.kind === 'current'),
    });
  }
  return segments;
}
