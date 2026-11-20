import { useEffect, useId, useRef } from 'react';
import type { CalibrationRecordDTO } from '#shared/domain/api.ts';
import { DIMENSION_IDS, DIMENSIONS, scoreLabel } from '#shared/domain/vocab.ts';
import { ApiError } from '../../lib/api.ts';
import { Icon, LoadingNotice } from '../trainer/bridge.tsx';
import { StudioError } from '../trainer/StudioFrame.tsx';
import { differenceText, signed } from './bias.ts';
import { comparisonSummary } from './records-model.ts';
import { ScoreAxis, ScorePair } from './ScorePair.tsx';

// The review is safe; only the comparison could not be fetched. Said that way, and retryable.
const SAVED_BUT_NO_COMPARISON = new ApiError(
  0,
  'network',
  'Your review was saved, but the comparison could not be loaded.',
  true,
);

/**
 * After a review is saved: the AI's scores beside the mentor's, skill by skill, as a ledger. Each
 * row says it in words (the two scores and "AI 1 point higher") and draws it on a 1 to 5 scale, so
 * the difference is a place and a length as well as a sentence.
 */
export function ReviewComparison({
  title,
  record,
  loading,
  failed,
  onRetry,
  onBack,
  onNext,
}: {
  title: string;
  record: CalibrationRecordDTO | null;
  loading: boolean;
  failed: boolean;
  onRetry(): void;
  onBack(): void;
  /** Present when another session is waiting for review. */
  onNext: (() => void) | null;
}) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className="cal-comparison" aria-labelledby={headingId}>
      <header className="cal-review__head">
        <p className="cal-review__eyebrow type-label">Review saved</p>
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className="cal-review__title type-title">
          {title}
        </h2>
        {record ? (
          <p className="cal-review__lead">
            Your scores are saved. Here is how they compare with the AI&rsquo;s for this session.{' '}
            {comparisonSummary(record)}
          </p>
        ) : null}
      </header>

      {record ? (
        <>
          <div
            className="cal-scroll"
            role="region"
            aria-label="AI and mentor scores for this session"
            // A scrolling region has to be reachable from the keyboard.
            tabIndex={0}
          >
            <table className="cal-table cal-compare">
              <caption className="sr-only">AI and mentor scores for this session</caption>
              <thead>
                <tr>
                  <th scope="col">Skill</th>
                  <th scope="col">AI</th>
                  <th scope="col">Mentor ({record.reviewer})</th>
                  <th scope="col">Difference</th>
                  <th scope="col" className="cal-compare__scale">
                    <span className="sr-only">Place on the 1 to 5 scale</span>
                    <ScoreAxis />
                  </th>
                </tr>
              </thead>
              <tbody>
                {DIMENSION_IDS.map((dimension) => {
                  const ai = record.ai[dimension];
                  const mentor = record.mentor[dimension];
                  return (
                    <tr key={dimension}>
                      <th scope="row">{DIMENSIONS[dimension].label}</th>
                      <td data-label="AI">
                        <span className="cal-num">{ai}</span>{' '}
                        <span className="cal-word">{scoreLabel(ai)}</span>
                      </td>
                      <td data-label={`Mentor (${record.reviewer})`}>
                        <span className="cal-num">{mentor}</span>{' '}
                        <span className="cal-word">{scoreLabel(mentor)}</span>
                      </td>
                      <td data-label="Difference">
                        <span className="cal-diff" data-same={ai === mentor ? '' : undefined}>
                          {differenceText(ai, mentor)}
                        </span>{' '}
                        <span className="cal-word cal-num">({signed(ai - mentor, 0)})</span>
                      </td>
                      <td className="cal-compare__scale">
                        <ScorePair ai={ai} mentor={mentor} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="cal-key">
            <span className="cal-key__ai" aria-hidden="true" /> AI
            <span className="cal-key__mentor" aria-hidden="true" /> Mentor ({record.reviewer})
            <span className="cal-key__link" aria-hidden="true" /> The difference
          </p>
          <p className="cal-foot">Difference is the AI score minus the mentor score.</p>
        </>
      ) : failed ? (
        <StudioError
          error={SAVED_BUT_NO_COMPARISON}
          title="Could not load the comparison"
          onRetry={onRetry}
        />
      ) : loading ? (
        <LoadingNotice label="Loading the comparison" lines={4} />
      ) : (
        <p className="cal-review__lead">
          Your review was saved. The comparison is not available yet.
        </p>
      )}

      <div className="action-row cal-form__actions">
        {onNext ? (
          <button type="button" className="action" onClick={onNext}>
            Review another session <Icon name="arrow-right" size={18} />
          </button>
        ) : null}
        <button type="button" className={onNext ? 'text-link' : 'action'} onClick={onBack}>
          Back to calibration
        </button>
      </div>
    </section>
  );
}
