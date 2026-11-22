import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import type { SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import {
  Badge,
  Button,
  IconButton,
  SearchBox,
  SegmentedControl,
  Tag,
  VisuallyHidden,
  cx,
  useAnnouncer,
  type BadgeTone,
  type IconName,
} from '../../design/index.ts';
import { pluralise, skillName } from './copy.ts';
import { scrollToElement } from './dom.ts';
import { SectionLink, useEvidence } from './evidence.tsx';
import { Section } from './parts.tsx';
import { useTimelineSync } from './selection.tsx';
import {
  FILTER_FOUND,
  FILTER_LABELS,
  TRANSCRIPT_FILTERS,
  buildTranscript,
  filterCounts,
  findMatches,
  hasSpokenTurns,
  locateQuote,
  segmentText,
  shownTurns,
  turnId,
  type MarkerKind,
  type RangeKind,
  type TextMatch,
  type TextRange,
  type TranscriptFilter,
  type TurnView,
} from './transcript-model.ts';
import './transcript.css';

const MARKER_LOOK: Record<MarkerKind, { tone: BadgeTone; icon: IconName }> = {
  'mood-rose': { tone: 'frustrated', icon: 'trend-up' },
  'mood-eased': { tone: 'recovering', icon: 'trend-down' },
  'mood-changed': { tone: 'neutral', icon: 'trend-flat' },
  discovery: { tone: 'success', icon: 'lightbulb' },
  unexpected: { tone: 'warning', icon: 'flag' },
};

const NO_MATCHES: readonly TextMatch[] = [];

interface TurnRowProps {
  view: TurnView;
  /** Shown only as the customer's reply to a turn the filter found. */
  context: boolean;
  matches: readonly TextMatch[];
  /** Where the match the search is on starts in this turn, if it is in this turn. */
  currentStart: number | null;
  /** This is the turn an evidence link led to. */
  cited: boolean;
  /** The quoted words to mark in the turn, when it is the cited one. */
  quote: string | null;
  /** This is the turn the reader marked, on the timeline or by choosing it here. */
  marked: boolean;
  /** What the timeline calls the moments seen at this turn, or null. */
  moments: string | null;
  /** How the turn number marks the turn on the timeline. Not given where there is no timeline. */
  picking: TurnPicking | null;
  /** This turn's number is the one Tab stop of all the turn numbers; the others are reached with the arrow keys. */
  tabStop: boolean;
}

interface TurnPicking {
  /** Marks the turn on the timeline, or takes the mark off when it is the marked turn. */
  pick(index: number): void;
  /** The number has focus (by the pointer or the keys): it is the tab stop from now on. */
  reached(index: number): void;
  /** Up and Down, Home and End move between the turn numbers. */
  move(event: KeyboardEvent<HTMLButtonElement>): void;
}

function TurnText({
  text,
  matches,
  currentStart,
  quote,
}: Pick<TurnRowProps['view'], 'text'> & Pick<TurnRowProps, 'matches' | 'currentStart' | 'quote'>) {
  const parts = useMemo(() => {
    const ranges: (TextRange & { kind: RangeKind })[] = matches.map((m) => ({
      start: m.start,
      end: m.end,
      kind: m.start === currentStart ? 'current' : 'match',
    }));
    const located = quote ? locateQuote(text, quote) : null;
    if (located) ranges.push({ ...located, kind: 'quote' });
    return ranges.length === 0 ? null : segmentText(text, ranges);
  }, [text, matches, currentStart, quote]);

  if (!parts) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        part.quote || part.match ? (
          <mark
            key={i}
            className={cx(
              'rp-mark',
              part.quote && 'rp-mark--quote',
              part.match && 'rp-mark--match',
              part.current && 'rp-mark--current',
            )}
            {...(part.current ? { 'data-rp-current-match': '' } : {})}
          >
            {part.text}
          </mark>
        ) : (
          part.text
        ),
      )}
    </>
  );
}

const TurnRow = memo(function TurnRow({
  view,
  context,
  matches,
  currentStart,
  cited,
  quote,
  marked,
  moments,
  picking,
  tabStop,
}: TurnRowProps) {
  return (
    <li
      id={turnId(view.index)}
      tabIndex={-1}
      className={cx(
        'rp-turn',
        `rp-turn--${view.role}`,
        context && 'rp-turn--context',
        cited && 'rp-turn--cited',
        marked && 'rp-turn--marked',
      )}
    >
      <div className="rp-turn__head">
        {picking ? (
          <button
            type="button"
            className="rp-turn__pick"
            aria-pressed={marked}
            tabIndex={tabStop ? 0 : -1}
            onClick={() => picking.pick(view.index)}
            onFocus={() => picking.reached(view.index)}
            onKeyDown={picking.move}
          >
            Turn {view.index}
            <VisuallyHidden>: show on the call journey</VisuallyHidden>
          </button>
        ) : (
          <span className="rp-turn__number">Turn {view.index}</span>
        )}
        <span className="rp-turn__speaker">{view.speaker}</span>
        <span className="rp-turn__clock">
          <VisuallyHidden>at </VisuallyHidden>
          {view.clock}
        </span>
        {cited ? (
          <Badge tone="info" size="small" icon="quote">
            Cited
          </Badge>
        ) : null}
      </div>
      <p className="rp-turn__text t-reading" dir="auto">
        <TurnText text={view.text} matches={matches} currentStart={currentStart} quote={quote} />
      </p>
      {view.markers.length > 0 || view.citedFor.length > 0 || moments || marked ? (
        <ul className="rp-turn__tags" role="list">
          {view.markers.map((marker, i) => (
            <li className="rp-marker" key={`${marker.kind}-${i}`}>
              <Badge
                tone={MARKER_LOOK[marker.kind].tone}
                icon={MARKER_LOOK[marker.kind].icon}
                size="small"
              >
                {marker.tag}
              </Badge>
              <span className="rp-marker__text">{marker.text}</span>
            </li>
          ))}
          {view.citedFor.length > 0 ? (
            <li className="rp-marker rp-marker--cites">
              {view.citedFor.map((id) => (
                <Tag size="small" icon="quote" key={id}>
                  Cited for: {skillName(id)}
                </Tag>
              ))}
            </li>
          ) : null}
          {moments || marked ? (
            <li className="rp-marker">
              {moments ? (
                <Tag size="small" icon="list">
                  On the call journey: {moments}
                </Tag>
              ) : null}
              {marked ? (
                <SectionLink to="journey" className="rp-turn__tolink">
                  Show on the call journey
                </SectionLink>
              ) : null}
            </li>
          ) : null}
        </ul>
      ) : null}
    </li>
  );
});

/**
 * The whole conversation, turn by turn, with search and filters. It never changes what was said:
 * markers, citations and highlights are drawn beside and over the text, not into it. With no
 * report (while it is still being made, or when it failed) it is the plain transcript.
 */
export function TranscriptReview({
  session,
  report,
  lead,
}: {
  session: SessionDTO;
  report: CoachingReport | null;
  lead?: string;
}) {
  const { target, highlight, origin, backToOrigin, verify } = useEvidence();
  const turns = useMemo(() => buildTranscript(session, report, verify), [session, report, verify]);
  const counts = useMemo(() => filterCounts(turns), [turns]);
  const sync = useTimelineSync();
  const announce = useAnnouncer();

  const [filter, setFilter] = useState<TranscriptFilter>('all');
  const [query, setQuery] = useState('');
  const searched = useDeferredValue(query);
  const [cursor, setCursor] = useState<{ key: string; index: number } | null>(null);
  const [seenJump, setSeenJump] = useState(0);

  // Choosing a turn number marks it and selects the nearest moment on the call journey; choosing the
  // marked one again takes the mark off. The handler is kept stable so only the two turns whose mark
  // changed are drawn again.
  const latest = useRef({ sync, announce });
  useEffect(() => {
    latest.current = { sync, announce };
  });
  const pick = useCallback((index: number) => {
    const { sync: timeline, announce: say } = latest.current;
    if (!timeline) return;
    if (timeline.markedTurn === index) {
      timeline.clearMark();
      return;
    }
    const near = timeline.pickTurn(index);
    say(
      near
        ? near.turnIndex === index
          ? `Call journey: ${near.label}, turn ${index}, selected.`
          : `Call journey: ${near.label}, the nearest moment to turn ${index}, selected.`
        : `Turn ${index} marked.`,
    );
  }, []);
  const momentsAt = useMemo(() => {
    const labels = new Map<number, string>();
    for (const event of sync?.events ?? []) {
      if (event.state !== 'seen' || event.turnIndex === null) continue;
      const known = labels.get(event.turnIndex);
      labels.set(event.turnIndex, known ? `${known}, ${event.label}` : event.label);
    }
    return labels;
  }, [sync?.events]);

  // The turn numbers are one Tab stop, not one for every turn of a long call: the arrow keys, Home
  // and End move between them, and the one that last had focus is where Tab comes back to.
  const [stop, setStop] = useState<number | null>(null);
  const move = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    const numbers = [
      ...(event.currentTarget
        .closest('ol')
        ?.querySelectorAll<HTMLButtonElement>('.rp-turn__pick') ?? []),
    ];
    const from = numbers.indexOf(event.currentTarget);
    const to =
      event.key === 'ArrowDown'
        ? from + 1
        : event.key === 'ArrowUp'
          ? from - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? numbers.length - 1
              : null;
    if (to === null || from < 0) return;
    event.preventDefault();
    numbers[Math.min(numbers.length - 1, Math.max(0, to))]?.focus();
  }, []);
  const hasTimeline = sync !== null;
  const picking = useMemo<TurnPicking | null>(
    () => (hasTimeline ? { pick, reached: setStop, move } : null),
    [hasTimeline, pick, move],
  );

  // Following a link to a turn the filter hides shows every turn again, so the turn is there.
  if (target && target.nonce !== seenJump) {
    setSeenJump(target.nonce);
    const visible = shownTurns(turns, filter).some((s) => s.turn.index === target.turnIndex);
    if (!visible) setFilter('all');
  }

  const shown = useMemo(() => shownTurns(turns, filter), [turns, filter]);
  // The tab stop is the turn that last had focus, or the first turn shown when it is not shown now.
  const tabStopTurn =
    stop !== null && shown.some((s) => s.turn.index === stop)
      ? stop
      : (shown[0]?.turn.index ?? null);
  const matches = useMemo(
    () =>
      findMatches(
        shown.map((s) => s.turn),
        searched,
      ),
    [shown, searched],
  );
  const byTurn = useMemo(() => {
    const grouped = new Map<number, TextMatch[]>();
    for (const match of matches) {
      grouped.set(match.turnIndex, [...(grouped.get(match.turnIndex) ?? []), match]);
    }
    return grouped;
  }, [matches]);

  // The match the search is on belongs to one query and one filter; changing either starts over.
  const cursorKey = `${filter}\u0000${searched.trim()}`;
  const current = cursor && cursor.key === cursorKey && matches[cursor.index] ? cursor.index : null;
  const currentMatch = current === null ? null : (matches[current] ?? null);

  const step = (direction: 1 | -1) => {
    // The highlighted matches follow the box a moment late (they are deferred), and Enter can be
    // pressed in that moment, so stepping works from what is typed now, not from what is shown.
    const typed = query.trim();
    const list =
      typed === searched.trim()
        ? matches
        : findMatches(
            shown.map((s) => s.turn),
            query,
          );
    if (list.length === 0) return;
    const key = `${filter}\u0000${typed}`;
    const from = cursor && cursor.key === key && list[cursor.index] ? cursor.index : null;
    const next =
      from === null
        ? direction === 1
          ? 0
          : list.length - 1
        : (from + direction + list.length) % list.length;
    setCursor({ key, index: next });
  };

  useEffect(() => {
    if (current === null) return;
    document
      .querySelector<HTMLElement>('[data-rp-current-match]')
      ?.scrollIntoView?.({ block: 'center', inline: 'nearest' });
  }, [current, cursorKey]);

  useEffect(() => {
    if (!target) return;
    const element = document.getElementById(turnId(target.turnIndex));
    if (!element) return;
    scrollToElement(element);
    element.focus({ preventScroll: true });
  }, [target]);

  const status =
    searched.trim() === ''
      ? ''
      : matches.length === 0
        ? 'No matches'
        : currentMatch
          ? `Match ${(current ?? 0) + 1} of ${matches.length}, in turn ${currentMatch.turnIndex}`
          : pluralise(matches.length, 'match', 'matches');
  const replies = shown.filter((s) => s.context).length;
  const hasReport = report !== null;
  const spoken = hasSpokenTurns(session);

  return (
    <Section id="transcript" title="Transcript">
      <p className="rp-transcript__lead">
        {lead ?? 'The conversation as it was saved. Nothing has been edited.'}
        {sync ? ' Choose a turn number to show it on the call journey.' : ''}
        {spoken
          ? ' Spoken turns were transcribed automatically and may contain recognition errors.'
          : ''}
      </p>
      <div className="rp-tools">
        <div className="rp-find">
          <div className="rp-find__box">
            <SearchBox
              label="Find in transcript"
              placeholder="Find in transcript"
              value={query}
              onChange={setQuery}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                step(event.shiftKey ? -1 : 1);
              }}
            />
          </div>
          <div className="rp-find__nav">
            <IconButton
              icon="chevron-up"
              label="Previous match"
              appearance="secondary"
              disabled={matches.length === 0}
              onClick={() => step(-1)}
            />
            <IconButton
              icon="chevron-down"
              label="Next match"
              appearance="secondary"
              disabled={matches.length === 0}
              onClick={() => step(1)}
            />
          </div>
          <p className="rp-find__count" role="status">
            {status}
          </p>
        </div>
        {hasReport ? (
          <SegmentedControl
            legend="Filter the transcript"
            hideLegend
            size="small"
            value={filter}
            onChange={setFilter}
            options={TRANSCRIPT_FILTERS.map((value) => ({
              value,
              label: `${FILTER_LABELS[value]} (${counts[value]})`,
              disabled: value !== 'all' && counts[value] === 0,
            }))}
          />
        ) : null}
      </div>
      {filter !== 'all' ? (
        <p className="rp-shown t-meta" role="status">
          Showing {pluralise(counts[filter], 'turn')} {FILTER_FOUND[filter]}
          {replies > 0 ? ', each with the customer\u2019s reply' : ''}.
        </p>
      ) : null}

      <ol className="rp-turns" role="list" aria-label="Transcript">
        {shown.map(({ turn, context }) => {
          const isCited = highlight?.turnIndex === turn.index;
          return (
            <TurnRow
              key={turn.index}
              view={turn}
              context={context}
              matches={byTurn.get(turn.index) ?? NO_MATCHES}
              currentStart={currentMatch?.turnIndex === turn.index ? currentMatch.start : null}
              cited={isCited}
              quote={isCited ? highlight.quote : null}
              marked={sync?.markedTurn === turn.index}
              moments={momentsAt.get(turn.index) ?? null}
              picking={picking}
              tabStop={tabStopTurn === turn.index}
            />
          );
        })}
      </ol>

      {origin && target ? (
        <div className="rp-back no-print">
          <Button
            appearance="primary"
            icon="arrow-up"
            className="rp-back__button"
            onClick={backToOrigin}
          >
            Back to {origin.label}
          </Button>
        </div>
      ) : null}
    </Section>
  );
}
