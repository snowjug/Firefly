import { useId } from 'react';
import { Link } from 'react-router';
import type { DemoStatusDTO, PublicScenarioDTO } from '#shared/domain/api.ts';
import { DIFFICULTY_PROFILES } from '#shared/domain/state.ts';
import {
  CURVEBALL_LABELS,
  IMPACT_LABELS,
  START_TEMPERATURE_LABELS,
  temperatureBand,
} from '#shared/domain/vocab.ts';
import { useMediaQuery, type AsyncState } from '../../lib/hooks.ts';
import { SettingChips } from '../Chips.tsx';
import { Icon, type IconName } from '../Icon.tsx';
import { CustomerAvatar } from '../illustration/index.ts';
import { EmptyState, ErrorState, SkeletonBlock } from '../Page.tsx';
import { useStartCall } from './useStartCall.ts';

interface Highlight {
  icon: IconName;
  title: string;
  text: string;
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

const joinList = (items: string[]) =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** What the spotlight scenario shows, worded only from its public fields and the difficulty presets. */
export function spotlightHighlights(scenario: PublicScenarioDTO): Highlight[] {
  const profile = DIFFICULTY_PROFILES[scenario.difficulty];
  const areas = scenario.expectedDiscoveryAreas;
  const kinds = scenario.curveballOptions.map((type) => CURVEBALL_LABELS[type].label);
  const examples = joinList(kinds.slice(0, 2).map((kind) => `\u201c${kind}\u201d`));
  const byDefault = profile.defaultCurveballCount;

  return [
    {
      icon: 'sliders',
      title: 'Configurable',
      text: `Starts at ${profile.label} difficulty with ${IMPACT_LABELS[scenario.impact].label.toLowerCase()} business impact and a ${START_TEMPERATURE_LABELS[scenario.startingTemperature].label.toLowerCase()} customer. Every setting can be changed before the call.`,
    },
    {
      icon: 'eye',
      title: 'Hidden facts',
      text:
        areas.length > 0
          ? `${areas.length} areas hold details the customer shares only when asked, for example ${lowerFirst(areas[0] as string)}.`
          : 'The customer holds some details back until you ask about them.',
    },
    {
      icon: 'flame',
      title: 'A curveball',
      text:
        byDefault === 0
          ? `${profile.label} difficulty starts with no curveball. You can switch one on in setup, from ${kinds.length} kinds such as ${examples}.`
          : `${profile.label} difficulty switches on up to ${byDefault === 1 ? 'one curveball' : `${byDefault} curveballs`} by default: an unexpected turn partway through the call. Setup offers ${kinds.length} kinds, such as ${examples}.`,
    },
    {
      icon: 'chart',
      title: 'Evidence in the report',
      text: 'The customer\u2019s mood moves with what you say. The report quotes your own words, shows the temperature timeline and suggests alternative phrasing.',
    },
  ];
}

function SpotlightSkeleton() {
  return (
    <div
      className="glass card tr-spotlight-loading"
      role="status"
      aria-label="Loading the demo spotlight"
    >
      <div className="stack">
        <SkeletonBlock height={14} width="22%" />
        <SkeletonBlock height={32} width="60%" />
        <SkeletonBlock height={16} width="40%" />
        <SkeletonBlock height={52} />
        <SkeletonBlock height={44} width="45%" />
      </div>
    </div>
  );
}

function SpotlightCard({ scenario }: { scenario: PublicScenarioDTO }) {
  const titleId = useId();
  const withArt = useMediaQuery('(min-width: 721px)');
  const { start, error } = useStartCall();
  const { persona } = scenario;
  const mood = temperatureBand(START_TEMPERATURE_LABELS[scenario.startingTemperature].startValue);

  return (
    <section id="spotlight" className="tr-spotlight" aria-labelledby={titleId}>
      <div className="banner tr-banner">
        <div className="tr-banner-copy">
          <p className="tr-banner-label">Demo spotlight</p>
          <h2 id={titleId} className="tr-spotlight-title">
            {scenario.title}
          </h2>
          <p className="tr-persona">
            {persona.name}, {persona.role} at {persona.organisation}
            <span className="tr-persona-time">
              <Icon name="clock" size={14} /> About {scenario.estimatedMinutes} min
            </span>
          </p>
          <p className="tr-banner-summary">{scenario.summary}</p>
          <SettingChips
            settings={scenario}
            only={['difficulty', 'impact', 'startingTemperature', 'style', 'callStage']}
          />
          <div className="tr-actions">
            <button
              type="button"
              className="btn btn-light btn-lg"
              onClick={() => start(scenario.id, {})}
            >
              Start the spotlight call <Icon name="arrow-right" size={18} />
            </button>
            <Link
              to={`/scenarios/${encodeURIComponent(scenario.id)}/setup`}
              className="btn btn-outline-light btn-lg"
              viewTransition
            >
              Customise first
            </Link>
          </div>
          {error ? (
            <p role="alert" className="tr-banner-error">
              {error}
            </p>
          ) : null}
        </div>
        {withArt ? (
          <div className="tr-banner-art">
            <CustomerAvatar seed={persona.name} mood={mood.id} />
          </div>
        ) : null}
      </div>

      <div className="glass card tr-shows">
        <h3 className="t-label">What this scenario shows</h3>
        <ul role="list" className="tr-shows-list">
          {spotlightHighlights(scenario).map((item) => (
            <li key={item.title}>
              <span className="tone-icon" data-tone="blue" aria-hidden="true">
                <Icon name={item.icon} size={18} />
              </span>
              <span>
                <span className="tr-shows-title">{item.title}</span>
                <span className="t-small t-muted">{item.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** The demo spotlight: loading, error and "no spotlight" states around the scenario card. */
export function SpotlightSection({
  demo,
  spotlight,
}: {
  demo: AsyncState<DemoStatusDTO>;
  spotlight: AsyncState<PublicScenarioDTO | null>;
}) {
  if (!demo.data) {
    return demo.error ? (
      <ErrorState
        error={demo.error}
        onRetry={demo.reload}
        title="Could not load the demo spotlight"
      />
    ) : (
      <SpotlightSkeleton />
    );
  }
  if (demo.data.spotlightScenarioId === null) {
    return (
      <EmptyState
        icon="spark"
        title="No demo spotlight is set"
        action={
          <Link to="/scenarios" className="btn btn-secondary">
            Browse the scenario library
          </Link>
        }
      >
        The spotlight is a scenario marked for demos. You can still start any scenario from the
        quick start below or from the library.
      </EmptyState>
    );
  }
  if (spotlight.error) {
    return (
      <ErrorState
        error={spotlight.error}
        onRetry={spotlight.reload}
        title="Could not load the spotlight scenario"
      />
    );
  }
  if (!spotlight.data) return <SpotlightSkeleton />;
  return <SpotlightCard scenario={spotlight.data} />;
}
