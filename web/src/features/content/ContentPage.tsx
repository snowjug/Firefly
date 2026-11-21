import { useId, type ReactNode } from 'react';
import { cx } from '../../design/index.ts';
import { OnThisPage, type TocItem } from './OnThisPage.tsx';
import './content.css';

/**
 * The frame of a content page: one h1 and a lead, then the sections. With `toc` it adds an "On this
 * page" list (sticky beside the text on a wide screen, a disclosure above it on a narrow one);
 * without it the text is a single centred reading column.
 */
export function ContentPage({
  title,
  lead,
  toc,
  children,
}: {
  title: string;
  lead: ReactNode;
  toc?: readonly TocItem[];
  children: ReactNode;
}) {
  return (
    <div className={cx('ct-page', toc && 'ct-page--toc')}>
      <div className="ct-header">
        <h1 className="t-title1">{title}</h1>
        <p className="ct-lead">{lead}</p>
      </div>
      {toc ? <OnThisPage items={toc} /> : null}
      <div className="ct-body">{children}</div>
    </div>
  );
}

/** One section of a content page: a labelled region whose id is the anchor for "On this page". */
export function ContentSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section id={id} aria-labelledby={titleId} className="ct-section">
      <h2 id={titleId} className="ct-h2">
        {title}
      </h2>
      {children}
    </section>
  );
}
