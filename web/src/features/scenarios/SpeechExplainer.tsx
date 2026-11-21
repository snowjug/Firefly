import type { ReactNode } from 'react';
import type { AppConfigDTO } from '#shared/domain/api.ts';
import { Button, Icon, MessageBar, Skeleton, TextLink, type IconName } from '../../design/index.ts';
import { MICROPHONE_INTRO, describeCustomer, type SpeechSetup } from './speech-setup.ts';
import './speech-explainer.css';

function Fact({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <div className="brf-fact">
      <Icon name={icon} size={20} className="brf-fact__icon" />
      <div className="brf-fact__body">
        <h3 className="brf-fact__title">{title}</h3>
        <p className="brf-fact__text">{children}</p>
      </div>
    </div>
  );
}

export interface SpeechExplainerProps {
  /** How speech works here, or null while the server's settings are not known. */
  setup: SpeechSetup | null;
  provider: AppConfigDTO['provider'] | null;
  loading: boolean;
  /** The server's settings could not be loaded. */
  failed: boolean;
  onRetry(): void;
}

/**
 * The microphone and privacy explainer. Every sentence says what this server and this browser
 * will really do: where speech is turned into text, who makes the customer's voice, and who plays
 * the customer.
 */
export function SpeechExplainer({
  setup,
  provider,
  loading,
  failed,
  onRetry,
}: SpeechExplainerProps) {
  return (
    <div className="brf-explainer">
      <Fact icon="microphone" title="Speak, or type.">
        {MICROPHONE_INTRO}
      </Fact>

      {setup && provider ? (
        <>
          <Fact icon="shield" title="Your speech">
            {setup.yourSpeech}
          </Fact>
          <Fact icon="speaker" title="The customer's voice">
            {setup.customerVoice}
          </Fact>
          <Fact icon="sparkle" title="Who plays the customer">
            {describeCustomer(provider)}
          </Fact>
          {setup.notice || provider.notice ? (
            <MessageBar intent="warning" live={false}>
              {[setup.notice, provider.notice].filter(Boolean).join(' ')}
            </MessageBar>
          ) : null}
        </>
      ) : failed ? (
        <MessageBar
          intent="warning"
          title="Speech settings could not be loaded"
          actions={<Button onClick={onRetry}>Try again</Button>}
        >
          Firefly cannot say how your voice would be handled, so only a typed call is offered.
          Nothing has been recorded.
        </MessageBar>
      ) : loading ? (
        <div className="brf-explainer__loading" aria-busy="true">
          <Skeleton lines={3} />
          <Skeleton lines={2} />
        </div>
      ) : null}

      <TextLink to="/responsible-ai" className="brf-explainer__link">
        How Firefly uses AI and speech
      </TextLink>
    </div>
  );
}
