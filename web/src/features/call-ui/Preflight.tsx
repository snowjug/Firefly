import { useEffect, useRef } from 'react';
import {
  Avatar,
  Button,
  Disclosure,
  Icon,
  MessageBar,
  ProductIcon,
  Surface,
  Tag,
  TextLink,
  type IconName,
} from '../../design/index.ts';
import { Wordmark } from '../../app/shell/Wordmark.tsx';
import type { CallActions, CallSnapshot } from '../call/contract.ts';
import { MICROPHONE_NOTICE, PRIVACY_DETAILS_LABEL, privacyDetails } from '../voice/privacy.ts';
import { VOICE_STATE_TEXT } from '../voice/states.ts';
import { clock, describeStatus, providerDescription, recoveryOptions } from './call-model.ts';
import { Recovery } from './Recovery.tsx';
import { TurnList } from './Transcript.tsx';
import './preflight.css';

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
  if (snapshot.microphone === 'granted')
    return { label: 'Microphone', value: 'Allowed', tone: 'ok' };
  // The same state the call itself shows once it begins, in a word or two.
  const status = describeStatus({
    stage: snapshot.stage,
    mode: snapshot.mode,
    phase: snapshot.phase,
    speechDetected: false,
    microphone: snapshot.microphone,
    problem: snapshot.problem,
  });
  return {
    label: 'Microphone',
    value: status.row,
    tone: status.who === 'alert' ? 'blocked' : 'info',
  };
}

function rows(snapshot: CallSnapshot, provider: { demo: boolean; label: string }): Row[] {
  const { support } = snapshot;
  const voice: Row =
    support.playback === 'none'
      ? { label: 'Customer voice', value: 'Captions only', tone: 'info' }
      : support.speechDemo && support.playback === 'server-speech'
        ? { label: 'Customer voice', value: 'Placeholder sound (demo)', tone: 'info' }
        : { label: 'Customer voice', value: support.playbackLabel, tone: 'ok' };
  // The browser's own recognition is never shown as a sure thing: it can return no words for a
  // clear voice, so its row says so, and typing always works.
  const speech: Row =
    support.capture === 'none'
      ? { label: 'Speech', value: 'Unavailable', tone: 'blocked' }
      : support.capture === 'browser-recognition'
        ? { label: 'Speech', value: support.captureLabel, tone: 'info' }
        : support.speechDemo
          ? { label: 'Speech', value: support.captureLabel, tone: 'info' }
          : { label: 'Speech', value: support.captureLabel, tone: 'ok' };
  return [
    microphoneRow(snapshot),
    voice,
    speech,
    {
      label: 'Customer AI',
      value: providerDescription(provider),
      tone: provider.demo ? 'info' : 'ok',
    },
  ];
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
 * and the choice between a spoken and a typed call. Nothing here opens the microphone or plays a
 * sound: that only ever happens after one of the two buttons is pressed. It is a short list of
 * facts, the one-sentence notice about the microphone, and how the voice is handled one step further
 * in (the voice layer's own words for the speech path really in use).
 */
export function Preflight({ snapshot, actions, provider, preferText, briefTo }: PreflightProps) {
  const notice = useRef<HTMLDivElement>(null);
  const microphoneCode = snapshot.problem?.code.startsWith('microphone-')
    ? snapshot.problem.code
    : null;
  // The button that was pressed is replaced by the notice about it (the browser's prompt was
  // declined), so the keyboard goes to the notice's first action and not to the top of the page.
  useEffect(() => {
    if (microphoneCode) notice.current?.querySelector<HTMLElement>('[data-cw-action]')?.focus();
  }, [microphoneCode]);

  const session = snapshot.session;
  if (!session) return null;

  const requesting = snapshot.stage === 'mic-permission';
  const { persona, title, product } = session.scenario;
  const resume = snapshot.turns.some((turn) => turn.role === 'trainee');
  const voiceAvailable = snapshot.support.reason === null;
  const problem = snapshot.problem;
  const microphoneProblem = problem !== null && problem.code.startsWith('microphone-');
  const textLeads = preferText || !voiceAvailable;
  const startVoice = () => void actions.begin({ voice: true });
  const startText = () => void actions.begin({ voice: false });

  // While the browser's prompt is open the button says so, and the announcer reads the voice
  // layer's sentence for it once (the design system's button announces its loading label).
  const voiceButton = voiceAvailable ? (
    <Button
      appearance={textLeads ? 'outline' : 'primary'}
      size={textLeads ? 'medium' : 'large'}
      icon="microphone"
      loading={requesting}
      loadingLabel={VOICE_STATE_TEXT['requesting-permission'].announcement ?? ''}
      onClick={startVoice}
    >
      {requesting ? 'Waiting for permission' : resume ? 'Resume voice call' : 'Start voice call'}
    </Button>
  ) : null;
  const textButton = (
    <Button
      appearance={textLeads ? 'primary' : 'outline'}
      size={textLeads ? 'large' : 'medium'}
      icon="keyboard"
      onClick={startText}
    >
      {resume ? 'Resume with text' : 'Start text call'}
    </Button>
  );

  return (
    <div className="cw-pre">
      <header className="cw-pre__bar">
        <div className="cw-pre__bar-inner">
          <Wordmark size="sm" />
          <TextLink to={briefTo} className="cw-pre__back">
            <Icon name="chevron-left" size={16} />
            Back to brief
          </TextLink>
        </div>
      </header>

      <div className="cw-pre__body">
        <Surface as="section" appearance="elevated" padding="lg" className="cw-pre__card">
          <h1 className="cw-pre__title">{resume ? 'Resume call' : 'Ready to call?'}</h1>

          <div className="cw-pre__customer">
            <Avatar name={persona.name} size="lg" />
            <div className="cw-pre__who">
              <p className="cw-pre__name">{persona.name}</p>
              <p className="cw-pre__role">
                {persona.role}, {persona.organisation}
              </p>
              <p className="cw-pre__scenario">
                {product ? <ProductIcon product={product.id} size={16} /> : null}
                <span>{product ? `${product.name}: ${title}` : title}</span>
              </p>
              <Tag size="small">Synthetic customer</Tag>
            </div>
          </div>

          {resume ? (
            <p className="cw-pre__resume">
              Time so far <span>{clock(snapshot.elapsedSeconds)}</span>
            </p>
          ) : null}

          <ul className="cw-pre__checks" role="list" aria-label="What is ready">
            {rows(snapshot, provider).map((row) => (
              <li key={row.label} className={`cw-pre__check cw-pre__check--${row.tone}`}>
                <Icon name={ROW_ICONS[row.tone]} size={20} className="cw-pre__check-icon" />
                <span className="cw-pre__check-label">{row.label}</span>
                <span className="cw-pre__check-value">{row.value}</span>
              </li>
            ))}
          </ul>
          {voiceAvailable ? <p className="cw-pre__notice">{MICROPHONE_NOTICE}</p> : null}
          <Disclosure appearance="inline" summary={PRIVACY_DETAILS_LABEL}>
            <ul className="cw-pre__privacy" role="list">
              {privacyDetails({
                provider: snapshot.support.provider,
                capture: snapshot.support.capture,
                playback: snapshot.support.playback,
                chromium: snapshot.support.chromium,
              }).map((detail) => (
                <li key={detail.id} className="cw-pre__privacy-item">
                  <span className="cw-pre__privacy-label">{detail.label}</span>
                  <span className="cw-pre__detail">{detail.text}</span>
                </li>
              ))}
            </ul>
          </Disclosure>

          {!voiceAvailable && !problem ? (
            <MessageBar intent="info" live={false} title="Voice is not available here">
              {snapshot.support.reason}
            </MessageBar>
          ) : null}

          {problem ? (
            <div ref={notice}>
              <Recovery
                problem={problem}
                busy={false}
                live={problem.announce === 'assertive'}
                // Only what this step can do: ending a call is done from inside it, so a call that is
                // already at its message limit is resumed, and ended from there.
                options={recoveryOptions(problem, { mode: 'text', begun: false }).filter(
                  (option) => option.action === 'retry' || option.action === 'use-text',
                )}
                onAction={(action) => {
                  if (action === 'retry') actions.retry();
                  else if (action === 'use-text') startText();
                }}
              />
            </div>
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
            <h2 className="cw-pre__subtitle">Transcript so far</h2>
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
