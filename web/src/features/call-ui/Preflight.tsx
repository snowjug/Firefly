import {
  Avatar,
  Button,
  Icon,
  MessageBar,
  Surface,
  Tag,
  TextLink,
  type IconName,
} from '../../design/index.ts';
import { WordmarkMark } from '../../app/shell/Wordmark.tsx';
import type { CallActions, CallSnapshot, CallSupport } from '../call/contract.ts';
import { clock, providerDescription } from './call-model.ts';
import { ProblemNotice } from './ProblemNotice.tsx';
import { TurnList } from './Transcript.tsx';
import './preflight.css';

const WAITING =
  'Waiting for you to allow the microphone. Look for the prompt near the address bar.';

type Tone = 'ok' | 'info' | 'blocked';

interface Row {
  label: string;
  value: string;
  tone: Tone;
}

const ROW_ICONS: Record<Tone, IconName> = {
  ok: 'check-circle',
  info: 'info',
  blocked: 'warning',
};

function microphoneRow(snapshot: CallSnapshot): Row {
  switch (snapshot.microphone) {
    case 'granted':
      return { label: 'Microphone', value: 'Allowed', tone: 'ok' };
    case 'denied':
      return { label: 'Microphone', value: 'Blocked in this browser', tone: 'blocked' };
    case 'unavailable':
      return { label: 'Microphone', value: 'Not available in this browser', tone: 'blocked' };
    case 'prompt':
      return { label: 'Microphone', value: 'Waiting for you to allow it', tone: 'info' };
    case 'unknown':
      return {
        label: 'Microphone',
        value: 'Not requested yet. Firefly asks only when you choose to start.',
        tone: 'info',
      };
  }
}

/** Where speech is processed in this setup, in one sentence that claims no more than is true. */
export function speechProcessing(
  support: Pick<CallSupport, 'capture' | 'captureLabel' | 'speechDemo'>,
): string {
  switch (support.capture) {
    case 'server-speech':
      if (support.speechDemo) {
        return `Your speech goes to Firefly's server, which is running a scripted demonstration (${support.captureLabel}). It does not understand audio: it answers with scripted text instead of what you said, so it is for trying the call out. Firefly does not keep the audio.`;
      }
      return `Your speech goes to Firefly's server, which passes it to ${support.captureLabel} to be turned into text. Firefly does not keep the audio.`;
    case 'browser-recognition':
      if (support.captureLabel.includes('on this device')) {
        return 'Your browser turns your speech into text on this device. Firefly does not keep the audio.';
      }
      if (support.captureLabel.includes('online')) {
        return "Your browser's online speech service turns your speech into text, so your audio goes to the browser's vendor. Firefly does not keep it.";
      }
      return "Your browser's speech service turns your speech into text. In Edge and Chrome that is an online service run by the browser's vendor. Firefly does not keep the audio.";
    case 'none':
      return 'Speech recognition is not available here, so nothing is recorded and you will type your replies.';
  }
}

function rows(snapshot: CallSnapshot, provider: { demo: boolean; label: string }): Row[] {
  const { support } = snapshot;
  return [
    microphoneRow(snapshot),
    speechRecognitionRow(support),
    support.playback === 'none'
      ? { label: 'Customer voice', value: 'Captions only', tone: 'info' }
      : support.speechDemo && support.playback === 'server-speech'
        ? {
            label: 'Customer voice',
            value: `${support.playbackLabel}. A placeholder sound stands in for the customer's voice, so read the transcript.`,
            tone: 'info',
          }
        : { label: 'Customer voice', value: support.playbackLabel, tone: 'ok' },
    {
      label: 'AI customer',
      value: providerDescription(provider),
      tone: provider.demo ? 'info' : 'ok',
    },
  ];
}

/**
 * The browser's own recognition is never shown as a sure thing: it can return no words at all for a
 * clear voice, so its row says so and points at typing, which always works.
 */
function speechRecognitionRow(support: CallSupport): Row {
  switch (support.capture) {
    case 'none':
      return {
        label: 'Speech recognition',
        value: 'Not available in this browser',
        tone: 'blocked',
      };
    case 'browser-recognition':
      return {
        label: 'Speech recognition',
        value: `${support.captureLabel}. It can miss words, so you can always type your reply.`,
        tone: 'info',
      };
    case 'server-speech':
      return support.speechDemo
        ? {
            label: 'Speech recognition',
            value: `${support.captureLabel}. It does not understand audio and returns scripted text instead of what you say, so it is for trying the call out. You can always type your reply.`,
            tone: 'info',
          }
        : { label: 'Speech recognition', value: support.captureLabel, tone: 'ok' };
  }
}

export interface PreflightProps {
  snapshot: CallSnapshot;
  actions: Pick<CallActions, 'begin' | 'retry'>;
  provider: { demo: boolean; label: string };
  /** The address asked for a typed call (`?input=text`): the typed action leads. */
  preferText: boolean;
  /** Where "Back to brief" goes. */
  briefTo: string;
}

/**
 * The step before the call: who the customer is, what this browser and this server can really do,
 * what happens to speech, and the choice between a spoken and a typed call. Nothing here opens the
 * microphone or plays a sound: that only ever happens after one of the two buttons is pressed.
 */
export function Preflight({ snapshot, actions, provider, preferText, briefTo }: PreflightProps) {
  const session = snapshot.session;
  if (!session) return null;

  const requesting = snapshot.phase === 'requesting-microphone';
  const { persona, title } = session.scenario;
  const resume = snapshot.turns.some((turn) => turn.role === 'trainee');
  const voiceAvailable = snapshot.support.reason === null;
  const problem = snapshot.problem;
  const microphoneProblem = problem !== null && problem.code.startsWith('microphone-');
  const textLeads = preferText || !voiceAvailable;
  const startVoice = () => void actions.begin({ voice: true });
  const startText = () => void actions.begin({ voice: false });

  // While the browser's prompt is open the button says so, and the announcer reads the same
  // sentence once (the design system's button announces its loading label).
  const voiceButton = voiceAvailable ? (
    <Button
      appearance={textLeads ? 'outline' : 'primary'}
      size={textLeads ? 'medium' : 'large'}
      icon="microphone"
      loading={requesting}
      loadingLabel={WAITING}
      onClick={startVoice}
    >
      {requesting
        ? 'Waiting for the microphone'
        : resume
          ? 'Allow microphone and resume'
          : 'Allow microphone and start'}
    </Button>
  ) : null;
  const textButton = (
    <Button
      appearance={textLeads ? 'primary' : 'outline'}
      size={textLeads ? 'large' : 'medium'}
      icon="keyboard"
      onClick={startText}
    >
      {resume ? 'Resume as a text-only call' : 'Start text-only call'}
    </Button>
  );

  return (
    <div className="cw-pre">
      <header className="cw-pre__bar">
        <div className="cw-pre__bar-inner">
          <span className="cw-pre__brand">
            <WordmarkMark size={24} />
            <span className="cw-pre__brand-name">Firefly</span>
          </span>
          <TextLink to={briefTo} className="cw-pre__back">
            <Icon name="chevron-left" size={16} />
            Back to brief
          </TextLink>
        </div>
      </header>

      <div className="cw-pre__body">
        <Surface as="section" appearance="elevated" padding="lg" className="cw-pre__card">
          <div className="cw-pre__head">
            <h1 className="t-title2">{resume ? 'Resume your call' : 'Ready to start the call?'}</h1>
            <p className="t-reading t-muted">
              {resume
                ? `Your call is still open and your transcript so far is saved. Time so far: ${clock(snapshot.elapsedSeconds)}.`
                : 'This is a practice call with a fictional customer. Check how it will run, then start when you are ready.'}
            </p>
          </div>

          <div className="cw-pre__customer">
            <Avatar name={persona.name} size="lg" />
            <div className="cw-pre__who">
              <p className="cw-pre__name">{persona.name}</p>
              <p className="cw-pre__role">
                {persona.role}, {persona.organisation}
              </p>
              <div className="cw-pre__tags">
                <Tag size="small">Fictional customer</Tag>
              </div>
            </div>
          </div>
          <p className="cw-pre__scenario">
            <span className="cw-pre__scenario-label">Scenario</span>
            {title}
          </p>

          <ul className="cw-pre__checks" role="list" aria-label="What is ready">
            {rows(snapshot, provider).map((row) => (
              <li key={row.label} className={`cw-pre__check cw-pre__check--${row.tone}`}>
                <Icon name={ROW_ICONS[row.tone]} size={20} className="cw-pre__check-icon" />
                <span className="cw-pre__check-label">{row.label}</span>
                <span className="cw-pre__check-value">{row.value}</span>
              </li>
            ))}
          </ul>

          <div className="cw-pre__privacy">
            <Icon name="shield" size={20} className="cw-pre__privacy-icon" />
            <p>
              Firefly opens your microphone only during the call and does not store audio. You can
              mute or stop it at any time. {speechProcessing(snapshot.support)}
            </p>
          </div>

          {!voiceAvailable && !problem ? (
            <MessageBar intent="info" live={false} title="A spoken call is not available here">
              {snapshot.support.reason}
            </MessageBar>
          ) : null}

          {requesting ? (
            <p className="cw-pre__waiting">
              <Icon name="microphone" size={20} />
              {WAITING}
            </p>
          ) : null}

          {problem ? (
            <ProblemNotice
              problem={problem}
              variant="panel"
              onRetry={() => actions.retry()}
              extraActions={
                microphoneProblem ? (
                  <Button icon="keyboard" onClick={startText}>
                    Start a text-only call
                  </Button>
                ) : null
              }
            />
          ) : null}

          {microphoneProblem ? null : (
            <div className="cw-pre__actions">
              {textLeads ? (
                <>
                  {textButton}
                  {voiceButton}
                </>
              ) : (
                <>
                  {voiceButton}
                  {textButton}
                </>
              )}
            </div>
          )}
        </Surface>

        {resume ? (
          <Surface as="section" appearance="outlined" padding="lg" className="cw-pre__transcript">
            <h2 className="t-subtitle2" id="cw-pre-transcript">
              Transcript so far
            </h2>
            <TurnList
              turns={snapshot.turns}
              customerName={persona.name}
              startedAt={session.startedAt}
            />
          </Surface>
        ) : null}
      </div>
    </div>
  );
}
