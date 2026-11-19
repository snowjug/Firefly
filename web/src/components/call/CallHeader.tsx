import { useState } from 'react';
import { Link } from 'react-router';
import type { SessionDTO } from '#shared/domain/api.ts';
import { CALL_STAGE_LABELS, PRACTICE_MODE_LABELS } from '#shared/domain/vocab.ts';
import { formatClock } from '../../lib/format.ts';
import { useInterval } from '../../lib/hooks.ts';
import { useSound } from '../../lib/sound.ts';
import { DifficultyChip } from '../Chips.tsx';
import { Icon } from '../Icon.tsx';
import { ProviderBadge } from '../ProviderBadge.tsx';

/** A running clock. It is deliberately not a live region, so it never interrupts a screen reader. */
function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), 1000);
  return (
    <span className="chip tabular" role="timer" aria-live="off" aria-label="Call length">
      <Icon name="clock" size={14} />
      {formatClock((now - Date.parse(startedAt)) / 1000)}
    </span>
  );
}

export function CallHeader({
  session,
  onOpenDetails,
  onEnd,
}: {
  session: SessionDTO;
  onOpenDetails(): void;
  onEnd(): void;
}) {
  const { scenario } = session;
  const [soundOn, setSound] = useSound();
  return (
    <header className="call-header glass glass-strong">
      <Link
        to="/"
        className="brand call-brand"
        aria-label="Firefly home. Leaving the call keeps it open, and you can resume it from the home page."
      >
        <span className="brand-mark" aria-hidden="true" />
        <span className="hide-sm">Firefly</span>
      </Link>
      <div className="call-title grow">
        <h1 className="call-heading">{scenario.title}</h1>
        <p className="t-meta call-sub">
          Call with {scenario.persona.name}
          <span className="hide-sm"> · {CALL_STAGE_LABELS[scenario.config.callStage].label}</span>
        </p>
      </div>
      <div className="call-chips hide-sm">
        <DifficultyChip difficulty={scenario.config.difficulty} />
        <span className="chip">{PRACTICE_MODE_LABELS[scenario.config.mode].label}</span>
        <ProviderBadge compact />
      </div>
      <ElapsedTimer startedAt={session.startedAt} />
      <button
        type="button"
        className="btn btn-ghost btn-sm btn-icon call-sound"
        aria-pressed={soundOn}
        aria-label="Sound effects"
        title={soundOn ? 'Sound effects are on' : 'Sound effects are off'}
        onClick={() => setSound(!soundOn)}
      >
        <Icon name={soundOn ? 'volume' : 'volume-off'} size={18} />
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm call-details-button"
        onClick={onOpenDetails}
        aria-label="Call details"
      >
        <Icon name="info" size={16} /> <span className="hide-sm">Details</span>
      </button>
      <button type="button" className="btn btn-danger btn-sm" onClick={onEnd}>
        <Icon name="phone" size={16} /> End call
      </button>
    </header>
  );
}
