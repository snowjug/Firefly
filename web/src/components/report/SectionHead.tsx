import type { ReactNode } from 'react';

/** The heading of a long section of the report: a title and one plain sentence under it. */
export function SectionHead({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="rp-section-head">
      <h2 id={id} className="rp-h2">
        {title}
      </h2>
      {children ? <p className="rp-lead">{children}</p> : null}
    </div>
  );
}
