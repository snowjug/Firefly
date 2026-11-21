import { Link } from 'react-router';
import type { SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { DIMENSIONS, SCORE_DESCRIPTIONS, SCORE_LABELS } from '#shared/domain/vocab.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import { saveDraft } from '../../lib/draft.ts';
import { formatDateTime } from '../../lib/format.ts';
import { Icon } from '../Icon.tsx';
import { Disclosure, Ledger, Section, Tag } from './bridge.tsx';
import { CopyButton } from './CopyButton.tsx';
import { ReportFeedbackButton } from './ReportFeedbackDialog.tsx';
import {
  AUTOMATIC_FEEDBACK_NOTE,
  TRAINING_AID_NOTE,
  summaryToCopy,
  transcriptHref,
} from './labels.ts';

/** One focus skill and the call to practise it on: the single thing to take from the report. */
export function NextPracticeSection({
  session,
  report,
  eyebrow,
}: {
  session: Pick<SessionDTO, 'id' | 'scenarioId' | 'scenarioTitle' | 'startedAt'>;
  report: CoachingReport;
  eyebrow?: string;
}) {
  const next = report.nextPractice;
  const focus = DIMENSIONS[next.dimension];
  const suggested = next.suggestedScenarioId;
  const level = DIFFICULTY_PROFILES[next.suggestedDifficulty].label;
  return (
    <Section id="next" eyebrow={eyebrow} title="Next practice target">
      <p className="rp-lead">One thing to work on in your next call, not a list of everything.</p>
      <div className="rp-next">
        <div className="rp-next__focus">
          <p className="type-label">Focus skill</p>
          <p className="rp-next__skill">{focus.label}</p>
          <p className="rp-next__what">{focus.description}</p>
        </div>
        <div className="rp-next__plan">
          <p className="rp-next__reco">{next.recommendation}</p>

          {suggested ? (
            <div className="rp-next__suggest">
              <p className="type-label">Suggested next call</p>
              <p className="rp-next__title">
                {next.suggestedScenarioTitle ?? 'Suggested scenario'}
              </p>
              <p className="rp-next__level">
                <span>Difficulty</span>
                <Tag>{level}</Tag>
              </p>
              <div className="action-row">
                <Link
                  to={`/scenarios/${encodeURIComponent(suggested)}/setup`}
                  className="action"
                  // Open the setup at the suggested difficulty rather than the scenario's own.
                  onClick={() =>
                    saveDraft({
                      scenarioId: suggested,
                      overrides: { difficulty: next.suggestedDifficulty },
                    })
                  }
                  viewTransition
                >
                  Practise this next <Icon name="arrow-right" size={18} />
                </Link>
              </div>
            </div>
          ) : (
            <p className="rp-next__level">
              <span>Suggested difficulty for your next call:</span>
              <Tag>{level}</Tag>
            </p>
          )}

          <div className="action-row rp-next__actions">
            <Link
              to={`/scenarios/${encodeURIComponent(session.scenarioId)}/setup`}
              className={suggested ? 'text-link' : 'action'}
              viewTransition
            >
              Practise this scenario again
            </Link>
            <Link to={transcriptHref(session.id)} className="text-link" viewTransition>
              Review transcript
            </Link>
            <Link to="/history" className="text-link" viewTransition>
              Back to history
            </Link>
            <CopyButton
              text={summaryToCopy(session, report)}
              label="Copy summary"
              done="Summary copied to the clipboard."
            />
          </div>
        </div>
      </div>
    </Section>
  );
}

/** What the report is and is not, how it was made, how to question it, and the training-aid line. */
export function AboutSection({
  session,
  report,
  eyebrow,
}: {
  session: Pick<SessionDTO, 'id' | 'turns'>;
  report: CoachingReport;
  eyebrow?: string;
}) {
  const { evaluator } = report;
  return (
    <Section id="about" eyebrow={eyebrow} title="About this report">
      <div className="rp-about">
        <p className="rp-about__note">{report.trainingNote}</p>
        <p className="rp-quiet">{AUTOMATIC_FEEDBACK_NOTE}</p>
        <Disclosure summary="Report details and scoring rubric">
          <Ledger
            rows={[
              {
                label: 'Produced by',
                value: `${evaluator.name}, version ${evaluator.version}`,
              },
              { label: 'Mode', value: evaluator.providerLabel },
              {
                label: 'Generated',
                value: (
                  <time dateTime={report.generatedAt}>{formatDateTime(report.generatedAt)}</time>
                ),
              },
              {
                label: 'Evidence',
                value:
                  'Quotes come from your transcript and link to the turn they were taken from. The CARE behaviours shown on each skill are a working guide for coaching conversations, not an official standard.',
              },
              {
                label: 'Scoring rubric',
                value: (
                  <ol role="list" className="rp-rubric">
                    {SCORE_LABELS.map((label, index) => (
                      <li key={label}>
                        <strong>
                          {index + 1} &ndash; {label}.
                        </strong>{' '}
                        {SCORE_DESCRIPTIONS[index + 1]}
                      </li>
                    ))}
                  </ol>
                ),
              },
            ]}
          />
        </Disclosure>
        <div className="rp-about__foot">
          <p className="rp-quiet">{TRAINING_AID_NOTE}</p>
          <ReportFeedbackButton
            sessionId={session.id}
            evaluator={evaluator}
            turnCount={session.turns.length}
          />
        </div>
      </div>
    </Section>
  );
}
