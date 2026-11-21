import type { CoachingReport } from '#shared/domain/report.ts';
import { Icon } from '../../design/index.ts';
import { countWords, dimensionLabel, plainUnexpectedTurn } from './copy.ts';
import { TurnLink } from './evidence.tsx';
import { ClampedText, Quote, Section, SkillTag } from './parts.tsx';
import { wordingPairs } from './report-model.ts';
import './report.css';

/** The most words a strength (its title and its reason) shows before "Show more". */
export const STRENGTH_WORDS = 35;
/** The most words an improvement (its title and its risk) shows before "Show more". */
export const IMPROVEMENT_WORDS = 45;
/** The most words the reason a better wording works shows before "Show more". */
const WORDING_WORDS = 40;

/** What the trainee did that helped, each with the words and the turn they happened at. */
export function Strengths({ report }: { report: CoachingReport }) {
  const { strengths } = report;
  return (
    <Section id="strengths" title="Strengths">
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
        {item.quote ? <Quote quote={item.quote} turnIndex={null} /> : null}
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

/** Where a different choice would have helped, with the words and the turn it happened at. */
export function Improvements({ report }: { report: CoachingReport }) {
  const { improvements } = report;
  return (
    <Section id="improvements" title="Improvements">
      {improvements.length === 0 ? (
        <p className="rp-empty">No specific improvement stood out in this call.</p>
      ) : (
        <ul className="rp-items" role="list">
          {improvements.map((item) => {
            const title = plainUnexpectedTurn(item.title);
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
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/**
 * What was said, and what could have been said instead, side by side, for each improvement. The
 * improved wording eases in after the original; where there was nothing said, the original says so.
 */
export function BetterWording({ report }: { report: CoachingReport }) {
  const pairs = wordingPairs(report);
  if (pairs.length === 0) return null;
  return (
    <Section id="wording" title="Better wording">
      <ul className="rp-wordings" role="list">
        {pairs.map(({ improvement, original, improved }) => (
          <li
            className="rp-wording"
            key={`${improvement.dimension}-${improvement.turnIndex}-${improvement.title}`}
          >
            <h3 className="rp-wording__for">{plainUnexpectedTurn(improvement.title)}</h3>
            <div className="rp-wording__pair">
              <div className="rp-wording__before">
                <p className="rp-wording__label">Original</p>
                {original ? (
                  <p className="rp-wording__text t-quote">{`\u201c${original}\u201d`}</p>
                ) : (
                  <p className="rp-wording__text rp-wording__none">Not said in this call</p>
                )}
              </div>
              <Icon name="arrow-right" size={20} className="rp-wording__arrow" />
              <div className="rp-wording__after">
                <p className="rp-wording__label">Improved</p>
                <p className="rp-wording__text t-quote">{`\u201c${improved}\u201d`}</p>
              </div>
            </div>
            <ClampedText
              className="rp-wording__why"
              text={`Why it works: ${plainUnexpectedTurn(improvement.whyItWorks)}`}
              budget={WORDING_WORDS}
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}
