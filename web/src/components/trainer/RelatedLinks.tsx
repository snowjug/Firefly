import { Link } from 'react-router';
import { Icon, type IconName } from '../Icon.tsx';

const LINKS: { to: string; icon: IconName; title: string; text: string }[] = [
  {
    to: '/history',
    icon: 'history',
    title: 'History',
    text: 'Review past calls and their reports.',
  },
  { to: '/progress', icon: 'chart', title: 'Progress', text: 'See how skills change over time.' },
  {
    to: '/calibration',
    icon: 'target',
    title: 'Calibration',
    text: 'Compare AI scores with a mentor\u2019s.',
  },
];

/** Where a demo usually goes next. */
export function RelatedLinks() {
  return (
    <nav aria-label="Related pages">
      <ul role="list" className="tr-links">
        {LINKS.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className="glass card card-tight card-interactive tr-link"
              viewTransition
            >
              <span className="tone-icon tr-link-icon" data-tone="blue" aria-hidden="true">
                <Icon name={link.icon} size={20} />
              </span>
              <span className="grow">
                <span className="tr-link-title">{link.title}</span>
                <span className="t-small t-muted">{link.text}</span>
              </span>
              <Icon name="arrow-right" size={18} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
