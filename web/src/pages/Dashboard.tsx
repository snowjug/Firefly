import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { SessionSummaryDTO } from '#shared/domain/api.ts';
import { recommendMission } from '#shared/domain/recommend.ts';
import {
  activeCall,
  pickScenarios,
  practiceStats,
  recentCalls,
} from '../components/dashboard/dashboard-model.ts';
import { NextSkill } from '../components/dashboard/NextSkill.tsx';
import { PracticeBanner } from '../components/dashboard/PracticeBanner.tsx';
import { NoRecentCalls, RecentCalls } from '../components/dashboard/RecentCalls.tsx';
import { ScenarioCards, ScenarioCardsSkeleton } from '../components/dashboard/ScenarioCards.tsx';
import { StatsRow } from '../components/dashboard/StatsRow.tsx';
import { TourEntry } from '../components/dashboard/TourEntry.tsx';
import { Icon } from '../components/Icon.tsx';
import { EmptyState, ErrorState, Page, PageHeader, SkeletonBlock } from '../components/Page.tsx';
import { earnedCount } from '../components/rewards/rewards-model.ts';
import { api, errorMessage } from '../lib/api.ts';
import { useApi } from '../lib/hooks.ts';
import { usePractice } from '../lib/practice.ts';
import { firstName, greetingFor, useProfile } from '../lib/profile.ts';
import '../styles/dashboard.css';

const NO_SESSIONS: SessionSummaryDTO[] = [];

export default function Dashboard() {
  const { scenarios, sessions, progress } = usePractice();
  // One request for the badge count; "today" for a streak is the learner's own day.
  const rewards = useApi((signal) => api.rewards(new Date().getTimezoneOffset(), signal), []);
  const profile = useProfile();
  const [greeting] = useState(() => greetingFor());

  const list = sessions.data?.sessions ?? NO_SESSIONS;
  const stats = useMemo(() => practiceStats(list), [list]);
  const active = useMemo(() => activeCall(list), [list]);
  const recent = useMemo(() => recentCalls(list), [list]);
  // Only the latest calls are read, so a very long history says so rather than quietly under-counting.
  const partial = (sessions.data?.total ?? 0) > list.length;

  const ready = !scenarios.loading && !sessions.loading && !progress.loading;
  const recommendation = useMemo(
    () =>
      ready && scenarios.data && sessions.data
        ? recommendMission({ scenarios: scenarios.data, sessions: list, progress: progress.data })
        : null,
    [ready, scenarios.data, sessions.data, list, progress.data],
  );
  const picks = useMemo(
    () =>
      ready && scenarios.data && sessions.data
        ? pickScenarios({ scenarios: scenarios.data, sessions: list, recommendation })
        : [],
    [ready, scenarios.data, sessions.data, list, recommendation],
  );

  const retry = () => {
    if (scenarios.error) scenarios.reload();
    if (sessions.error) sessions.reload();
    if (rewards.error) rewards.reload();
  };
  const unreachable = Boolean(sessions.error && scenarios.error);
  const loadingSessions = sessions.loading && !sessions.data;

  const title = profile ? `${greeting}, ${firstName(profile.name)}` : 'Welcome to Firefly';

  let recommended;
  if (scenarios.error || sessions.error) {
    recommended = (
      <ErrorState
        error={scenarios.error ?? sessions.error}
        onRetry={retry}
        title="We could not load your recommendations"
      />
    );
  } else if (!ready) {
    recommended = <ScenarioCardsSkeleton />;
  } else if (picks.length > 0) {
    recommended = <ScenarioCards picks={picks} />;
  } else {
    recommended = (
      <EmptyState icon="grid" title="No scenarios are available">
        The scenario library is empty right now. Check back after the server has loaded its
        scenarios.
      </EmptyState>
    );
  }

  let recentBody;
  if (loadingSessions) {
    recentBody = (
      <div className="stack" role="status" aria-label="Loading recent practice">
        <SkeletonBlock height={52} />
        <SkeletonBlock height={52} />
        <SkeletonBlock height={52} />
      </div>
    );
  } else if (sessions.error) {
    recentBody = (
      <div className="stack" role="alert" style={{ ['--stack-gap' as string]: 'var(--sp-3)' }}>
        <p className="t-small t-muted">{errorMessage(sessions.error)}</p>
        <div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={sessions.reload}>
            <Icon name="refresh" size={16} /> Try again
          </button>
        </div>
      </div>
    );
  } else if (recent.length > 0) {
    recentBody = <RecentCalls calls={recent} />;
  } else {
    recentBody = <NoRecentCalls />;
  }

  return (
    <Page title="Home" className="dash">
      <PageHeader title={title} lead="Ready to practise a customer call?" />

      <div className="dash-body">
        <TourEntry />

        {unreachable ? (
          <div className="dash-block">
            <PracticeBanner active={null} />
            <ErrorState
              error={sessions.error}
              onRetry={retry}
              title="We could not load your home page"
            />
          </div>
        ) : (
          <>
            <section className="dash-block" aria-labelledby="dash-stats-title">
              <h2 id="dash-stats-title" className="sr-only">
                Your practice so far
              </h2>
              <StatsRow
                stats={sessions.data ? stats : sessions.error ? 'error' : 'loading'}
                badges={
                  rewards.data
                    ? {
                        earned: earnedCount(rewards.data.badges),
                        total: rewards.data.badges.length,
                      }
                    : rewards.error
                      ? 'error'
                      : 'loading'
                }
              />
              {partial ? (
                <p className="t-meta dash-partial">
                  These totals use your latest {list.length} calls.
                </p>
              ) : null}
            </section>

            <div className="dash-block">
              {loadingSessions ? (
                <div className="dash-banner-skeleton" role="status" aria-label="Loading">
                  <div className="skeleton" aria-hidden="true" />
                </div>
              ) : (
                <PracticeBanner active={active} />
              )}
            </div>

            <section className="dash-block" aria-labelledby="dash-reco-title">
              <div className="section-head">
                <h2 id="dash-reco-title" className="t-section">
                  Recommended scenarios
                </h2>
                <Link to="/scenarios" className="link-more" viewTransition>
                  View all <Icon name="arrow-right" size={16} />
                </Link>
              </div>
              {recommended}
            </section>

            <div className="dash-lower">
              <section className="glass card" aria-labelledby="dash-recent-title">
                <div className="section-head">
                  <h2 id="dash-recent-title" className="t-section">
                    Recent practice
                  </h2>
                  <Link to="/history" className="link-more" viewTransition>
                    View all <Icon name="arrow-right" size={16} />
                  </Link>
                </div>
                {recentBody}
              </section>
              <NextSkill progress={progress} />
            </div>
          </>
        )}
      </div>
    </Page>
  );
}
