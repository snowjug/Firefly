import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { TurnDTO } from '#shared/domain/api.ts';
import { formatTime } from '../../lib/format.ts';
import { estimateHeight, spineSegment } from '../call/spine-model.ts';
import { markQuotes, type Citation } from './citations.ts';
import { describeMarker } from './markers.ts';
import { MarkGlyph, StarMark } from './marks.tsx';
import type { TurnLine } from './turn-lines.ts';

// The evidence lens: the whole conversation typeset the way the call chamber sets it. Who spoke, which
// turn and when in a mono margin; the customer's filament down the page, drawn from how composed
// they were at each moment; the words in serif, the customer's large and the learner's italic and
// receding. What the report knows about a turn is set around it: the words it quotes underlined, the
// reasons it cites the turn in the margin, a star where a hidden fact came out, a jog where a
// curveball landed. Every one of those has words as well as a shape.

/** One turn's stretch of filament. Drawn once from the customer's mood at that moment. */
function Spine({ turn, line }: { turn: TurnDTO; line: TurnLine }) {
  const stretch = useMemo(
    () =>
      spineSegment({
        mood: line.band?.id ?? 'neutral',
        easing: line.easing,
        kink: line.kink,
        seed: `turn-${turn.index}`,
        height: estimateHeight(turn.text, turn.role),
      }),
    [line.band?.id, line.easing, line.kink, turn.index, turn.text, turn.role],
  );
  return (
    <svg
      className="tx-spine"
      viewBox="0 0 44 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={stretch.d}
        strokeWidth={stretch.weight}
        strokeLinejoin={stretch.join}
        strokeDasharray={stretch.dash ?? undefined}
      />
    </svg>
  );
}

/**
 * A thin line from the filament's point for this turn to the first words the report quotes from it,
 * drawn once when the turn is arrived at from the report and gone a moment later. Purely a
 * drawing: moving focus to the turn is the real feedback, and the quoted words stay underlined.
 * It is measured and set directly on the SVG, so it costs no render.
 */
function Trace({ turn }: { turn: number }) {
  const svg = useRef<SVGSVGElement>(null);
  const path = useRef<SVGPathElement>(null);
  useLayoutEffect(() => {
    const el = svg.current;
    const line = path.current;
    const item = el?.closest<HTMLElement>('li');
    const node = item?.querySelector<HTMLElement>('.tx-turn__mark');
    // The quoted words, or the start of the turn when the report quotes all of it.
    const quote =
      item?.querySelector<HTMLElement>('mark.tx-quote') ??
      item?.querySelector<HTMLElement>('.tx-turn__text');
    if (!el || !line || !item || !node || !quote) return;
    const box = item.getBoundingClientRect();
    const from = node.getBoundingClientRect();
    const first = quote.getClientRects()[0] ?? quote.getBoundingClientRect();
    const x0 = from.left + from.width / 2 - box.left;
    const y0 = from.top + from.height / 2 - box.top;
    const x1 = first.left - box.left - 6;
    const y1 = first.top + first.height * 0.62 - box.top;
    const bend = x0 + (x1 - x0) * 0.5;
    el.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    line.setAttribute('d', y1 - y0 < 4 ? `M${x0} ${y0}H${x1}` : `M${x0} ${y0}H${bend}V${y1}H${x1}`);
    el.setAttribute('data-ready', '');
  }, [turn]);
  return (
    <svg ref={svg} className="tx-trace" aria-hidden="true" focusable="false">
      <path ref={path} pathLength={1} />
    </svg>
  );
}

const TurnItem = memo(function TurnItem({
  turn,
  customerName,
  line,
  citations,
  showMarkers,
  linked,
}: {
  turn: TurnDTO;
  customerName: string;
  line: TurnLine;
  citations: readonly Citation[] | undefined;
  showMarkers: boolean;
  linked: boolean;
}) {
  const isCustomer = turn.role === 'customer';
  const markers = showMarkers ? (turn.markers ?? []) : [];
  const cited = showMarkers && citations !== undefined && citations.length > 0;
  const reasons = cited ? [...new Set(citations.map((citation) => citation.label))] : [];
  const quotes = cited
    ? citations.flatMap((citation) => (citation.quote ? [citation.quote] : []))
    : [];
  const quotesKey = quotes.join('\u0000');
  const pieces = useMemo(
    () => markQuotes(turn.text, quotesKey ? quotesKey.split('\u0000') : []),
    [turn.text, quotesKey],
  );
  const mood = showMarkers ? line.band : null;
  const signal = showMarkers && line.signal;
  const number = String(turn.index);
  return (
    <li
      id={`turn-${turn.index}`}
      tabIndex={-1}
      className="tx-turn"
      data-role={turn.role}
      data-mood={mood?.id}
      data-cited={cited ? 'true' : undefined}
      data-linked={linked ? 'true' : undefined}
      data-signal={signal || undefined}
      data-shift={showMarkers && line.kink ? 'true' : undefined}
      aria-current={linked ? 'location' : undefined}
    >
      <p className="tx-turn__label">
        <span className="tx-turn__who">
          {isCustomer ? (
            <>
              <span className="sr-only">Customer {'\u2013'} </span>
              {customerName}
            </>
          ) : (
            'You'
          )}
        </span>
        <span className="tx-turn__where">
          Turn {number}
          <span aria-hidden="true"> &middot; </span>
          <time dateTime={turn.createdAt}>{formatTime(turn.createdAt)}</time>
        </span>
        {mood && isCustomer ? <span className="tx-turn__mood">{mood.label}</span> : null}
      </p>
      <div className="tx-turn__spine" aria-hidden="true">
        <Spine
          turn={turn}
          line={showMarkers ? line : { ...line, band: null, easing: false, kink: false }}
        />
        <span className="tx-turn__mark">
          {signal ? <StarMark size={16} className="tx-star" /> : null}
        </span>
      </div>
      <div className="tx-turn__body">
        <p className="tx-turn__text">
          {pieces.map((piece, index) =>
            piece.quoted ? (
              <mark key={index} className="tx-quote">
                {piece.text}
              </mark>
            ) : (
              piece.text
            ),
          )}
        </p>
        {linked ? <Trace turn={turn.index} /> : null}
      </div>
      <div className="tx-turn__notes">
        {cited ? (
          <>
            <p className="tx-tag" data-kind="cited">
              Cited in report
            </p>
            <ul role="list" className="tx-cites" aria-label="Where the report uses this turn">
              {reasons.map((label) => (
                <li key={label} className="tx-cite">
                  {label}
                </li>
              ))}
            </ul>
          </>
        ) : linked ? (
          <p className="tx-tag" data-kind="linked">
            Linked turn
          </p>
        ) : null}
        {markers.length > 0 ? (
          <ul role="list" className="tx-markers" aria-label="Analysis markers">
            {markers.map((marker, index) => {
              const view = describeMarker(marker);
              return (
                <li key={`${marker.kind}-${index}`} className="tx-marker" data-tone={view.tone}>
                  <MarkGlyph shape={view.shape} size={14} />
                  <span>{view.text}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </li>
  );
});

/**
 * The conversation as a semantic ordered list, set as a page. Each turn has an id (`turn-N`) that
 * links from the report land on; the linked turn is scrolled into view, focused and marked.
 */
export function TranscriptList({
  turns,
  customerName,
  lines,
  citations,
  showMarkers,
  linked,
}: {
  turns: readonly TurnDTO[];
  customerName: string;
  /** What the filament is drawn from, one for each turn. */
  lines: readonly TurnLine[];
  citations: ReadonlyMap<number, Citation[]>;
  showMarkers: boolean;
  linked: number | null;
}) {
  useEffect(() => {
    if (linked === null) return;
    const element = document.getElementById(`turn-${linked}`);
    if (!element) return;
    element.scrollIntoView?.({ block: 'center' });
    element.focus({ preventScroll: true });
  }, [linked]);

  return (
    <ol role="list" className="tx-list" aria-label="Conversation">
      {turns.map((turn, index) => (
        <TurnItem
          key={turn.index}
          turn={turn}
          customerName={customerName}
          line={lines[index] ?? { band: null, easing: false, kink: false, signal: false }}
          citations={citations.get(turn.index)}
          showMarkers={showMarkers}
          linked={linked === turn.index}
        />
      ))}
    </ol>
  );
}
