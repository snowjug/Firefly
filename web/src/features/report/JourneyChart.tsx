import { useMemo, useEffect, useRef, useState, type RefObject } from 'react';
import type { CoachingReport } from '#shared/domain/report.ts';
import { Icon, CUSTOMER_STATE_ICONS } from '../../design/index.ts';
import { bandIdFor } from './copy.ts';
import {
  POINT_KIND_LABELS,
  journeySentence,
  layoutChart,
  type PointKind,
} from './journey-model.ts';
import { MarkerShape, MarkerGlyph } from './marker-shape.tsx';
import './journey-chart.css';

// The customer's temperature through the call as a line over the turns, the five bands named on the
// left and a marker for the start, each turning point, the unexpected turn and the end. This is the
// only part of the report that is drawn; it loads on its own, and the list and table under it carry
// the same information in words.

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
  const width = useWidth(box);
  const narrow = width < 520;
  const height = narrow ? 244 : 288;
  const geometry = useMemo(
    () => layoutChart(journey.points, { width, height, gutter: narrow ? 92 : 112 }),
    [journey.points, width, height, narrow],
  );
  const { plot } = geometry;
  const first = geometry.points[0];
  const last = geometry.points[geometry.points.length - 1];
  // "Start" and "End" are written beside their markers; a label above would leave the chart at the top.
  const labelY = (y: number) => (y - plot.top < 20 ? y + 22 : y - 12);

  return (
    <div className="rp-chart" ref={box}>
      <svg
        className="rp-chart__svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
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
        {geometry.points.map((point) => (
          <g
            key={`${point.turnIndex}-${point.kind}`}
            className={`rp-chart__marker rp-chart__marker--${bandIdFor(point.band) ?? 'calm'}`}
            transform={`translate(${point.x} ${point.y})`}
          >
            <MarkerShape kind={point.kind} />
          </g>
        ))}
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
