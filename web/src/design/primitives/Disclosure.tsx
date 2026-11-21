import { useId, useState, type ElementType, type ReactNode } from 'react';
import { cx } from '../cx.ts';
import { Icon, type IconName } from '../icons.tsx';
import './disclosure.css';

export interface DisclosureProps {
  /** What is behind the row, as it reads: "Details", "Where speech goes". */
  summary: ReactNode;
  /** A short fact at the end of the row (a count, a status). It is part of the button's name. */
  meta?: ReactNode;
  icon?: IconName;
  children: ReactNode;
  /** Open on first render, when the open state is not controlled. */
  defaultOpen?: boolean;
  /** Controlled open state. Pass `onOpenChange` too. */
  open?: boolean;
  onOpenChange?(open: boolean): void;
  /** `row` is a full-width row with a rule under it; `inline` is a plain toggle that sits in text. */
  appearance?: 'row' | 'inline';
  /** Puts the button inside a heading of this level (the accordion pattern) when the row names a section. */
  headingLevel?: 2 | 3 | 4 | 5;
  className?: string;
  id?: string;
}

/**
 * Progressive disclosure: a button that shows or hides more. It announces its state
 * (`aria-expanded`), names what it controls (`aria-controls`), works with Enter and Space and is a
 * 44 px target (an inline toggle is 32 px with a mouse and 44 px on a touch screen). The panel
 * appears with a short fade; under reduced motion it simply appears. A printed page shows every
 * panel.
 */
export function Disclosure({
  summary,
  meta,
  icon,
  children,
  defaultOpen = false,
  open,
  onOpenChange,
  appearance = 'row',
  headingLevel,
  className,
  id,
}: DisclosureProps) {
  const base = useId();
  const [own, setOwn] = useState(defaultOpen);
  const isOpen = open ?? own;
  const panelId = `${base}-panel`;
  const toggle = () => {
    const next = !isOpen;
    if (open === undefined) setOwn(next);
    onOpenChange?.(next);
  };
  // The spaces between the parts are invisible in the flex row, and make the button's name read
  // "Evidence 3 quotes" instead of "Evidence3 quotes" wherever inline parts are joined as written.
  const button = (
    <button
      type="button"
      className="ff-disclosure__button"
      aria-expanded={isOpen}
      aria-controls={panelId}
      onClick={toggle}
    >
      {icon ? <Icon name={icon} size={20} className="ff-disclosure__icon" /> : null}
      <span className="ff-disclosure__summary">{summary}</span>{' '}
      {meta ? <span className="ff-disclosure__meta">{meta}</span> : null}{' '}
      <Icon name="chevron-down" size={16} className="ff-disclosure__chevron" />
    </button>
  );
  const Heading = `h${headingLevel ?? 3}` as ElementType;
  return (
    <div
      id={id}
      className={cx(
        'ff-disclosure',
        `ff-disclosure--${appearance}`,
        isOpen && 'ff-disclosure--open',
        className,
      )}
    >
      {headingLevel ? <Heading className="ff-disclosure__heading">{button}</Heading> : button}
      <div id={panelId} className="ff-disclosure__panel" hidden={!isOpen}>
        {children}
      </div>
    </div>
  );
}
