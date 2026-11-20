import { SCORES } from './ScoreField.tsx';

// Where a score sits on the 1 to 5 scale, as a fraction of the track's width.
const at = (score: number) => `${((score - 1) / (SCORES.length - 1)) * 100}%`;

/**
 * The AI's score and the mentor's on one hairline scale: a ring for the AI, a solid dot for the
 * mentor, and, where they differ, an amber line between them. Position is the score and the length
 * of the line is the difference, so how far apart they are can be seen at a glance. It is a
 * picture of the numbers in the cells beside it (which say the same in words), so it is hidden
 * from assistive technology. When the two agree the dot sits inside the ring.
 */
export function ScorePair({ ai, mentor }: { ai: number; mentor: number }) {
  const low = Math.min(ai, mentor);
  const high = Math.max(ai, mentor);
  return (
    <span className="cal-pair" aria-hidden="true" data-gap={Math.min(2, high - low)}>
      <span className="cal-pair__track">
        {SCORES.map((score) => (
          <span key={score} className="cal-pair__tick" style={{ left: at(score) }} />
        ))}
        {high > low ? (
          <span
            className="cal-pair__link"
            style={{ left: at(low), width: `${((high - low) / (SCORES.length - 1)) * 100}%` }}
          />
        ) : null}
        <span className="cal-pair__dot cal-pair__dot--ai" style={{ left: at(ai) }} />
        <span className="cal-pair__dot cal-pair__dot--mentor" style={{ left: at(mentor) }} />
      </span>
    </span>
  );
}

/** The numerals 1 to 5 under the same positions as the dots, for a column header. */
export function ScoreAxis() {
  return (
    <span className="cal-axis" aria-hidden="true">
      {SCORES.map((score) => (
        <span key={score} style={{ left: at(score) }}>
          {score}
        </span>
      ))}
    </span>
  );
}
