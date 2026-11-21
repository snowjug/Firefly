import { useId, useLayoutEffect, useRef } from 'react';
import { slidePip } from './motion.ts';
import '../../styles/frame.css';

export interface ChoiceOption {
  value: string;
  label: string;
  /** Said under the row while this option is chosen, and read with it by screen readers. */
  hint?: string;
  disabled?: boolean;
}

/**
 * One decision as a row of serif words on a hairline; the chosen word is full ink with an amber
 * point under it, which slides from the old choice to the new one. Each word is a real radio input
 * (visually hidden, still focusable), so arrow keys, Space and screen readers work as they do for
 * any radio group. The fieldset is named by `legend`; the chosen option's hint describes the chosen
 * radio, and the space for the longest hint is kept so the page does not move when the choice does.
 * Words wrap onto more lines on narrow screens.
 */
export function ChoiceRow({
  legend,
  name,
  value,
  options,
  onChange,
  size = 'display',
  describedBy,
  disabled = false,
}: {
  legend: string;
  /** Shared by the radios; keep it unique on the page. */
  name: string;
  value: string;
  options: readonly ChoiceOption[];
  onChange(value: string): void;
  /** `display` for the large words of a calibration; `text` where many rows share a page. */
  size?: 'display' | 'text';
  /** Id(s) of other text that describes the whole group. */
  describedBy?: string;
  disabled?: boolean;
}) {
  const hintId = useId();
  const fieldset = useRef<HTMLFieldSetElement>(null);
  const previous = useRef<HTMLElement | null>(null);
  const hasHints = options.some((option) => option.hint);

  useLayoutEffect(() => {
    const mark = fieldset.current?.querySelector<HTMLElement>('input:checked ~ .ff-choice__mark');
    if (!mark) return;
    slidePip(previous.current, mark);
    previous.current = mark;
  }, [value]);

  return (
    <fieldset
      ref={fieldset}
      className="ff-choice"
      data-size={size}
      disabled={disabled}
      aria-describedby={describedBy}
    >
      <legend className="ff-choice__legend type-label">{legend}</legend>
      <div className="ff-choice__opts">
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label key={option.value} className="ff-choice__opt">
              <input
                type="radio"
                className="ff-choice__input"
                name={name}
                value={option.value}
                checked={checked}
                disabled={option.disabled}
                aria-describedby={checked && option.hint ? hintId : undefined}
                onChange={() => onChange(option.value)}
              />
              <span className="ff-choice__word">{option.label}</span>
              <span className="ff-choice__mark" aria-hidden="true" />
            </label>
          );
        })}
      </div>
      {hasHints ? (
        <div className="ff-choice__hints">
          {options.map((option) =>
            option.hint ? (
              <p
                key={option.value}
                id={option.value === value ? hintId : undefined}
                className="ff-choice__hint"
                data-on={option.value === value ? '' : undefined}
              >
                {option.hint}
              </p>
            ) : null,
          )}
        </div>
      ) : null}
    </fieldset>
  );
}
