import type { DimensionResult } from '#shared/domain/report.ts';
import { DIMENSION_IDS, DIMENSIONS, scoreLabel } from '#shared/domain/vocab.ts';
import { useMediaQuery } from '../../lib/hooks.ts';
import { Icon } from '../Icon.tsx';
import { ScoreMeter } from '../ScoreMeter.tsx';
import { Disclosure } from './Disclosure.tsx';
import { EvidenceQuote } from './EvidenceQuote.tsx';
import { SUFFICIENCY_BADGE, careHint, scoreOfFive } from './labels.ts';

const byDimensionOrder = (a: DimensionResult, b: DimensionResult) =>
  DIMENSION_IDS.indexOf(a.id) - DIMENSION_IDS.indexOf(b.id);

/** "4 of 5 – Strong": always text, never colour alone. */
function ScoreLine({ score, className = '' }: { score: number; className?: string }) {
  return (
    <p className={`rp-score-line ${className}`.trim()}>
      <span className="rp-score-num tabular">{score}</span>
      <span className="rp-score-of"> of 5</span>
      <span className="rp-score-label"> &ndash; {scoreLabel(score)}</span>
    </p>
  );
}

function OverviewItem({ dimension }: { dimension: DimensionResult }) {
  const badge = SUFFICIENCY_BADGE[dimension.sufficiency];
  return (
    <a href={`#dim-${dimension.id}`} className="rp-ov">
      <span className="rp-ov-name">{DIMENSIONS[dimension.id].label}</span>
      <ScoreLine score={dimension.score} />
      <span aria-hidden="true" className="rp-ov-meter">
        <ScoreMeter score={dimension.score} label={scoreOfFive(dimension.score)} />
      </span>
      {badge ? <span className="rp-ov-badge">{badge}</span> : null}
      <Icon name="chevron-down" size={16} className="rp-ov-jump" />
    </a>
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
    <article id={`dim-${dimension.id}`} className="surface rp-dim" aria-labelledby={titleId}>
      <header className="rp-dim-head">
        <div className="rp-dim-id">
          <h3 id={titleId} className="rp-dim-title">
            {meta.label}
          </h3>
          <p className="t-meta">{careHint(dimension.id)}</p>
        </div>
        {badge ? <span className="chip chip-caution">{badge}</span> : null}
      </header>
      <div className="rp-dim-score">
        <span aria-hidden="true" className="rp-dim-meter">
          <ScoreMeter score={dimension.score} label={scoreOfFive(dimension.score)} />
        </span>
        <ScoreLine score={dimension.score} />
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

export function SkillsSection({
  dimensions,
  turnHref,
}: {
  dimensions: readonly DimensionResult[];
  turnHref: (turn: number) => string;
}) {
  const ordered = [...dimensions].sort(byDimensionOrder);
  return (
    <section id="skills" className="rp-section" aria-labelledby="skills-title">
      <div className="rp-section-head">
        <h2 id="skills-title" className="t-section">
          Six skill scores
        </h2>
        <p className="rp-lead">
          Each skill is scored from 1 to 5 against the practice rubric, using quotes from your own
          call. Select a skill to jump to its details.
        </p>
      </div>
      <ul role="list" className="rp-overview">
        {ordered.map((dimension) => (
          <li key={dimension.id}>
            <OverviewItem dimension={dimension} />
          </li>
        ))}
      </ul>
      <div className="rp-dims">
        {ordered.map((dimension) => (
          <DimensionCard key={dimension.id} dimension={dimension} turnHref={turnHref} />
        ))}
      </div>
    </section>
  );
}
