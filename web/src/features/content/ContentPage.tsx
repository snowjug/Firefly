import { useId, type ReactNode } from 'react';
import { Disclosure } from '../../design/primitives/Disclosure.tsx';
import './content.css';

/**
 * The frame of a content page: one h1 and one supporting line, then short sections. There is no
 * "on this page" list because there is no page long enough to need one: the detail is folded away.
 */
export function ContentPage({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <div className="ct-page">
      <div className="ct-header">
        <h1 className="t-title1">{title}</h1>
        <p className="t-lead">{lead}</p>
      </div>
      <div className="ct-body">{children}</div>
    </div>
  );
}

/**
 * One section of a content page: a heading, a few short bullets, and the detail folded into a
 * disclosure that opens on request. Each section is a labelled region.
 */
export function ContentSection({
  id,
  title,
  bullets,
  detailsLabel,
  details,
}: {
  id: string;
  title: string;
  bullets: readonly ReactNode[];
  /** The words on the control that opens the detail. Each one is different, so a list of buttons makes sense. */
  detailsLabel?: string;
  details?: ReactNode;
}) {
  const titleId = useId();
  return (
    <section id={id} aria-labelledby={titleId} className="ct-section">
      <h2 id={titleId} className="ct-h2">
        {title}
      </h2>
      <ul className="ct-bullets" role="list">
        {bullets.map((bullet, index) => (
          <li key={index}>{bullet}</li>
        ))}
      </ul>
      {details ? (
        <Disclosure appearance="inline" summary={detailsLabel ?? 'Details'}>
          <div className="ct-details">{details}</div>
        </Disclosure>
      ) : null}
    </section>
  );
}
