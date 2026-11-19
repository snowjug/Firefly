import { useAppConfig } from '../lib/config.tsx';
import { Icon } from './Icon.tsx';

/** Always-visible label for how the customer and coaching are produced. Demo mode is never disguised. */
export function ProviderBadge({ compact = false }: { compact?: boolean }) {
  const { config, loading, error } = useAppConfig();
  if (loading)
    return (
      <span className="chip" aria-hidden="true">
        …
      </span>
    );
  if (error || !config) {
    return (
      <span className="chip chip-negative" role="status">
        <Icon name="alert" size={14} /> Server offline
      </span>
    );
  }
  const { provider } = config;
  const text = provider.demo ? 'Demo mode' : 'Live model';
  return (
    <span
      className={`chip ${provider.demo ? 'chip-caution' : 'chip-positive'}`}
      title={
        provider.demo
          ? 'Replies and coaching come from Firefly\u2019s built-in rules engine, not an AI model.'
          : provider.label
      }
    >
      <span className="dot" aria-hidden="true" />
      {compact
        ? text
        : provider.demo
          ? 'Demo mode \u00b7 built-in simulated customer'
          : provider.label}
    </span>
  );
}
