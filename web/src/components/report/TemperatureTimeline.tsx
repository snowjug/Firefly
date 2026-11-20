import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import type { JourneyPoint } from '#shared/domain/report.ts';
import { useMediaQuery } from '../../lib/hooks.ts';
import { Icon } from '../Icon.tsx';
import { FrozenPresence } from './bridge.tsx';
import { EvidenceQuote } from './EvidenceQuote.tsx';
import {
  filamentPieces,
  foundBy,
  placeDiscoveries,
  trendOf,
  type JourneyDiscovery,
  type PlacedDiscovery,
} from './journey-model.ts';
import { starPath } from './marks.tsx';
import {
  BANDS,
  KIND_LEGEND,
  buildMoments,
  defaultSelection,
  journeyAriaLabel,
  layoutChart,
  planLabels,
  planTicks,
  summariseJourney,
  type Moment,
  type PointKind,
} from './timeline-model.ts';
import { useElementWidth } from './useElementWidth.ts';
import { usePrinting } from './usePrinting.ts';

const LEGEND_ORDER: PointKind[] = ['start', 'turn', 'turning-point', 'curveball', 'end'];

/**
 * A different shape for each kind of point, so colour is never the only cue: a ring for the start,
 * a dot for a reply, a diamond for a turning point, a triangle for a curveball, a square for the
 * end. The colour (the mood the customer was in) comes from the CSS around it.
 */
export function Marker({
  kind,
  x,
  y,
  size,
}: {
  kind: PointKind;
  x: number;
  y: number;
  size: number;
}) {
  switch (kind) {
    case 'start':
      return (
        <g className="tl-m">
          <circle cx={x} cy={y} r={size + 0.5} className="tl-m-ring" />
          <circle cx={x} cy={y} r={size * 0.38} className="tl-m-fill" />
        </g>
      );
    case 'turn':
      return <circle cx={x} cy={y} r={size * 0.62} className="tl-m tl-m-fill" />;
    case 'turning-point': {
      const s = size * 0.95;
      return (
        <rect
          x={x - s}
          y={y - s}
          width={s * 2}
          height={s * 2}
          transform={`rotate(45 ${x} ${y})`}
          className="tl-m tl-m-fill"
        />
      );
    }
    case 'curveball': {
      const w = size * 1.25;
      return (
        <polygon
          points={`${x},${y - size * 1.3} ${x + w},${y + size * 0.85} ${x - w},${y + size * 0.85}`}
          className="tl-m tl-m-fill"
        />
      );
    }
    case 'end': {
      const s = size * 0.85;
      return (
        <rect x={x - s} y={y - s} width={s * 2} height={s * 2} rx={2} className="tl-m tl-m-fill" />
      );
    }
  }
}

function Legend({ moments, signals }: { moments: readonly Moment[]; signals: boolean }) {
  const present = new Set(moments.map((m) => m.point.kind));
  return (
    <ul role="list" className="tl-legend" aria-label="Point shapes">
      {LEGEND_ORDER.filter((kind) => present.has(kind)).map((kind) => (
        <li key={kind}>
          <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true" focusable="false">
            <Marker kind={kind} x={9} y={9} size={5} />
          </svg>
          {KIND_LEGEND[kind]}
        </li>
      ))}
      {signals ? (
        <li>
          <svg
            width={18}
            height={18}
            viewBox="-9 -9 18 18"
            aria-hidden="true"
            focusable="false"
            className="tl-legend__star"
          >
            <path d={starPath(7)} />
          </svg>
          Signal found
        </li>
      ) : null}
    </ul>
  );
}

function DetailPanel({
  moment,
  total,
  href,
  signals,
  presence,
  onStep,
}: {
  moment: Moment;
  total: number;
  href: string;
  /** The hidden facts that came out at this moment. */
  signals: readonly PlacedDiscovery[];
  presence: { found: number; facts: number; size: number };
  onStep(delta: -1 | 1): void;
}) {
  const { point } = moment;
  const noQuote =
    point.kind === 'curveball'
      ? 'The customer raised this themselves, so there is nothing of yours to quote.'
      : point.kind === 'start'
        ? 'The call began here.'
        : 'No single phrase stands out for this moment.';
  return (
    <div className="tl-panel" role="group" aria-label="Selected moment">
      <div className="tl-panel__presence" aria-hidden="true">
        <FrozenPresence
          band={moment.band}
          trend={trendOf(moment.direction)}
          found={presence.found}
          facts={presence.facts}
          size={presence.size}
        />
      </div>
      <div aria-live="polite" aria-atomic="true" className="tl-panel__body">
        <div className="tl-panel__head">
          <p className="tl-panel__turn">Turn {moment.turn}</p>
          <p className="tl-panel__count tabular">
            Point {moment.index + 1} of {total}
          </p>
          {moment.kindLabel ? <p className="tl-panel__kind">{moment.kindLabel}</p> : null}
        </div>
        <p className="tl-panel__band">
          <span className="tl-dot" data-band={moment.band.id} aria-hidden="true" />
          <strong>{moment.band.label}</strong>
          <span className="tl-panel__change">{moment.change}</span>
        </p>
        {point.reason ? (
          <div className="tl-panel__block">
            <p className="type-label">Why it moved</p>
            <p>{point.reason}</p>
          </div>
        ) : null}
        <div className="tl-panel__block">
          <p className="type-label">What you said</p>
          {point.quote ? (
            <EvidenceQuote quote={point.quote} tone="accent" />
          ) : (
            <p className="rp-quiet">{noQuote}</p>
          )}
        </div>
        {signals.length > 0 ? (
          <ul role="list" className="tl-panel__signals">
            {signals.map((signal) => (
              <li key={`${signal.turn}-${signal.label}`}>
                <svg
                  width={14}
                  height={14}
                  viewBox="-8 -8 16 16"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d={starPath(7.5)} />
                </svg>
                {signal.status === 'partial' ? 'Signal found in part' : 'Signal found'}:{' '}
                {signal.label}
              </li>
            ))}
          </ul>
        ) : null}
        <Link to={href} className="tl-panel__link text-link" viewTransition>
          View in transcript <Icon name="arrow-right" size={16} />
        </Link>
      </div>
      <div className="tl-stepper">
        <button
          type="button"
          className="action action--quiet action--compact"
          aria-label="Previous moment"
          aria-disabled={moment.index === 0}
          onClick={() => onStep(-1)}
        >
          <Icon name="arrow-left" size={16} />
          Previous
        </button>
        <button
          type="button"
          className="action action--quiet action--compact"
          aria-label="Next moment"
          aria-disabled={moment.index === total - 1}
          onClick={() => onStep(1)}
        >
          Next
          <Icon name="arrow-right" size={16} />
        </button>
      </div>
    </div>
  );
}

function MoodTable({
  moments,
  turnHref,
  id,
}: {
  moments: readonly Moment[];
  turnHref: (turn: number) => string;
  id: string;
}) {
  return (
    <div id={id} className="tl-table-wrap">
      <table className="tl-table">
        <caption className="sr-only">Customer mood at each point in the call</caption>
        <thead>
          <tr>
            <th scope="col">Turn</th>
            <th scope="col">Customer mood</th>
            <th scope="col" className="tl-col-change">
              Change
            </th>
            <th scope="col">What moved it</th>
          </tr>
        </thead>
        <tbody>
          {moments.map((m) => (
            <tr key={`${m.turn}-${m.index}`}>
              <th scope="row">
                <Link to={turnHref(m.turn)} className="text-link" viewTransition>
                  Turn {m.turn}
                </Link>
              </th>
              <td>
                <span className="tl-cell-band">
                  <span className="tl-dot" data-band={m.band.id} aria-hidden="true" />
                  {m.band.label}
                </span>
                <span className="tl-narrow-only"> &middot; {m.directionLabel}</span>
              </td>
              <td className="tl-col-change">{m.directionLabel}</td>
              <td>{m.point.reason ?? '\u2013'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Timeline({
  moments,
  turnHref,
  discoveries,
  facts,
}: {
  moments: readonly Moment[];
  turnHref: (turn: number) => string;
  discoveries: readonly JourneyDiscovery[];
  facts: number;
}) {
  const uid = useId().replace(/:/g, '');
  const [plotRef, width] = useElementWidth<HTMLDivElement>(640);
  const roomy = useMediaQuery('(min-width: 720px)');
  const layout = useMemo(() => layoutChart(moments, width), [moments, width]);
  const labels = useMemo(() => planLabels(moments, layout), [moments, layout]);
  const labelsByMoment = useMemo(
    () => new Map(labels.map((label) => [label.index, label])),
    [labels],
  );
  const ticks = useMemo(() => planTicks(moments, layout), [moments, layout]);
  const pieces = useMemo(
    () => filamentPieces(moments, layout.xs, layout.ys),
    [moments, layout.xs, layout.ys],
  );
  const placed = useMemo(
    () => placeDiscoveries(discoveries, moments, layout.xs, layout.ys),
    [discoveries, moments, layout.xs, layout.ys],
  );
  const [selected, setSelected] = useState(() => defaultSelection(moments));
  const [roving, setRoving] = useState(selected);
  const [showTable, setShowTable] = useState(false);
  const printing = usePrinting();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const count = moments.length;
  const current = moments[Math.min(selected, count - 1)] as Moment;
  const summary = summariseJourney(moments);
  const choose = (index: number) => {
    setSelected(index);
    setRoving(index);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
      next = Math.min(count - 1, index + 1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = Math.max(0, index - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = count - 1;
    else return;
    event.preventDefault();
    setRoving(next);
    buttons.current[next]?.focus();
  };
  const step = (delta: -1 | 1) => {
    const next = current.index + delta;
    if (next >= 0 && next < count) choose(next);
  };

  const { plot, xs, ys } = layout;
  const plotHeight = plot.bottom - plot.top;
  const sliceWidth = Math.min(44, Math.max(8, layout.step || 44));
  const tableId = `tl-table-${uid}`;
  const tableOpen = showTable || printing;
  const here = placed.filter((signal) => signal.moment === current.index);

  return (
    <div className="tl" data-compact={layout.compact || undefined}>
      <div className="tl-bar">
        <p className="tl-summary">{`${summary.charAt(0).toUpperCase()}${summary.slice(1)}.`}</p>
        <button
          type="button"
          className="rp-link tl-toggle"
          aria-expanded={tableOpen}
          aria-controls={tableId}
          onClick={() => setShowTable((v) => !v)}
        >
          <Icon name="grid" size={16} />
          {tableOpen ? 'Hide table' : 'Show as table'}
        </button>
      </div>

      <div className="tl-chart">
        <div ref={plotRef} className="tl-plot" style={{ height: layout.height }}>
          <svg
            className="tl-svg"
            width={width}
            height={layout.height}
            viewBox={`0 0 ${width} ${layout.height}`}
            role="img"
            aria-label={journeyAriaLabel(moments)}
            focusable="false"
          >
            {BANDS.map((band) => {
              const top = plot.bottom - (band.index + 1) * layout.bandHeight;
              return (
                <g key={band.id} className="tl-band" data-band={band.id}>
                  <line className="tl-grid" x1={plot.left} x2={plot.right} y1={top} y2={top} />
                  <circle className="tl-band-dot" cx={4} cy={top + layout.bandHeight / 2} r={2.6} />
                  <text
                    className="tl-band-label"
                    x={14}
                    y={top + layout.bandHeight / 2}
                    dy="0.35em"
                  >
                    {band.label}
                  </text>
                </g>
              );
            })}
            <line
              className="tl-grid tl-base"
              x1={plot.left}
              x2={plot.right}
              y1={plot.bottom}
              y2={plot.bottom}
            />

            <text className="tl-axis-title" x={0} y={layout.tickY}>
              Turn
            </text>
            {ticks.map((tick) => (
              <line
                key={`v-${tick.index}`}
                className="tl-grid tl-vgrid"
                x1={tick.x}
                x2={tick.x}
                y1={plot.top}
                y2={plot.bottom + 5}
              />
            ))}
            {ticks.map((tick) => (
              <text
                key={tick.index}
                className="tl-tick"
                x={tick.x}
                y={layout.tickY}
                textAnchor="middle"
              >
                {tick.text}
              </text>
            ))}
            {count > 1 ? (
              <>
                <text className="tl-edge" x={xs[0]} y={layout.edgeY} textAnchor="middle">
                  Start
                </text>
                <text className="tl-edge" x={xs[count - 1]} y={layout.edgeY} textAnchor="middle">
                  End
                </text>
              </>
            ) : null}

            <line
              className="tl-guide"
              x1={xs[current.index]}
              x2={xs[current.index]}
              y1={ys[current.index]}
              y2={plot.bottom}
            />
            {pieces.map((piece) => (
              <g key={piece.to} data-band={piece.band.id}>
                <path
                  className="tl-glow"
                  d={piece.d}
                  strokeWidth={piece.weight * 6}
                  strokeDasharray={piece.dash ?? undefined}
                />
                <path
                  className="tl-piece"
                  data-kink={piece.kink || undefined}
                  d={piece.d}
                  strokeWidth={piece.weight * 1.25}
                  strokeDasharray={piece.dash ?? undefined}
                  strokeLinejoin={piece.join}
                />
              </g>
            ))}
            {placed.map((signal) => {
              // A star and a label never share a side of the same point.
              const label = labelsByMoment.get(signal.moment);
              const labelAbove = label !== undefined && label.y < (ys[signal.moment] as number);
              const room = signal.y - layout.markerSize - 22 > plot.top - 6;
              const above = room && !labelAbove;
              const flag = above
                ? signal.y - layout.markerSize - 20
                : signal.y + layout.markerSize + 20;
              return (
                <g
                  key={`${signal.turn}-${signal.label}`}
                  className="tl-signal"
                  data-status={signal.status}
                  data-reached={signal.moment <= current.index || undefined}
                >
                  <line
                    className="tl-stem"
                    x1={signal.x}
                    x2={signal.x}
                    y1={signal.y + (above ? -layout.markerSize : layout.markerSize)}
                    y2={flag + (above ? 5 : -5)}
                  />
                  <path
                    className="tl-star"
                    d={starPath(7.5)}
                    transform={`translate(${signal.x} ${flag})`}
                  />
                </g>
              );
            })}
            {moments.map((m) => (
              <g key={`${m.turn}-${m.index}`} className="tl-marker" data-band={m.band.id}>
                <Marker
                  kind={m.point.kind}
                  x={xs[m.index] as number}
                  y={ys[m.index] as number}
                  size={layout.markerSize}
                />
              </g>
            ))}
            <circle
              className="tl-ring"
              cx={xs[current.index]}
              cy={ys[current.index]}
              r={layout.markerSize + 6}
            />
            {labels.map((label) => (
              <text
                key={label.index}
                className="tl-label"
                x={label.x}
                y={label.y}
                textAnchor={label.anchor}
              >
                {label.text}
              </text>
            ))}
          </svg>

          <div className="tl-hit" role="group" aria-label="Points in the call">
            {moments.map((m) => (
              <button
                key={`${m.turn}-${m.index}`}
                type="button"
                ref={(el) => {
                  buttons.current[m.index] = el;
                }}
                className="tl-point"
                style={{
                  left: xs[m.index],
                  top: plot.top - 6,
                  width: sliceWidth,
                  height: plotHeight + 12,
                }}
                tabIndex={m.index === roving ? 0 : -1}
                aria-label={m.name}
                aria-current={m.index === current.index ? 'true' : undefined}
                onClick={() => choose(m.index)}
                onFocus={() => setRoving(m.index)}
                onKeyDown={(event) => onKeyDown(event, m.index)}
              />
            ))}
          </div>
        </div>
        <Legend moments={moments} signals={placed.length > 0} />
        <p className="tl-hint">
          The customer is simulated, so heights show direction rather than exact measurements.
          Select a point to see what happened there; the arrow keys move between points.
        </p>
      </div>

      <DetailPanel
        moment={current}
        total={count}
        href={turnHref(current.turn)}
        signals={here}
        presence={{ found: foundBy(current.index, placed), facts, size: roomy ? 148 : 104 }}
        onStep={step}
      />

      {tableOpen ? <MoodTable id={tableId} moments={moments} turnHref={turnHref} /> : null}
    </div>
  );
}

/**
 * The customer's mood through the call as the filament the call chamber hangs its conversation
 * from: a hairline whose shape is how composed the customer was (straight, swaying, trembling,
 * kinked or broken), five labelled bands, a point for each recorded moment (a different shape for
 * each kind), a star where a hidden fact came out, a panel for the selected moment with the
 * customer frozen as they were then, and a table alternative. Built from `report.journey.points`;
 * it never shows raw 0-100 numbers.
 */
export function TemperatureTimeline({
  points,
  turnHref,
  discoveries = [],
  facts = 0,
}: {
  points: readonly JourneyPoint[];
  /** Where "View in transcript" should go for a given turn. */
  turnHref: (turn: number) => string;
  /** The hidden facts the call brought out, to light as stars where they came out. */
  discoveries?: readonly JourneyDiscovery[];
  /** How many hidden facts the scenario held: the dormant dots of the customer's presence. */
  facts?: number;
}) {
  const moments = useMemo(() => buildMoments(points), [points]);
  if (moments.length === 0) {
    return (
      <p className="rp-quiet">
        There are not enough recorded moments to draw this call&rsquo;s timeline.
      </p>
    );
  }
  return <Timeline moments={moments} turnHref={turnHref} discoveries={discoveries} facts={facts} />;
}
