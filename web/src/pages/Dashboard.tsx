import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { SessionSummaryDTO } from '#shared/domain/api.ts';
import { recommendMission } from '#shared/domain/recommend.ts';
import { buildAtlas } from '../components/atlas/atlas-model.ts';
import {
  activeCall,
  hasPractised,
  heroMissionOf,
  practiceStats,
  recentCalls,
} from '../components/dashboard/dashboard-model.ts';
import { LastCall, NoRecentCalls } from '../components/dashboard/LastCall.tsx';
import { AlsoSuggested, NextMission, OpenCall } from '../components/dashboard/NextMission.tsx';
import { NextSkill } from '../components/dashboard/NextSkill.tsx';
import { PracticeLedger } from '../components/dashboard/PracticeLedger.tsx';
import { QuickLinks } from '../components/dashboard/QuickLinks.tsx';
import { TourEntry } from '../components/dashboard/TourEntry.tsx';
import { EmptyNotice, ErrorNotice, LoadingNotice } from '../components/frame/Notices.tsx';
import { PageFrame, PageHead, Section } from '../components/frame/PageFrame.tsx';
import { Icon } from '../components/Icon.tsx';
import { earnedCount } from '../components/rewards/rewards-model.ts';
import { useWorldPose } from '../components/world/useWorldPose.ts';
import { api } from '../lib/api.ts';
import { useApi } from '../lib/hooks.ts';
import { usePractice } from '../lib/practice.ts';
import { firstName, greetingFor, useProfile } from '../lib/profile.ts';
import '../styles/dashboard.css';

const NO_SESSIONS: SessionSummaryDTO[] = [];

const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export default function Dashboard() {
  const { scenarios, sessions, progress } = usePractice();
  // One request for the badge count; "today" for a streak is the learner's own day.
  const rewards = useApi((signal) => api.rewards(new Date().getTimezoneOffset(), signal), []);
  const profile = useProfile();
  const [greeting] = useState(() => greetingFor());
  const [today] = useState(() => dayFormat.format(new Date()));
  useWorldPose({ intensity: 0.65 });

  const list = sessions.data?.sessions ?? NO_SESSIONS;
  const stats = useMemo(() => practiceStats(list), [list]);
  const active = useMemo(() => activeCall(list), [list]);
  const recent = useMemo(() => recentCalls(list, 1), [list]);
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
  // The map's own model: it knows each mission's instrument and who is calling.
  const missions = useMemo(
    () =>
      scenarios.data
        ? buildAtlas(scenarios.data, list, recommendation?.scenario.id ?? null).missions
        : [],
    [scenarios.data, list, recommendation],
  );
  const missionById = (id: string) => missions.find((mission) => mission.id === id);
  // The map leaves out a scenario of an issue type it does not know; the suggestion still names it.
  const recommended = recommendation
    ? (missionById(recommendation.scenario.id) ?? heroMissionOf(recommendation.scenario))
    : undefined;

  const retry = () => {
    if (scenarios.error) scenarios.reload();
    if (sessions.error) sessions.reload();
    if (rewards.error) rewards.reload();
  };
  const loadingSessions = sessions.loading && !sessions.data;
  const failed = scenarios.error ?? sessions.error;
  const practised = Boolean(sessions.data) && hasPractised(stats, recent);

  const name = profile ? firstName(profile.name) : null;
  const title = name ? (
    <>
      {greeting}, <em>{name}</em>.
    </>
  ) : (
    <>
      Welcome to <em>Firefly</em>.
    </>
  );

  let hero: ReactNode;
  if (active) {
    const open = missionById(active.scenarioId);
    hero = (
      <>
        <OpenCall call={active} scenario={open} persona={open?.persona ?? null} />
        {recommended && recommendation ? (
          <AlsoSuggested mission={recommended} reason={recommendation.reason} />
        ) : null}
      </>
    );
  } else if (failed) {
    hero = (
      <>
        <ErrorNotice
          error={failed}
          onRetry={retry}
          title={
            scenarios.error && sessions.error
              ? 'We could not load your home page'
              : sessions.error
                ? 'We could not load your calls'
                : 'We could not load your next mission'
          }
        />
        <p className="home-fallback">
          <Link to="/practice" className="action" viewTransition>
            Start practice <Icon name="arrow-right" size={18} />
          </Link>
        </p>
      </>
    );
  } else if (!ready || loadingSessions) {
    hero = <LoadingNotice label="Loading your next mission" lines={4} />;
  } else if (recommended && recommendation) {
    hero = <NextMission mission={recommended} reason={recommendation.reason} />;
  } else {
    hero = (
      <EmptyNotice title="No scenarios are available">
        The scenario library is empty right now. Check back after the server has loaded its
        scenarios.
      </EmptyNotice>
    );
  }

  let band: ReactNode;
  if (!loadingSessions && !practised) {
    // The calls decide what the lower part of the page can say. Without any, it says so once, in a
    // sentence, and keeps the way on.
    band = (
      <div className="home-band home-band--short">
        {sessions.error ? (
          <Section title="Your next skill to practise">
            <NextSkill progress={progress} />
          </Section>
        ) : (
          <Section title="Your practice so far">
            <p className="home-first">
              No finished calls yet. Finish one and this page adds up your practice, shows your
              latest call with its coaching report, and suggests one skill to work on next, from the
              evidence in your own conversations.
            </p>
          </Section>
        )}
        <Section title="Where to next">
          <QuickLinks />
        </Section>
      </div>
    );
  } else {
    const last = recent[0];
    band = (
      <div className="home-band">
        <Section title="Your practice so far">
          {loadingSessions ? (
            <LoadingNotice label="Loading your practice" lines={4} />
          ) : (
            <>
              <PracticeLedger
                stats={stats}
                badges={
                  rewards.data
                    ? {
                        earned: earnedCount(rewards.data.badges),
                        total: rewards.data.badges.length,
                        points: rewards.data.points,
                      }
                    : rewards.error
                      ? 'error'
                      : 'loading'
                }
              />
              {partial ? (
                <p className="home-partial">These totals use your latest {list.length} calls.</p>
              ) : null}
            </>
          )}
        </Section>
        <Section
          title="Your last call"
          eyebrow="Pick up where you left off"
          aside={
            <Link to="/history" className="text-link" viewTransition>
              View all calls
            </Link>
          }
        >
          {loadingSessions ? (
            <LoadingNotice label="Loading recent practice" lines={2} />
          ) : last ? (
            <LastCall call={last} scenario={missionById(last.scenarioId)} />
          ) : (
            <NoRecentCalls />
          )}
        </Section>
        <Section title="Your next skill to practise">
          <NextSkill progress={progress} />
        </Section>
        <Section title="Where to next">
          <QuickLinks />
        </Section>
      </div>
    );
  }

  return (
    <PageFrame title="Home" className="home">
      <PageHead
        eyebrow={`Home \u00b7 ${today}`}
        title={title}
        lead={
          active ? 'A call is waiting where you left it.' : 'Ready to practise a customer call?'
        }
      />
      <div className="home-hero-area">{hero}</div>
      <TourEntry />
      {band}
    </PageFrame>
  );
}
