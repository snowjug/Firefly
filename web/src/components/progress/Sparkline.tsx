import type { DimensionTrendDTO } from '#shared/domain/api.ts';
import { SPARK, sparkGeometry } from './progress-model.ts';

/** More calls than this and the individual dots would only blur the line, so just the last stays. */
const MAX_DOTS = 24;

/**
 * A small line of one skill's 1 to 5 scores, one point per call, oldest on the left. The line is a
 * picture of numbers that are always written out beside it, and the label lists every score.
 */
export function Sparkline({
  points,
  label,
}: {
  points: DimensionTrendDTO['points'];
  label: string;
}) {
  const geometry = sparkGeometry(points.map((point) => point.score));
  const last = geometry.points[geometry.points.length - 1];
  return (
    <div className="pg-spark-wrap">
      <svg
        className="pg-spark"
        viewBox={`0 0 ${SPARK.width} ${SPARK.height}`}
        role="img"
        aria-label={label}
        focusable="false"
      >
        {geometry.grid.map((y, index) => (
          <line key={index} className="pg-spark-grid" x1={0} x2={SPARK.width} y1={y} y2={y} />
        ))}
        {geometry.area ? <path className="pg-spark-area" d={geometry.area} /> : null}
        {geometry.line ? <path className="pg-spark-line" d={geometry.line} /> : null}
        {geometry.points.length <= MAX_DOTS
          ? geometry.points.map((point, index) => (
              <circle key={index} className="pg-spark-dot" cx={point.x} cy={point.y} r={2.6} />
            ))
          : null}
        {last ? <circle className="pg-spark-last" cx={last.x} cy={last.y} r={4.6} /> : null}
      </svg>
      <span className="pg-spark-scale" aria-hidden="true">
        <span>5</span>
        <span>1</span>
      </span>
    </div>
  );
}
