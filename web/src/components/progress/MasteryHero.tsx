import {
  CONSTELLATIONS,
  MASTERY_TIERS,
  MASTERY_TIER_LABELS,
  brightest,
  nextToLight,
  type DimensionMastery,
} from '#shared/domain/mastery.ts';
import { DIMENSIONS, type DimensionId } from '#shared/domain/vocab.ts';
import { MasteryStars, TierGlyph } from '../mastery/MasteryStars.tsx';
import '../../styles/progress.css';

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six'] as const;
const word = (n: number) => WORDS[n] ?? String(n);

/** "Four of six skills are lit." Said in words, because the picture alone is not enough. */
export function litHeadline(lit: number, total: number): string {
  if (lit <= 0) return 'No skills are lit yet.';
  if (lit >= total) return `All ${word(total)} skills are lit.`;
  const first = word(lit);
  return `${first.charAt(0).toUpperCase()}${first.slice(1)} of ${word(total)} skills ${lit === 1 ? 'is' : 'are'} lit.`;
}

/**
 * The top of the Progress page: the six skill constellations as one picture, a sentence saying what
 * it shows, the next skill to light and exactly what that needs. Weak skills stay visible without
 * judgement: a skill that is not lit yet is simply the next one to light.
 */
export function MasteryHero({
  mastery,
  focus,
  includeSamples,
}: {
  mastery: readonly DimensionMastery[];
  focus: DimensionId | null;
  includeSamples: boolean;
}) {
  const lit = mastery.filter((m) => m.tierIndex > 0).length;
  const top = brightest(mastery);
  const next = nextToLight(mastery, focus);
  return (
    <section className="pg-hero" aria-labelledby="pg-hero-title">
      <div className="pg-hero-stars">
        <MasteryStars mastery={mastery} reveal />
      </div>
      <div className="pg-hero-text">
        <p className="t-label">
          {includeSamples ? 'Sample practice, as light' : 'Your practice, as light'}
        </p>
        <h2 id="pg-hero-title" className="pg-hero-title">
          {litHeadline(lit, mastery.length)}
        </h2>
        <p className="pg-hero-sub">
          {top ? (
            <>
              The brightest is <strong>{CONSTELLATIONS[top.dimension].name}</strong> (
              {DIMENSIONS[top.dimension].label}), {MASTERY_TIER_LABELS[top.tier].label}. Each
              constellation is one coaching skill and lights up with completed calls.
            </>
          ) : (
            <>
              Each constellation is one coaching skill. They light up as completed calls give
              evidence for them.
            </>
          )}
        </p>

        {next && next.next ? (
          <div className="pg-next-light">
            <TierGlyph tier={next.tierIndex} size={34} />
            <div>
              <p className="t-label">Next to light up</p>
              <p className="pg-next-name">
                {CONSTELLATIONS[next.dimension].name}
                <span className="t-meta"> &middot; {DIMENSIONS[next.dimension].label}</span>
              </p>
              <p className="t-small t-muted">
                {MASTERY_TIER_LABELS[next.tier].label} now. To reach{' '}
                {MASTERY_TIER_LABELS[next.next.tier].label}:
              </p>
              <ul role="list" className="pg-next-needs">
                {next.next.needs.map((need) => (
                  <li key={need}>{need}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="t-small t-muted">
            Every skill is a Beacon. New scenarios and harder customers keep them lit.
          </p>
        )}

        <details className="pg-how">
          <summary>How skills light up</summary>
          <ol role="list" className="pg-tiers">
            {MASTERY_TIERS.map((tier, index) => (
              <li key={tier}>
                <TierGlyph tier={index} size={26} />
                <span>
                  <strong>{MASTERY_TIER_LABELS[tier].label}</strong>
                  <span className="t-small t-muted"> {MASTERY_TIER_LABELS[tier].meaning}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="t-meta">
            Light comes only from completed calls and the evidence in their coaching reports. Time
            spent, message counts and other people do not change it.
          </p>
        </details>
      </div>
    </section>
  );
}
