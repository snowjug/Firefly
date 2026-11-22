import type { ReactNode } from 'react';
import { cx } from '../../design/cx.ts';
import './landing.css';

/**
 * One section of the landing page below the hero: a region named by its heading, with the page
 * container inside. `lead` is the one short line under the heading; `quiet` puts the section on the
 * quiet grey of the page, with a hairline above and below.
 */
export function LandingSection({
  id,
  title,
  lead,
  quiet = false,
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  quiet?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`lp-${id}-title`}
      className={cx('lp-section', quiet && 'lp-section--quiet')}
    >
      <div className="l-page lp-section__inner">
        <div className="lp-section__head">
          <h2 id={`lp-${id}-title`} className="lp-title">
            {title}
          </h2>
          {lead ? <p className="lp-lead">{lead}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}
