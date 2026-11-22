import type { CoachingReport } from '#shared/domain/report.ts';
import { Icon } from '../../design/index.ts';
import { BetterWording } from './BetterWording.tsx';
import { countWords, dimensionLabel, plainUnexpectedTurn } from './copy.ts';
import { TurnLink, useEvidence } from './evidence.tsx';
import { ClampedText, Quote, Section, SkillTag } from './parts.tsx';
import { wordingFor } from './report-model.ts';
import './coaching.css';

/** The most words a strength (its title and its reason) shows before "Show more". */
export const STRENGTH_WORDS = 35;
/** The most words an improvement (its title and its risk) shows before "Show more". */
export const IMPROVEMENT_WORDS = 45;

/** What the trainee did that helped, each with the words and the turn they happened at. */
export function Strengths({ report }: { report: CoachingReport }) {
  const { strengths } = report;
  return (
    <Section
      id="strengths"
      title="Strengths"
      lead={strengths.length > 0 ? 'What worked, in your own words.' : undefined}
    >
      {strengths.length === 0 ? (
        <p className="rp-empty">
          No clear strength stood out in this call. The improvements below are the best place to
          start.
        </p>
      ) : (
        <ul className="rp-items" role="list">
          {strengths.map((s) => {
            const title = plainUnexpectedTurn(s.title);
            return (
              <li
                className="rp-item rp-item--strength"
                key={`${s.dimension}-${s.turnIndex}-${s.title}`}
              >
                <SkillTag>
                  <Icon name="check-circle" size={16} />
                  {dimensionLabel(s.dimension)}
                </SkillTag>
                <div className="rp-item__copy" data-budget="strength">
                  <h3 className="rp-item__title">{title}</h3>
                  <ClampedText
                    className="rp-item__text"
                    text={plainUnexpectedTurn(s.whyItHelped)}
                    budget={STRENGTH_WORDS - countWords(title)}
                  />
                </div>
                <Quote quote={s.quote} turnIndex={s.turnIndex} />
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

type Improvement = CoachingReport['improvements'][number];

/** The evidence for an improvement: the words, or the plain statement that something never happened. */
function ImprovementEvidence({ item }: { item: Improvement }) {
  if (item.turnIndex === null) {
    return (
      <div className="rp-gap">
        <p className="rp-gap__label">
          <Icon name="info" size={16} />
          <span>Something that did not happen</span>
        </p>
      </div>
    );
  }
  if (item.quote) return <Quote quote={item.quote} turnIndex={item.turnIndex} />;
  return (
    <p className="rp-quote__foot">
      <span className="rp-quote__who">You</span> <TurnLink turnIndex={item.turnIndex} />
    </p>
  );
}

/**
 * Where a different choice would have helped: the words said, or the plain statement that
 * something never happened, the risk, the better wording as a comparison with what was said, and why
 * it is stronger.
 */
export function Improvements({ report }: { report: CoachingReport }) {
  const { improvements } = report;
  const { turns } = useEvidence();
  return (
    <Section
      id="improvements"
      title="Improvement opportunities"
      lead={improvements.length > 0 ? 'Where a different choice would have helped.' : undefined}
    >
      {improvements.length === 0 ? (
        <p className="rp-empty">No specific improvement stood out in this call.</p>
      ) : (
        <ul className="rp-items" role="list">
          {improvements.map((item) => {
            const title = plainUnexpectedTurn(item.title);
            const wording = wordingFor(item, turns);
            return (
              <li
                className="rp-item rp-item--improvement"
                key={`${item.dimension}-${item.turnIndex}-${item.title}`}
              >
                <SkillTag>
                  <Icon name="flag" size={16} />
                  {dimensionLabel(item.dimension)}
                </SkillTag>
                <div className="rp-item__copy" data-budget="improvement">
                  <h3 className="rp-item__title">{title}</h3>
                  <ClampedText
                    className="rp-item__text"
                    text={plainUnexpectedTurn(item.risk)}
                    budget={IMPROVEMENT_WORDS - countWords(title)}
                  />
                </div>
                <ImprovementEvidence item={item} />
                {wording ? (
                  <BetterWording wording={wording} why={plainUnexpectedTurn(item.whyItWorks)} />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
