import type { CSSProperties, ReactNode } from 'react';
import { cx } from '../../design/cx.ts';
import { useReveal } from '../../design/interaction/use-reveal.ts';
import './landing.css';

/**
 * One section of the landing page below the hero: a region named by its heading, with the page
 * container inside. `lead` is the one short line under the heading; `quiet` puts the section on the
 * quiet grey of the page, with a hairline above and below; `tight` takes less air above and below.
 * The heading rises into place the first time it scrolls into view and what the section holds
 * follows it a beat later (`useReveal`); nothing is hidden without motion, on paper or without a
 * script.
 */
export function LandingSection({
  id,
  title,
  lead,
  quiet = false,
  tight = false,
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  quiet?: boolean;
  tight?: boolean;
  children: ReactNode;
}) {
  const [head, headReveal] = useReveal<HTMLDivElement>();
  const [body, bodyReveal] = useReveal<HTMLDivElement>();
  return (
    <section
      aria-labelledby={`lp-${id}-title`}
      className={cx('lp-section', quiet && 'lp-section--quiet', tight && 'lp-section--tight')}
    >
      <div className="l-page lp-section__inner">
        <div ref={head} {...headReveal} className="lp-section__head">
          <h2 id={`lp-${id}-title`} className="lp-title">
            {title}
          </h2>
          {lead ? <p className="lp-lead">{lead}</p> : null}
        </div>
        <div ref={body} {...bodyReveal} style={{ '--reveal-i': 1 } as CSSProperties}>
          {children}
        </div>
      </div>
    </section>
  );
}
