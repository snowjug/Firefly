import { Link } from 'react-router';
import { DIMENSIONS } from '#shared/domain/vocab.ts';
import { Beacon } from '../components/Beacon.tsx';
import { DifficultyChip } from '../components/Chips.tsx';
import { Icon, type IconName } from '../components/Icon.tsx';
import { ErrorState, Page, SkeletonBlock } from '../components/Page.tsx';
import { api } from '../lib/api.ts';
import { formatRelative, formatScore } from '../lib/format.ts';
import { useApi } from '../lib/hooks.ts';
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

export default function Dashboard() {
  const demo = useApi((signal) => api.demo(signal), []);
  const recent = useApi(
    (signal) => api.listSessions({ limit: 4, includeSamples: false }, signal),
    [],
  );
  const progress = useApi((signal) => api.progress(false, signal), []);

  const active = recent.data?.sessions.find((s) => s.status === 'active');
  const spotlight = demo.data?.spotlightScenarioId;

  return (
    <Page title="Home">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy stack" style={{ ['--stack-gap' as string]: 'var(--sp-5)' }}>
          <p className="t-label">Customer call simulator</p>
          <h1 id="hero-title" className="t-display">
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
          <Beacon />
        </div>
      </section>

      {active ? (
        <section
          aria-label="Resume your call"
          className="glass card resume row between"
          style={{ marginBottom: 'var(--sp-6)' }}
        >
          <div className="row" style={{ ['--row-gap' as string]: 'var(--sp-4)' }}>
            <span className="state-icon">
              <Icon name="phone" size={24} />
            </span>
            <div>
              <p className="t-label">Call in progress</p>
              <p className="t-section">{active.scenarioTitle}</p>
            </div>
          </div>
          <Link to={`/calls/${active.id}`} className="btn btn-primary">
            Resume call <Icon name="arrow-right" size={18} />
          </Link>
        </section>
      ) : null}

      <section aria-labelledby="how-title" style={{ marginBottom: 'var(--sp-7)' }}>
        <h2 id="how-title" className="t-section" style={{ marginBottom: 'var(--sp-4)' }}>
          How practice works
        </h2>
        <ol role="list" className="steps">
          {STEPS.map((step, index) => (
            <li key={step.title} className="glass card step">
              <span className="step-number" aria-hidden="true">
                {index + 1}
              </span>
              <span className="state-icon" style={{ width: '2.6rem', height: '2.6rem' }}>
                <Icon name={step.icon} />
              </span>
              <h3 className="t-body" style={{ fontWeight: 650 }}>
                {step.title}
              </h3>
              <p className="t-small t-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid-2 dash-columns">
        <section className="glass card stack" aria-labelledby="recent-title">
          <div className="row between">
            <h2 id="recent-title" className="t-section">
              Recent practice
            </h2>
            <Link to="/history" className="t-small">
              View all
            </Link>
          </div>
          {recent.loading ? (
            <div className="stack" role="status" aria-label="Loading recent sessions">
              <SkeletonBlock height={52} />
              <SkeletonBlock height={52} />
            </div>
          ) : recent.error ? (
            <ErrorState
              error={recent.error}
              onRetry={recent.reload}
              title="Could not load recent practice"
            />
          ) : recent.data && recent.data.sessions.length > 0 ? (
            <ul role="list" className="stack" style={{ ['--stack-gap' as string]: 'var(--sp-2)' }}>
              {recent.data.sessions.map((s) => (
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

        <section className="glass card stack" aria-labelledby="focus-title">
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
              <p className="t-title" style={{ fontSize: '1.5rem' }}>
                {DIMENSIONS[progress.data.focus].label}
              </p>
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
        </section>
      </div>
    </Page>
  );
}
