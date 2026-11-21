import type { CoachingReport } from '#shared/domain/report.ts';
import { Icon } from '../../design/index.ts';
import { dimensionLabel, plainUnexpectedTurn, turnName } from './copy.ts';
import { TurnLink } from './evidence.tsx';
import { Field, Quote, Section, SkillTag } from './parts.tsx';

/** What the trainee did that helped, each with the words and the turn they happened at. */
export function Strengths({ report }: { report: CoachingReport }) {
  const { strengths } = report;
  return (
    <Section
      id="strengths"
      title="What went well"
      lead="Moments from your call that helped, in your own words."
    >
      {strengths.length === 0 ? (
        <p className="rp-empty">
          No clear strength stood out in this call. The opportunities below are the best place to
          start.
        </p>
      ) : (
        <ul className="rp-items" role="list">
          {strengths.map((s) => (
            <li className="rp-item" key={`${s.dimension}-${s.turnIndex}-${s.title}`}>
              <SkillTag>{dimensionLabel(s.dimension)}</SkillTag>
              <h3 className="rp-item__title">{plainUnexpectedTurn(s.title)}</h3>
              <Quote quote={s.quote} turnIndex={s.turnIndex} />
              <Field label="Why it worked">
                <p className="t-reading">{plainUnexpectedTurn(s.whyItHelped)}</p>
              </Field>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

type Improvement = CoachingReport['improvements'][number];

/** The evidence for an opportunity: the words, or the plain statement that something never happened. */
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
    <p className="rp-turnref">
      <span className="rp-quote__who">You, {turnName(item.turnIndex).toLowerCase()}</span>
      <TurnLink turnIndex={item.turnIndex} />
    </p>
  );
}

/** Where a different choice would have helped, with wording to try and why it works. */
export function Improvements({ report }: { report: CoachingReport }) {
  const { improvements } = report;
  return (
    <Section
      id="improvements"
      title="What to improve"
      lead="Where a different choice could have helped, with wording you can try next time."
    >
      {improvements.length === 0 ? (
        <p className="rp-empty">No specific opportunity to improve stood out in this call.</p>
      ) : (
        <ul className="rp-items" role="list">
          {improvements.map((item) => (
            <li className="rp-item" key={`${item.dimension}-${item.turnIndex}-${item.title}`}>
              <SkillTag>{dimensionLabel(item.dimension)}</SkillTag>
              <h3 className="rp-item__title">{plainUnexpectedTurn(item.title)}</h3>
              <ImprovementEvidence item={item} />
              <Field label="The risk">
                <p className="t-reading">{plainUnexpectedTurn(item.risk)}</p>
              </Field>
              <Field label="A stronger way to say it">
                <p className="rp-suggestion t-reading">
                  {plainUnexpectedTurn(item.betterPhrasing)}
                </p>
              </Field>
              <Field label="Why it works">
                <p className="t-reading">{plainUnexpectedTurn(item.whyItWorks)}</p>
              </Field>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
