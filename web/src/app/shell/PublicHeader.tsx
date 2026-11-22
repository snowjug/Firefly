import { useCallback, useId, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { useScrolled } from '../../design/interaction/use-scrolled.ts';
import { Button, LinkButton } from '../../design/primitives/Button.tsx';
import { ThemeToggle } from '../../design/theme/ThemeToggle.tsx';
import { useDismiss } from './use-dismiss.ts';
import { useSlidingIndicator } from './use-sliding-indicator.ts';
import { Wordmark } from './Wordmark.tsx';
import './header.css';

const LINKS = [
  { to: '/scenarios', label: 'Scenarios' },
  { to: '/responsible-ai', label: 'Responsible AI' },
] as const;

/**
 * The header of the public pages: the wordmark, two links and the main action. Below 48em the links
 * collapse into a disclosure menu (aria-expanded, aria-controls, Escape closes it and returns focus
 * to the button) while "Start call" stays in the bar. One indicator slides to the current link, and
 * the bar gains an edge and a soft shadow once the page has scrolled.
 */
export function PublicHeader() {
  const location = useLocation();
  const menuId = useId();
  const header = useRef<HTMLElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const nav = useRef<HTMLElement>(null);
  // Open for one location: following any link (or going back) closes the menu with no effect needed.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === location.key;
  const close = useCallback(() => setOpenAt(null), []);
  useDismiss(header, button, open, close);
  const scrolled = useScrolled();
  useSlidingIndicator(nav, '[aria-current="page"]', location.pathname);

  return (
    <header
      ref={header}
      className="ff-header ff-header--public"
      data-scrolled={scrolled || undefined}
    >
      <div className="ff-header__bar l-page">
        <Wordmark to="/" className="ff-header__brand" />
        <Button
          ref={button}
          appearance="subtle"
          icon={open ? 'x' : 'menu'}
          className="ff-header__menu"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpenAt(open ? null : location.key)}
        >
          <span className="ff-header__menu-label">Menu</span>
        </Button>
        <nav
          ref={nav}
          id={menuId}
          className="ff-header__nav"
          aria-label="Primary"
          data-open={open || undefined}
        >
          <ul className="ff-header__links" role="list">
            {LINKS.map((link) => (
              <li key={link.label}>
                <NavLink to={link.to} className="ff-navlink">
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <span className="ff-header__indicator" aria-hidden="true" />
        </nav>
        <div className="ff-header__actions">
          <ThemeToggle />
          <LinkButton to="/scenarios" appearance="primary">
            Start call
          </LinkButton>
        </div>
      </div>
    </header>
  );
}
