import { useAppConfig } from '../../lib/config.tsx';

/**
 * How replies are produced, said in full. Demo mode is always stated plainly, and any notice from
 * the server is shown with it.
 */
export function ProviderNote() {
  const { config, loading, error } = useAppConfig();
  if (loading) return <p className="stp-provider-text">Checking how replies are produced…</p>;
  if (error || !config) {
    return (
      <p className="stp-provider-text">
        Firefly could not confirm how replies are produced right now. Treat replies and coaching as
        imperfect.
      </p>
    );
  }
  const { provider } = config;
  return (
    <>
      <p className="stp-provider-text">
        {provider.demo
          ? "Replies and coaching come from Firefly's built-in rules engine, not an AI model. They can still miss nuance."
          : `Replies and coaching come from ${provider.label}, an AI model. They can be incomplete or wrong.`}
      </p>
      {provider.notice ? <p className="stp-provider-text">{provider.notice}</p> : null}
    </>
  );
}
