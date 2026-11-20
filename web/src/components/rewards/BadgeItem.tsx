import { Link } from 'react-router';
import type { BadgeDTO } from '#shared/domain/api.ts';
import { formatDate } from '../../lib/format.ts';
import { reportHref } from '../report/labels.ts';
import { BadgeMark } from './BadgeMark.tsx';
import { Meter } from './Meter.tsx';
import {
  badgeFigure,
  badgeProgressText,
  badgeRatio,
  badgeState,
  type BadgeState,
} from './rewards-model.ts';
import '../../styles/rewards.css';

const STATE_WORD: Record<BadgeState, string> = {
  earned: 'Earned',
  progress: 'In progress',
  locked: 'Locked',
};

/**
 * One badge as an engraved mark with its words. Earned, in progress or locked is always written
 * out (with the date it was earned, and exactly how far along it is), so the mark's lines and its
 * light are only a second signal. Nothing here is a trophy and nothing is compared with anyone.
 */
export function BadgeItem({ badge, moment }: { badge: BadgeDTO; moment: boolean }) {
  const state = badgeState(badge);
  const earnedText = badge.earnedAt ? `Earned ${formatDate(badge.earnedAt)}` : 'Earned';
  return (
    <li
      className="rw-badge"
      data-earned={badge.earned ? 'true' : 'false'}
      data-state={state}
      data-badge={badge.id}
      data-moment={moment ? '' : undefined}
    >
      <BadgeMark figure={badgeFigure(badge.id)} state={state} ratio={badgeRatio(badge)} />
      <div className="rw-badge__body">
        <h4 className="rw-badge__title">{badge.title}</h4>
        <p className="rw-badge__state">{state === 'earned' ? earnedText : STATE_WORD[state]}</p>
        <p className="rw-badge__criteria">{badge.criteria}</p>
        <Meter
          className="rw-badge__meter"
          value={badge.progress.current}
          max={badge.progress.target}
          label={`${badge.title}: progress`}
        />
        <p className="rw-badge__progress">{badgeProgressText(badge)}</p>
        {badge.earned && badge.earnedInSessionId ? (
          <p className="rw-badge__link">
            <Link to={reportHref(badge.earnedInSessionId)} className="text-link" viewTransition>
              See the call that earned it
            </Link>
          </p>
        ) : null}
      </div>
    </li>
  );
}
