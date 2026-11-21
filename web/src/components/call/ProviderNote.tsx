import { useAppConfig } from '../../lib/config.tsx';

/**
 * Says how the customer and the coaching are produced, in a few honest words. Demo mode is never
 * disguised: replies and coaching come from a built-in rules engine, not an AI model.
 */
export function ProviderNote({ long = false }: { long?: boolean }) {
  const { config, loading, error } = useAppConfig();
  if (loading) return <span aria-hidden="true">…</span>;
  if (error || !config) return <span data-tone="negative">Server offline</span>;
  const { provider } = config;
  if (!provider.demo)
    return <span title={provider.label}>{long ? provider.label : 'Live model'}</span>;
  return long ? (
    <span>
      Demo mode, a built-in simulated customer. Replies and coaching come from Firefly’s rules
      engine, not an AI model.
    </span>
  ) : (
    <span title="Replies and coaching come from Firefly’s built-in rules engine, not an AI model.">
      Demo mode
    </span>
  );
}
