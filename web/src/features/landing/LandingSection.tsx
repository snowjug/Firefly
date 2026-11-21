import type { ReactNode } from 'react';
import { cx } from '../../design/cx.ts';
import './landing.css';

/**
 * One section of the landing page below the hero: a region named by its heading, with the page
 * container inside. `quiet` puts it on the quiet grey of the page, with a hairline above and below.
 */
export function LandingSection({
  id,
  title,
  quiet = false,
  children,
}: {
  id: string;
  title: string;
  quiet?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`lp-${id}-title`}
      className={cx('lp-section', quiet && 'lp-section--quiet')}
    >
      <div className="l-page lp-section__inner">
        <h2 id={`lp-${id}-title`} className="lp-title">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}
