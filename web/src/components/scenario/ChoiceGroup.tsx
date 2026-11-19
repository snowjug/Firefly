import { useId, type ReactNode } from 'react';
import type { Tone } from '../ui/StatCard.tsx';

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  /** Shown before the label, such as a tinted icon. */
  lead?: ReactNode;
  /** A short text tag, such as "Default for Standard". */
  tag?: string;
  /** Tints the card. */
  tone?: Tone;
}

interface ChoiceGroupProps<T extends string> {
  /** Shared by the radio inputs; keep it unique on the page. */
  name: string;
  legend: string;
  /** Makes the legend the section's heading, so the group is both a heading and a named group. */
  heading?: 'h2' | 'h3';
  /** Keep the legend for screen readers only when a heading already says the same thing. */
  hideLegend?: boolean;
  /** Said under the options. The group is described by it. */
  hint?: ReactNode;
  value: T;
  options: readonly ChoiceOption<T>[];
  onChange(value: T): void;
  columns?: 1 | 2 | 3;
  disabled?: boolean;
  className?: string;
}

/**
 * One decision as a row of selectable cards. Each card is a real radio input (visually hidden but
 * focusable), so arrow keys, Space and screen readers work as they do for any radio group.
 */
export function ChoiceGroup<T extends string>({
  name,
  legend,
  heading,
  hideLegend = false,
  hint,
  value,
  options,
  onChange,
  columns = 1,
  disabled = false,
  className = '',
}: ChoiceGroupProps<T>) {
  const baseId = useId();
  const hintId = `${baseId}-hint`;
  const Heading = heading;
  return (
    <fieldset
      className={`stp-choices ${className}`.trim()}
      disabled={disabled}
      aria-describedby={hint ? hintId : undefined}
    >
      <legend className={hideLegend ? 'sr-only' : 'stp-legend'}>
        {Heading ? <Heading className="t-section">{legend}</Heading> : legend}
      </legend>
      <div className="stp-choice-grid" data-columns={columns}>
        {options.map((option) => {
          const id = `${baseId}-${option.value}`;
          const describedBy = [
            option.description ? `${id}-desc` : null,
            option.tag ? `${id}-tag` : null,
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <label
              key={option.value}
              className="option stp-choice"
              data-tone={option.tone}
              data-lead={option.lead ? 'true' : undefined}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                aria-labelledby={`${id}-title`}
                aria-describedby={describedBy || undefined}
              />
              {option.lead}
              <span className="stp-choice-body">
                <span className="stp-choice-head">
                  <span id={`${id}-title`} className="option-title">
                    {option.label}
                  </span>
                  {option.tag ? (
                    <span id={`${id}-tag`} className="stp-tag">
                      {option.tag}
                    </span>
                  ) : null}
                </span>
                {option.description ? (
                  <span id={`${id}-desc`} className="stp-choice-desc">
                    {option.description}
                  </span>
                ) : null}
              </span>
              <span className="option-check" aria-hidden="true" />
            </label>
          );
        })}
      </div>
      {hint ? (
        <p id={hintId} className="stp-hint">
          {hint}
        </p>
      ) : null}
    </fieldset>
  );
}
