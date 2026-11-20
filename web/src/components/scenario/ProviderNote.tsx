import { useAppConfig } from '../../lib/config.tsx';

/**
 * How replies are produced, said in full and in plain words. Demo mode is always stated, a server
 * that cannot be reached is said to be offline, and any notice from the server is shown with it.
 */
export function ProviderNote() {
  const { config, loading, error } = useAppConfig();
  if (loading) return <p className="cal-note__text">Checking how replies are produced…</p>;
  if (error || !config) {
    return (
      <p className="cal-note__text">
        <strong>Server offline.</strong> Firefly could not confirm how replies are produced right
        now. Treat replies and coaching as imperfect.
      </p>
    );
  }
  const { provider } = config;
  return (
    <>
      <p className="cal-note__text">
        {provider.demo ? (
          <>
            <strong>Demo mode.</strong> Replies and coaching come from Firefly&rsquo;s built-in
            rules engine, not an AI model. They can still miss nuance.
          </>
        ) : (
          `Replies and coaching come from ${provider.label}, an AI model. They can be incomplete or wrong.`
        )}
      </p>
      {provider.notice ? <p className="cal-note__text">{provider.notice}</p> : null}
    </>
  );
}
