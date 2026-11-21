import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
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
import { LoadingNotice, Toggle } from '../components/trainer/bridge.tsx';
import {
  StudioError,
  StudioFrame,
  StudioNote,
  StudioSection,
} from '../components/trainer/StudioFrame.tsx';
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

  if (review) {
    return (
      <StudioFrame tool="calibration" compact>
        {review.saved === null ? (
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
        )}
      </StudioFrame>
    );
  }

  return (
    <StudioFrame
      tool="calibration"
      lead="Check whether the AI's coaching scores roughly agree with an experienced mentor's scores for the same call."
      actions={
        <div className="cal-samples">
          <Toggle
            checked={includeSamples}
            onChange={setIncludeSamples}
            label="Include sample records (synthetic examples)"
            hint="Off by default. Sample records use synthetic mentor scores and are always marked Sample."
          />
        </div>
      }
    >
      <CalibrationIntro />

      <StudioSection
        title="What the reviews show"
        about="Figures worked out from the stored reviews, and how many they rest on."
        busy={cal.loading}
        aside={
          <p className="cal-updating" role="status">
            {cal.loading && data ? 'Updating\u2026' : ''}
          </p>
        }
      >
        {cal.error && !data ? (
          <StudioError
            error={cal.error}
            onRetry={cal.reload}
            title="Could not load calibration data"
          />
        ) : !data ? (
          <LoadingNotice label="Loading calibration data" lines={4} />
        ) : data.metrics.sessions === 0 ? (
          <StudioNote title="No mentor reviews yet">
            <p>
              To begin, score a completed practice session in the review queue below. Each review
              adds one comparison between the AI&rsquo;s scores and a mentor&rsquo;s.
            </p>
            {includeSamples ? null : (
              <p>
                If you loaded sample sessions from the{' '}
                <Link to="/trainer" className="text-link" viewTransition>
                  Trainer page
                </Link>
                , switch on &ldquo;Include sample records&rdquo; to see those.
              </p>
            )}
            <p>
              To compare larger sets of score files, see the calibration guide in
              docs/calibration.md.
            </p>
          </StudioNote>
        ) : (
          <MetricsPanel metrics={data.metrics} records={data.records} />
        )}
      </StudioSection>

      {data ? (
        <>
          <StudioSection
            title="Sessions waiting for review"
            about="Completed practice sessions that no mentor has scored yet."
            headingRef={queueHeadingRef}
            focusable
          >
            {data.reviewable.length > 0 ? (
              <ReviewQueue
                sessions={data.reviewable}
                onScore={(session) => setReview({ session: toReviewSession(session), saved: null })}
              />
            ) : (
              <p className="cal-plain">
                Nothing is waiting for review. Finish a practice call and it will appear here.
              </p>
            )}
          </StudioSection>

          {data.records.length > 0 ? (
            <StudioSection
              title="Review records"
              about="Every stored comparison, with who scored it and where the scores came from."
              stack
            >
              <RecordsTable records={data.records} />
            </StudioSection>
          ) : null}
        </>
      ) : null}
    </StudioFrame>
  );
}
