import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { PRACTICE_MODE_LABELS } from '#shared/domain/vocab.ts';
import { useAppSection } from '../../app/section.tsx';
import { cx } from '../../design/cx.ts';
import { Icon } from '../../design/icons.tsx';
import { Button, LinkButton } from '../../design/primitives/Button.tsx';
import { MessageBar } from '../../design/primitives/MessageBar.tsx';
import { ProductIcon } from '../../design/primitives/ProductIcon.tsx';
import { Skeleton } from '../../design/primitives/Skeleton.tsx';
import { Tag } from '../../design/primitives/Badge.tsx';
import { accentClass } from '../../design/product-accent.ts';
import { api, errorMessage, isApiError } from '../../lib/api.ts';
import { useApi, useDocumentTitle, useOnline } from '../../lib/hooks.ts';
import { CaseRows } from './CaseRows.tsx';
import {
  editPathFromSearch,
  effectiveVoice,
  inspectConfig,
  toOverrides,
  type ConfigKey,
} from './config-params.ts';
import { useFirstUseNotice } from './first-use.ts';
import { MODE_SENTENCE, productLine } from './labels.ts';
import { describeReadiness } from './mic-readiness.ts';
import { PrivacyNotice } from './PrivacyNotice.tsx';
import { privacyDetails } from './privacy.ts';
import { StartActions } from './StartActions.tsx';
import { useBrowserVoiceNote } from './use-browser-voices.ts';
import { useMicCheck } from './use-mic-check.ts';
import { useMicrophonePermission } from './use-mic-permission.ts';
import { useSpeechSetup } from './use-speech-setup.ts';
import { useStartCall, type StartInput } from './use-start-call.ts';
import { useVoicePreview } from './use-voice-preview.ts';
import { useTileTransition } from './view-transition.ts';
import {
  defaultVoiceFor,
  offeredVoice,
  sharedVoiceNote,
  speechLanguage,
  voiceChoices,
  type VoiceId,
} from './voice-choice.ts';
import { MicRow, VoiceSetup } from './VoiceSetup.tsx';
import './brief.css';

const KEY_NAMES: Record<ConfigKey, string> = {
  difficulty: 'Difficulty',
  impact: 'Impact',
  temperature: 'Starting state',
  proficiency: 'Proficiency',
  style: 'Style',
  stage: 'Call stage',
  curveballs: 'Complications',
  hints: 'Practice mode',
  voice: 'Voice',
};

const READINESS_ID = 'brf-readiness';

function BriefSkeleton() {
  return (
    <div className="l-page brf-page" aria-busy="true">
      <h1 className="brf-title">Case brief</h1>
      <div className="brf-layout" aria-hidden="true">
        <div className="brf-case brf-case--loading">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="brf-row" key={index}>
              <Skeleton width="5rem" />
              <Skeleton width={index % 2 ? '70%' : '90%'} />
            </div>
          ))}
        </div>
        <div className="brf-side">
          <Skeleton variant="rect" height="2.75rem" />
          <Skeleton variant="rect" height="3rem" />
        </div>
      </div>
    </div>
  );
}

/** A scenario that cannot be found: the link is wrong, or the scenario has been retired. */
function Unavailable() {
  return (
    <div className="l-page brf-page brf-page--centred">
      <section className="brf-unavailable" aria-labelledby="brf-unavailable">
        <Icon name="warning" size={28} className="brf-unavailable__icon" />
        <h1 className="brf-unavailable__title" id="brf-unavailable">
          Scenario unavailable
        </h1>
        <p>This scenario is no longer available. Nothing was started.</p>
        <LinkButton to="/scenarios" appearance="primary" icon="arrow-left">
          Choose a scenario
        </LinkButton>
      </section>
    </div>
  );
}

/**
 * The case brief: the support case in six short rows, the customer's voice, the microphone, and the
 * way to start. What the trainee chose on the scenario page is read from the address. Starting the
 * call creates it once, however many times the button is pressed or retried, and it opens a spoken
 * call or a typed one; a typed one is always possible.
 */
export function CallBrief() {
  const { id = '' } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const online = useOnline();
  const loaded = useApi((signal) => api.scenario(id, signal), [id]);
  const scenario = loaded.data;
  const speech = useSpeechSetup();

  const editTo = useMemo(() => editPathFromSearch(id, search), [id, search]);
  useAppSection('Case brief', { backTo: editTo, backLabel: 'Scenarios' });
  useDocumentTitle(scenario ? `Case brief: ${scenario.title}` : 'Case brief');
  // The product tile is the one on the scenario's details, carried over by a view transition.
  const tile = useTileTransition(editTo);

  const read = useMemo(
    () => (scenario ? inspectConfig(search, scenario) : null),
    [scenario, search],
  );
  const settings = useMemo(
    () => (scenario && read ? toOverrides(read.config, scenario) : null),
    [scenario, read],
  );

  // The voice is shown the moment it is chosen; the address follows (replaced, never added to). It
  // is one of the voices on offer, or none where the speech service chooses for itself, and then no
  // request names a voice. It is never stored on the server: it travels to the call in the address.
  const language = useMemo(() => speechLanguage(), []);
  const playback = speech.setup?.playback ?? null;
  const offered = useMemo(
    () => voiceChoices(speech.config?.speech ?? null, playback),
    [speech.config, playback],
  );
  const [chosen, setChosen] = useState<VoiceId | null>(null);
  const voice = offeredVoice(
    offered,
    chosen ?? effectiveVoice(read?.config ?? { voice: null }, id),
  );
  const chooseVoice = (next: VoiceId) => {
    setChosen(next);
    const params = new URLSearchParams(search);
    if (next === defaultVoiceFor(id)) params.delete('voice');
    else params.set('voice', next);
    const text = params.toString().replace(/%2C/gi, ',');
    void navigate({ search: text ? `?${text}` : '' }, { replace: true, preventScrollReset: true });
  };

  const start = useStartCall({
    scenarioId: id,
    overrides: settings?.overrides ?? {},
    mode: settings?.mode ?? 'immersive',
    voice,
  });
  const notice = useFirstUseNotice();
  const { check, begin: beginCheck, stop: stopCheck, meter } = useMicCheck();
  const permission = useMicrophonePermission();
  const preview = useVoicePreview(playback, language);
  const browserVoices = useBrowserVoiceNote(playback === 'browser-synthesis', language);

  const startCall = (input: StartInput) => {
    if (input === 'voice') notice.markSeen();
    void start.start(input);
  };

  if (loaded.loading && !scenario) return <BriefSkeleton />;

  const missing = isApiError(loaded.error) && loaded.error.status === 404;
  if (missing) return <Unavailable />;

  if (!scenario || !read) {
    return (
      <div className="l-page brf-page">
        <h1 className="brf-title">Case brief</h1>
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

  const { setup, config, loading: speechLoading, error: speechError } = speech;
  const practiceMode = settings?.mode ?? 'immersive';
  const speechState = setup
    ? setup.canSpeak
      ? 'voice'
      : 'typed'
    : speechLoading
      ? 'loading'
      : 'failed';
  const readiness = describeReadiness({
    speech: speechState,
    typedBecause: setup?.typedBecause ?? null,
    check,
    permission,
  });
  const details = privacyDetails(setup, config?.speech.provider ?? null, config?.provider ?? null);
  // Something true about the voices that the trainee should know: a browser with one English voice
  // cannot make four sound different, and a speech service with fewer voices than choices says so.
  const voiceNote =
    playback === 'browser-synthesis'
      ? browserVoices
      : config && !config.speech.demo
        ? sharedVoiceNote(config.speech.voices, language)
        : null;

  return (
    <div className="l-page brf-page">
      <header className="brf-head">
        <span
          className={cx('brf-tile', accentClass(scenario.product.id))}
          style={tile}
          aria-hidden="true"
        >
          <ProductIcon product={scenario.product.id} size={24} />
        </span>
        <div className="brf-head__text">
          <p className="brf-product">{productLine(scenario.product)}</p>
          <h1 className="brf-title">Case brief</h1>
          <p className="brf-subtitle">{scenario.title}</p>
          <p className="brf-mode">
            <strong>{PRACTICE_MODE_LABELS[practiceMode].label}.</strong>{' '}
            {MODE_SENTENCE[practiceMode]}.
          </p>
        </div>
        <Tag size="small">Synthetic scenario</Tag>
      </header>
      {read.ignored.length > 0 ? (
        <MessageBar intent="info">
          Some settings in this link could not be used, so the scenario&apos;s own are used:{' '}
          {read.ignored.map((key) => KEY_NAMES[key]).join(', ')}.
        </MessageBar>
      ) : null}
      <div className="brf-layout">
        <CaseRows scenario={scenario} config={read.config} />
        <aside className="brf-side" aria-labelledby="brf-side-title">
          <h2 className="brf-side__title" id="brf-side-title">
            Voice call
          </h2>
          {speechError && !setup ? (
            <MessageBar
              intent="warning"
              title="Speech settings could not be loaded"
              actions={<Button onClick={speech.reload}>Try again</Button>}
            >
              Only a typed call is offered. Nothing has been recorded.
            </MessageBar>
          ) : null}
          {speechState === 'typed' || speechState === 'voice' || speechState === 'loading' ? (
            <VoiceSetup
              choices={offered}
              voice={voice}
              onVoice={chooseVoice}
              setup={setup}
              demo={config?.speech.demo === true}
              voiceNote={voiceNote}
              preview={preview}
            />
          ) : null}
          {speechState === 'loading' ? null : (
            <PrivacyNotice
              details={details}
              introduce={speechState === 'voice' && !notice.seen}
              onAcknowledge={notice.markSeen}
            />
          )}
          <MicRow
            readiness={readiness}
            status={check.status}
            onBegin={beginCheck}
            onStop={stopCheck}
            meterRef={meter}
            canSpeak={speechState === 'voice'}
            statusId={READINESS_ID}
          />
          <StartActions
            speech={speech}
            start={start}
            onStart={startCall}
            editTo={editTo}
            readinessId={READINESS_ID}
          />
        </aside>
      </div>
    </div>
  );
}
