import type { DimensionResult } from '#shared/domain/report.ts';
import { CARE_LABELS, DIMENSION_IDS, DIMENSIONS } from '#shared/domain/vocab.ts';
import { scoreTone } from '../../lib/format.ts';
import { useMediaQuery } from '../../lib/hooks.ts';
import { ProgressBar } from '../ui/ProgressBar.tsx';
import { Disclosure } from './Disclosure.tsx';
import { EvidenceQuote } from './EvidenceQuote.tsx';
import { SectionHead } from './SectionHead.tsx';
import { SUFFICIENCY_BADGE, scoreOfFive } from './labels.ts';

const byDimensionOrder = (a: DimensionResult, b: DimensionResult) =>
  DIMENSION_IDS.indexOf(a.id) - DIMENSION_IDS.indexOf(b.id);

/** "4 of 5 – Strong": always text, never colour alone. */
function ScoreLine({ dimension }: { dimension: DimensionResult }) {
  return (
    <p className="rp-score-line">
      <span className="rp-score-num tabular">{dimension.score}</span>
      <span className="rp-score-of"> of 5</span>
      <span className="rp-score-label"> &ndash; {dimension.label}</span>
    </p>
  );
}

function DimensionCard({
  dimension,
  turnHref,
}: {
  dimension: DimensionResult;
  turnHref: (turn: number) => string;
}) {
  const roomy = useMediaQuery('(min-width: 720px)');
  const meta = DIMENSIONS[dimension.id];
  const badge = SUFFICIENCY_BADGE[dimension.sufficiency];
  const titleId = `dim-${dimension.id}-title`;

  const quotes =
    dimension.evidence.length > 0 ? (
      <ul role="list" className="rp-quote-list">
        {dimension.evidence.map((item, index) => (
          <li key={`${item.turnIndex}-${index}`}>
            <EvidenceQuote
              quote={item.quote}
              turn={item.turnIndex}
              href={turnHref(item.turnIndex)}
            />
          </li>
        ))}
      </ul>
    ) : (
      <p className="t-small t-muted">No quotable moment stood out for this skill.</p>
    );

  return (
    <article
      id={`dim-${dimension.id}`}
      className="glass card rp-dim"
      aria-labelledby={titleId}
      data-tone={scoreTone(dimension.score)}
    >
      <header className="rp-dim-head">
        <div className="rp-dim-id">
          <h3 id={titleId} className="rp-dim-title">
            {meta.label}
          </h3>
          <ul role="list" className="rp-care" aria-label="CARE behaviours">
            {meta.care.map((behaviour) => (
              <li key={behaviour} className="chip">
                {CARE_LABELS[behaviour]}
              </li>
            ))}
          </ul>
        </div>
        {badge ? <span className="chip chip-caution">{badge}</span> : null}
      </header>

      <div className="rp-dim-score">
        <span aria-hidden="true">
          <ProgressBar
            value={dimension.score}
            max={5}
            label={`${meta.label}: ${scoreOfFive(dimension.score)}`}
          />
        </span>
        <ScoreLine dimension={dimension} />
      </div>
      <p className="rp-rationale">{dimension.rationale}</p>

      {roomy ? (
        <div className="rp-dim-evidence">
          <p className="t-label">Evidence from your call</p>
          {quotes}
        </div>
      ) : (
        <Disclosure
          className="rp-dim-evidence"
          summary={
            dimension.evidence.length > 0
              ? `Evidence from your call (${dimension.evidence.length})`
              : 'Evidence from your call'
          }
        >
          {quotes}
        </Disclosure>
      )}

      <div className="rp-guidance">
        <p className="t-label">To strengthen this</p>
        <p>{dimension.guidance}</p>
      </div>
    </article>
  );
}

/** One card per skill: why it scored as it did, the quotes behind it and what to try. */
export function SkillDetailsSection({
  dimensions,
  turnHref,
}: {
  dimensions: readonly DimensionResult[];
  turnHref: (turn: number) => string;
}) {
  const ordered = [...dimensions].sort(byDimensionOrder);
  return (
    <section id="skill-details" className="rp-section" aria-labelledby="skill-details-title">
      <SectionHead id="skill-details-title" title="Skill details">
        Why each skill scored as it did, the moments from your call it rests on, and one thing to
        try.
      </SectionHead>
      <div className="rp-dims">
        {ordered.map((dimension) => (
          <DimensionCard key={dimension.id} dimension={dimension} turnHref={turnHref} />
        ))}
      </div>
    </section>
  );
}
