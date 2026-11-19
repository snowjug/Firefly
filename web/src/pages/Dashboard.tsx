import { useMemo } from 'react';
import { Link } from 'react-router';
import type { SessionSummaryDTO } from '#shared/domain/api.ts';
import { assessMastery } from '#shared/domain/mastery.ts';
import { recommendMission } from '#shared/domain/recommend.ts';
import { DIMENSIONS } from '#shared/domain/vocab.ts';
import { FireflyCore } from '../components/core/FireflyCore.tsx';
import { NextMission } from '../components/dashboard/NextMission.tsx';
import { DifficultyChip } from '../components/Chips.tsx';
import { Icon, type IconName } from '../components/Icon.tsx';
import { MasteryStars } from '../components/mastery/MasteryStars.tsx';
import { ErrorState, Page, SkeletonBlock } from '../components/Page.tsx';
import { TourPrompt } from '../components/tour/TourPrompt.tsx';
import { api } from '../lib/api.ts';
import { formatRelative, formatScore } from '../lib/format.ts';
import { useApi } from '../lib/hooks.ts';
import { usePractice } from '../lib/practice.ts';
import '../styles/dashboard.css';

const STEPS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'sliders',
    title: 'Configure',
    text: 'Choose a scenario, then shape the issue, impact, customer mood, style and difficulty.',
  },
  {
    icon: 'phone',
    title: 'Practise and adapt',
    text: 'Talk with a simulated customer. Ask the right questions to uncover what they have not said, and watch how they react.',
  },
  {
    icon: 'target',
    title: 'Reflect',
    text: 'Get coaching on six skills, with quotes from your own call and better ways to say it.',
  },
  {
    icon: 'chart',
    title: 'Improve',
    text: 'See what you found and missed, track your practice over time and pick your next focus.',
  },
];

const NO_SESSIONS: SessionSummaryDTO[] = [];

export default function Dashboard() {
  const demo = useApi((signal) => api.demo(signal), []);
  const { scenarios, sessions, progress } = usePractice();

  const list = sessions.data?.sessions ?? NO_SESSIONS;
  const recent = list.slice(0, 4);
  const active = list.find((s) => s.status === 'active');
  const spotlight = demo.data?.spotlightScenarioId;

  const mastery = useMemo(() => assessMastery(list), [list]);
  const lit = mastery.filter((m) => m.tierIndex > 0).length;
  const recommendation = useMemo(
    () =>
      scenarios.data
        ? recommendMission({ scenarios: scenarios.data, sessions: list, progress: progress.data })
        : null,
    [scenarios.data, list, progress.data],
  );
  const ready = !scenarios.loading && !sessions.loading;

  return (
    <Page title="Home">
      <TourPrompt />

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy stack" style={{ ['--stack-gap' as string]: 'var(--sp-5)' }}>
          <p className="t-label">Customer call simulator</p>
          <h1 id="hero-title" className="t-display hero-title">
            Practice difficult customer conversations before they become real ones.
          </h1>
          <p className="t-lead">
            Rehearse with a simulated customer who reacts to what you actually say, then get
            coaching tied to your own words.
          </p>
          <div className="cluster" style={{ ['--cluster-gap' as string]: 'var(--sp-3)' }}>
            <Link to="/scenarios" className="btn btn-primary btn-lg" viewTransition>
              Start a simulation <Icon name="arrow-right" size={18} />
            </Link>
            {spotlight ? (
              <Link
                to={`/scenarios/${spotlight}/setup`}
                className="btn btn-secondary btn-lg"
                viewTransition
              >
                Try the demo scenario
              </Link>
            ) : null}
          </div>
          <ul role="list" className="hero-notes t-meta">
            <li>
              <Icon name="shield" size={16} /> Fictional customers only
            </li>
            <li>
              <Icon name="lock" size={16} /> Stored on this machine
            </li>
            <li>
              <Icon name="users" size={16} /> Coaching, not ranking
            </li>
          </ul>
        </div>
        <div className="hero-visual">
          <div className="hero-core" aria-hidden="true">
            <FireflyCore signals={{ total: 6, lit }} />
          </div>
          <p className="hero-caption t-meta">
            {lit === 0
              ? 'Six skills orbit the core. They light up as you practise.'
              : `${lit} of 6 skills lit so far. Each one comes on from your own completed calls.`}
          </p>
        </div>
      </section>

      {active ? (
        <section aria-label="Resume your call" className="resume">
          <span className="resume-pulse" aria-hidden="true" />
          <div className="resume-text">
            <p className="t-label">Call in progress</p>
            <p className="resume-title">{active.scenarioTitle}</p>
          </div>
          <Link to={`/calls/${active.id}`} className="btn btn-primary">
            Resume call <Icon name="arrow-right" size={18} />
          </Link>
        </section>
      ) : null}

      {!ready ? (
        <div className="dash-block" role="status" aria-label="Loading your next mission">
          <SkeletonBlock height={190} />
        </div>
      ) : recommendation ? (
        <div className="dash-block">
          <NextMission recommendation={recommendation} />
        </div>
      ) : null}

      <section aria-labelledby="how-title" className="dash-block">
        <h2 id="how-title" className="t-section dash-heading">
          How practice works
        </h2>
        <ol role="list" className="path">
          {STEPS.map((step, index) => (
            <li key={step.title} className="path-step">
              <span className="path-node" aria-hidden="true">
                <span className="path-number">{index + 1}</span>
              </span>
              <span className="path-icon" aria-hidden="true">
                <Icon name={step.icon} size={20} />
              </span>
              <h3 className="path-title">{step.title}</h3>
              <p className="t-small t-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="dash-columns">
        <section className="dash-panel stack" aria-labelledby="recent-title">
          <div className="row between">
            <h2 id="recent-title" className="t-section">
              Recent practice
            </h2>
            <Link to="/history" className="t-small">
              View all
            </Link>
          </div>
          {sessions.loading ? (
            <div className="stack" role="status" aria-label="Loading recent sessions">
              <SkeletonBlock height={52} />
              <SkeletonBlock height={52} />
            </div>
          ) : sessions.error ? (
            <ErrorState
              error={sessions.error}
              onRetry={sessions.reload}
              title="Could not load recent practice"
            />
          ) : recent.length > 0 ? (
            <ul role="list" className="recent-list">
              {recent.map((s) => (
                <li key={s.id}>
                  <Link
                    to={s.status === 'active' ? `/calls/${s.id}` : `/sessions/${s.id}/report`}
                    className="recent-item"
                    viewTransition
                  >
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="recent-title">{s.scenarioTitle}</span>
                      <span className="t-meta">{formatRelative(s.startedAt)}</span>
                    </span>
                    <DifficultyChip difficulty={s.difficulty} />
                    <span
                      className="tabular recent-score"
                      aria-label={
                        s.overallScore === null
                          ? 'No score'
                          : `Overall ${formatScore(s.overallScore)} out of 5`
                      }
                    >
                      {s.status === 'active' ? 'In progress' : formatScore(s.overallScore)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="stack" style={{ ['--stack-gap' as string]: 'var(--sp-3)' }}>
              <p className="t-muted">
                No practice yet. A Starter scenario is a gentle way to begin: the customer is
                cooperative and gives clearer clues.
              </p>
              <div>
                <Link to="/scenarios?difficulty=starter" className="btn btn-secondary">
                  Browse Starter scenarios
                </Link>
              </div>
            </div>
          )}
        </section>

        <section className="dash-panel stack" aria-labelledby="focus-title">
          <h2 id="focus-title" className="t-section">
            Your practice focus
          </h2>
          {progress.loading ? (
            <div className="stack" role="status" aria-label="Loading practice focus">
              <SkeletonBlock height={20} width="60%" />
              <SkeletonBlock height={48} />
            </div>
          ) : progress.data?.focus ? (
            <div className="stack" style={{ ['--stack-gap' as string]: 'var(--sp-3)' }}>
              <p className="focus-skill">{DIMENSIONS[progress.data.focus].label}</p>
              <p className="t-muted">{progress.data.focusReason}</p>
              <p className="t-small t-muted">{DIMENSIONS[progress.data.focus].description}</p>
              <div>
                <Link to="/progress" className="btn btn-secondary">
                  See your progress
                </Link>
              </div>
            </div>
          ) : (
            <p className="t-muted">
              Complete a practice call and Firefly will suggest one skill to work on next, based on
              the evidence from your own conversations.
            </p>
          )}
          {lit > 0 ? (
            <div className="focus-stars">
              <MasteryStars mastery={mastery} />
            </div>
          ) : null}
        </section>
      </div>
    </Page>
  );
}
