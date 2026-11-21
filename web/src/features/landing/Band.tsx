import type { ReactNode } from 'react';
import { cx } from '../../design/index.ts';
import './landing.css';

/**
 * One full-width section of the landing page: a labelled region with a hairline above it, white or
 * quiet, and the page container inside. Pair it with `BandHead` for the heading, which names the
 * region (`aria-labelledby`), and `id` doubles as the anchor the header links to.
 */
export function Band({
  id,
  tone = 'plain',
  className,
  children,
}: {
  id: string;
  tone?: 'plain' | 'quiet';
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cx('lp-band', tone === 'quiet' && 'lp-band--quiet', className)}
    >
      <div className="l-page lp-band__inner">{children}</div>
    </section>
  );
}

/** The h2 of a `Band` and, when there is one, the short paragraph that introduces it. */
export function BandHead({ id, title, intro }: { id: string; title: string; intro?: ReactNode }) {
  return (
    <div className="lp-head">
      <h2 id={`${id}-title`} className="lp-title">
        {title}
      </h2>
      {intro ? <p className="lp-intro measure">{intro}</p> : null}
    </div>
  );
}
