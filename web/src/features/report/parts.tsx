import type { ReactNode } from 'react';
import { cx } from '../../design/index.ts';
import { TurnLink } from './evidence.tsx';
import { turnName } from './copy.ts';
import './report.css';

/**
 * A titled part of the report. Its heading can take focus (when a link jumps here) and its
 * `data-rp-origin` is what "Back to ..." calls it after an evidence link was followed from inside.
 */
export function Section({
  id,
  title,
  lead,
  children,
  className,
}: {
  id: string;
  title: string;
  lead?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cx('rp-section', className)}
      data-rp-origin={title}
    >
      <header className="rp-section__head">
        <h2 id={`${id}-title`} className="rp-section__title" tabIndex={-1} data-rp-heading>
          {title}
        </h2>
        {lead ? <p className="rp-section__lead">{lead}</p> : null}
      </header>
      {children}
    </section>
  );
}

/** A small label and the text it names, one under the other. */
export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('rp-field', className)}>
      <p className="rp-field__label">{label}</p>
      <div className="rp-field__text">{children}</div>
    </div>
  );
}

/**
 * Words the trainee said, set apart as evidence: the exact text, whose turn it was and a link to
 * that turn in the transcript. Without a turn it is only the words.
 */
export function Quote({
  quote,
  turnIndex,
  speaker = 'You',
}: {
  quote: string;
  turnIndex: number | null;
  speaker?: string;
}) {
  return (
    <figure className="rp-quote">
      <blockquote className="rp-quote__text">
        <p className="t-quote">{`\u201c${quote}\u201d`}</p>
      </blockquote>
      {turnIndex !== null ? (
        <figcaption className="rp-quote__foot">
          <span className="rp-quote__who">
            {speaker}, {turnName(turnIndex).toLowerCase()}
          </span>
          <TurnLink turnIndex={turnIndex} quote={quote} />
        </figcaption>
      ) : null}
    </figure>
  );
}

/** The skill an item is about, as a small label above its title. */
export const SkillTag = ({ children }: { children: ReactNode }) => (
  <p className="rp-item__skill">{children}</p>
);
