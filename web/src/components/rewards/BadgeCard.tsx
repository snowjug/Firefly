import { Link } from 'react-router';
import type { BadgeDTO } from '#shared/domain/api.ts';
import { formatDate } from '../../lib/format.ts';
import { Icon } from '../Icon.tsx';
import { reportHref } from '../report/labels.ts';
import { ProgressBar } from '../ui/ProgressBar.tsx';
import { BadgeEmblem } from './BadgeEmblem.tsx';
import { badgeProgressText, badgeVisual } from './rewards-model.ts';

/**
 * One badge. Earned or not is always written out ("Earned 12 Nov 2026" or "Locked"), so the tint
 * is only a second signal. The progress line says exactly how far along it is.
 */
export function BadgeCard({ badge }: { badge: BadgeDTO }) {
  const visual = badgeVisual(badge.id);
  const { earned } = badge;
  return (
    <li className="glass rw-badge" data-earned={earned ? 'true' : 'false'}>
      <BadgeEmblem icon={visual.icon} tone={visual.tone} earned={earned} />
      <h3 className="rw-badge-title">{badge.title}</h3>
      {earned ? (
        <p className="rw-badge-state">
          <span className="chip chip-amber">
            <Icon name="check" size={14} />
            {badge.earnedAt ? `Earned ${formatDate(badge.earnedAt)}` : 'Earned'}
          </span>
        </p>
      ) : (
        <p className="rw-badge-state">
          <span className="chip">
            <Icon name="lock" size={14} />
            Locked
          </span>
        </p>
      )}
      <p className="rw-badge-criteria">{badge.criteria}</p>
      <div className="rw-badge-progress">
        <ProgressBar
          value={badge.progress.current}
          max={badge.progress.target}
          label={`${badge.title}: progress`}
          tone={earned ? 'amber' : 'violet'}
        />
        <p className="rw-meta tabular">{badgeProgressText(badge)}</p>
      </div>
      {earned && badge.earnedInSessionId ? (
        <p className="rw-meta">
          <Link to={reportHref(badge.earnedInSessionId)} viewTransition>
            See the call that earned it
          </Link>
        </p>
      ) : null}
    </li>
  );
}
