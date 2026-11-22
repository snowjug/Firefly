import type { CoachingReport } from '#shared/domain/report.ts';
import { Icon } from '../../design/index.ts';
import { BetterWording } from './BetterWording.tsx';
import { clampWords, countWords, dimensionLabel, plainUnexpectedTurn } from './copy.ts';
import { TurnLink, useEvidence } from './evidence.tsx';
import { customerReplyTo } from './evidence-model.ts';
import { ClampedText, Quote, Section, SkillTag } from './parts.tsx';
import { withoutTrend, wordingFor } from './report-model.ts';
import './coaching.css';

/** The most words a strength (its title and its reason) shows before "Show more". */
export const STRENGTH_WORDS = 35;
/** The most words an improvement (its title and its risk) shows before "Show more". */
export const IMPROVEMENT_WORDS = 45;
/** The most words of what the customer said next that a strength or an improvement quotes. */
const REACTION_WORDS = 30;

/**
 * What the customer said next, in the customer's own words, from the transcript. It stands where the
 * evaluator's sentence about the customer's hidden mood used to: it can be read, and followed to the
 * turn, where a movement of temperature or trust that the chart does not show cannot. It is only
 * given for a turn whose quote the transcript backs: a claim the transcript does not confirm gets
 * no evidence beside it.
 */
function Reaction({ turnIndex, quote }: { turnIndex: number | null; quote: string | null }) {
  const { turns, verify } = useEvidence();
  const reply = turnIndex === null ? null : customerReplyTo(turns, turnIndex);
  if (!reply || reply.role !== 'customer') return null;
  if (quote !== null && !verify(turnIndex, quote)) return null;
  const { shown } = clampWords(reply.text, REACTION_WORDS, { whole: true });
  return (
    <p className="rp-item__reaction">
      <span className="rp-item__who">{reply.speaker} replied</span>{' '}
      <span dir="auto">{`\u201c${shown}\u201d`}</span> <TurnLink turnIndex={reply.index} />
    </p>
  );
}

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
                    text={withoutTrend(plainUnexpectedTurn(s.whyItHelped))}
                    budget={STRENGTH_WORDS - countWords(title)}
                  />
                </div>
                <Quote quote={s.quote} turnIndex={s.turnIndex} />
                <Reaction turnIndex={s.turnIndex} quote={s.quote} />
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
                    text={withoutTrend(plainUnexpectedTurn(item.risk))}
                    budget={IMPROVEMENT_WORDS - countWords(title)}
                  />
                </div>
                <ImprovementEvidence item={item} />
                <Reaction turnIndex={item.turnIndex} quote={item.quote} />
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
