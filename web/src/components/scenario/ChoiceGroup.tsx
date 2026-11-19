import { useId, type ReactNode } from 'react';

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  /** An extra line below the description, for example what a preset starts with. */
  detail?: string;
  /** Shown before the label, such as the temperature orb. */
  lead?: ReactNode;
  /** A short text tag, such as "Scenario default". */
  tag?: string;
}

interface ChoiceGroupProps<T extends string> {
  /** Shared by the radio inputs; keep it unique on the page. */
  name: string;
  legend: string;
  /** Keep the legend for screen readers only when a heading already says the same thing. */
  hideLegend?: boolean;
  hint?: string;
  value: T;
  options: readonly ChoiceOption<T>[];
  onChange(value: T): void;
  columns?: 1 | 2 | 3;
  disabled?: boolean;
}

/**
 * One decision as a set of large selectable cards. Each card is a real radio input (visually hidden
 * but focusable), so arrow keys, Space and screen readers work as they do for any radio group.
 */
export function ChoiceGroup<T extends string>({
  name,
  legend,
  hideLegend = false,
  hint,
  value,
  options,
  onChange,
  columns = 1,
  disabled = false,
}: ChoiceGroupProps<T>) {
  const baseId = useId();
  const hintId = `${baseId}-hint`;
  return (
    <fieldset
      className="stp-choices"
      disabled={disabled}
      aria-describedby={hint ? hintId : undefined}
    >
      <legend className={hideLegend ? 'sr-only' : 'stp-legend'}>{legend}</legend>
      {hint ? (
        <p id={hintId} className="stp-hint">
          {hint}
        </p>
      ) : null}
      <div className="stp-choice-grid" data-columns={columns}>
        {options.map((option) => {
          const id = `${baseId}-${option.value}`;
          const describedBy = [
            option.description ? `${id}-desc` : null,
            option.tag ? `${id}-tag` : null,
            option.detail ? `${id}-detail` : null,
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <label key={option.value} className="option stp-choice">
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                aria-labelledby={`${id}-title`}
                aria-describedby={describedBy || undefined}
              />
              <span className="option-check" aria-hidden="true" />
              <span className="stp-choice-body">
                <span className="stp-choice-head">
                  {option.lead}
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
                {option.detail ? (
                  <span id={`${id}-detail`} className="stp-choice-detail">
                    {option.detail}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
