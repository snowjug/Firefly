import { scoreText } from './labels.ts';

// A score from 1 to 5 as a ruler: five ticks, an amber point where the score falls and a hairline
// of light from the first tick to it. It is a measurement and says so in words (the numbers sit
// under the ticks, and the whole mark is named "N out of 5"), never a chart of anything else.

const LEFT = 8;
const WIDTH = 184;
const xOf = (score: number) => LEFT + ((Math.min(5, Math.max(1, score)) - 1) / 4) * WIDTH;

/**
 * `score` null draws the empty ruler (no overall score for this call). `numbered` writes the
 * numbers under the ticks; small rulers leave them out because the score is said next to them.
 */
export function ScoreScale({
  score,
  label,
  numbered = false,
  decorative = false,
  className,
}: {
  score: number | null;
  /** What the ruler is a score of, said to screen readers: "Overall score" or a skill. */
  label: string;
  numbered?: boolean;
  /** The score is said in words beside the ruler, so it is hidden from screen readers. */
  decorative?: boolean;
  className?: string;
}) {
  const height = numbered ? 34 : 20;
  const at = score === null ? null : xOf(score);
  return (
    <svg
      className={className ? `rp-scale ${className}` : 'rp-scale'}
      viewBox={`0 0 200 ${height}`}
      role={decorative ? undefined : 'img'}
      aria-label={
        decorative ? undefined : score === null ? label : `${label}: ${scoreText(score)} out of 5`
      }
      aria-hidden={decorative ? true : undefined}
      focusable="false"
      data-numbered={numbered || undefined}
      data-empty={score === null || undefined}
    >
      <line className="rp-scale__rail" x1={LEFT} x2={LEFT + WIDTH} y1={11} y2={11} />
      {at !== null ? <line className="rp-scale__fill" x1={LEFT} x2={at} y1={11} y2={11} /> : null}
      {[1, 2, 3, 4, 5].map((n) => (
        <g key={n}>
          <line className="rp-scale__tick" x1={xOf(n)} x2={xOf(n)} y1={6} y2={16} />
          {numbered ? (
            <text className="rp-scale__n" x={xOf(n)} y={32} textAnchor="middle">
              {n}
            </text>
          ) : null}
        </g>
      ))}
      {at !== null ? <circle className="rp-scale__pip" cx={at} cy={11} r={4.5} /> : null}
    </svg>
  );
}
