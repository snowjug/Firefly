import type { EarnedAchievement } from '#shared/domain/achievements.ts';
import { EvidenceQuote } from './EvidenceQuote.tsx';

/**
 * What this call earned. Nothing here is shown unless the report's own evidence supports it, and
 * every badge points at the words from the call that earned it.
 */
export function AchievementsSection({
  earned,
  turnHref,
}: {
  earned: readonly EarnedAchievement[];
  turnHref: (turn: number) => string;
}) {
  if (earned.length === 0) return null;
  return (
    <section id="earned" className="rp-section" aria-labelledby="earned-title">
      <div className="rp-section-head">
        <h2 id="earned-title" className="t-section">
          Earned in this call
        </h2>
        <p className="rp-lead">
          Each one is awarded only when your own words in this call support it. They are practice
          milestones, not scores.
        </p>
      </div>
      <ul role="list" className="rp-earned">
        {earned.map((item, index) => (
          <li key={item.id} style={{ ['--i' as string]: index }}>
            <article className="rp-badge" aria-labelledby={`earned-${item.id}`}>
              <span className="rp-badge-mark" aria-hidden="true">
                <svg viewBox="0 0 48 48" focusable="false">
                  <circle cx="24" cy="24" r="21" className="rp-badge-ring" />
                  <path
                    d="M24 10l3.6 9.4 10 .6-7.8 6.3 2.6 9.7L24 30.6l-8.4 5.4 2.6-9.7L10.4 20l10-.6L24 10z"
                    className="rp-badge-star"
                  />
                </svg>
              </span>
              <div className="rp-badge-body">
                <h3 id={`earned-${item.id}`} className="rp-badge-title">
                  {item.title}
                </h3>
                <p className="rp-badge-criteria">{item.criteria}</p>
                {item.proof.quote !== null || item.proof.turnIndex !== null ? (
                  <EvidenceQuote
                    quote={item.proof.quote}
                    turn={item.proof.turnIndex}
                    href={
                      item.proof.turnIndex !== null ? turnHref(item.proof.turnIndex) : undefined
                    }
                    tone="accent"
                  />
                ) : null}
                <p className="t-meta">{item.proof.detail}</p>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
