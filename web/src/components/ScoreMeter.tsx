import { SCORE_LABELS } from '#shared/domain/vocab.ts';
import { scoreTone } from '../lib/format.ts';

/** Five-segment meter for a 1-5 score. Shown with the numeric score and label for non-visual clarity. */
export function ScoreMeter({ score, label }: { score: number; label?: string }) {
  const tone = scoreTone(score);
  const rounded = Math.round(score);
  return (
    <div
      className="meter"
      role="img"
      aria-label={
        label ?? `Score ${score} out of 5, ${SCORE_LABELS[Math.min(4, Math.max(0, rounded - 1))]}`
      }
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className="meter-seg" data-on={n <= rounded} data-tone={tone} />
      ))}
    </div>
  );
}
