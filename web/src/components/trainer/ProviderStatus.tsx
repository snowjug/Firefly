import { ApiError } from '../../lib/api.ts';
import { useAppConfig } from '../../lib/config.tsx';
import { Ledger, LoadingNotice, Tag } from './bridge.tsx';
import { StudioError, StudioSection } from './StudioFrame.tsx';

// Said when the server's settings cannot be read, so the provider is not guessed at.
const UNKNOWN = new ApiError(
  0,
  'network',
  'Firefly could not read the server\u2019s settings, so the provider is unknown. Check that the server is running, then try again.',
  true,
);

/** Says plainly how the customer and the coaching are produced right now, from the server's config. */
export function ProviderStatus() {
  const { config, loading, error, reload } = useAppConfig();

  return (
    <StudioSection
      title="Provider status"
      about="How the customer and the coaching are produced right now."
      busy={loading}
    >
      {loading ? (
        <LoadingNotice label="Loading provider status" lines={3} />
      ) : error || !config ? (
        <StudioError error={UNKNOWN} title="The provider is unknown" onRetry={reload} />
      ) : (
        <div className="tr-provider">
          <div className="tr-provider__head">
            <p className="tr-provider__label">{config.provider.label}</p>
            <Tag tone={config.provider.demo ? 'amber' : 'sage'}>
              {config.provider.demo ? 'Demo mode' : 'Live model'}
            </Tag>
          </div>
          <Ledger
            rows={[
              ...(config.provider.demo
                ? [
                    {
                      label: 'The customer',
                      value: (
                        <p className="tr-measure">
                          No AI model is called in demo mode. Firefly&rsquo;s built-in rules engine
                          plays the customer: it reads what you say, then composes a reply from the
                          scenario&rsquo;s facts and the customer&rsquo;s current mood.
                        </p>
                      ),
                    },
                    {
                      label: 'The coaching report',
                      value: (
                        <p className="tr-measure">
                          The coaching report comes from the rules-based evaluator. It is less
                          flexible than a model and can miss nuance, but every quoted line is still
                          checked against the transcript.
                        </p>
                      ),
                    },
                  ]
                : [
                    {
                      label: 'Replies and coaching',
                      value: (
                        <p className="tr-measure">
                          The customer&rsquo;s replies come from the configured model, and the model
                          drafts the coaching text.
                        </p>
                      ),
                    },
                    {
                      label: 'What Firefly still checks',
                      value: (
                        <p className="tr-measure">
                          Firefly still tracks the customer&rsquo;s mood and the facts you uncover,
                          and checks every quoted line against the transcript before a report is
                          saved. Call text is sent from the server to that model service to produce
                          replies and coaching.
                        </p>
                      ),
                    },
                  ]),
              ...(config.provider.notice
                ? [
                    {
                      label: 'Notice from the server',
                      value: (
                        <p className="tr-measure">
                          {config.provider.notice}
                          {config.provider.demo ? ' Firefly is running in demo mode instead.' : ''}
                        </p>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      )}
    </StudioSection>
  );
}
