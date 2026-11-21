import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react';
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
  type BadgeTone,
  type IconName,
} from '../../design/index.ts';
import { pluralise, skillName } from './copy.ts';
import { scrollToElement } from './dom.ts';
import { useEvidence } from './evidence.tsx';
import { Section } from './parts.tsx';
import {
  FILTER_FOUND,
  FILTER_LABELS,
  TRANSCRIPT_FILTERS,
  buildTranscript,
  filterCounts,
  findMatches,
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
      )}
    >
      <div className="rp-turn__head">
        <span className="rp-turn__number">Turn {view.index}</span>
        <span className="rp-turn__speaker">{view.speaker}</span>
        <span className="rp-turn__clock">
          <VisuallyHidden>at </VisuallyHidden>
          {view.clock}
        </span>
        {view.spoken ? (
          <Tag size="small" icon="microphone">
            Spoken
          </Tag>
        ) : null}
        {cited ? (
          <Badge tone="info" size="small" icon="quote">
            Cited
          </Badge>
        ) : null}
      </div>
      <p className="rp-turn__text t-reading" dir="auto">
        <TurnText text={view.text} matches={matches} currentStart={currentStart} quote={quote} />
      </p>
      {view.markers.length > 0 || view.citedFor.length > 0 ? (
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
  const turns = useMemo(() => buildTranscript(session, report), [session, report]);
  const counts = useMemo(() => filterCounts(turns), [turns]);
  const { target, origin, backToOrigin } = useEvidence();

  const [filter, setFilter] = useState<TranscriptFilter>('all');
  const [query, setQuery] = useState('');
  const searched = useDeferredValue(query);
  const [cursor, setCursor] = useState<{ key: string; index: number } | null>(null);
  const [seenJump, setSeenJump] = useState(0);

  // Following a link to a turn the filter hides shows every turn again, so the turn is there.
  if (target && target.nonce !== seenJump) {
    setSeenJump(target.nonce);
    const visible = shownTurns(turns, filter).some((s) => s.turn.index === target.turnIndex);
    if (!visible) setFilter('all');
  }

  const shown = useMemo(() => shownTurns(turns, filter), [turns, filter]);
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

  return (
    <Section
      id="transcript"
      title="Transcript"
      lead={lead ?? 'The full conversation as it was saved. Nothing here has been edited.'}
    >
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
          const isTarget = target?.turnIndex === turn.index;
          return (
            <TurnRow
              key={turn.index}
              view={turn}
              context={context}
              matches={byTurn.get(turn.index) ?? NO_MATCHES}
              currentStart={currentMatch?.turnIndex === turn.index ? currentMatch.start : null}
              cited={isTarget}
              quote={isTarget ? target.quote : null}
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
