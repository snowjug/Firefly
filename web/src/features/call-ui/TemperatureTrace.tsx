import { memo, useId } from 'react';
import { cx } from '../../design/index.ts';
import {
  BANDS_TOP_DOWN,
  bandRank,
  traceSummary,
  type CustomerStateView,
  type TracePoint,
} from './call-model.ts';
import './trace.css';

// The customer's temperature over the call: five labelled bands, one point after each exchange.
// It is drawn in a box that is one unit wide per percent and one per band tall, stretched to fit;
// markers are zero-length lines with round ends so they stay round however the box is stretched.
// A table of the same points follows, for anyone who prefers to read it.

const BAND_COUNT = BANDS_TOP_DOWN.length;
const PAD = 4;
const SPAN = 100 - PAD * 2;
/** Beyond this many points the line is drawn without a marker on every point. */
const MARKED_UP_TO = 16;

export interface TemperatureTraceProps {
  points: readonly TracePoint[];
  view: CustomerStateView | null;
}

export const TemperatureTrace = memo(function TemperatureTrace({
  points,
  view,
}: TemperatureTraceProps) {
  const tableId = useId();
  if (points.length === 0) return null;
  const count = points.length;
  const first = points[0] as TracePoint;
  const last = points[count - 1] as TracePoint;
  const x = (index: number) => (count === 1 ? 100 - PAD : PAD + (index * SPAN) / (count - 1));
  const y = (point: TracePoint) => BAND_COUNT - 1 - bandRank(point.band) + 0.5;
  const line = points.map((point, index) => `${x(index)},${y(point)}`).join(' ');
  const lastX = x(count - 1);

  return (
    <div className="cw-trace">
      <div className="cw-trace__chart" role="img" aria-label={traceSummary(points, view)}>
        <div className="cw-trace__axis">
          {BANDS_TOP_DOWN.map((band) => (
            <span key={band.id} className="cw-trace__band">
              {band.label}
            </span>
          ))}
        </div>
        <svg
          className="cw-trace__plot"
          viewBox={`0 0 100 ${BAND_COUNT}`}
          preserveAspectRatio="none"
          focusable="false"
        >
          {BANDS_TOP_DOWN.map((band, index) => (
            <line
              key={band.id}
              className="cw-trace__grid"
              x1={0}
              x2={100}
              y1={index + 0.5}
              y2={index + 0.5}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {count > 1 ? (
            <polyline className="cw-trace__line" points={line} vectorEffect="non-scaling-stroke" />
          ) : null}
          {count <= MARKED_UP_TO
            ? points
                .slice(0, -1)
                .map((point, index) => (
                  <path
                    key={`${point.turnIndex}-${index}`}
                    className={cx('cw-trace__dot', `cw-trace__dot--${point.band}`)}
                    d={`M${x(index)} ${y(point)}h0`}
                    vectorEffect="non-scaling-stroke"
                  />
                ))
            : count > 1 && (
                <path
                  className={cx('cw-trace__dot', `cw-trace__dot--${first.band}`)}
                  d={`M${x(0)} ${y(first)}h0`}
                  vectorEffect="non-scaling-stroke"
                />
              )}
          <path
            className={cx('cw-trace__halo', `cw-trace__halo--${last.band}`)}
            d={`M${lastX} ${y(last)}h0`}
            vectorEffect="non-scaling-stroke"
          />
          <path
            className={cx('cw-trace__dot', 'cw-trace__dot--latest', `cw-trace__dot--${last.band}`)}
            d={`M${lastX} ${y(last)}h0`}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="cw-trace__ends">
          {count > 1 ? (
            <span className="cw-trace__end">
              Start: <strong>{first.label}</strong>
            </span>
          ) : (
            <span />
          )}
          <span className="cw-trace__end">
            Now: <strong>{last.label}</strong>
          </span>
        </div>
      </div>
      <details className="cw-trace__details">
        <summary className="cw-trace__summary">Show the points as a table</summary>
        <table className="cw-trace__table" id={tableId}>
          <caption className="visually-hidden">Customer state after each reply</caption>
          <thead>
            <tr>
              <th scope="col">After</th>
              <th scope="col">Customer state</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point, index) => (
              <tr key={`${point.turnIndex}-${index}`}>
                <th scope="row">
                  {point.after}
                  {index === count - 1 ? ' (now)' : ''}
                </th>
                <td>{point.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
});
