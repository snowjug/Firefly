import type { IssueType } from '#shared/domain/vocab.ts';
import { Icon, type IconName } from '../Icon.tsx';
import type { Tone } from './StatCard.tsx';

// Every issue type has one icon and one tint, so a scenario is recognisable at a glance. The icon is
// decoration: the issue type is always written out next to it.
const VISUALS: Record<IssueType, { icon: IconName; tone: Tone }> = {
  'sign-in-access': { icon: 'key', tone: 'blue' },
  'service-outage': { icon: 'activity', tone: 'red' },
  'slow-performance': { icon: 'gauge', tone: 'amber' },
  'data-missing': { icon: 'database', tone: 'violet' },
  'billing-licence': { icon: 'credit-card', tone: 'green' },
  'how-to': { icon: 'help', tone: 'blue' },
  'feature-not-working': { icon: 'wrench', tone: 'violet' },
};

export function issueVisual(issue: IssueType): { icon: IconName; tone: Tone } {
  return VISUALS[issue];
}

export function IssueIcon({ issue, size = 20 }: { issue: IssueType; size?: number }) {
  const { icon, tone } = VISUALS[issue];
  return (
    <span className="tone-icon" data-tone={tone}>
      <Icon name={icon} size={size} />
    </span>
  );
}
