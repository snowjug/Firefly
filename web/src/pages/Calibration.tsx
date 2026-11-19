import { useEffect, useId, useRef, useState } from 'react';
import {
  BlindReview,
  toReviewSession,
  type ReviewSession,
} from '../components/calibration/BlindReview.tsx';
import { CalibrationIntro } from '../components/calibration/CalibrationIntro.tsx';
import { MetricsPanel } from '../components/calibration/MetricsPanel.tsx';
import { RecordsTable } from '../components/calibration/RecordsTable.tsx';
import { queueButtonId, ReviewQueue } from '../components/calibration/ReviewQueue.tsx';
import { ReviewComparison } from '../components/calibration/ReviewComparison.tsx';
import { Icon } from '../components/Icon.tsx';
import { ErrorState, Page, PageHeader, SkeletonBlock } from '../components/Page.tsx';
import { api } from '../lib/api.ts';
import { useApi } from '../lib/hooks.ts';
import { useToast } from '../lib/toast.tsx';
import '../styles/calibration.css';

interface ReviewState {
  session: ReviewSession;
  /** The reviewer name once the review has been saved. */
  saved: string | null;
}

export default function Calibration() {
  const toggleId = useId();
  const resultsId = useId();
  const queueId = useId();
  const recordsId = useId();
  const queueHeadingRef = useRef<HTMLHeadingElement>(null);
  const { toast } = useToast();

  const [includeSamples, setIncludeSamples] = useState(false);
  const cal = useApi((signal) => api.calibration(includeSamples, signal), [includeSamples]);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [lastReviewer, setLastReviewer] = useState('');
  const [returnTo, setReturnTo] = useState<string | null>(null);

  // Back from a review: put focus on the button that opened it, or on the queue if it is gone.
  useEffect(() => {
    if (review === null && returnTo !== null) {
      (document.getElementById(returnTo) ?? queueHeadingRef.current)?.focus();
    }
  }, [review, returnTo]);

  function leaveReview() {
    if (review) setReturnTo(queueButtonId(review.session.id));
    setReview(null);
  }

  function handleSaved(reviewer: string) {
    if (!review) return;
    setLastReviewer(reviewer);
    cal.reload();
    setReview({ ...review, saved: reviewer });
    toast({ tone: 'positive', title: 'Review saved' });
  }

  const data = cal.data;
  const savedRecord =
    review?.saved && data
      ? (data.records.find(
          (record) => record.sessionId === review.session.id && record.reviewer === review.saved,
        ) ?? null)
      : null;
  const nextSession =
    review && data ? data.reviewable.find((s) => s.id !== review.session.id) : null;

  return (
    <Page title="Calibration">
      <PageHeader
        title="Calibration"
        lead={
          review
            ? undefined
            : "Check whether the AI's coaching scores roughly agree with an experienced mentor's scores for the same call."
        }
      />

      {review ? (
        review.saved === null ? (
          <BlindReview
            key={review.session.id}
            session={review.session}
            initialReviewer={lastReviewer}
            onSaved={handleSaved}
            onBack={leaveReview}
          />
        ) : (
          <ReviewComparison
            title={review.session.scenarioTitle}
            record={savedRecord}
            loading={cal.loading}
            failed={Boolean(cal.error)}
            onRetry={cal.reload}
            onBack={leaveReview}
            onNext={
              nextSession
                ? () => setReview({ session: toReviewSession(nextSession), saved: null })
                : null
            }
          />
        )
      ) : (
        <div className="cal-layout">
          <CalibrationIntro />

          {cal.error && !data ? (
            <ErrorState
              error={cal.error}
              onRetry={cal.reload}
              title="Could not load calibration data"
            />
          ) : !data ? (
            <div className="glass card stack" role="status" aria-label="Loading calibration data">
              <SkeletonBlock height={22} width="40%" />
              <SkeletonBlock height={72} />
              <SkeletonBlock height={140} />
            </div>
          ) : (
            <>
              <label className="option cal-toggle" htmlFor={toggleId}>
                <input
                  id={toggleId}
                  type="checkbox"
                  checked={includeSamples}
                  onChange={(event) => setIncludeSamples(event.target.checked)}
                />
                <span className="option-check" aria-hidden="true" />
                <span className="option-title">Include sample records (synthetic examples)</span>
                <span className="hint">
                  Off by default. Sample records use synthetic mentor scores and are always marked
                  Sample.
                </span>
              </label>

              <section
                className="glass card stack"
                aria-labelledby={resultsId}
                aria-busy={cal.loading}
              >
                <div className="row between cal-section-head">
                  <h2 id={resultsId} className="t-section">
                    What the reviews show
                  </h2>
                  <span className="t-meta" role="status">
                    {cal.loading ? 'Updating\u2026' : ''}
                  </span>
                </div>
                {data.metrics.sessions === 0 ? (
                  <div className="cal-empty">
                    <span className="state-icon" aria-hidden="true">
                      <Icon name="target" size={26} />
                    </span>
                    <h3 className="t-section">No mentor reviews yet</h3>
                    <p>
                      To begin, score a completed practice session in the review queue below. Each
                      review adds one comparison between the AI&rsquo;s scores and a mentor&rsquo;s.
                    </p>
                    {includeSamples ? null : (
                      <p>
                        If you loaded sample sessions from the Trainer page, switch on
                        &ldquo;Include sample records&rdquo; to see those.
                      </p>
                    )}
                    <p className="t-small">
                      To compare larger sets of score files, see the calibration guide in
                      docs/calibration.md.
                    </p>
                  </div>
                ) : (
                  <MetricsPanel metrics={data.metrics} records={data.records} />
                )}
              </section>

              <section className="glass card stack" aria-labelledby={queueId}>
                <div>
                  <h2 id={queueId} ref={queueHeadingRef} tabIndex={-1} className="t-section">
                    Sessions waiting for review
                  </h2>
                  <p className="t-small t-muted">
                    Completed practice sessions that no mentor has scored yet.
                  </p>
                </div>
                {data.reviewable.length > 0 ? (
                  <ReviewQueue
                    sessions={data.reviewable}
                    onScore={(session) =>
                      setReview({ session: toReviewSession(session), saved: null })
                    }
                  />
                ) : (
                  <p className="t-muted">
                    Nothing is waiting for review. Finish a practice call and it will appear here.
                  </p>
                )}
              </section>

              {data.records.length > 0 ? (
                <section className="glass card stack" aria-labelledby={recordsId}>
                  <h2 id={recordsId} className="t-section">
                    Review records
                  </h2>
                  <RecordsTable records={data.records} />
                </section>
              ) : null}
            </>
          )}
        </div>
      )}
    </Page>
  );
}
