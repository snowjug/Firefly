import { useEffect, useId, useRef } from 'react';
import type { CalibrationRecordDTO } from '#shared/domain/api.ts';
import { DIMENSION_IDS, DIMENSIONS, scoreLabel } from '#shared/domain/vocab.ts';
import { plural } from '../../lib/format.ts';
import { Icon } from '../Icon.tsx';
import { SkeletonBlock } from '../Page.tsx';
import { differenceText, signed } from './bias.ts';

/** After a review is saved: the AI's scores beside the mentor's, skill by skill. */
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

  const differences = record
    ? DIMENSION_IDS.map((dimension) => record.ai[dimension] - record.mentor[dimension])
    : [];
  const averageGap =
    differences.length > 0
      ? differences.reduce((sum, d) => sum + Math.abs(d), 0) / differences.length
      : 0;
  const closeCount = differences.filter((d) => Math.abs(d) <= 1).length;

  return (
    <section className="glass card cal-comparison" aria-labelledby={headingId}>
      <p className="t-label">Review saved</p>
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="cal-review-title">
        {title}
      </h2>

      {record ? (
        <>
          <p className="t-muted">
            Your scores are saved. Here is how they compare with the AI&rsquo;s for this session. On
            average they differ by {averageGap.toFixed(1)} points, and{' '}
            {closeCount === DIMENSION_IDS.length
              ? 'all six skills are'
              : `${closeCount} of ${plural(DIMENSION_IDS.length, 'skill')} ${closeCount === 1 ? 'is' : 'are'}`}{' '}
            within 1 point.
          </p>
          <div
            className="table-wrap cal-table-wrap"
            role="region"
            aria-label="AI and mentor scores for this session"
            // A scrolling region has to be reachable from the keyboard.
            tabIndex={0}
          >
            <table className="table cal-table">
              <caption className="sr-only">AI and mentor scores for this session</caption>
              <thead>
                <tr>
                  <th scope="col">Skill</th>
                  <th scope="col">AI</th>
                  <th scope="col">Mentor ({record.reviewer})</th>
                  <th scope="col">Difference</th>
                </tr>
              </thead>
              <tbody>
                {DIMENSION_IDS.map((dimension) => {
                  const ai = record.ai[dimension];
                  const mentor = record.mentor[dimension];
                  return (
                    <tr key={dimension}>
                      <th scope="row">{DIMENSIONS[dimension].label}</th>
                      <td>
                        <span className="tabular">{ai}</span>{' '}
                        <span className="t-meta">{scoreLabel(ai)}</span>
                      </td>
                      <td>
                        <span className="tabular">{mentor}</span>{' '}
                        <span className="t-meta">{scoreLabel(mentor)}</span>
                      </td>
                      <td>
                        {differenceText(ai, mentor)}{' '}
                        <span className="t-meta tabular">({signed(ai - mentor, 0)})</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="t-meta">Difference is the AI score minus the mentor score.</p>
        </>
      ) : failed ? (
        <div className="callout callout-negative" role="alert">
          <Icon name="alert" size={18} />
          <div className="stack" style={{ ['--stack-gap' as string]: 'var(--sp-3)' }}>
            <p>Your review was saved, but the comparison could not be loaded.</p>
            <div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
                <Icon name="refresh" size={16} /> Try again
              </button>
            </div>
          </div>
        </div>
      ) : loading ? (
        <div className="stack" role="status" aria-label="Loading the comparison">
          <SkeletonBlock height={20} width="60%" />
          <SkeletonBlock height={180} />
        </div>
      ) : (
        <p className="t-muted">Your review was saved. The comparison is not available yet.</p>
      )}

      <div className="cal-form-actions">
        {onNext ? (
          <button type="button" className="btn btn-primary" onClick={onNext}>
            Review another session
          </button>
        ) : null}
        <button
          type="button"
          className={`btn ${onNext ? 'btn-secondary' : 'btn-primary'}`}
          onClick={onBack}
        >
          Back to calibration
        </button>
      </div>
    </section>
  );
}
