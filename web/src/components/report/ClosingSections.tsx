import { Link } from 'react-router';
import type { SessionDTO } from '#shared/domain/api.ts';
import type { CoachingReport } from '#shared/domain/report.ts';
import { DIMENSIONS, SCORE_DESCRIPTIONS, SCORE_LABELS } from '#shared/domain/vocab.ts';
import { formatDateTime } from '../../lib/format.ts';
import { DifficultyChip } from '../Chips.tsx';
import { Icon } from '../Icon.tsx';
import { FireflyCore } from '../core/FireflyCore.tsx';
import { Disclosure } from './Disclosure.tsx';
import { AUTOMATIC_FEEDBACK_NOTE, transcriptHref } from './labels.ts';

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
      <div className="rp-section-head">
        <h2 id="next-title" className="t-section">
          Next practice target
        </h2>
        <p className="rp-lead">One thing to work on in your next call, not a list of everything.</p>
      </div>
      <div className="surface rp-card rp-next">
        <div className="rp-next-core" aria-hidden="true">
          <FireflyCore signals={{ total: 6, lit: 0 }} quality="low" />
        </div>
        <div className="rp-next-focus">
          <p className="t-label">Focus skill</p>
          <p className="rp-next-skill">{focus.label}</p>
          <p className="t-small t-muted">{focus.description}</p>
        </div>
        <p className="rp-next-reco">{next.recommendation}</p>

        {suggested ? (
          <div className="rp-next-suggest">
            <div className="row between rp-next-suggest-head">
              <p className="t-label">Suggested next call</p>
              <span className="row" style={{ ['--row-gap' as string]: 'var(--sp-2)' }}>
                <span className="t-meta">Difficulty</span>
                <DifficultyChip difficulty={next.suggestedDifficulty} />
              </span>
            </div>
            <p className="rp-next-title">{next.suggestedScenarioTitle ?? 'Suggested scenario'}</p>
            <div>
              <Link
                to={`/scenarios/${encodeURIComponent(suggested)}/setup`}
                className="btn btn-primary btn-lg"
                viewTransition
              >
                Practise this next <Icon name="arrow-right" size={18} />
              </Link>
            </div>
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
            className={suggested ? 'btn btn-secondary' : 'btn btn-primary btn-lg'}
            viewTransition
          >
            Practise this scenario again
          </Link>
          <Link to={transcriptHref(session.id)} className="btn btn-secondary" viewTransition>
            Review transcript
          </Link>
          <Link to="/history" className="btn btn-ghost" viewTransition>
            Back to history
          </Link>
        </div>
      </div>
    </section>
  );
}

export function AboutSection({ report }: { report: CoachingReport }) {
  const { evaluator } = report;
  return (
    <section id="about" className="rp-section rp-about" aria-labelledby="about-title">
      <div className="rp-section-head">
        <h2 id="about-title" className="t-section">
          About this report
        </h2>
      </div>
      <div className="surface rp-card stack" style={{ ['--stack-gap' as string]: 'var(--sp-4)' }}>
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
      </div>
    </section>
  );
}
