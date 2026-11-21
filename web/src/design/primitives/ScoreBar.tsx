import { scoreLabel } from '#shared/domain/vocab.ts';
import { cx } from '../cx.ts';
import './score-bar.css';

export interface ScoreBarProps {
  /** A score from 1 to `max`, or null when there is none. Fractions fill part of a segment. */
  score: number | null;
  max?: number;
  /** The word for the score. For a 1 to 5 score it defaults to Firefly's own labels. */
  label?: string;
  size?: 'small' | 'medium' | 'large';
  /** Show the number and label as text. Turn off only where the text sits beside it already. */
  showText?: boolean;
  /**
   * Fill the segments once from empty when the bar first appears, one after another. Only when
   * motion is allowed: under reduced motion the bar is simply there.
   */
  animate?: boolean;
  className?: string;
}

function format(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

/**
 * A score drawn as segments, always with the number and the word as text: the bar is never the only
 * carrier. It uses one calm colour, because a practice score is coaching, not a grade.
 */
export function ScoreBar({
  score,
  max = 5,
  label,
  size = 'medium',
  showText = true,
  animate = false,
  className,
}: ScoreBarProps) {
  const has = score !== null;
  const clamped = has ? Math.min(max, Math.max(0, score)) : 0;
  const word = label ?? (has && max === 5 ? scoreLabel(clamped) : has ? undefined : 'Not scored');
  const spoken = has ? `${format(clamped)} of ${max}${word ? `, ${word}` : ''}` : 'Not scored';
  return (
    <span
      className={cx(
        'ff-scorebar',
        `ff-scorebar--${size}`,
        animate && 'ff-scorebar--animate',
        className,
      )}
    >
      <span
        className="ff-scorebar__segments"
        {...(showText ? { 'aria-hidden': true } : { role: 'img', 'aria-label': spoken })}
      >
        {Array.from({ length: max }, (_, index) => {
          const fill = Math.min(1, Math.max(0, clamped - index));
          return (
            <span className="ff-scorebar__segment" key={index}>
              <span
                className="ff-scorebar__fill"
                style={{ transform: `translateX(${(fill - 1) * 100}%)` }}
              />
            </span>
          );
        })}
      </span>
      {showText ? (
        <span className="ff-scorebar__text">
          {has ? (
            <>
              <span className="ff-scorebar__number">{format(clamped)}</span>
              <span className="ff-scorebar__of"> of {max}</span>
              {word ? <span className="ff-scorebar__word">{word}</span> : null}
            </>
          ) : (
            <span className="ff-scorebar__word">{word}</span>
          )}
        </span>
      ) : null}
    </span>
  );
}
