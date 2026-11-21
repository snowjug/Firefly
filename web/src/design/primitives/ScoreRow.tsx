import { useState, type ReactNode } from 'react';
import { cx } from '../cx.ts';
import { Disclosure } from './Disclosure.tsx';
import { ScoreBar } from './ScoreBar.tsx';
import './score-row.css';

export interface ScoreRowProps {
  /** The skill or measure, for example "Scoping & Discovery". */
  label: string;
  /** A score from 1 to `max`, or null when there is none. */
  score: number | null;
  max?: number;
  /** How many verified quotes the score rests on, shown as "3 quotes". Leave it out when unknown. */
  evidenceCount?: number;
  /** What opens under the row: the rationale, the quote, the improvement. Without it the row is only a row. */
  children?: ReactNode;
  /** Puts the row's button inside a heading, so a screen reader can list the rows. */
  headingLevel?: 2 | 3 | 4 | 5;
  /** Fills the bar once from empty when it first appears. Only when motion is allowed. */
  animate?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?(open: boolean): void;
  className?: string;
}

/**
 * One score on one line: the label, a bar with the number and the word as text, how many quotes
 * support it, and an "Expand details" control that opens the evidence in place. The whole line is
 * the button, so the target is large; the state is announced by the button and written in the label.
 */
export function ScoreRow({
  label,
  score,
  max = 5,
  evidenceCount,
  children,
  headingLevel,
  animate,
  defaultOpen = false,
  open,
  onOpenChange,
  className,
}: ScoreRowProps) {
  const [own, setOwn] = useState(defaultOpen);
  const isOpen = open ?? own;
  const evidence =
    evidenceCount === undefined
      ? null
      : `${evidenceCount} ${evidenceCount === 1 ? 'quote' : 'quotes'}`;
  const main = (
    <span className="ff-scorerow__main">
      <span className="ff-scorerow__label">{label}</span>
      <ScoreBar score={score} max={max} size="small" animate={animate} />
    </span>
  );

  if (!children) {
    return (
      <div className={cx('ff-scorerow', 'ff-scorerow--static', className)}>
        {main}
        {evidence ? <span className="ff-scorerow__evidence">{evidence}</span> : null}
      </div>
    );
  }
  return (
    <Disclosure
      className={cx('ff-scorerow', className)}
      summary={main}
      meta={
        <span className="ff-scorerow__meta">
          {evidence ? <span className="ff-scorerow__evidence">{evidence}</span> : null}
          <span className="ff-scorerow__toggle">{isOpen ? 'Hide details' : 'Expand details'}</span>
        </span>
      }
      headingLevel={headingLevel}
      open={isOpen}
      onOpenChange={(next) => {
        if (open === undefined) setOwn(next);
        onOpenChange?.(next);
      }}
    >
      {children}
    </Disclosure>
  );
}
