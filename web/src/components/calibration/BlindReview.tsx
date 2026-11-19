import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { ReviewableSessionDTO } from '#shared/domain/api.ts';
import {
  DIMENSION_IDS,
  DIMENSIONS,
  SCORE_DESCRIPTIONS,
  SCORE_LABELS,
  type DimensionId,
} from '#shared/domain/vocab.ts';
import { api, errorMessage } from '../../lib/api.ts';
import { formatDate, plural } from '../../lib/format.ts';
import { useApi } from '../../lib/hooks.ts';
import { DifficultyChip } from '../Chips.tsx';
import { Dialog } from '../Dialog.tsx';
import { Icon } from '../Icon.tsx';
import { ENDED_EARLY_NOTE, EndedEarlyChip } from './EndedEarly.tsx';
import { ReviewTranscript } from './ReviewTranscript.tsx';
import { SampleChip } from './SampleChip.tsx';
import { firstScoreInputId, ScoreField, SCORES } from './ScoreField.tsx';

export const NOTES_LIMIT = 500;
export const REVIEWER_LIMIT = 40;
// The same characters the server accepts for a reviewer name.
const REVIEWER_PATTERN = /^[\p{L}\p{N} .,'@_-]+$/u;

/** The facts about a session that the review screen needs. The AI's scores are not among them. */
export type ReviewSession = Pick<
  ReviewableSessionDTO,
  'id' | 'scenarioTitle' | 'startedAt' | 'difficulty' | 'traineeTurns' | 'completion' | 'isSample'
>;

export function toReviewSession(session: ReviewableSessionDTO): ReviewSession {
  return {
    id: session.id,
    scenarioTitle: session.scenarioTitle,
    startedAt: session.startedAt,
    difficulty: session.difficulty,
    traineeTurns: session.traineeTurns,
    completion: session.completion,
    isSample: session.isSample,
  };
}

type Scores = Partial<Record<DimensionId, number>>;

export interface ReviewErrors {
  reviewer?: string;
  scores: Partial<Record<DimensionId, string>>;
}

export function validateReview(reviewer: string, scores: Scores): ReviewErrors {
  const errors: ReviewErrors = { scores: {} };
  const name = reviewer.trim();
  if (name === '') errors.reviewer = 'Enter your name or initials.';
  else if (name.length > REVIEWER_LIMIT)
    errors.reviewer = `Use ${REVIEWER_LIMIT} characters or fewer.`;
  else if (!REVIEWER_PATTERN.test(name))
    errors.reviewer = 'Use letters, numbers and simple punctuation only.';
  for (const dimension of DIMENSION_IDS) {
    if (typeof scores[dimension] !== 'number')
      errors.scores[dimension] = `Choose a score for ${DIMENSIONS[dimension].label}.`;
  }
  return errors;
}

const hasErrors = (errors: ReviewErrors) =>
  errors.reviewer !== undefined || Object.keys(errors.scores).length > 0;

const isComplete = (scores: Scores): scores is Record<DimensionId, number> =>
  DIMENSION_IDS.every((dimension) => typeof scores[dimension] === 'number');

/**
 * Scores one completed session without showing the AI's scores or the coaching report. Only the
 * transcript is requested, from an endpoint that carries no report, scores or markers, so none of
 * them can reach this view.
 */
export function BlindReview({
  session,
  initialReviewer,
  onSaved,
  onBack,
}: {
  session: ReviewSession;
  initialReviewer: string;
  onSaved(reviewer: string): void;
  onBack(): void;
}) {
  const idBase = useId();
  const headingId = `${idBase}-heading`;
  const formId = `${idBase}-form`;
  const reviewerId = `${idBase}-reviewer`;
  const notesId = `${idBase}-notes`;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);

  const transcript = useApi(
    (signal) => api.transcript(session.id, signal).then((dto) => dto.turns),
    [session.id],
  );

  const [scores, setScores] = useState<Scores>({});
  const [reviewer, setReviewer] = useState(initialReviewer);
  const [notes, setNotes] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const errors: ReviewErrors = attempted ? validateReview(reviewer, scores) : { scores: {} };
  const problems = [
    ...(errors.reviewer ? [{ id: reviewerId, text: errors.reviewer }] : []),
    ...DIMENSION_IDS.flatMap((dimension) => {
      const text = errors.scores[dimension];
      return text ? [{ id: firstScoreInputId(idBase, dimension), text }] : [];
    }),
  ];
  const dirty = Object.keys(scores).length > 0 || notes.trim() !== '';

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  function focusField(id: string) {
    document.getElementById(id)?.focus();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    setAttempted(true);
    const found = validateReview(reviewer, scores);
    if (hasErrors(found) || !isComplete(scores)) {
      // The summary appears on the next render; focus it once it exists.
      window.requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    submitting.current = true;
    setSaving(true);
    setSaveError(null);
    const name = reviewer.trim();
    try {
      await api.mentorScore(session.id, {
        reviewer: name,
        scores,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onSaved(name);
    } catch (error) {
      setSaveError(errorMessage(error));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="cal-review" aria-labelledby={headingId}>
      <header className="glass card cal-review-head">
        <div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => (dirty ? setConfirmLeave(true) : onBack())}
          >
            <Icon name="arrow-left" size={16} /> Back to the queue
          </button>
        </div>
        <p className="t-label">Blind review</p>
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className="cal-review-title">
          {session.scenarioTitle}
        </h2>
        <p className="t-meta cal-review-meta">
          <span>{formatDate(session.startedAt)}</span>
          <DifficultyChip difficulty={session.difficulty} />
          <span>{plural(session.traineeTurns, 'trainee message')}</span>
          {session.completion === 'ended-early' ? <EndedEarlyChip /> : null}
          {session.isSample ? <SampleChip /> : null}
        </p>
        {session.completion === 'ended-early' ? (
          <p className="t-small t-muted">{ENDED_EARLY_NOTE}</p>
        ) : null}
        <p className="t-muted cal-review-lead">
          Read the transcript, then score each skill. The AI&rsquo;s scores and the coaching report
          stay hidden until you save, so your scores are independent.
        </p>
        <a href={`#${formId}`} className="cal-skip t-small">
          Skip to the scoring form
        </a>
      </header>

      <div className="cal-review-grid">
        <ReviewTranscript
          turns={transcript.data}
          loading={transcript.loading}
          error={transcript.error}
          onRetry={transcript.reload}
        />

        <form
          id={formId}
          className="glass card cal-form"
          onSubmit={(event) => void submit(event)}
          noValidate
        >
          <h3 className="t-body cal-subhead">Your scores</h3>

          <details className="cal-scale-guide">
            <summary>How to read the 1 to 5 scale</summary>
            <dl>
              {SCORES.map((score) => (
                <div key={score}>
                  <dt>
                    {score} &ndash; {SCORE_LABELS[score - 1]}
                  </dt>
                  <dd>{SCORE_DESCRIPTIONS[score]}</dd>
                </div>
              ))}
            </dl>
          </details>

          {problems.length > 0 ? (
            <div
              ref={summaryRef}
              tabIndex={-1}
              role="alert"
              className="callout callout-negative cal-problems"
            >
              <Icon name="alert" size={18} />
              <div>
                <p className="cal-problems-title">
                  {problems.length === 1
                    ? 'One thing needs attention before you can save.'
                    : `${problems.length} things need attention before you can save.`}
                </p>
                <ul>
                  {problems.map((problem) => (
                    <li key={problem.id}>
                      <a
                        href={`#${problem.id}`}
                        onClick={(event) => {
                          event.preventDefault();
                          focusField(problem.id);
                        }}
                      >
                        {problem.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          <div className="field">
            <label className="label" htmlFor={reviewerId}>
              Reviewer name or initials
            </label>
            <input
              id={reviewerId}
              className="input"
              value={reviewer}
              maxLength={REVIEWER_LIMIT}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={errors.reviewer ? true : undefined}
              aria-describedby={`${reviewerId}-hint${errors.reviewer ? ` ${reviewerId}-error` : ''}`}
              onChange={(event) => setReviewer(event.target.value)}
            />
            <p id={`${reviewerId}-hint`} className="hint">
              Use initials. Do not enter real customer information.
            </p>
            {errors.reviewer ? (
              <p id={`${reviewerId}-error`} className="field-error">
                {errors.reviewer}
              </p>
            ) : null}
          </div>

          {DIMENSION_IDS.map((dimension) => (
            <ScoreField
              key={dimension}
              idBase={idBase}
              dimension={dimension}
              value={scores[dimension]}
              error={errors.scores[dimension]}
              onChange={(score) => setScores((current) => ({ ...current, [dimension]: score }))}
            />
          ))}

          <div className="field">
            <label className="label" htmlFor={notesId}>
              Notes <span className="t-meta">(optional)</span>
            </label>
            <textarea
              id={notesId}
              className="textarea"
              rows={4}
              value={notes}
              maxLength={NOTES_LIMIT}
              aria-describedby={`${notesId}-hint ${notesId}-count`}
              onChange={(event) => setNotes(event.target.value)}
            />
            <p id={`${notesId}-hint`} className="hint">
              Why you scored as you did. Do not include real customer information.
            </p>
            <p id={`${notesId}-count`} className="hint tabular">
              {notes.length} of {NOTES_LIMIT} characters
            </p>
          </div>

          {saveError ? (
            <div className="callout callout-negative" role="alert">
              <Icon name="alert" size={18} />
              <p>{saveError}</p>
            </div>
          ) : null}

          <div className="cal-form-actions">
            <button type="submit" className="btn btn-primary" aria-disabled={saving || undefined}>
              {saving ? <span className="spinner" aria-hidden="true" /> : null}
              {saving ? 'Saving\u2026' : 'Save review'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => (dirty ? setConfirmLeave(true) : onBack())}
            >
              Back to the queue
            </button>
            <span className="sr-only" role="status">
              {saving ? 'Saving your review' : ''}
            </span>
          </div>
        </form>
      </div>

      <Dialog
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Leave this review?"
        description="Your scores and notes have not been saved. If you leave now, they are discarded."
      >
        <div className="cal-dialog-actions">
          <button
            type="button"
            className="btn btn-secondary"
            data-autofocus=""
            onClick={() => setConfirmLeave(false)}
          >
            Keep reviewing
          </button>
          <button
            type="button"
            className="btn btn-danger-solid"
            onClick={() => {
              setConfirmLeave(false);
              onBack();
            }}
          >
            Discard and leave
          </button>
        </div>
      </Dialog>
    </section>
  );
}
