import { Link } from 'react-router';
import type { SessionDTO } from '#shared/domain/api.ts';
import { CALL_STAGE_LABELS, PRACTICE_MODE_LABELS } from '#shared/domain/vocab.ts';
import { formatClock } from '../../lib/format.ts';
import { useInterval } from '../../lib/hooks.ts';
import { useState } from 'react';
import { ProviderNote } from './ProviderNote.tsx';

/** A running clock. It is deliberately not a live region, so it never interrupts a screen reader. */
function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), 1000);
  return (
    <span className="ch-strip__clock" role="timer" aria-live="off" aria-label="Call length">
      {formatClock((now - Date.parse(startedAt)) / 1000)}
    </span>
  );
}

/**
 * The quiet line along the top of the room: that the call is live and for how long, what it is
 * about, how it is being practised and what produces the customer. Nothing here is a control except
 * the way home, which keeps the call open.
 */
export function CallStrip({ session }: { session: SessionDTO }) {
  const { scenario } = session;
  return (
    <header className="ch-strip">
      <p className="ch-strip__live">
        <span className="ch-strip__dot" aria-hidden="true" />
        <span>Call in progress</span>
      </p>
      <ElapsedTimer startedAt={session.startedAt} />
      <p className="ch-strip__title" title={scenario.title}>
        {scenario.title}
      </p>
      <ul className="ch-strip__meta" role="list">
        <li>{PRACTICE_MODE_LABELS[scenario.config.mode].label}</li>
        <li className="ch-strip__stage">{CALL_STAGE_LABELS[scenario.config.callStage].label}</li>
        <li>
          <ProviderNote />
        </li>
      </ul>
      <Link
        to="/home"
        className="ch-strip__home"
        aria-label="Firefly home. Leaving the call keeps it open, and you can resume it from the home page."
      >
        Home
      </Link>
    </header>
  );
}
