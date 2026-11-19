import type { ReactNode } from 'react';
import type { ProgressDTO } from '#shared/domain/api.ts';
import { DIMENSIONS } from '#shared/domain/vocab.ts';
import { plural } from '../../lib/format.ts';
import { Icon, type IconName } from '../Icon.tsx';
import type { Tone } from '../ui/StatCard.tsx';
import { RECENT_CHANGE } from './progress-model.ts';

function Tile({
  icon,
  tone,
  label,
  value,
  children,
}: {
  icon: IconName;
  tone: Tone;
  label: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <div className="glass pg-tile">
      <span className="stat-icon" data-tone={tone} aria-hidden="true">
        <Icon name={icon} size={22} />
      </span>
      <div className="pg-tile-body">
        <p className="t-label">{label}</p>
        <p className="pg-tile-value">{value}</p>
        <p className="pg-tile-text">{children}</p>
      </div>
    </div>
  );
}

/** Three things to know at a glance: how many calls count, which way recent calls are heading and the strongest skill. */
export function SummaryTiles({ progress }: { progress: ProgressDTO }) {
  const change = RECENT_CHANGE[progress.recentChange];
  const strongest = progress.strongest ? DIMENSIONS[progress.strongest] : null;
  const started = progress.totalSessions - progress.completedSessions;
  return (
    <section aria-labelledby="pg-summary-title">
      <h2 id="pg-summary-title" className="sr-only">
        Summary
      </h2>
      <div className="pg-tiles">
        <Tile
          icon="check-circle"
          tone="blue"
          label="Completed calls"
          value={String(progress.completedSessions)}
        >
          {started > 0
            ? `${plural(progress.totalSessions, 'session')} started in all. Only completed calls are scored.`
            : 'Each one has a coaching report.'}
        </Tile>
        <Tile icon={change.icon} tone={change.tone} label="Recent change" value={change.label}>
          {change.text}
        </Tile>
        <Tile
          icon="bolt"
          tone="green"
          label="Strongest so far"
          value={strongest ? strongest.label : 'Not clear yet'}
        >
          {strongest
            ? strongest.description
            : 'This appears once you have two completed calls to compare.'}
        </Tile>
      </div>
    </section>
  );
}
