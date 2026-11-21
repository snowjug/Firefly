import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import type { CoachingReport } from '#shared/domain/report.ts';
import { CUSTOMER_STATE_ICONS, Icon, cx } from '../../design/index.ts';
import { bandIdFor, plainUnexpectedTurn } from './copy.ts';
import { useEvidence } from './evidence.tsx';
import {
  POINT_KIND_LABELS,
  journeySentence,
  layoutChart,
  pointSummary,
  type ChartPoint,
  type PointKind,
} from './journey-model.ts';
import { MarkerGlyph, MarkerShape } from './marker-shape.tsx';
import './journey-chart.css';

// The customer's temperature through the call as a line over the turns, the five bands named on the
// left and a marker for the start, each turning point, the unexpected turn and the end. It is the
// only part of the report that is drawn, so it loads on its own. Its points are controls: one tab
// stop for the whole chart, the arrow keys move between points, and Enter (or a click or a tap)
// shows the matching turn in the transcript. The list and the table under it carry the same
// information in words, with a link on every row, so nothing depends on the chart.

type Journey = CoachingReport['journey'];

const LEGEND: PointKind[] = ['start', 'turn', 'turning-point', 'curveball', 'end'];
const DEFAULT_WIDTH = 640;

/** The width of an element, kept up to date as it is resized. */
function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.floor(entry?.contentRect.width ?? 0);
      if (next > 0) setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

export default function JourneyChart({ journey }: { journey: Journey }) {
  const box = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<number, SVGGElement>());
  const width = useWidth(box);
  const narrow = width < 520;
  const height = narrow ? 244 : 272;
  const geometry = useMemo(
    () => layoutChart(journey.points, { width, height, gutter: narrow ? 92 : 108 }),
    [journey.points, width, height, narrow],
  );
  const { plot } = geometry;
  const { hasTurn, goToTurn } = useEvidence();

  // Only a point that is a turn of the transcript can be used; the start of the call is not one.
  const stops = useMemo(
    () => geometry.points.filter((point) => hasTurn(point.turnIndex)),
    [geometry.points, hasTurn],
  );
  const [current, setCurrent] = useState<number | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const tabStop =
    current !== null && stops.some((p) => p.index === current)
      ? current
      : (stops[0]?.index ?? null);

  const first = geometry.points[0];
  const last = geometry.points[geometry.points.length - 1];
  const hit = narrow ? 13 : 12;
  // "Start" and "End" are written beside their markers; a label above would leave the chart at the top.
  const labelY = (y: number) => (y - plot.top < 20 ? y + 22 : y - 12);

  const summaryOf = (index: number): string => {
    const point = journey.points[index];
    if (!point) return '';
    return pointSummary(index > 0 ? (journey.points[index - 1] ?? null) : null, point);
  };
  const readout = (() => {
    if (shown === null) return journeySentence(journey);
    const reason = journey.points[shown]?.reason;
    return reason ? `${summaryOf(shown)}. ${plainUnexpectedTurn(reason)}` : summaryOf(shown);
  })();

  const reveal = (point: ChartPoint, from: SVGGElement) =>
    goToTurn(point.turnIndex, journey.points[point.index]?.quote ?? null, from);

  const onKeyDown = (event: KeyboardEvent<SVGGElement>, point: ChartPoint) => {
    const at = stops.findIndex((p) => p.index === point.index);
    const end = stops.length - 1;
    let to: number;
    if (event.key === 'ArrowRight') to = Math.min(end, at + 1);
    else if (event.key === 'ArrowLeft') to = Math.max(0, at - 1);
    else if (event.key === 'Home') to = 0;
    else if (event.key === 'End') to = end;
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      reveal(point, event.currentTarget);
      return;
    } else return;
    event.preventDefault();
    const next = stops[to];
    if (!next) return;
    setCurrent(next.index);
    nodes.current.get(next.index)?.focus();
  };

  const onPointerLeave = (event: PointerEvent<SVGGElement>) => {
    // A point that has keyboard focus keeps describing itself.
    if (event.currentTarget !== document.activeElement) setShown(null);
  };

  return (
    <div className="rp-chart" ref={box}>
      <p className="rp-chart__readout">{readout}</p>
      <svg
        className="rp-chart__svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role={stops.length > 0 ? 'group' : 'img'}
        aria-label={`Customer temperature through the call. ${journeySentence(journey)} The same information is listed below the chart.`}
      >
        {geometry.bands.map((band, i) => (
          <g key={band.id}>
            <rect
              className={`rp-chart__stripe rp-chart__stripe--${band.id}`}
              x={plot.left}
              y={band.top}
              width={plot.right - plot.left}
              height={band.bottom - band.top}
            />
            <g
              className={`rp-chart__bandicon--${band.id}`}
              transform={`translate(${narrow ? 4 : 8} ${(band.top + band.bottom) / 2 - 7})`}
            >
              <Icon name={CUSTOMER_STATE_ICONS[band.id]} size={14} />
            </g>
            <text
              className="rp-chart__label"
              x={narrow ? 24 : 28}
              y={(band.top + band.bottom) / 2}
              dominantBaseline="central"
            >
              {band.label}
            </text>
            {i > 0 ? (
              <line
                className="rp-chart__rule"
                x1={plot.left}
                x2={plot.right}
                y1={band.top}
                y2={band.top}
              />
            ) : null}
          </g>
        ))}
        <line
          className="rp-chart__axis"
          x1={plot.left}
          x2={plot.right}
          y1={plot.bottom}
          y2={plot.bottom}
        />
        {geometry.ticks.map((tick) => (
          <g key={tick.x}>
            <line
              className="rp-chart__tick"
              x1={tick.x}
              x2={tick.x}
              y1={plot.bottom}
              y2={plot.bottom + 5}
            />
            <text
              className="rp-chart__tick-label"
              x={tick.x}
              y={plot.bottom + 19}
              textAnchor="middle"
            >
              {tick.label}
            </text>
          </g>
        ))}
        <text
          className="rp-chart__axis-title"
          x={(plot.left + plot.right) / 2}
          y={height - 6}
          textAnchor="middle"
        >
          Turn in the conversation
        </text>

        <path className="rp-chart__line" d={geometry.path} />
        {geometry.points.map((point) => {
          const band = bandIdFor(point.band) ?? 'calm';
          const marker = (
            <g className={`rp-chart__marker rp-chart__marker--${band}`}>
              <MarkerShape kind={point.kind} />
            </g>
          );
          const place = `translate(${point.x} ${point.y})`;
          if (!stops.includes(point)) {
            return (
              <g
                key={`${point.turnIndex}-${point.kind}`}
                className="rp-chart__point rp-chart__point--static"
                transform={place}
                aria-hidden="true"
              >
                {marker}
              </g>
            );
          }
          return (
            <g
              key={`${point.turnIndex}-${point.kind}`}
              ref={(node) => {
                if (node) nodes.current.set(point.index, node);
                else nodes.current.delete(point.index);
              }}
              className={cx('rp-chart__point', shown === point.index && 'rp-chart__point--on')}
              transform={place}
              role="button"
              tabIndex={point.index === tabStop ? 0 : -1}
              aria-label={`${summaryOf(point.index)}. See turn ${point.turnIndex} in the transcript`}
              onKeyDown={(event) => onKeyDown(event, point)}
              onClick={(event) => reveal(point, event.currentTarget)}
              onFocus={() => {
                setCurrent(point.index);
                setShown(point.index);
              }}
              onBlur={() => setShown(null)}
              onPointerEnter={() => setShown(point.index)}
              onPointerLeave={onPointerLeave}
            >
              <circle className="rp-chart__hit" r={hit} />
              <circle className="rp-chart__ring" r={hit} />
              {marker}
            </g>
          );
        })}
        {first ? (
          <text className="rp-chart__note" x={first.x} y={labelY(first.y)} textAnchor="middle">
            Start
          </text>
        ) : null}
        {last && last !== first ? (
          <text className="rp-chart__note" x={last.x} y={labelY(last.y)} textAnchor="middle">
            End
          </text>
        ) : null}
      </svg>
      <ul className="rp-legend" role="list" aria-label="Chart key">
        {LEGEND.map((kind) => (
          <li key={kind} className="rp-legend__item">
            <MarkerGlyph kind={kind} />
            <span>
              {POINT_KIND_LABELS[kind] === 'End of call' ? 'End' : POINT_KIND_LABELS[kind]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
