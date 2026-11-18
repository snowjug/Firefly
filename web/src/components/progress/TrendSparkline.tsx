import type { DimensionTrendDTO } from '#shared/domain/api.ts';
import '../../styles/progress.css';

const W = 240;
const H = 64;
const PAD_X = 10;
const PAD_Y = 9;

/** A small trend line for 1-5 scores, spaced evenly by call. The text alternative lists every score. */
export function TrendSparkline({
  points,
  label,
}: {
  points: DimensionTrendDTO['points'];
  label: string;
}) {
  const count = points.length;
  const x = (index: number) =>
    count === 1 ? W / 2 : PAD_X + (index * (W - PAD_X * 2)) / (count - 1);
  const y = (score: number) =>
    PAD_Y + ((5 - Math.min(5, Math.max(1, score))) / 4) * (H - PAD_Y * 2);
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.score).toFixed(1)}`)
    .join(' ');
  const showDots = count <= 24;
  const last = points[count - 1];

  return (
    <svg
      className="pg-spark"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={label}
      focusable="false"
    >
      {[1, 3, 5].map((score) => (
        <line key={score} className="pg-spark-grid" x1={0} x2={W} y1={y(score)} y2={y(score)} />
      ))}
      {count > 1 ? <path className="pg-spark-line" d={path} /> : null}
      {showDots
        ? points.map((p, i) => (
            <circle
              key={`${p.sessionId}-${i}`}
              className="pg-spark-dot"
              cx={x(i)}
              cy={y(p.score)}
              r={2.6}
            />
          ))
        : null}
      {last ? (
        <circle className="pg-spark-last" cx={x(count - 1)} cy={y(last.score)} r={4.6} />
      ) : null}
    </svg>
  );
}
