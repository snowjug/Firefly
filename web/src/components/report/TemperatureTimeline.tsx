import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import type { JourneyPoint } from '#shared/domain/report.ts';
import { Icon } from '../Icon.tsx';
import { EvidenceQuote } from './EvidenceQuote.tsx';
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
import { usePrinting } from './usePrinting.ts';
import '../../styles/report.css';

const LEGEND_ORDER: PointKind[] = ['start', 'turn', 'turning-point', 'curveball', 'end'];

function useElementWidth<T extends HTMLElement>(initial: number) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const next = Math.round(el.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A different shape for each kind of point, so colour is never the only cue. */
function Marker({
  kind,
  x,
  y,
  size,
  color,
}: {
  kind: PointKind;
  x: number;
  y: number;
  size: number;
  color: string;
}) {
  switch (kind) {
    case 'start':
      return (
        <g>
          <circle
            cx={x}
            cy={y}
            r={size + 0.5}
            className="tl-m tl-m-ring"
            style={{ stroke: color }}
          />
          <circle cx={x} cy={y} r={size * 0.38} style={{ fill: color }} />
        </g>
      );
    case 'turn':
      return <circle cx={x} cy={y} r={size * 0.62} className="tl-m" style={{ fill: color }} />;
    case 'turning-point': {
      const s = size * 0.95;
      return (
        <rect
          x={x - s}
          y={y - s}
          width={s * 2}
          height={s * 2}
          transform={`rotate(45 ${x} ${y})`}
          className="tl-m"
          style={{ fill: color }}
        />
      );
    }
    case 'curveball': {
      const w = size * 1.25;
      return (
        <polygon
          points={`${x},${y - size * 1.3} ${x + w},${y + size * 0.85} ${x - w},${y + size * 0.85}`}
          className="tl-m"
          style={{ fill: color }}
        />
      );
    }
    case 'end': {
      const s = size * 0.85;
      return (
        <rect
          x={x - s}
          y={y - s}
          width={s * 2}
          height={s * 2}
          rx={2}
          className="tl-m"
          style={{ fill: color }}
        />
      );
    }
  }
}

function Legend({ moments }: { moments: readonly Moment[] }) {
  const present = new Set(moments.map((m) => m.point.kind));
  return (
    <ul role="list" className="tl-legend" aria-label="Point shapes">
      {LEGEND_ORDER.filter((kind) => present.has(kind)).map((kind) => (
        <li key={kind}>
          <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
            <Marker kind={kind} x={9} y={9} size={5} color="var(--text-2)" />
          </svg>
          {KIND_LEGEND[kind]}
        </li>
      ))}
    </ul>
  );
}

function DetailPanel({
  moment,
  total,
  href,
  onStep,
}: {
  moment: Moment;
  total: number;
  href: string;
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
      <div aria-live="polite" aria-atomic="true" className="tl-panel-body">
        <div className="tl-panel-head">
          <div>
            <p className="tl-panel-turn">Turn {moment.turn}</p>
            <p className="t-meta tabular">
              Point {moment.index + 1} of {total}
            </p>
          </div>
          {moment.kindLabel ? <span className="chip">{moment.kindLabel}</span> : null}
        </div>
        <p className="tl-panel-band">
          <span className="tl-dot" data-band={moment.band.id} aria-hidden="true" />
          <strong>{moment.band.label}</strong>
          <span className="tl-panel-change">{moment.change}</span>
        </p>
        {point.reason ? (
          <div className="tl-panel-block">
            <p className="t-label">Why it moved</p>
            <p>{point.reason}</p>
          </div>
        ) : null}
        <div className="tl-panel-block">
          <p className="t-label">What you said</p>
          {point.quote ? (
            <EvidenceQuote quote={point.quote} tone="accent" />
          ) : (
            <p className="t-small t-muted">{noQuote}</p>
          )}
        </div>
        <Link to={href} className="tl-panel-link" viewTransition>
          View in transcript <Icon name="arrow-right" size={16} />
        </Link>
      </div>
      <div className="tl-stepper">
        <button
          type="button"
          className="btn btn-secondary"
          aria-label="Previous moment"
          aria-disabled={moment.index === 0}
          onClick={() => onStep(-1)}
        >
          <Icon name="arrow-left" size={16} />
          Previous
        </button>
        <button
          type="button"
          className="btn btn-secondary"
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
      <table className="table tl-table">
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
                <Link to={turnHref(m.turn)} viewTransition>
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
}: {
  moments: readonly Moment[];
  turnHref: (turn: number) => string;
}) {
  const uid = useId().replace(/:/g, '');
  const [plotRef, width] = useElementWidth<HTMLDivElement>(640);
  const layout = useMemo(() => layoutChart(moments, width), [moments, width]);
  const labels = useMemo(() => planLabels(moments, layout), [moments, layout]);
  const ticks = useMemo(() => planTicks(moments, layout), [moments, layout]);
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
  const path = xs
    .map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${(ys[i] as number).toFixed(1)}`)
    .join(' ');
  const gradientId = `tl-grad-${uid}`;
  const tableId = `tl-table-${uid}`;
  const tableOpen = showTable || printing;

  return (
    <div className="tl">
      <div className="tl-bar">
        <p className="tl-summary">{`${summary.charAt(0).toUpperCase()}${summary.slice(1)}.`}</p>
        <button
          type="button"
          className="btn btn-ghost btn-sm tl-toggle"
          aria-expanded={tableOpen}
          aria-controls={tableId}
          onClick={() => setShowTable((v) => !v)}
        >
          <Icon name="grid" size={16} />
          {tableOpen ? 'Hide table' : 'Show as table'}
        </button>
      </div>

      <div className="tl-main">
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
              data-compact={layout.compact}
            >
              <defs>
                <linearGradient
                  id={gradientId}
                  gradientUnits="userSpaceOnUse"
                  x1="0"
                  y1={plot.bottom}
                  x2="0"
                  y2={plot.top}
                >
                  {BANDS.map((band) => (
                    <stop
                      key={band.id}
                      offset={`${((band.index + 0.5) / BANDS.length) * 100}%`}
                      style={{ stopColor: `var(--temp-${band.id})` }}
                    />
                  ))}
                </linearGradient>
              </defs>

              {BANDS.map((band) => {
                const top = plot.bottom - (band.index + 1) * layout.bandHeight;
                return (
                  <g key={band.id}>
                    <rect
                      className="tl-stripe"
                      x={plot.left}
                      y={top}
                      width={plot.right - plot.left}
                      height={layout.bandHeight}
                      style={{ fill: `color-mix(in srgb, var(--temp-${band.id}) 8%, transparent)` }}
                    />
                    <line className="tl-grid" x1={plot.left} x2={plot.right} y1={top} y2={top} />
                    <circle
                      className="tl-band-dot"
                      cx={layout.compact ? 6 : 8}
                      cy={top + layout.bandHeight / 2}
                      r={3.5}
                      style={{ fill: `var(--temp-${band.id})` }}
                    />
                    <text
                      className="tl-band-label"
                      x={layout.compact ? 15 : 19}
                      y={top + layout.bandHeight / 2}
                      dy="0.35em"
                    >
                      {band.label}
                    </text>
                  </g>
                );
              })}
              <line
                className="tl-grid"
                x1={plot.left}
                x2={plot.right}
                y1={plot.bottom}
                y2={plot.bottom}
              />

              <text className="tl-axis-title" x={layout.compact ? 2 : 4} y={layout.tickY}>
                Turn
              </text>
              {ticks.map((tick) => (
                <line
                  key={`v-${tick.index}`}
                  className="tl-grid tl-vgrid"
                  x1={tick.x}
                  x2={tick.x}
                  y1={plot.top}
                  y2={plot.bottom}
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
              {count > 1 ? (
                <path className="tl-line" d={path} pathLength={1} stroke={`url(#${gradientId})`} />
              ) : null}
              {moments.map((m) => (
                <Marker
                  key={`${m.turn}-${m.index}`}
                  kind={m.point.kind}
                  x={xs[m.index] as number}
                  y={ys[m.index] as number}
                  size={layout.markerSize}
                  color={`var(--temp-${m.band.id})`}
                />
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
          <Legend moments={moments} />
          <p className="tl-hint t-meta">
            The customer is simulated, so heights show direction rather than exact measurements.
            Select a point to see what happened there; the arrow keys move between points.
          </p>
        </div>

        <DetailPanel moment={current} total={count} href={turnHref(current.turn)} onStep={step} />
      </div>

      {tableOpen ? <MoodTable id={tableId} moments={moments} turnHref={turnHref} /> : null}
    </div>
  );
}

/**
 * The customer's mood through the call as an accessible SVG: five labelled bands, one point per
 * recorded moment (a different shape for each kind), a detail panel for the selected point and a
 * table alternative. Built from `report.journey.points`; it never shows raw 0-100 numbers.
 */
export function TemperatureTimeline({
  points,
  turnHref,
}: {
  points: readonly JourneyPoint[];
  /** Where "View in transcript" should go for a given turn. */
  turnHref: (turn: number) => string;
}) {
  const moments = useMemo(() => buildMoments(points), [points]);
  if (moments.length === 0) {
    return (
      <p className="tl-empty t-muted">
        There are not enough recorded moments to draw this call&rsquo;s timeline.
      </p>
    );
  }
  return <Timeline moments={moments} turnHref={turnHref} />;
}
