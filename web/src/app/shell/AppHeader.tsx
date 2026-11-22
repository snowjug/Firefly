import { useCallback, useId, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import type { AppConfigDTO } from '#shared/domain/api.ts';
import { useScrolled } from '../../design/interaction/use-scrolled.ts';
import { Badge, type BadgeTone } from '../../design/primitives/Badge.tsx';
import { Icon, type IconName } from '../../design/icons.tsx';
import { ThemeToggle } from '../../design/theme/ThemeToggle.tsx';
import { useAppConfig } from '../../lib/config.tsx';
import { useCurrentSection } from '../section.tsx';
import { useDismiss } from './use-dismiss.ts';
import { Wordmark } from './Wordmark.tsx';
import './header.css';

interface ProviderStatus {
  full: string;
  compact: string;
  tone: BadgeTone;
  icon: IconName;
  explanation: string;
  notice: string | null;
}

/** What the server says it is using, in its own words. Nothing is shown if the config did not load. */
export function providerStatus(config: AppConfigDTO | null): ProviderStatus | null {
  if (!config) return null;
  const { demo, label, notice } = config.provider;
  return {
    full: demo ? 'Demo mode' : `Live: ${label}`,
    compact: demo ? 'Demo' : 'Live',
    tone: notice ? 'warning' : demo ? 'neutral' : 'ai',
    icon: notice ? 'warning' : demo ? 'info' : 'sparkle',
    explanation: demo
      ? "Customer replies come from Firefly's built-in rules engine, not a live language model."
      : 'Customer replies come from this language model.',
    notice,
  };
}

/**
 * The header inside the app: the wordmark, the current section (set by the page with
 * `useAppSection`), the provider status and a Responsible AI link. Below 48em it is a compact bar
 * with a Back control (when the page supplies one) and a disclosure holding the status and link.
 * Like the public header, it gains an edge and a soft shadow once the page has scrolled.
 */
export function AppHeader() {
  const section = useCurrentSection();
  const { config } = useAppConfig();
  const status = providerStatus(config);
  const location = useLocation();
  const panelId = useId();
  const header = useRef<HTMLElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === location.key;
  const close = useCallback(() => setOpenAt(null), []);
  useDismiss(header, button, open, close);
  const scrolled = useScrolled();

  const hasBack = Boolean(section?.backTo);
  return (
    <header ref={header} className="ff-header ff-header--app" data-scrolled={scrolled || undefined}>
      <div className="ff-header__bar l-page">
        {section?.backTo ? (
          <Link
            to={section.backTo}
            className="ff-header__back"
            aria-label={section.backLabel ? `Back to ${section.backLabel}` : 'Back'}
          >
            <Icon name="chevron-left" size={18} />
            <span>Back</span>
          </Link>
        ) : null}
        <Wordmark
          to="/"
          className={hasBack ? 'ff-header__brand ff-header__brand--has-back' : 'ff-header__brand'}
        />
        {section ? (
          <div className="ff-header__section">
            <span className="ff-header__rule" aria-hidden="true" />
            {section.backTo && section.backLabel ? (
              <>
                <Link to={section.backTo} className="ff-header__parent">
                  {section.backLabel}
                </Link>
                <Icon name="chevron-right" size={14} className="ff-header__parent-separator" />
              </>
            ) : null}
            <p className="ff-header__title">{section.title}</p>
          </div>
        ) : (
          <div className="ff-header__grow" />
        )}
        {status ? (
          <span className="ff-header__status">
            <Badge tone={status.tone} icon={status.icon}>
              {status.full}
            </Badge>
          </span>
        ) : null}
        <ThemeToggle className="ff-header__theme" />
        <button
          ref={button}
          type="button"
          className="ff-header__more"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={status ? status.full : 'Menu'}
          onClick={() => setOpenAt(open ? null : location.key)}
        >
          {status ? (
            <>
              <Badge tone={status.tone} icon={status.icon} size="small">
                {status.compact}
              </Badge>
              <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} />
            </>
          ) : (
            <Icon name={open ? 'x' : 'menu'} size={20} />
          )}
        </button>
        <div id={panelId} className="ff-header__panel" data-open={open || undefined}>
          {status ? (
            <p className="ff-header__note">
              <strong>{status.full}.</strong> {status.explanation}
              {status.notice ? ` ${status.notice}` : ''}
            </p>
          ) : null}
          <nav aria-label="Primary">
            <ul className="ff-header__links" role="list">
              <li>
                <NavLink to="/responsible-ai" className="ff-navlink">
                  Responsible AI
                </NavLink>
              </li>
            </ul>
          </nav>
          <div className="ff-header__theme-row">
            <span>Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
