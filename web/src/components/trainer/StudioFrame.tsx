import { useId, type ReactNode, type Ref } from 'react';
import { Link } from 'react-router';
import { errorMessage, isApiError } from '../../lib/api.ts';
import { DOCK_ITEMS } from '../shell/nav.ts';
import { Icon, PageFrame, PageHead, useWorldPose } from './bridge.tsx';
import '../../styles/trainer.css';

/** The two tools of the studio, in the order they are offered. */
export const STUDIO_TOOLS = [
  { id: 'trainer', label: 'Trainer', to: '/trainer' },
  { id: 'calibration', label: 'Calibration', to: '/calibration' },
] as const;

export type StudioTool = (typeof STUDIO_TOOLS)[number]['id'];

/** "05 / Studio": the number the dock gives the studio, so the page and the ruler agree. */
export function studioEyebrow(): string {
  const index = DOCK_ITEMS.findIndex((item) => item.to === '/trainer');
  return index < 0 ? 'Studio' : `${String(index + 1).padStart(2, '0')} / Studio`;
}

/**
 * Tabs for the two studio routes, drawn as words on a hairline with an amber point under the one
 * you are on. They are real links in a navigation landmark (not ARIA tabs: each tool is its own
 * page), so the current one is `aria-current="page"`. The point carries a view-transition name, so
 * moving between the tools slides it from one word to the other.
 */
function StudioTabs({ tool }: { tool: StudioTool }) {
  return (
    <nav className="sd-tabs" aria-label="Studio">
      <ul className="sd-tabs__list">
        {STUDIO_TOOLS.map((item) => (
          <li key={item.id}>
            <Link
              to={item.to}
              className="sd-tabs__link"
              aria-current={item.id === tool ? 'page' : undefined}
              viewTransition
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * The frame both studio pages sit in: the page frame, a field that is almost still, a masthead (a
 * mono eyebrow, the page's title in display serif, a lead) and the tabs that make the two tools one
 * place. `compact` is for the middle of a task (a review in progress): a quiet running head and no
 * tabs, so there is nothing to wander off to by accident.
 */
export function StudioFrame({
  tool,
  lead,
  actions,
  compact = false,
  className = '',
  children,
}: {
  tool: StudioTool;
  lead?: ReactNode;
  /** Page-wide controls, set to the right of the lead on a wide screen. */
  actions?: ReactNode;
  compact?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const label = STUDIO_TOOLS.find((item) => item.id === tool)?.label ?? 'Studio';
  // Text pages hold the field nearly still. The route already asks for this; stating it here keeps
  // the page's wish next to the page.
  useWorldPose({ intensity: 0.15 });

  return (
    <PageFrame title={label} className={`sd-root ${className}`.trim()}>
      {compact ? (
        <header className="sd-running">
          <p className="sd-running__eyebrow type-label">{studioEyebrow()}</p>
          <h1 className="sd-running__title type-heading">{label}</h1>
        </header>
      ) : (
        <>
          <PageHead eyebrow={studioEyebrow()} title={label} lead={lead} actions={actions} />
          <StudioTabs tool={tool} />
        </>
      )}
      {children}
    </PageFrame>
  );
}

/**
 * A part of a studio page: a hairline with a small tick, then the section's own words in a margin
 * on the left (a mono eyebrow, the heading, a line about it) and the working content beside it. On
 * a narrow screen the margin sits above the content. `stack` keeps the margin above the content
 * even where there is room, for content that needs the whole width (a wide table).
 */
export function StudioSection({
  id,
  eyebrow,
  title,
  about,
  stack = false,
  headingRef,
  focusable = false,
  aside,
  busy,
  children,
}: {
  id?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  /** One line about the section, under its heading. */
  about?: ReactNode;
  stack?: boolean;
  headingRef?: Ref<HTMLHeadingElement>;
  /** Lets script send focus to the heading (it is not a tab stop). */
  focusable?: boolean;
  /** Something that belongs with the heading but not in the margin (a status, a count). */
  aside?: ReactNode;
  busy?: boolean;
  children?: ReactNode;
}) {
  const titleId = useId();
  return (
    <section
      id={id}
      className="sd-section"
      data-stack={stack ? '' : undefined}
      aria-labelledby={titleId}
      aria-busy={busy || undefined}
    >
      <header className="sd-section__margin">
        {eyebrow ? <p className="sd-section__eyebrow type-label">{eyebrow}</p> : null}
        <h2
          id={titleId}
          ref={headingRef}
          tabIndex={focusable ? -1 : undefined}
          className="sd-section__title type-heading"
        >
          {title}
        </h2>
        {about ? <p className="sd-section__about">{about}</p> : null}
        {aside ? <div className="sd-section__aside">{aside}</div> : null}
      </header>
      <div className="sd-section__body">{children}</div>
    </section>
  );
}

/**
 * A state said as a sentence on a hairline with a point on it: nothing here yet (`empty`) or
 * something went wrong (`error`, announced as an alert, with a diamond instead of a point). It sits
 * inside a section, so its title is a line of text, not another heading.
 */
export function StudioNote({
  tone = 'empty',
  title,
  children,
  action,
}: {
  tone?: 'empty' | 'error';
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="sd-note" data-tone={tone} role={tone === 'error' ? 'alert' : undefined}>
      <p className="sd-note__title">{title}</p>
      {children ? <div className="sd-note__text">{children}</div> : null}
      {action ? <div className="sd-note__action">{action}</div> : null}
    </div>
  );
}

/** What went wrong (in words that are safe to show) and, when trying again can help, a way to. */
export function StudioError({
  error,
  title,
  onRetry,
}: {
  error: unknown;
  title: ReactNode;
  onRetry?: () => void;
}) {
  const retryable = !isApiError(error) || error.retryable;
  return (
    <StudioNote
      tone="error"
      title={title}
      action={
        onRetry && retryable ? (
          <button type="button" className="action action--quiet" onClick={onRetry}>
            <Icon name="refresh" size={18} /> Try again
          </button>
        ) : null
      }
    >
      <p>{errorMessage(error)}</p>
    </StudioNote>
  );
}
