import { Link } from 'react-router';
import { Icon } from './bridge.tsx';
import { StudioSection } from './StudioFrame.tsx';

const LINKS: { to: string; title: string; text: string }[] = [
  { to: '/history', title: 'History', text: 'Review past calls and their reports.' },
  { to: '/progress', title: 'Progress', text: 'See how skills change over time.' },
  { to: '/calibration', title: 'Calibration', text: 'Compare AI scores with a mentor\u2019s.' },
];

/** Where a demo usually goes next. */
export function RelatedLinks() {
  return (
    <StudioSection
      title="Where a demo goes next"
      about="Three places that pick up from a finished call."
    >
      <nav aria-label="Related pages">
        <ul className="tr-links">
          {LINKS.map((link) => (
            <li key={link.to}>
              <Link to={link.to} className="tr-link" viewTransition>
                <span className="tr-link__text">
                  <span className="tr-link__title">{link.title}</span>
                  <span className="tr-link__about">{link.text}</span>
                </span>
                <Icon name="arrow-right" size={20} />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </StudioSection>
  );
}
