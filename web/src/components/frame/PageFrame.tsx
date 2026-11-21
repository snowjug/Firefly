import { useId, type ReactNode } from 'react';
import { useDocumentTitle } from '../../lib/hooks.ts';
import '../../styles/frame.css';

/**
 * The frame every page sits in: it sets the document title, keeps clear of the wordmark above and
 * the dock below, applies the page gutter and holds the page to a maximum width (`narrow` is a
 * reading column). It renders no landmark: the shell owns `<main>`.
 */
export function PageFrame({
  title,
  width = 'default',
  className = '',
  children,
}: {
  /** The document title ("Missions" becomes "Missions · Firefly"). */
  title: string;
  width?: 'narrow' | 'default' | 'wide';
  className?: string;
  children: ReactNode;
}) {
  useDocumentTitle(title);
  return <div className={`frame frame--${width} ${className}`.trim()}>{children}</div>;
}

/**
 * The opening of a page or a block: a mono eyebrow, a display-serif title, a lead paragraph held to
 * the reading measure and actions that sit to the right on wide screens and stack below on narrow
 * ones. Use level 1 once per page (the page title); level 2 for a head inside a page.
 */
export function PageHead({
  eyebrow,
  title,
  lead,
  actions,
  level = 1,
  as: Wrapper = 'header',
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  level?: 1 | 2;
  /** The wrapping element; use `div` where a `header` landmark would be wrong. */
  as?: 'header' | 'div';
}) {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <Wrapper className="ff-head">
      {eyebrow ? <p className="ff-head__eyebrow type-label">{eyebrow}</p> : null}
      <div className="ff-head__row">
        <div className="ff-head__text">
          <Heading className={`ff-head__title ${level === 1 ? 'type-display' : 'type-title'}`}>
            {title}
          </Heading>
          {lead ? <p className="ff-head__lead type-lead">{lead}</p> : null}
        </div>
        {actions ? <div className="ff-head__actions action-row">{actions}</div> : null}
      </div>
    </Wrapper>
  );
}

/**
 * A part of a page: a heading with a hairline rule above it (and an optional mono eyebrow and an
 * aside such as a "View all" link). It is a labelled region, so screen-reader users can jump to it.
 */
export function Section({
  title,
  eyebrow,
  children,
  aside,
  id,
  level = 2,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
  id?: string;
  level?: 2 | 3;
}) {
  const titleId = useId();
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <section id={id} className="ff-section" aria-labelledby={titleId}>
      <header className="ff-section__head">
        <div className="ff-section__titles">
          {eyebrow ? <p className="ff-section__eyebrow type-label">{eyebrow}</p> : null}
          <Heading id={titleId} className="ff-section__title type-heading">
            {title}
          </Heading>
        </div>
        {aside ? <div className="ff-section__aside">{aside}</div> : null}
      </header>
      {children}
    </section>
  );
}
