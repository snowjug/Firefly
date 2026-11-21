import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router';
import { useAppSection } from '../../app/section.tsx';
import {
  BackLink,
  Button,
  Icon,
  LinkButton,
  MessageBar,
  Skeleton,
  Surface,
} from '../../design/index.ts';
import { api, errorMessage, isApiError } from '../../lib/api.ts';
import { useApi, useDocumentTitle, useOnline } from '../../lib/hooks.ts';
import { BriefDocument } from './BriefDocument.tsx';
import { editPathFromSearch, inspectConfig, toOverrides, type ConfigKey } from './config-params.ts';
import { StartPanel } from './StartPanel.tsx';
import { useSpeechSetup } from './use-speech-setup.ts';
import { useStartCall } from './use-start-call.ts';
import './brief.css';

const KEY_NAMES: Record<ConfigKey, string> = {
  difficulty: 'Difficulty',
  impact: 'Business impact',
  temperature: 'Starting temperature',
  proficiency: 'Technical proficiency',
  style: 'Communication style',
  stage: 'Call stage',
  curveballs: 'Curveballs',
  hints: 'Live hints',
};

function Head({ subtitle }: { subtitle?: string }) {
  return (
    <header className="brf-head">
      <h1 className="t-title2">Call brief</h1>
      {subtitle ? <p className="brf-head__subtitle">{subtitle}</p> : null}
    </header>
  );
}

function BriefSkeleton({ backTo }: { backTo: string }) {
  return (
    <div className="l-page brf-page" aria-busy="true">
      <BackLink to={backTo}>Edit scenario</BackLink>
      <Head />
      <div className="brf-layout" aria-hidden="true">
        <Surface appearance="outlined" padding="lg" className="brf-skeleton">
          <Skeleton width="40%" height="1.75rem" />
          <Skeleton lines={3} />
          <Skeleton lines={4} />
          <Skeleton lines={3} />
        </Surface>
        <Surface appearance="outlined" padding="lg" className="brf-skeleton">
          <Skeleton width="50%" height="1.75rem" />
          <Skeleton lines={5} />
          <Skeleton variant="rect" height="3rem" />
        </Surface>
      </div>
    </div>
  );
}

/** A scenario that cannot be found: the link is wrong or the scenario has gone. */
function Unavailable({ scenarioId }: { scenarioId: string }) {
  return (
    <div className="l-page brf-page brf-page--centred">
      <Surface as="section" appearance="outlined" padding="xl" aria-labelledby="brf-unavailable">
        <div className="brf-unavailable">
          <Icon name="warning" size={28} className="brf-unavailable__icon" />
          <h1 className="t-title2" id="brf-unavailable">
            Scenario unavailable
          </h1>
          <p className="brf-unavailable__text">
            {scenarioId ? 'That scenario could not be found' : 'No scenario was given'}. It may have
            been removed, or the link may be wrong. Nothing was started.
          </p>
          <LinkButton to="/scenarios" appearance="primary" icon="arrow-left">
            Choose a scenario
          </LinkButton>
        </div>
      </Surface>
    </div>
  );
}

/**
 * The call brief: the support case as the trainee may know it, the settings chosen for it (read
 * from the address), and everything to know about the microphone before starting. Starting the call
 * creates it once, however many times the button is pressed or retried.
 */
export function CallBrief() {
  const { id = '' } = useParams();
  const { search } = useLocation();
  const online = useOnline();
  const loaded = useApi((signal) => api.scenario(id, signal), [id]);
  const scenario = loaded.data;
  const speech = useSpeechSetup();

  const editTo = useMemo(() => editPathFromSearch(id, search), [id, search]);
  useAppSection('Call brief', { backTo: editTo, backLabel: 'Scenarios' });
  useDocumentTitle(scenario ? `Call brief: ${scenario.title}` : 'Call brief');

  const read = useMemo(
    () => (scenario ? inspectConfig(search, scenario) : null),
    [scenario, search],
  );
  const settings = useMemo(
    () => (scenario && read ? toOverrides(read.config, scenario) : null),
    [scenario, read],
  );
  const start = useStartCall({
    scenarioId: id,
    overrides: settings?.overrides ?? {},
    mode: settings?.mode ?? 'immersive',
  });

  if (loaded.loading && !scenario) return <BriefSkeleton backTo={editTo} />;

  const missing = isApiError(loaded.error) && loaded.error.status === 404;
  if (missing) return <Unavailable scenarioId={id} />;

  if (!scenario || !read) {
    return (
      <div className="l-page brf-page">
        <BackLink to="/scenarios">Scenarios</BackLink>
        <Head />
        <MessageBar
          intent="error"
          title="The scenario could not be loaded"
          actions={<Button onClick={loaded.reload}>Try again</Button>}
        >
          {online
            ? `${errorMessage(loaded.error)} Nothing was started.`
            : 'You are offline, so the scenario could not be loaded. Nothing was started. Reconnect, then try again.'}
        </MessageBar>
      </div>
    );
  }

  return (
    <div className="l-page brf-page">
      <BackLink to={editTo}>Edit scenario</BackLink>
      <Head subtitle={scenario.title} />
      {read.ignored.length > 0 ? (
        <MessageBar intent="info">
          Some settings in this link could not be used, so the scenario&apos;s own settings are used
          for them: {read.ignored.map((key) => KEY_NAMES[key]).join(', ')}.
        </MessageBar>
      ) : null}
      <div className="brf-layout">
        <BriefDocument scenario={scenario} config={read.config} />
        <div className="brf-side">
          <StartPanel speech={speech} start={start} editTo={editTo} />
        </div>
      </div>
    </div>
  );
}
