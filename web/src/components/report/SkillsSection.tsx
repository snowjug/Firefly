import { useId } from 'react';
import type { DimensionResult } from '#shared/domain/report.ts';
import { CARE_LABELS, DIMENSION_IDS, DIMENSIONS } from '#shared/domain/vocab.ts';
import { scoreTone } from '../../lib/format.ts';
import { useMediaQuery } from '../../lib/hooks.ts';
import { Disclosure, Section, Tag } from './bridge.tsx';
import { EvidenceQuote } from './EvidenceQuote.tsx';
import { SUFFICIENCY_BADGE } from './labels.ts';
import { ScoreScale } from './ScoreScale.tsx';
import { SkillConstellation } from './SkillConstellation.tsx';

const byDimensionOrder = (a: DimensionResult, b: DimensionResult) =>
  DIMENSION_IDS.indexOf(a.id) - DIMENSION_IDS.indexOf(b.id);

/** "4 of 5 – Strong": always words and numbers, never colour alone. */
function ScoreLine({ dimension }: { dimension: DimensionResult }) {
  return (
    <p className="rp-skill__score">
      <span className="rp-skill__num tabular">{dimension.score}</span>
      <span className="rp-skill__of"> of 5</span>
      <span className="rp-skill__label"> &ndash; {dimension.label}</span>
    </p>
  );
}

function Skill({
  dimension,
  index,
  turnHref,
  sessionId,
}: {
  dimension: DimensionResult;
  index: number;
  turnHref: (turn: number) => string;
  sessionId: string;
}) {
  const roomy = useMediaQuery('(min-width: 720px)');
  const meta = DIMENSIONS[dimension.id];
  const badge = SUFFICIENCY_BADGE[dimension.sufficiency];
  const titleId = useId();

  const quotes =
    dimension.evidence.length > 0 ? (
      <ul role="list" className="rp-quotes">
        {dimension.evidence.map((item, at) => (
          <li key={`${item.turnIndex}-${at}`}>
            <EvidenceQuote
              quote={item.quote}
              turn={item.turnIndex}
              href={turnHref(item.turnIndex)}
              sessionId={sessionId}
            />
          </li>
        ))}
      </ul>
    ) : (
      <p className="rp-quiet">No quotable moment stood out for this skill.</p>
    );

  return (
    <li>
      <article
        id={`dim-${dimension.id}`}
        tabIndex={-1}
        className="rp-skill"
        aria-labelledby={titleId}
        data-tone={scoreTone(dimension.score)}
        data-sufficiency={dimension.sufficiency}
      >
        <header className="rp-skill__head">
          <p className="rp-skill__index type-label" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </p>
          <h3 id={titleId} className="rp-skill__title">
            {meta.label}
          </h3>
          <ScoreLine dimension={dimension} />
          <ScoreScale
            className="rp-skill__scale"
            score={dimension.score}
            label={meta.label}
            decorative
          />
          {badge ? <Tag tone="amber">{badge}</Tag> : null}
          <ul role="list" className="rp-care" aria-label="CARE behaviours">
            {meta.care.map((behaviour) => (
              <li key={behaviour}>{CARE_LABELS[behaviour]}</li>
            ))}
          </ul>
        </header>

        <div className="rp-skill__body">
          <p className="rp-rationale">{dimension.rationale}</p>
          {roomy ? (
            <div className="rp-evidence">
              <p className="type-label">Evidence from your call</p>
              {quotes}
            </div>
          ) : (
            <Disclosure
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
            <p className="type-label">To strengthen this</p>
            <p>{dimension.guidance}</p>
          </div>
        </div>
      </article>
    </li>
  );
}

/**
 * The six skills: the constellation first, which is also the way into each skill, then each skill
 * in full (why it scored as it did, the moments it rests on, one thing to try).
 */
export function SkillsSection({
  dimensions,
  eyebrow,
  turnHref,
  sessionId,
}: {
  dimensions: readonly DimensionResult[];
  eyebrow?: string;
  turnHref: (turn: number) => string;
  sessionId: string;
}) {
  const skills = [...dimensions].sort(byDimensionOrder);
  return (
    <Section id="skills" eyebrow={eyebrow} title="Six skill scores">
      <p className="rp-lead">
        Each skill is scored from 1 to 5 against the practice rubric, using quotes from your own
        call. Select a skill to jump to its details.
      </p>
      <SkillConstellation dimensions={skills} />
      <p className="rp-lead rp-lead--sub">
        Why each skill scored as it did, the moments from your call it rests on, and one thing to
        try.
      </p>
      <ol role="list" className="rp-skills">
        {skills.map((dimension, index) => (
          <Skill
            key={dimension.id}
            dimension={dimension}
            index={index}
            turnHref={turnHref}
            sessionId={sessionId}
          />
        ))}
      </ol>
    </Section>
  );
}
