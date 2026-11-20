import { useAppConfig } from '../lib/config.tsx';
import { Icon } from './Icon.tsx';

/**
 * Always-visible label for how the customer and coaching are produced. Demo mode is never
 * disguised. Quiet mono text, never a pill (the shell styles it by where it sits). While the
 * answer is on its way there is nothing to say yet, so it renders nothing.
 */
export function ProviderBadge({ compact = false }: { compact?: boolean }) {
  const { config, loading, error } = useAppConfig();
  if (loading) return null;
  if (error || !config) {
    return (
      <span className="provider-badge provider-badge--offline" role="status">
        <Icon name="alert" size={14} /> Server offline
      </span>
    );
  }
  const { provider } = config;
  const text = provider.demo ? 'Demo mode' : 'Live model';
  return (
    <span
      className="provider-badge"
      data-mode={provider.demo ? 'demo' : 'live'}
      title={
        provider.demo
          ? 'Replies and coaching come from Firefly\u2019s built-in rules engine, not an AI model.'
          : provider.label
      }
    >
      {compact
        ? text
        : provider.demo
          ? 'Demo mode \u00b7 built-in simulated customer'
          : provider.label}
    </span>
  );
}
