import type { CoachingReport } from '#shared/domain/report.ts';
import { Icon, MessageBar } from '../../design/index.ts';
import { plainUnexpectedTurn, scoreText } from './copy.ts';
import { SectionLink } from './evidence.tsx';
import { ClampedText, Section } from './parts.tsx';
import { restsOnLimitedEvidence } from './report-model.ts';
import './report.css';

/** The most words the summary shows before "Show more". */
export const SUMMARY_WORDS = 45;

/**
 * The call in a few sentences, the average of the six skills, and one plain line about what this
 * is. A short or ended-early call says so here, before the scores that rest on it.
 */
export function Summary({ report }: { report: CoachingReport }) {
  const { overallScore, overall } = report.summary;
  return (
    <Section id="summary" title="Summary" className="rp-section--first">
      <div className="rp-summary">
        <div className="rp-summary__body">
          <ClampedText
            className="rp-summary__text t-reading"
            text={plainUnexpectedTurn(overall)}
            budget={SUMMARY_WORDS}
            budgetKey="summary"
          />
          <p className="rp-summary__note">
            <Icon name="info" size={16} />
            <span>
              Automatic practice feedback, not a performance assessment.{' '}
              <SectionLink to="about">About this report</SectionLink>
            </span>
          </p>
        </div>
        <div className="rp-overall">
          <p className="rp-overall__label">Overall</p>
          {overallScore !== null ? (
            <>
              <p className="rp-overall__score">
                <span className="rp-overall__number">{scoreText(overallScore)}</span> of 5
              </p>
              <p className="rp-overall__note">Average of the six skills</p>
            </>
          ) : (
            <p className="rp-overall__none">Not enough evidence for an overall score</p>
          )}
        </div>
      </div>
      {restsOnLimitedEvidence(report) ? (
        <MessageBar intent="info" live={false}>
          {report.completion.note ??
            'This call was short, so the coaching rests on limited evidence.'}
        </MessageBar>
      ) : null}
    </Section>
  );
}
