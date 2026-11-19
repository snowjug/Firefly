import { Link } from 'react-router';
import type { SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { DIMENSIONS, SCORE_DESCRIPTIONS, SCORE_LABELS } from '#shared/domain/vocab.ts';
import { saveDraft } from '../../lib/draft.ts';
import { formatDateTime } from '../../lib/format.ts';
import { DifficultyChip } from '../Chips.tsx';
import { Icon } from '../Icon.tsx';
import { Disclosure } from './Disclosure.tsx';
import { ReportFeedbackButton } from './ReportFeedbackDialog.tsx';
import { SectionHead } from './SectionHead.tsx';
import { AUTOMATIC_FEEDBACK_NOTE, TRAINING_AID_NOTE, transcriptHref } from './labels.ts';

export function NextPracticeSection({
  session,
  next,
}: {
  session: Pick<SessionDTO, 'id' | 'scenarioId' | 'scenarioTitle'>;
  next: CoachingReport['nextPractice'];
}) {
  const focus = DIMENSIONS[next.dimension];
  const suggested = next.suggestedScenarioId;
  return (
    <section id="next" className="rp-section" aria-labelledby="next-title">
      <SectionHead id="next-title" title="Next practice target">
        One thing to work on in your next call, not a list of everything.
      </SectionHead>
      <div className="glass card rp-next">
        <div className="rp-next-focus">
          <span className="tone-icon" data-tone="violet" aria-hidden="true">
            <Icon name="target" size={22} />
          </span>
          <div>
            <p className="t-label">Focus skill</p>
            <p className="rp-next-skill">{focus.label}</p>
            <p className="t-small t-muted">{focus.description}</p>
          </div>
        </div>
        <p className="rp-next-reco">{next.recommendation}</p>

        {suggested ? (
          <div className="banner rp-next-banner">
            <div className="rp-next-suggest">
              <p className="t-label">Suggested next call</p>
              <p className="rp-next-title">{next.suggestedScenarioTitle ?? 'Suggested scenario'}</p>
              <p className="rp-next-level">
                <span>Difficulty</span>
                <DifficultyChip difficulty={next.suggestedDifficulty} />
              </p>
            </div>
            <Link
              to={`/scenarios/${encodeURIComponent(suggested)}/setup`}
              className="btn btn-light btn-lg"
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
        ) : (
          <p className="t-small t-muted">
            Suggested difficulty for your next call:{' '}
            <DifficultyChip difficulty={next.suggestedDifficulty} />
          </p>
        )}

        <div className="cluster rp-next-actions">
          <Link
            to={`/scenarios/${encodeURIComponent(session.scenarioId)}/setup`}
            className={suggested ? 'btn btn-secondary' : 'btn btn-primary'}
            viewTransition
          >
            Practise this scenario again
          </Link>
          <Link to={transcriptHref(session.id)} className="btn btn-secondary" viewTransition>
            <Icon name="notes" size={18} /> Review transcript
          </Link>
          <Link to="/history" className="btn btn-ghost" viewTransition>
            Back to history
          </Link>
        </div>
      </div>
    </section>
  );
}

export function AboutSection({
  session,
  report,
}: {
  session: Pick<SessionDTO, 'id' | 'turns'>;
  report: CoachingReport;
}) {
  const { evaluator } = report;
  return (
    <section id="about" className="rp-section rp-about" aria-labelledby="about-title">
      <SectionHead id="about-title" title="About this report" />
      <div className="glass card stack" style={{ ['--stack-gap' as string]: 'var(--sp-4)' }}>
        <p className="rp-training-note">{report.trainingNote}</p>
        <p className="t-small t-muted">{AUTOMATIC_FEEDBACK_NOTE}</p>
        <Disclosure summary="Report details and scoring rubric">
          <dl className="rp-facts">
            <div>
              <dt>Produced by</dt>
              <dd>
                {evaluator.name}, version {evaluator.version}
              </dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>{evaluator.providerLabel}</dd>
            </div>
            <div>
              <dt>Generated</dt>
              <dd>
                <time dateTime={report.generatedAt}>{formatDateTime(report.generatedAt)}</time>
              </dd>
            </div>
            <div>
              <dt>Evidence</dt>
              <dd>
                Quotes come from your transcript and link to the turn they were taken from. The CARE
                behaviours shown on each skill are a working guide for coaching conversations, not
                an official standard.
              </dd>
            </div>
            <div>
              <dt>Scoring rubric</dt>
              <dd>
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
              </dd>
            </div>
          </dl>
        </Disclosure>
        <div className="rp-about-foot">
          <p className="t-meta">{TRAINING_AID_NOTE}</p>
          <ReportFeedbackButton
            sessionId={session.id}
            evaluator={evaluator}
            turnCount={session.turns.length}
          />
        </div>
      </div>
    </section>
  );
}
