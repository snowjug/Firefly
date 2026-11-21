import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { ReviewableSessionDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
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
import { Dialog, Disclosure, Field, Icon, TextArea, TextInput } from '../trainer/bridge.tsx';
import { ReviewTranscript } from './ReviewTranscript.tsx';
import { firstScoreInputId, ScoreField, SCORES } from './ScoreField.tsx';
import { ENDED_EARLY_NOTE, EndedEarlyTag, SampleTag } from './tags.tsx';

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

interface Problem {
  key: 'reviewer' | DimensionId;
  text: string;
}

/**
 * Scores one completed session without showing the AI's scores or the coaching report. Only the
 * transcript is requested, from an endpoint that carries no report, scores or markers, so none of
 * them can reach this view. On a wide screen the transcript stays in view beside the form; on a
 * narrow one it comes first and the form follows.
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
  const formTitleId = `${idBase}-form-title`;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const reviewerRef = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);

  const transcript = useApi((signal) => api.transcript(session.id, signal), [session.id]);

  const [scores, setScores] = useState<Scores>({});
  const [reviewer, setReviewer] = useState(initialReviewer);
  const [notes, setNotes] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const errors: ReviewErrors = attempted ? validateReview(reviewer, scores) : { scores: {} };
  const problems: Problem[] = [
    ...(errors.reviewer ? [{ key: 'reviewer' as const, text: errors.reviewer }] : []),
    ...DIMENSION_IDS.flatMap((dimension) => {
      const text = errors.scores[dimension];
      return text ? [{ key: dimension, text }] : [];
    }),
  ];
  const dirty = Object.keys(scores).length > 0 || notes.trim() !== '';

  function focusProblem(key: Problem['key']) {
    if (key === 'reviewer') reviewerRef.current?.focus();
    else document.getElementById(firstScoreInputId(idBase, key))?.focus();
  }

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

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

  const leave = () => (dirty ? setConfirmLeave(true) : onBack());
  const ended = session.completion === 'ended-early';

  return (
    <section className="cal-review" aria-labelledby={headingId}>
      <header className="cal-review__head">
        <button type="button" className="text-link cal-back" onClick={leave}>
          <Icon name="arrow-left" size={16} /> Back to the queue
        </button>
        <p className="cal-review__eyebrow type-label">Blind review</p>
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className="cal-review__title type-title">
          {session.scenarioTitle}
        </h2>
        <p className="cal-facts type-label">
          <span>
            <time dateTime={session.startedAt}>{formatDate(session.startedAt)}</time>
          </span>
          <span>{DIFFICULTY_PROFILES[session.difficulty].label}</span>
          <span>{plural(session.traineeTurns, 'trainee message')}</span>
          {ended ? <EndedEarlyTag /> : null}
          {session.isSample ? <SampleTag /> : null}
        </p>
        {ended ? <p className="cal-review__note">{ENDED_EARLY_NOTE}</p> : null}
        <p className="cal-review__lead">
          Read the transcript, then score each skill. The AI&rsquo;s scores and the coaching report
          stay hidden until you save, so your scores are independent.
        </p>
        <a
          href={`#${formId}`}
          className="cal-skip text-link"
          onClick={(event) => {
            event.preventDefault();
            reviewerRef.current?.focus();
          }}
        >
          Skip to the scoring form
        </a>
      </header>

      <div className="cal-review__grid">
        <ReviewTranscript
          turns={transcript.data?.turns ?? null}
          persona={transcript.data?.persona ?? null}
          loading={transcript.loading}
          error={transcript.error}
          onRetry={transcript.reload}
        />

        <form
          id={formId}
          className="cal-score-form"
          aria-labelledby={formTitleId}
          onSubmit={(event) => void submit(event)}
          noValidate
        >
          <h3 id={formTitleId} className="cal-score-form__title type-heading">
            Your scores
          </h3>

          <Disclosure summary="How to read the 1 to 5 scale">
            <dl className="cal-scale">
              {SCORES.map((score) => (
                <div key={score}>
                  <dt>
                    {score} &ndash; {SCORE_LABELS[score - 1]}
                  </dt>
                  <dd>{SCORE_DESCRIPTIONS[score]}</dd>
                </div>
              ))}
            </dl>
          </Disclosure>

          {problems.length > 0 ? (
            <div ref={summaryRef} tabIndex={-1} role="alert" className="cal-problems">
              <p className="cal-problems__title">
                {problems.length === 1
                  ? 'One thing needs attention before you can save.'
                  : `${problems.length} things need attention before you can save.`}
              </p>
              <ul>
                {problems.map((problem) => (
                  <li key={problem.key}>
                    <a
                      href={`#${formId}`}
                      onClick={(event) => {
                        event.preventDefault();
                        focusProblem(problem.key);
                      }}
                    >
                      {problem.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Field
            label="Reviewer name or initials"
            hint="Use initials. Do not enter real customer information."
            error={errors.reviewer}
          >
            <TextInput
              ref={reviewerRef}
              value={reviewer}
              maxLength={REVIEWER_LIMIT}
              counter={false}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setReviewer(event.target.value)}
            />
          </Field>

          <div className="cal-scores">
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
          </div>

          <Field
            label={
              <>
                Notes <span className="cal-optional">(optional)</span>
              </>
            }
            hint="Why you scored as you did. Do not include real customer information."
          >
            <TextArea
              serif
              rows={4}
              value={notes}
              maxLength={NOTES_LIMIT}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>

          {saveError ? (
            <p role="alert" className="cal-problem">
              <Icon name="alert" size={16} />
              <span>{saveError}</span>
            </p>
          ) : null}

          <div className="action-row cal-score-form__actions">
            <button
              type="submit"
              className="action"
              aria-disabled={saving || undefined}
              aria-busy={saving || undefined}
            >
              {saving ? 'Saving\u2026' : 'Save review'}
              {saving ? null : <Icon name="arrow-right" size={18} />}
            </button>
            <button type="button" className="action action--quiet" onClick={leave}>
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
        eyebrow="Blind review"
        title="Leave this review?"
        description="Your scores and notes have not been saved. If you leave now, they are discarded."
      >
        <div className="action-row cal-dialog__actions">
          <button
            type="button"
            className="action action--quiet"
            data-autofocus=""
            onClick={() => setConfirmLeave(false)}
          >
            Keep reviewing
          </button>
          <button
            type="button"
            className="action action--danger"
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
