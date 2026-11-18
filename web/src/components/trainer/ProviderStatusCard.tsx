import { useId } from 'react';
import { useAppConfig } from '../../lib/config.tsx';
import { Icon } from '../Icon.tsx';
import { SkeletonBlock } from '../Page.tsx';
import { ProviderBadge } from '../ProviderBadge.tsx';

/** Says plainly how the customer and the coaching are produced right now, from the server's config. */
export function ProviderStatusCard() {
  const titleId = useId();
  const { config, loading, error, reload } = useAppConfig();

  return (
    <section className="glass card tr-provider" aria-labelledby={titleId}>
      <div className="tr-provider-head">
        <span className="state-icon" aria-hidden="true">
          <Icon name="layers" size={24} />
        </span>
        <h2 id={titleId} className="t-section grow">
          Provider status
        </h2>
        <ProviderBadge compact />
      </div>

      {loading ? (
        <div className="stack" role="status" aria-label="Loading provider status">
          <SkeletonBlock height={26} width="55%" />
          <SkeletonBlock height={16} />
          <SkeletonBlock height={16} width="80%" />
        </div>
      ) : error || !config ? (
        <div className="callout callout-negative" role="alert">
          <Icon name="alert" size={18} />
          <div className="stack" style={{ ['--stack-gap' as string]: 'var(--sp-3)' }}>
            <p>
              Firefly could not read the server&rsquo;s settings, so the provider is unknown. Check
              that the server is running, then try again.
            </p>
            <div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>
                <Icon name="refresh" size={16} /> Try again
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="stack" style={{ ['--stack-gap' as string]: 'var(--sp-3)' }}>
          <p className="tr-provider-label">{config.provider.label}</p>
          {config.provider.demo ? (
            <>
              <p className="t-muted">
                No AI model is called in demo mode. Firefly&rsquo;s built-in rules engine plays the
                customer: it reads what you say, then composes a reply from the scenario&rsquo;s
                facts and the customer&rsquo;s current mood.
              </p>
              <p className="t-muted">
                The coaching report comes from the rules-based evaluator. It is less flexible than a
                model and can miss nuance, but every quoted line is still checked against the
                transcript.
              </p>
            </>
          ) : (
            <>
              <p className="t-muted">
                The customer&rsquo;s replies come from the configured model, and the model drafts
                the coaching text.
              </p>
              <p className="t-muted">
                Firefly still tracks the customer&rsquo;s mood and the facts you uncover, and checks
                every quoted line against the transcript before a report is saved. Call text is sent
                from the server to that model service to produce replies and coaching.
              </p>
            </>
          )}
          {config.provider.notice ? (
            <div className="callout callout-caution">
              <Icon name="alert" size={18} />
              <p>
                <strong>Notice from the server:</strong> {config.provider.notice}
                {config.provider.demo ? ' Firefly is running in demo mode instead.' : ''}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
