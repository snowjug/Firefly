import { Link, useLocation } from 'react-router';
import { Icon } from '../Icon.tsx';
import { BrandMark } from './BrandMark.tsx';
import { FOOT_NAV, MAIN_NAV, MENTOR_NAV, type NavItem } from './nav.ts';

function SideLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = item.match(pathname);
  return (
    <Link
      to={item.to}
      className="side-link"
      aria-current={active ? 'page' : undefined}
      title={item.label}
      onClick={onNavigate}
    >
      <Icon name={item.icon} size={19} />
      <span className="side-link-label">{item.label}</span>
    </Link>
  );
}

/** The destinations, shared by the desktop sidebar and the mobile drawer. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return (
    <>
      <nav aria-label="Main" className="side-nav">
        {MAIN_NAV.map((item) => (
          <SideLink key={item.to} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </nav>
      <nav aria-label="For mentors" className="side-group">
        <p className="side-label">For mentors</p>
        <div className="side-nav">
          {MENTOR_NAV.map((item) => (
            <SideLink key={item.to} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>
      <nav aria-label="Account and help" className="side-foot">
        {FOOT_NAV.map((item) => (
          <SideLink key={item.to} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
        <p className="side-note">
          Firefly is a training aid. Scenarios are fictional. Scores are for practice, not
          performance reviews.
        </p>
      </nav>
    </>
  );
}

export function SidebarBrand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link to="/home" className="brand" aria-label="Firefly home" onClick={onNavigate}>
      <BrandMark />
      <span className="brand-text">Firefly</span>
    </Link>
  );
}
